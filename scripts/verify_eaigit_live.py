#!/usr/bin/env python3
"""Bewijs dat de losstaande EAIgit-wizard na Theory7-uitrol werkelijk online is."""
from __future__ import annotations

import argparse
import hashlib
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

FILES = (
    "tools/eaigit/index.html",
    "tools/eaigit/hulp/index.html",
    "tools/eaigit/prompts/index.html",
    "tools/projecthulp/index.html",
    "assets/eaigit/wizard.mjs",
    "assets/projecthulp/analyse.mjs",
    "assets/projecthulp/inhoudscontrole.mjs",
    "assets/projecthulp/onderzoek-worker.mjs",
)


def fetch(url: str) -> bytes:
    request = Request(
        url,
        headers={"Cache-Control": "no-cache", "User-Agent": "EAI-release-check/1.0"},
    )
    with urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}: {url}")
        return response.read()


def check(root: Path, base: str, fetcher=fetch) -> None:
    for relative in FILES:
        local = root / relative
        if not local.is_file() or not local.stat().st_size:
            raise FileNotFoundError(f"EAIgit ontbreekt in de build: {relative}")
        remote = fetcher(base.rstrip("/") + "/" + relative)
        if hashlib.sha256(remote).digest() != hashlib.sha256(local.read_bytes()).digest():
            raise RuntimeError(f"Live-bestand verschilt van gebouwde release: {relative}")
        print(f"EAIgit live gelijk aan build: {relative}")


def verify(root: Path, base: str, timeout: int, fetcher=fetch, pause=time.sleep) -> None:
    destination = urlsplit(base)
    if destination.scheme != "https" or destination.netloc not in ("eaimodel.nl", "www.eaimodel.nl"):
        raise ValueError("Alleen de productie-HTTPS-domeinen van EAI zijn toegestaan")
    deadline = time.monotonic() + timeout
    while True:
        try:
            check(root, base, fetcher)
            return
        except (OSError, RuntimeError) as error:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"Publicatie niet bevestigd: {error}") from error
            print(f"Online bestanden nog niet gelijk: {error}")
            pause(min(4, max(0, deadline - time.monotonic())))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("site-build"))
    parser.add_argument("--url", default="https://eaimodel.nl")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()
    verify(args.root, args.url, args.timeout)
