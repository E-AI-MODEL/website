#!/usr/bin/env python3
"""Preserve public image assets from the user's existing LLMscan before switching hosts.

Runs in a GitHub Actions runner with HTTPS access. Commits happen only after all
required assets have been downloaded successfully. This is a one-time migration,
not a continuing dependency on the old Sites host.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "nl" / "llmscan"
ORIGIN = "https://eai-llmscan.werkruimte-s-2100.chatgpt.site/"
MAX_BYTES = 6_000_000


def main() -> None:
    seed_js = (ROOT / "catalogue.js").read_text(encoding="utf-8")
    data = json.loads(seed_js.split("window.__LLMSCAN_SEED=", 1)[1].rsplit(";", 1)[0])
    files: set[str] = {"icon.svg", "logo.svg", "classroom-hero.png"}
    files.update(data.get("provider_assets", {}).values())
    for visual in data.get("catalogue_visuals", {}).values():
        if isinstance(visual, dict) and visual.get("path"):
            files.add(visual["path"])
    for entry in files:
        if not re.fullmatch(r"(?:brands/|catalogue/)?[A-Za-z0-9_.-]+\.(?:svg|png|webp|ico)", entry):
            raise ValueError(f"Unexpected asset path: {entry!r}")
    contents = {}
    for relative in sorted(files):
        target = ROOT / relative
        if target.exists() and target.stat().st_size:
            continue
        url = ORIGIN + relative
        req = urllib.request.Request(url, headers={"User-Agent": "EAI-LLMscan-Migration/1.0"})
        with urllib.request.urlopen(req, timeout=25) as response:
            mime = response.headers.get("Content-Type", "").split(";")[0]
            if mime not in {"image/svg+xml", "image/png", "image/webp", "image/x-icon", "image/vnd.microsoft.icon", "application/octet-stream"}:
                raise ValueError(f"Unexpected MIME type: {relative} / {mime}")
            buf = response.read(MAX_BYTES + 1)
            if not buf or len(buf) > MAX_BYTES:
                raise ValueError(f"Image missing or too big: {relative}")
            extension = relative.rsplit(".", 1)[-1].lower()
            signatures = {
                "png": buf.startswith(bytes.fromhex("89504e470d0a1a0a")),
                "webp": buf.startswith(b"RIFF") and buf[8:12] == b"WEBP",
                "ico": buf.startswith(bytes.fromhex("00000100")) or buf.startswith(bytes.fromhex("89504e470d0a1a0a")),
                "svg": b"<svg" in buf[:2048].lower() and b"</svg>" in buf[-512:].lower(),
            }
            if not signatures.get(extension, False):
                raise ValueError(f"Image content does not match file extension: {relative} / {mime}")
            contents[relative] = buf
    for relative, blob in contents.items():
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(blob)
    # Switch to local paths only after verifying every original image.
    app = ROOT / "app.js"
    app_js = app.read_text(encoding="utf-8")
    app_js = app_js.replace("'https://eai-llmscan.werkruimte-s-2100.chatgpt.site/'+path", "path")
    app.write_text(app_js, encoding="utf-8")
    html_file = ROOT / "index.html"
    html = html_file.read_text(encoding="utf-8")
    for relative in files:
        html = html.replace(ORIGIN + relative, relative)
    html_file.write_text(html, encoding="utf-8")
    print(f"Downloaded {len(contents)} missing images; {len(files)} images are local.")


if __name__ == "__main__":
    main()
