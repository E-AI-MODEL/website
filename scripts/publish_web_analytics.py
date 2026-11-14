#!/usr/bin/env python3
"""Publish a small, privacy-filtered Web Analytics snapshot for eaimodel.nl.

Only aggregate RUM metrics leave the authenticated build environment.
Never expose the Cloudflare API token to the browser or repository.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://api.cloudflare.com/client/v4/graphql"
PUBLIC_HOSTS = {"eaimodel.nl", "www.eaimodel.nl"}
PRIVATE_SEGMENTS = {
    "admin", "auth", "login", "logout", "private", "continue", "backoffice",
    "account", "accounts", "profile", "profiel", "dashboard", "api", "leif",
}
PUBLIC_PREFIXES = {
    "nl", "en", "tools", "publicaties", "onderwijs", "onderzoek", "kennis",
    "over", "toepassingen", "verdieping", "praktijk", "werkvormen",
    "taalwerkvormen", "bronnen", "onderbouwing", "model-monitor",
    "statistieken", "twee-pijlers", "workshop-ai", "eaa-model",
}
QUERY = """
query PublicAnalytics($account: String!, $site: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      daily: rumPageloadEventsAdaptiveGroups(
        limit: 100, orderBy: [date_ASC],
        filter: { siteTag: $site, datetime_geq: $start, datetime_lt: $end }
      ) {
        count
        sum { visits }
        dimensions { date requestHost }
      }
      paths: rumPageloadEventsAdaptiveGroups(
        limit: 500, orderBy: [count_DESC],
        filter: { siteTag: $site, datetime_geq: $start, datetime_lt: $end }
      ) {
        count
        dimensions { requestHost requestPath }
      }
      referrers: rumPageloadEventsAdaptiveGroups(
        limit: 200, orderBy: [count_DESC],
        filter: { siteTag: $site, datetime_geq: $start, datetime_lt: $end }
      ) {
        count
        dimensions { requestHost refererHost }
      }
    }
  }
}
"""


def number(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("Cloudflare gaf een ongeldige teller terug")
    if value < 0 or value != value or value == float("inf"):
        raise ValueError("Cloudflare gaf een ongeldige teller terug")
    return int(value)


def public_path(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 120:
        return None
    if value == "/":
        return "/"
    if not re.fullmatch(r"/[a-zA-Z0-9/_-]+/?", value):
        return None
    segments = [part.lower() for part in value.split("/") if part]
    if not segments or segments[0] not in PUBLIC_PREFIXES:
        return None
    if any(seg in PRIVATE_SEGMENTS or seg.startswith(".") for seg in segments):
        return None
    if any(len(seg) > 55 for seg in segments):
        return None
    return value if value.endswith("/") else value + "/"


def summarize(data: dict, start: datetime, end: datetime) -> dict:
    """Convert the Cloudflare response to deliberately limited public totals."""
    if data.get("errors"):
        raise ValueError("Cloudflare GraphQL-fout: " + str(data["errors"])[:250])
    try:
        accounts = data["data"]["viewer"]["accounts"]
        account = accounts[0]
        daily = account["daily"]
        paths = account["paths"]
        referrers = account["referrers"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Cloudflare antwoord mist Web Analytics-gegevens") from exc
    if not isinstance(daily, list) or not isinstance(paths, list) or not isinstance(referrers, list):
        raise ValueError("Cloudflare antwoord heeft ongeldige groepen")

    counts = defaultdict(lambda: {"views": 0, "visits": 0})
    for row in daily:
        dimensions = row["dimensions"]
        if dimensions.get("requestHost", "").lower() not in PUBLIC_HOSTS:
            continue
        date = dimensions["date"]
        if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise ValueError("Cloudflare gaf een ongeldige datum terug")
        counts[date]["views"] += number(row["count"])
        counts[date]["visits"] += number(row["sum"]["visits"])

    pages = Counter()
    for row in paths:
        dims = row["dimensions"]
        if dims.get("requestHost", "").lower() not in PUBLIC_HOSTS:
            continue
        path = public_path(dims.get("requestPath"))
        if path:
            pages[path] += number(row["count"])

    sources = Counter()
    for row in referrers:
        dims = row["dimensions"]
        if dims.get("requestHost", "").lower() not in PUBLIC_HOSTS:
            continue
        host = dims.get("refererHost") or ""
        if not isinstance(host, str):
            continue
        host = host.lower().strip().rstrip(".")
        if host in PUBLIC_HOSTS or not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,100}", host):
            continue
        sources[host] += number(row["count"])

    series = []
    cursor = start.date()
    while cursor < end.date():
        date = cursor.isoformat()
        series.append({"date": date, **counts[date]})
        cursor += timedelta(days=1)
    return {
        "schema": 1,
        "source": "Cloudflare Web Analytics (RUM)",
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "period": {"from": start.date().isoformat(), "through": (end - timedelta(days=1)).date().isoformat()},
        "views": sum(day["views"] for day in series),
        "visits": sum(day["visits"] for day in series),
        "daily": series,
        "pages": [{"path": path, "views": views} for path, views in pages.most_common(10) if views >= 5],
        "referrers": [{"host": host, "views": views} for host, views in sources.most_common(8) if views >= 5],
        "notes": [
            "Bezoeken zijn geen unieke personen.",
            "Cloudflare Web Analytics meet geladen pagina's in browsers met JavaScript; cijfers kunnen door steekproeven afwijken.",
            "Bouncepercentage en interacties binnen een simulatie worden hier niet gemeten."
        ],
    }


def fetch() -> dict:
    token = os.environ["CLOUDFLARE_ANALYTICS_TOKEN"]
    account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    site = os.environ["CLOUDFLARE_SITE_TAG"]
    if not token or not account or not site:
        raise ValueError("Cloudflare-gegevens ontbreken")
    now = datetime.now(timezone.utc)
    # A rolling calendar-month view, including the current partial day.
    start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    payload = json.dumps({
        "query": QUERY,
        "variables": {"account": account, "site": site, "start": start.isoformat().replace("+00:00", "Z"), "end": end.isoformat().replace("+00:00", "Z")},
    }).encode("utf-8")
    req = urllib.request.Request(API, data=payload, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "EAI-public-analytics/1.0",
    }, method="POST")
    with urllib.request.urlopen(req, timeout=25) as response:
        raw = json.loads(response.read(2_000_000).decode("utf-8"))
    return summarize(raw, start, end)


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "statistieken/data.json")
    result = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    # Atomically replace the previous successful snapshot. Never publish partial data.
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)
    print("Publicatieklaar:", result["visits"], "bezoeken in", len(result["daily"]), "dagen")


if __name__ == "__main__":
    main()
