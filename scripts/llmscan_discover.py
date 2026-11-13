#!/usr/bin/env python3
"""Collect possible new AI-education papers for human review.

The output is a candidate list, not a published evidence claim. Only trusted
primary-source metadata is retained; publication requires a later evidence review.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.openalex.org/works"
TERMS = ("generative ai", "generative artificial intelligence", "large language model", "llm", "chatgpt", "ai tutor", "ai tutoring")
LEARNING = ("learn", "student", "educat", "teach", "tutor", "feedback", "retention", "transfer", "math", "writing", "science", "classroom", "assessment")


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "EAI-LLMscan-source-discovery/1.0 (https://eaimodel.nl/)", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)


def candidate(work: dict) -> dict | None:
    title = work.get("title") or ""
    abstract_index = work.get("abstract_inverted_index") or {}
    term_text = " ".join([title] + list(abstract_index.keys())).lower()
    if not any(term in term_text for term in TERMS) or not any(term in term_text for term in LEARNING):
        return None
    doi = (work.get("doi") or "").lower()
    if doi and not doi.startswith("https://doi.org/"):
        return None
    work_id = work.get("id", "")
    pub = work.get("primary_location") or {}
    url = doi or (pub.get("landing_page_url") or work_id)
    if not (isinstance(url, str) and url.startswith("https://")):
        return None
    authors = [x.get("author", {}).get("display_name", "") for x in work.get("authorships", [])[:6]]
    return {
        "id": doi or work_id,
        "title": title,
        "authors": [a for a in authors if a],
        "date": work.get("publication_date"),
        "type": work.get("type"),
        "source_url": url,
        "openalex_id": work_id,
        "status": "kandidaat - niet inhoudelijk beoordeeld",
        "needs_review": ["Volledige bron", "Onderzoeksopzet en comparator", "Zelfstandige uitkomst", "Meetmoment", "Didactische betekenis"],
    }


def collect(today: dt.date, days: int) -> dict:
    since = today - dt.timedelta(days=days)
    found: dict[str, dict] = {}
    queries = ("large language model education learning", "generative AI tutoring feedback mathematics", "ChatGPT writing learning retention transfer")
    errors = []
    for term in queries:
        params = urllib.parse.urlencode({
            "search": term,
            "filter": f"from_publication_date:{since.isoformat()},to_publication_date:{today.isoformat()}",
            "per-page": 50,
        })
        try:
            response = fetch(API + "?" + params)
            for work in response.get("results", []):
                c = candidate(work)
                if c:
                    found[c["id"]] = c
        except Exception as exc:
            errors.append(f"{term}: {type(exc).__name__}: {exc}")
    if errors and not found:
        raise RuntimeError("Source discovery failed for all queries: " + " | ".join(errors))
    return {"scanned": today.isoformat(), "window_start": since.isoformat(), "review_required": True, "items": sorted(found.values(), key=lambda c: (c.get("date") or "", c["title"]), reverse=True), "source_errors": errors}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--output", type=Path, default=Path("content/llmscan-discovery-candidates.json"))
    args = parser.parse_args()
    if not 1 <= args.days <= 30:
        parser.error("--days must be between 1 and 30")
    data = collect(dt.datetime.now(dt.timezone.utc).date(), args.days)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Collected {len(data['items'])} candidates; {len(data['source_errors'])} source errors. Nothing was published.")


if __name__ == "__main__":
    main()
