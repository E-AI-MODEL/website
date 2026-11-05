#!/usr/bin/env python3
"""Haal bewust een vastgelegde WiHTML-versie uit GitHub.

Dit is een onderhoudsactie, geen verzoek aan GitHub tijdens het lesgeven.
De website gebruikt een bronkopie zodat bezoekers geen GitHub-login nodig hebben.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import hashlib
import re
import urllib.request

DEST = Path(__file__).resolve().parents[1] / "content/wihtml/studio.html"
REPO = "https://raw.githubusercontent.com/E-AI-MODEL/wihtml"
MARKERS = ('id="templateDialog"', 'id="preview"', 'id="export"',
           'id="toolbtn"', 'id="templateDownload"')

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True, help="Volledige commit SHA van wihtml")
    parser.add_argument("--write", action="store_true", help="Bronkopie bijwerken")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        parser.error("Gebruik een volledige Git-commit SHA, geen branchnaam.")
    url = f"{REPO}/{args.commit}/index.html"
    with urllib.request.urlopen(urllib.request.Request(
            url, headers={"User-Agent": "WiHTML-website-source-sync"}), timeout=25) as r:
        data = r.read(1_000_000)
    content = data.decode("utf-8")
    if not content.lower().startswith("<!doctype html") or not all(x in content for x in MARKERS):
        raise SystemExit("Bron voldoet niet aan de WiHTML-interface; niets gewijzigd.")
    digest = hashlib.sha256(data).hexdigest()
    if args.write:
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(data)
        print(f"Bijgewerkt vanaf {args.commit}\nSHA256 {digest}\nControleer de diff en open een PR.")
    else:
        local = DEST.read_bytes() if DEST.exists() else b""
        print(f"GitHub commit: {args.commit}\nSHA256: {digest}")
        if local != data:
            raise SystemExit("De websitekopie verschilt. Gebruik --write na beoordeling.")
        print("De websitekopie komt overeen.")

if __name__ == "__main__":
    main()
