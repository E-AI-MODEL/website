#!/usr/bin/env python3
"""Find primary-source paper candidates for EAI LLMscan.

Crossref and arXiv are searched without a paid API key. Results are only
candidates; nothing is added to the public site without checking the paper.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

TERMS = ("generative ai", "generative artificial intelligence", "large language model", "llm", "chatgpt", "ai tutor", "ai tutoring", "ai-generated", "ai assisted", "ai-assisted")
LEARNING = ("learn", "student", "educat", "teach", "tutor", "feedback", "retention", "transfer", "math", "writing", "science", "classroom", "assessment", "self-regulat")
UA = "EAI-LLMscan/1.0 (https://eaimodel.nl/)"


def read_url(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, application/atom+xml"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read(4_000_001)


def relevant(text: str) -> bool:
    value = re.sub(r"\s+", " ", text).lower()
    return any(term in value for term in TERMS) and any(term in value for term in LEARNING)


def author_names(authors: list) -> list[str]:
    return [(" ".join(filter(None, [a.get("given"), a.get("family")])).strip()) for a in authors[:6] if a.get("given") or a.get("family")]


def crossref(since: dt.date, today: dt.date) -> list[dict]:
    all_found: dict[str, dict] = {}
    for query in ("large language model education", "generative AI tutoring mathematics", "ChatGPT feedback learning"):
        params = urllib.parse.urlencode({
            "filter": f"from-pub-date:{since.isoformat()},until-pub-date:{today.isoformat()}",
            "query.title": query,
            "rows": 40,
            "select": "DOI,title,author,published,type,URL,abstract"
        })
        data = json.loads(read_url("https://api.crossref.org/works?" + params))
        for work in data.get("message", {}).get("items", []):
            title = (work.get("title") or [""])[0]
            if not relevant(title):
                continue
            doi = (work.get("DOI") or "").lower().strip()
            if not doi:
                continue
            published = work.get("published", {}).get("date-parts", [[None]])[0]
            date = "-".join(str(x).zfill(2) if i else str(x) for i,x in enumerate(published)) if published and published[0] else ""
            all_found[doi] = {
                "id": "doi:" + doi, "title": title, "authors": author_names(work.get("author") or []),
                "date": date, "source_url": "https://doi.org/" + doi,
                "source": "Crossref", "status": "kandidaat - niet inhoudelijk beoordeeld"
            }
    return list(all_found.values())


def arxiv(since: dt.date, today: dt.date) -> list[dict]:
    query = '(all:"large language model" AND all:education) OR (all:"generative AI" AND all:learning)'
    params = urllib.parse.urlencode({"search_query": query, "start": 0, "max_results": 80, "sortBy": "submittedDate", "sortOrder": "descending"})
    root = ET.fromstring(read_url("https://export.arxiv.org/api/query?" + params))
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items = []
    for entry in root.findall("atom:entry", ns):
        title = " ".join((entry.findtext("atom:title", default="", namespaces=ns)).split())
        summary = entry.findtext("atom:summary", default="", namespaces=ns)
        posted = entry.findtext("atom:published", default="", namespaces=ns)[:10]
        if not posted or posted < since.isoformat() or posted > today.isoformat() or not relevant(title + " " + summary):
            continue
        url = entry.findtext("atom:id", default="", namespaces=ns)
        if not url.startswith("https://arxiv.org/abs/") and not url.startswith("http://arxiv.org/abs/"):
            continue
        url = url.replace("http://", "https://")
        authors = [a.findtext("atom:name", default="", namespaces=ns) for a in entry.findall("atom:author", ns)]
        items.append({"id": "arxiv:" + url.rsplit("/", 1)[-1].split("v")[0], "title": title, "authors": authors[:6],
                      "date": posted, "source_url": url, "source": "arXiv", "status": "kandidaat - niet inhoudelijk beoordeeld"})
    return items


def collect(today: dt.date, days: int) -> dict:
    since = today - dt.timedelta(days=days)
    errors = []
    papers = {}
    for provider in (crossref, arxiv):
        try:
            for paper in provider(since, today):
                papers[paper["id"]] = paper
        except Exception as exc:
            errors.append(f"{provider.__name__}: {type(exc).__name__}: {exc}")
    if len(errors) == 2:
        raise RuntimeError("Both primary-source feeds failed: " + " | ".join(errors))
    return {"scanned": today.isoformat(), "window_start": since.isoformat(), "review_required": True,
            "items": sorted(papers.values(), key=lambda p: (p.get("date") or "", p["title"]), reverse=True),
            "source_errors": errors}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--output", type=Path, default=Path("content/llmscan-discovery-candidates.json"))
    args = parser.parse_args()
    if not 1 <= args.days <= 30:
        parser.error("--days must be between 1 and 30")
    result = collect(dt.datetime.now(dt.timezone.utc).date(), args.days)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Found {len(result['items'])} paper candidates; {len(result['source_errors'])} source errors. Nothing published.")


if __name__ == "__main__":
    main()
