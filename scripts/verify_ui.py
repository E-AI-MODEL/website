"""Validate the release and every prepared production HTML file and asset hash."""
from __future__ import annotations
import argparse
import hashlib
import json
import time
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup


def check(root: Path):
    manifest = json.loads((root / 'assets/ui-manifest.json').read_text())
    assert manifest['pages'], 'No pages were prepared'
    for name, info in manifest['assets'].items():
        data = (root / info['url'].lstrip('/')).read_bytes()
        assert hashlib.sha256(data).hexdigest() == info['sha256'], name
    for rel in manifest['pages']:
        soup = BeautifulSoup((root / rel).read_text(), 'html.parser')
        assert len(soup.select('header.eai-masthead')) == 1, rel
        assert not soup.select('header .eai-links'), rel
        assert len(soup.select('.eai-site-menu')) == 1, rel
        assert len(soup.select('.eai-site-group')) == 5, rel
        assert len(soup.select('.eai-site-language a')) == 2, rel
        assert len(soup.select('h1')) == 1, rel
        ids = [tag['id'] for tag in soup.select('[id]')]
        assert len(ids) == len(set(ids)), f'Duplicate id: {rel}'
        for tag in soup.select('[href], [src]'):
            url = tag.get('href') or tag.get('src')
            if not url.startswith('/') or url.startswith('//'):
                continue
            path = urlsplit(url).path.lstrip('/')
            candidate = root / path
            if not path or path.endswith('/'):
                candidate = candidate / 'index.html'
            assert candidate.is_file(), f'{rel}: missing {url}'
        for info in manifest['assets'].values():
            assert soup.find(src=info['url']) or soup.find(href=info['url']), (rel, info['url'])
        assert not soup.find(href='/assets/site.css'), rel
        assert not soup.find(src='/assets/site-refresh.js'), rel
    handoff = root / 'houseoftalents/index.html'
    if handoff.exists():
        assert 'data-ui-version' not in handoff.read_text(), 'Handoff must be untouched'
    print(f'UI validation passed: {len(manifest["pages"])} pages, {len(manifest["assets"])} fingerprinted assets')
    return manifest


def expected_pages(root: Path, manifest: dict) -> dict[str, str]:
    """Use every prepared page; keep aliases distinct and map index files to URLs."""
    pages = manifest.get('pages', [])
    if not pages:
        raise ValueError('Cannot verify an empty release manifest')
    expected = {}
    for relative in pages:
        path = PurePosixPath(relative)
        if path.is_absolute() or '..' in path.parts or path.suffix != '.html':
            raise ValueError(f'Invalid release page: {relative}')
        local = root / path.as_posix()
        if path.name == 'index.html':
            parent = path.parent.as_posix()
            url = '/' if parent == '.' else '/' + parent + '/'
        else:
            url = '/' + path.as_posix()
        if url in expected:
            raise ValueError(f'Duplicate release route: {url}')
        expected[url] = hashlib.sha256(local.read_bytes()).hexdigest()
    return expected


def verify_live(base: str, manifest: dict, timeout: int, root: Path):
    def get(path):
        request = Request(base.rstrip('/') + path, headers={'Cache-Control': 'no-cache', 'User-Agent': 'EAI-release-check/1.0'})
        with urlopen(request, timeout=20) as response:
            return response.read()
    # Same UI assets can accompany changed page copy. Verify every generated
    # page's exact bytes, rather than a fixed sample or the UI version alone.
    expected_html = expected_pages(root, manifest)
    deadline = time.monotonic() + timeout
    while True:
        try:
            for path, digest in expected_html.items():
                data = get(path)
                assert hashlib.sha256(data).hexdigest() == digest, f'HTML content mismatch: {path}'
                soup = BeautifulSoup(data, 'html.parser')
                assert soup.body.get('data-ui-version') == manifest['version'], f'Stale UI: {path}'
                assert soup.select_one('.eai-site-menu'), path
            for info in manifest['assets'].values():
                assert hashlib.sha256(get(info['url'])).hexdigest() == info['sha256'], f'Asset mismatch: {info["url"]}'
            print(f'LIVE verified: all {len(expected_html)} prepared HTML files and all asset hashes match UI {manifest["version"]}')
            return
        except Exception as exc:
            if time.monotonic() >= deadline:
                raise RuntimeError(f'Live release not confirmed: {exc}') from exc
            print(f'Waiting for matching release: {exc}', flush=True)
            time.sleep(5)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('site-build'))
    parser.add_argument('--url')
    parser.add_argument('--timeout', type=int, default=60)
    args = parser.parse_args()
    manifest = check(args.root)
    if args.url:
        verify_live(args.url, manifest, args.timeout, args.root)
