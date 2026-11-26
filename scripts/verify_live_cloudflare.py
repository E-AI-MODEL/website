"""Read-only verification of the public Cloudflare Web Analytics beacon.

A failed HTTP request is not evidence that the beacon is missing.
"""
import json
import os
from html.parser import HTMLParser
from pathlib import Path
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

EXPECTED_URL = "https://static.cloudflareinsights.com/beacon.min.js"
EXPECTED_TOKEN = "1aa5d5810d5a48e7bb8e5b2bac573e74"
ROUTES = (
    ("eaimodel.nl", "/"),
    ("eaimodel.nl", "/nl/"),
    ("eaimodel.nl", "/statistieken/"),
    ("www.eaimodel.nl", "/nl/"),
)
HEADERS = {
    "Cache-Control": "no-cache",
    "User-Agent": "EAI-release-check/1.0",
    "Accept": "text/html,application/xhtml+xml",
}


class BeaconParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.found = False

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        attrs = dict(attrs)
        src = urlsplit(attrs.get("src") or "")
        if (src.scheme, src.netloc, src.path) != (
            "https", "static.cloudflareinsights.com", "/beacon.min.js"
        ):
            return
        try:
            value = json.loads(attrs.get("data-cf-beacon") or "")
        except (ValueError, TypeError):
            return
        if isinstance(value, dict) and value.get("token") == EXPECTED_TOKEN:
            self.found = True


def has_beacon(html):
    parser = BeaconParser()
    parser.feed(html)
    parser.close()
    return parser.found


def check_route(domain, path, run_id, opener=urlopen, pause=sleep):
    url = f"https://{domain}{path}?eai_beacon_check={run_id}"
    problem = ""
    for attempt in range(3):
        try:
            with opener(Request(url, headers=HEADERS), timeout=18) as response:
                target = urlsplit(response.geturl())
                if target.scheme != "https" or target.hostname not in {"eaimodel.nl", "www.eaimodel.nl"}:
                    problem = "onverwachte eind-URL: " + response.geturl()
                elif response.status != 200:
                    problem = f"HTTP {response.status}"
                elif not has_beacon(response.read(1_000_000).decode("utf-8", "replace")):
                    problem = "HTTP 200, juiste beacon ontbreekt"
                else:
                    print(f"{domain}{path}: HTTP 200, juiste beacon aanwezig", flush=True)
                    return None
        except HTTPError as exc:
            try:
                problem = f"HTTP {exc.code} {exc.reason}; CF-Ray={exc.headers.get('CF-Ray', '-') if exc.headers else '-'}"
            finally:
                exc.close()
        except (URLError, TimeoutError, OSError) as exc:
            problem = f"{type(exc).__name__}: {exc}"
        print(f"{domain}{path}: poging {attempt+1}/3: {problem}", flush=True)
        if attempt < 2:
            pause(3)
    return f"https://{domain}{path}: {problem}"


def main():
    source = Path("scripts/build_site.py").read_text(encoding="utf-8")
    if EXPECTED_URL not in source or EXPECTED_TOKEN not in source:
        raise SystemExit("De verwachte meetcode ontbreekt in de websitebouw.")
    run_id = os.environ["GITHUB_RUN_ID"]
    if not run_id.isdecimal():
        raise SystemExit("Ongeldig GitHub-runnummer.")
    problems = [error for domain, path in ROUTES
                if (error := check_route(domain, path, run_id))]
    if problems:
        raise SystemExit("Live Cloudflare-controle mislukt:\n" + "\n".join(problems))
    print("Cloudflare-meetcode live gecontroleerd voor beide domeinnamen.")


if __name__ == "__main__":
    main()
