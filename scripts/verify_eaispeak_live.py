"""Byte-check the standalone EAIspeak release, including its compatibility redirect."""
import argparse
import hashlib
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from verify_ui import html_matches_release

def verify(root, base):
    app = root / "tools/eaispeak"
    old = root / "tools/delf-live/index.html"
    assert (app / "index.html").is_file() and old.is_file()
    assert not (app / "audio").exists()
    paths = sorted(p for p in app.rglob("*") if p.is_file()) + [old]
    assert len(paths) > 3
    for path in paths:
        relative = path.relative_to(root).as_posix()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        route = relative.removesuffix("index.html") if path.name == "index.html" else relative
        for attempt in range(5):
            try:
                url = base.rstrip("/") + "/" + quote(route) + "?eai_release=" + digest[:16]
                with urlopen(Request(url, headers={"Cache-Control":"no-cache","User-Agent":"EAIspeak-release-check/1.0"}), timeout=60) as response:
                    assert response.status == 200, relative
                    data = response.read()
                matches = html_matches_release(data,digest)[0] if path.suffix == ".html" else hashlib.sha256(data).hexdigest() == digest
                assert matches, relative + " differs"
                print("OK", relative, digest, flush=True)
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(3)

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--url",required=True)
    args=parser.parse_args()
    verify(args.root,args.url)
