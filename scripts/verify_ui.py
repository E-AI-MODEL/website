"""Validate the release and every prepared production HTML file and asset hash."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import time
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup, Comment
from prepare_ui import STORY_PATHS, DASH_CARD_PATHS, LEGACY_HUB_REDIRECTS, canonical


def check(root: Path):
    manifest = json.loads((root / 'assets/ui-manifest.json').read_text())
    assert manifest['pages'], 'No pages were prepared'
    for name, info in manifest['assets'].items():
        data = (root / info['url'].lstrip('/')).read_bytes()
        assert hashlib.sha256(data).hexdigest() == info['sha256'], name
    for rel in manifest['pages']:
        soup = BeautifulSoup((root / rel).read_text(), 'html.parser')
        route = '/' + rel.removesuffix('index.html')
        if route in LEGACY_HUB_REDIRECTS:
            # Redirect handoffs are byte-verified on the live site like all HTML.
            # They have no shared menu because the browser immediately navigates.
            expected = LEGACY_HUB_REDIRECTS[route]
            assert soup.find('link', rel='canonical')['href'] == 'https://eaimodel.nl' + expected, rel
            assert expected in soup.find('meta', attrs={'http-equiv': 'refresh'})['content'], rel
            assert soup.select_one('main a[href]')['href'] == expected, rel
            assert 'location.search + location.hash' in (root / rel).read_text(), rel
            continue
        assert len(soup.select('header.eai-masthead')) == 1, rel
        assert not soup.select('header .eai-links'), rel
        assert len(soup.select('.eai-site-menu')) == 1, rel
        assert len(soup.select('.eai-site-group')) == 6, rel
        assert len(soup.select('.eai-site-language a')) == 2, rel
        assert len(soup.select('h1')) == 1, rel
        # Cloudflare rewrites unguarded mailto links, breaking exact HTML hashes.
        # Keep zone-wide protection on and opt out only for explicit contact links.
        for email_link in soup.select('a[href^="mailto:"]'):
            opening, closing = email_link.previous_sibling, email_link.next_sibling
            assert isinstance(opening, Comment) and opening.strip() == 'email_off', f'{rel}: unguarded mailto link'
            assert isinstance(closing, Comment) and closing.strip() == '/email_off', f'{rel}: unguarded mailto link'
        assert len(soup.select('.eai-site-primary a')) == 5, rel
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
        # Editorial stories load only on twelve explicitly permitted index pages.
        # All other shared assets remain mandatory on every prepared page.
        page_route = canonical('/' + rel)
        expected_story = page_route in STORY_PATHS
        dashboard_home = page_route in ('/nl/', '/en/') and bool(soup.select_one('main.eai-dashboard-home'))
        card_index = page_route in DASH_CARD_PATHS
        assert ('eai-story-page' in soup.body.get('class', [])) == expected_story, rel
        assert ('eai-dash-page' in soup.body.get('class', [])) == dashboard_home, rel
        assert ('eai-card-index' in soup.body.get('class', [])) == card_index, rel
        for name, info in manifest['assets'].items():
            present = bool(soup.find(src=info['url']) or soup.find(href=info['url']))
            if name in ('site-story-cards.css', 'site-story-cards.js'):
                assert present == expected_story, (rel, info['url'], expected_story)
            elif name == 'site-dashboard-cards.css':
                assert present == (dashboard_home or card_index), (rel, info['url'])
            elif name == 'site-dashboard-cards.js':
                assert present == dashboard_home, (rel, info['url'])
            else:
                assert present, (rel, info['url'])
        assert not soup.find(href='/assets/site.css'), rel
        assert not soup.find(src='/assets/site-refresh.js'), rel
    handoff = root / 'houseoftalents/index.html'
    if handoff.exists():
        assert 'data-ui-version' not in handoff.read_text(), 'Handoff must be untouched'
    # The standalone LEIF route is not part of the shared editorial UI.
    # Validate it separately so the deployment cannot silently omit it.
    leif = root / 'leif/index.html'
    assert leif.is_file(), 'Missing standalone LEIF page in deploy output'
    leif_html = leif.read_text(encoding='utf-8')
    assert '<title>LEIF' in leif_html, 'LEIF page has unexpected content'
    assert 'id="accessGate"' in leif_html, 'LEIF access screen is missing'
    continuation = root / 'leif/continue/index.html'
    assert continuation.is_file(), 'LEIF continuation is missing from deployment'
    continuation_html = continuation.read_text(encoding='utf-8')
    assert '<title>LEIF' in continuation_html and 'leif-demo-session' in continuation_html, 'Unexpected LEIF continuation'
    story = root / 'leif/verhaal/index.html'
    assert story.is_file(), 'LEIF personal reader is missing from deployment'
    story_html = story.read_text(encoding='utf-8')
    assert '<title>LEIF' in story_html and 'id="protected-text"' in story_html, 'LEIF personal content must stay encrypted'
    assert 'LEIF-PERSONAL-READ-V1' in story_html, 'LEIF reader must verify encrypted data'
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



# Cloudflare may append its own *versioned* RUM beacon after the HTML reaches
# the origin. Never accept arbitrary HTML changes: only a single exact known
# extra script may be removed, and the remaining bytes must hash to the build.
_EDGE_RUM_SCRIPT = re.compile(
    rb'<script\b(?=[^>]*\bsrc=["\x27]https://static\.cloudflareinsights\.com/beacon\.min\.js/v[^\x22\x27]+["\x27])[^>]*></script>',
    re.IGNORECASE,
)


def html_matches_release(data: bytes, digest: str) -> tuple[bool, bool]:
    """(matches, was_edge_beacon_removed); all non-beacon bytes stay exact."""
    if hashlib.sha256(data).hexdigest() == digest:
        return True, False
    for match in _EDGE_RUM_SCRIPT.finditer(data):
        # A matching URL alone is insufficient: reject event handlers, unknown
        # attributes and inline script text, even if removal would fix the hash.
        fragment = BeautifulSoup(match.group(0), 'html.parser')
        beacon = fragment.script
        permitted = {'type', 'src', 'integrity', 'data-cf-beacon',
                     'crossorigin', 'async', 'defer'}
        if (beacon is None or
            set(beacon.attrs) - permitted or
            beacon.get_text(strip=True) or
            not re.fullmatch(
                r'https://static\.cloudflareinsights\.com/beacon\.min\.js/v[a-zA-Z0-9]+',
                str(beacon.get('src', ''))
            )):
            continue
        before = data[:match.start()]
        after = data[match.end():]
        # Cloudflare can insert a final newline along with its script tag.
        for remainder in (after, after[1:] if after.startswith(b'\n') else after):
            if hashlib.sha256(before + remainder).hexdigest() == digest:
                return True, True
    return False, False

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
                matched, edge_beacon = html_matches_release(data, digest)
                assert matched, f'HTML content mismatch: {path}'
                if edge_beacon:
                    print(f'Cloudflare RUM injection verified without weakening HTML hash: {path}', flush=True)
                if path in LEGACY_HUB_REDIRECTS:
                    # These six old hubs are intentional redirect handoffs,
                    # not editorial pages with the shared UI marker/menu.
                    # Their full bytes still have to match the prepared build;
                    # check(root) validates each redirect destination.
                    continue
                soup = BeautifulSoup(data, 'html.parser')
                assert soup.body.get('data-ui-version') == manifest['version'], f'Stale UI: {path}'
                assert soup.select_one('.eai-site-menu'), path
            # Cloudflare also injects its strictly validated RUM beacon into
            # the standalone LEIF pages. Do not weaken the byte-exact release
            # check: html_matches_release permits only that verified script.
            for relative, url, label in (
                ('leif/index.html', '/leif/', 'LEIF is missing or out of date'),
                ('leif/continue/index.html', '/leif/continue/', 'LEIF continuation is missing or out of date'),
                ('leif/verhaal/index.html', '/leif/verhaal/', 'LEIF personal reader is missing or out of date'),
            ):
                local = root / relative
                if not local.exists() and relative != 'leif/index.html':
                    continue
                expected = hashlib.sha256(local.read_bytes()).hexdigest()
                matched, edge_beacon = html_matches_release(get(url), expected)
                assert matched, label
                if edge_beacon:
                    print(f'Cloudflare RUM injection verified without weakening HTML hash: {url}', flush=True)
            # Controleer ook de zelfstandige tools die niet door de UI-builder zijn herschreven.
            for relative in ('tools/eaimesh/start/index.html',
                             'tools/eaistudio/studio/index.html',
                             'tools/eaistudio/studio/service-worker.js',
                             'tools/eaistudio/studio/manifest.webmanifest',
                             'tools/eaistudio/studio/icons/icon-192.png',
                             'tools/eaistudio/studio/icons/icon-512.png',
                             'tools/eaistudio/studio/icons/apple-touch-icon.png'):
                local = root / relative
                if not local.is_file():
                    continue  # Mock release fixtures contain only editorial pages; tool tests enforce completeness.
                online_path = '/' + relative.removesuffix('index.html')
                expected = hashlib.sha256(local.read_bytes()).hexdigest()
                remote = get(online_path)
                if relative.endswith('.html'):
                    # Apply the same strict single-beacon check as editorial
                    # pages and LEIF; do not allow any other HTML changes.
                    matched, edge_beacon = html_matches_release(remote, expected)
                    assert matched, f'Tool content mismatch: {online_path}'
                    if edge_beacon:
                        print(f'Cloudflare RUM injection verified without weakening HTML hash: {online_path}', flush=True)
                else:
                    assert hashlib.sha256(remote).hexdigest() == expected, f'Tool content mismatch: {online_path}'
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
