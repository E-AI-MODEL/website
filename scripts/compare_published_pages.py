#!/usr/bin/env python3
"""Vergelijk de gebouwde site met de actuele FTPS-documentroot. Alleen lezen."""
from __future__ import annotations
import argparse
import concurrent.futures
import json
import re
import sys
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

SITE = "https://eaimodel.nl"
# Deze mappen hebben eigen publicatieworkflows; geen opruimadvies genereren.
SEPARATE = {"topo": "TOPO (eigen publicatie)", "tools/delf-live": "DELF (eigen publicatie)"}
PRIVATE = {".git", ".github", ".well-known", "admin", "private", "cgi-bin", "node_modules",
           "backup", "backups", "backend", "logs", "cache", "tmp", "temp", "uploads",
           "secrets", "staging", "test-results", "beheer", "mijn", "account", "auth"}


def normalize_path(text: str) -> str | None:
    name = text.strip().replace("\\", "/")
    if name.startswith("./"):
        name = name[2:]
    name = name.lstrip("/")
    parts = PurePosixPath(name).parts
    if (not name.lower().endswith(".html") or not parts or "//" in name
            or any(part in {".", ".."} or part.startswith(".") for part in parts)
            or any(ord(char) < 32 for char in name) or len(name) > 500):
        return None
    return name


def owner(path: str) -> str:
    for prefix, label in SEPARATE.items():
        if path.startswith(prefix + "/"):
            return label
    return "Algemene website"


def url_for(path: str) -> str:
    if path == "index.html":
        return "/"
    return "/" + path[:-10] if path.endswith("/index.html") else "/" + path


def readable_html(blob: bytes) -> dict:
    soup = BeautifulSoup(blob, "html.parser")
    tag = soup.find("link", rel=lambda rel: rel and "canonical" in rel)
    canonical = tag.get("href") if tag else None
    node = soup.main or soup.body
    grams = set()
    if node:
        fragment = BeautifulSoup(str(node), "html.parser")
        for element in fragment.select("script,style,nav,header,footer,template,svg,noscript"):
            element.decompose()
        words = re.findall(r"[\w]+", fragment.get_text(" ", strip=True).casefold())
        grams = {" ".join(words[i:i + 4]) for i in range(len(words) - 3)}
    return {
        "title": soup.title.get_text(" ", strip=True) if soup.title else "",
        "canonical": canonical,
        "grams": grams,
    }


def live_probe(path: str, local: list[tuple[str, dict]]) -> dict:
    url = SITE + quote(url_for(path), safe="/.-_~")
    req = Request(url, headers={"User-Agent": "EAI-site-inventaris/1.0", "Cache-Control": "no-cache"})
    try:
        with urlopen(req, timeout=7) as response:
            if not response.geturl().startswith(SITE + "/"):
                return {"toegang": "externe_redirect"}
            if "html" not in response.headers.get("Content-Type", "").lower():
                return {"toegang": "geen_html", "http": response.status}
            blob = response.read(1000001)
            if len(blob) > 1000000:
                return {"toegang": "te_groot", "http": response.status}
            page = readable_html(blob)
            result = {"toegang": "zichtbaar", "http": response.status, "titel": page["title"],
                      "canonical": page["canonical"]}
            matches = []
            if len(page["grams"]) >= 30:
                for route, reference in local:
                    other = reference["grams"]
                    intersection = len(page["grams"] & other)
                    score = intersection / max(1, len(page["grams"] | other))
                    if score >= .91:
                        matches.append((score, route))
            if matches:
                score, route = max(matches)
                result["lijkt_op"] = route
                result["gelijkenis"] = round(score, 3)
            return result
    except HTTPError as exc:
        return {"toegang": "http_fout", "http": exc.code}
    except (URLError, TimeoutError, OSError, ValueError):
        return {"toegang": "niet_vastgesteld"}


def compare(root: Path, ftp_listing: str, http_limit: int = 30, max_depth: int | None = None) -> dict:
    if not (root / "index.html").is_file():
        raise ValueError("Geen websitebuild aanwezig")
    raw = sorted({p for row in ftp_listing.splitlines() if (p := normalize_path(row))})
    if len(raw) < 20 or len(raw) > 10000:
        raise ValueError(f"FTPS-inventaris onvolledig of onjuist: {len(raw)} HTML-bestanden")
    restricted = [p for p in raw if any(part.casefold() in PRIVATE for part in PurePosixPath(p).parts)]
    remote = set(raw) - set(restricted)
    if max_depth:
        remote = {p for p in remote if len(PurePosixPath(p).parts) <= max_depth}
    built = {p.relative_to(root).as_posix() for p in root.rglob("*.html")
             if not any(part.casefold() in PRIVATE for part in p.relative_to(root).parts)}
    if max_depth:
        built = {p for p in built if len(PurePosixPath(p).parts) <= max_depth}
    only_remote = sorted(remote - built)
    only_build = sorted(built - remote)
    expected = []
    for path in root.rglob("*.html"):
        relative = path.relative_to(root).as_posix()
        if relative not in built or path.stat().st_size > 1000000:
            continue
        page = readable_html(path.read_bytes())
        if len(page["grams"]) >= 30:
            expected.append((url_for(relative), page))
    pages = [{"bestand": p, "url": url_for(p), "beheer": owner(p)} for p in only_remote]
    candidates = [item for item in pages if item["beheer"] == "Algemene website"]
    selected = candidates[:max(0, min(http_limit, 60))]
    if selected:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(lambda item: live_probe(item["bestand"], expected), selected))
        for item, result in zip(selected, results):
            item.update(result)
    return {
        "resultaat": "onderzoek_nodig" if only_remote or only_build else "zelfde_html_routes",
        "scan_diepte": max_depth or "volledig_naar_lftp_lijst",
        "aantallen": {
            "html_op_ftp": len(raw), "html_op_website_ftp": len(remote),
            "html_in_build": len(built), "dezelfde_bestandsroute": len(remote & built),
            "alleen_ftp": len(only_remote), "alleen_build": len(only_build),
            "apart_gepubliceerd": sum(owner(p) != "Algemene website" for p in only_remote),
            "alleen_ftp_algemene_site": len(candidates),
            "via_http_gecontroleerd": len(selected),
            "http_niet_gecontroleerd": len(candidates) - len(selected),
            "afgeschermd_niet_gerapporteerd": len(restricted),
        },
        "alleen_ftp": pages,
        "alleen_build": only_build,
        "waarschuwingen": [
            "FTPS-bestanden bewijzen niet dat de URL openbaar bereikbaar is. HTTP-proeven zijn apart gemeld.",
            "Het rapport bevat geen afgeschermde bestandsnamen of inhoud.",
            "Een bestandsverschil bewijst geen inhoudelijke dubbeling. De inhoudscontrole loopt apart.",
            "Er is niets gewijzigd of verwijderd op de server.",
            *([f"De scan omvat alleen HTML-bestandsroutes tot {max_depth} niveaus; niet de hele server."] if max_depth else []),
        ],
    }


def markdown(result: dict) -> str:
    c = result["aantallen"]
    lines = ["## Server tegenover websitebuild", "",
             ("**Gedeeltelijke scan, maximaal " + str(result["scan_diepte"]) + " mapniveaus.**" if isinstance(result["scan_diepte"], int) else "**Volledige FTP-lijst tot de ingestelde scandiepte.**"),
             f"**FTPS:** {c['html_op_ftp']} HTML-bestanden. **Websitebuild:** {c['html_in_build']}. "
             f"**Zelfde pad:** {c['dezelfde_bestandsroute']}.",
             f"**Alleen op server:** {c['alleen_ftp']} (waarvan {c['apart_gepubliceerd']} apart gepubliceerd). "
             f"**Alleen in build:** {c['alleen_build']}.", "",
             "| Type | HTML-bestand | Controle |", "|---|---|---|"]
    for item in result["alleen_ftp"][:90]:
        note = item["beheer"]
        if item.get("lijkt_op"):
            note += "; lijkt op " + item["lijkt_op"] + " (" + str(round(item["gelijkenis"] * 100)) + "%)"
        elif item.get("toegang"):
            note += "; " + str(item.get("http") or item["toegang"])
        lines.append("| Server | " + item["bestand"] + " | " + note + " |")
    for name in result["alleen_build"][:40]:
        lines.append("| Build | " + name + " | Nog niet op server aangetroffen |")
    if len(result["alleen_ftp"]) > 90 or len(result["alleen_build"]) > 40:
        lines.append("\nOverige bestanden staan in het JSON-rapport.")
    lines.append("\nNiets verwijderd. Bestanden met eigen publicatie blijven ongemoeid.\n")
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, default=Path("site-build"))
    p.add_argument("--listing", type=Path, required=True)
    p.add_argument("--http-limit", type=int, default=30)
    p.add_argument("--depth", type=int, help="Beperk vergelijkingspaden tot deze mapdiepte")
    p.add_argument("--json", type=Path)
    p.add_argument("--summary", type=Path)
    args = p.parse_args()
    try:
        result = compare(args.root, args.listing.read_text(encoding="utf-8"),
                         args.http_limit, args.depth)
    except (OSError, ValueError) as exc:
        print("Serververgelijking mislukt:", exc, file=sys.stderr)
        return 1
    rendered = markdown(result)
    print(rendered)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
    if args.summary:
        with args.summary.open("a", encoding="utf-8") as stream:
            stream.write(rendered + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
