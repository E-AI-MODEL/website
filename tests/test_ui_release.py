"""Regression checks for exact live HTML, including pages outside former samples."""
from __future__ import annotations
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import verify_ui


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        self.paths = ['index.html', 'nl/tools/index.html', 'nl/publicaties/index.html', 'en/llmscan/index.html', '404.html']
        self.manifest = {'version': 'same-ui-assets', 'assets': {}, 'pages': self.paths}
        self.current = b'<html><body data-ui-version="same-ui-assets"><details class="eai-site-menu"></details><main>Updated content</main></body></html>'
        for relative in self.paths:
            file = self.root / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(self.current)
        self.leif = b'<!DOCTYPE html><html lang="nl"><title>LEIF</title><body><div id="accessGate"></div></body></html>'
        leif_path = self.root / 'leif/index.html'
        leif_path.parent.mkdir(parents=True, exist_ok=True)
        leif_path.write_bytes(self.leif)
        self.continuation = b'<!DOCTYPE html><html lang="nl"><title>LEIF | Verder</title><body>Resumable</body></html>'
        continuation_path = self.root / 'leif/continue/index.html'
        continuation_path.parent.mkdir(parents=True, exist_ok=True)
        continuation_path.write_bytes(self.continuation)
        self.story = b'<!DOCTYPE html><html lang="nl"><title>LEIF | Verhaal</title><body><script id="protected-text">cipher</script></body></html>'
        story_path = self.root / 'leif/verhaal/index.html'
        story_path.parent.mkdir(parents=True, exist_ok=True)
        story_path.write_bytes(self.story)
        self.eaigit = {}
        for relative in verify_ui.EAIGIT_RELEASE_FILES:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            data = (b'<html><body>EAIgit: ' + relative.encode() + b'</body></html>'
                    if relative.endswith('.html') else b'// ' + relative.encode() + b'\n')
            target.write_bytes(data)
            self.eaigit['/' + relative.removesuffix('index.html')] = data

    def release_response(self, request, **kwargs):
        path = urlsplit(request.full_url).path
        if path == '/leif/':
            return io.BytesIO(self.leif)
        if path == '/leif/continue/':
            return io.BytesIO(self.continuation)
        if path == '/leif/verhaal/':
            return io.BytesIO(self.story)
        if path in self.eaigit:
            return io.BytesIO(self.eaigit[path])
        return io.BytesIO(self.current)

    def test_exact_release_and_all_manifest_routes_pass(self):
        visited = []
        def response(request, **kwargs):
            visited.append(urlsplit(request.full_url).path)
            return self.release_response(request, **kwargs)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)
        self.assertEqual(visited, ['/', '/nl/tools/', '/nl/publicaties/', '/en/llmscan/', '/404.html', '/leif/', '/leif/continue/', '/leif/verhaal/'] + list(self.eaigit))

    def test_old_html_same_ui_stamp_is_rejected(self):
        stale = self.current.replace(b'Updated content', b'Previous content')
        for target in ['/nl/tools/', '/nl/publicaties/', '/en/llmscan/']:
            with self.subTest(path=target):
                def response(request, **kwargs):
                    return io.BytesIO(stale if urlsplit(request.full_url).path == target else self.current)
                with patch.object(verify_ui, 'urlopen', side_effect=response):
                    with self.assertRaisesRegex(RuntimeError, 'HTML content mismatch: ' + target):
                        verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_legacy_handoffs_do_not_need_editorial_ui_markers(self):
        # Redirects are full-byte verified but intentionally contain no
        # data-ui-version or main navigation. Exercise all six old URLs.
        from prepare_ui import LEGACY_HUB_REDIRECTS

        redirects = {}
        for route, target in LEGACY_HUB_REDIRECTS.items():
            redirect_html = (
                '<!doctype html><html><head>'
                f'<link rel="canonical" href="https://eaimodel.nl{target}">'
                f'<meta http-equiv="refresh" content="0;url={target}">'
                '</head><body><main>'
                f'<a href="{target}">Door naar nieuwe pagina</a>'
                '</main></body></html>'
            ).encode()
            relative = route.lstrip('/') + 'index.html'
            file = self.root / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(redirect_html)
            self.manifest['pages'].append(relative)
            redirects[route] = redirect_html

        def response(request, **kwargs):
            route = urlsplit(request.full_url).path
            if route in redirects:
                return io.BytesIO(redirects[route])
            return self.release_response(request, **kwargs)

        with patch.object(verify_ui, 'urlopen', side_effect=response):
            verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_legacy_handoff_with_modified_html_is_rejected(self):
        from prepare_ui import LEGACY_HUB_REDIRECTS

        route = '/kennis/'
        target = LEGACY_HUB_REDIRECTS[route]
        relative = 'kennis/index.html'
        handoff = (
            '<!doctype html><html><head>'
            f'<meta http-equiv="refresh" content="0;url={target}">'
            '</head><body><main>Verder</main></body></html>'
        ).encode()
        file = self.root / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(handoff)
        self.manifest['pages'].append(relative)

        def response(request, **kwargs):
            path = urlsplit(request.full_url).path
            if path == route:
                return io.BytesIO(handoff.replace(b'Verder', b'Veranderd'))
            return io.BytesIO(self.current)

        with patch.object(verify_ui, 'urlopen', side_effect=response):
            with self.assertRaisesRegex(RuntimeError, 'HTML content mismatch: /kennis/'):
                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_byte_identical_invalid_redirect_is_still_rejected(self):
        from prepare_ui import LEGACY_HUB_REDIRECTS
        route = '/kennis/'
        target = LEGACY_HUB_REDIRECTS[route]
        relative = 'kennis/index.html'
        self.manifest['pages'].append(relative)
        valid = (
            '<html><head>'
            f'<link rel="canonical" href="https://eaimodel.nl{target}">'
            f'<meta http-equiv="refresh" content="0;url={target}">'
            '</head><body><main>'
            f'<a href="{target}">Verder</a>'
            '</main></body></html>'
        )
        bad_cases = (
            (valid.replace(f'https://eaimodel.nl{target}', 'https://example.invalid/'), 'canonical'),
            (valid.replace(f'0;url={target}', f'0;url=/wrong/?next={target}'), 'refresh'),
            (valid.replace(f'href="{target}"', 'href="/wrong/"'), 'fallback'),
            (valid.replace('>Verder</a>', '></a>'), 'fallback'),
        )
        for bad, label in bad_cases:
            with self.subTest(label=label, html=bad):
                with self.assertRaisesRegex(AssertionError, f'Invalid {label} redirect: /kennis/'):
                    verify_ui.assert_redirect_contract(route, verify_ui.BeautifulSoup(bad, 'html.parser'))
                data = bad.encode()
                file = self.root / relative
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(data)
                def response(request, **kwargs):
                    return io.BytesIO(data if urlsplit(request.full_url).path == route else self.current)
                with patch.object(verify_ui, 'urlopen', side_effect=response):
                    with self.assertRaisesRegex(RuntimeError, f'Invalid {label} redirect: /kennis/'):
                        verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_editorial_page_without_matching_ui_version_is_rejected(self):
        relative = 'nl/tools/index.html'
        missing_version = self.current.replace(b'data-ui-version="same-ui-assets"', b'')
        (self.root / relative).write_bytes(missing_version)

        def response(request, **kwargs):
            path = urlsplit(request.full_url).path
            return io.BytesIO(missing_version if path == '/nl/tools/' else self.current)

        with patch.object(verify_ui, 'urlopen', side_effect=response):
            with self.assertRaisesRegex(RuntimeError, 'Stale UI: /nl/tools/'):
                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_leif_missing_online_is_rejected(self):
        def response(request, **kwargs):
            path = urlsplit(request.full_url).path
            return io.BytesIO(b'404 Not Found' if path == '/leif/' else self.current)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            with self.assertRaisesRegex(RuntimeError, 'LEIF is missing or out of date'):
                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_private_reader_missing_online_is_rejected(self):
        def response(request, **kwargs):
            path = urlsplit(request.full_url).path
            if path == '/leif/':
                return io.BytesIO(self.leif)
            if path == '/leif/continue/':
                return io.BytesIO(self.continuation)
            if path == '/leif/verhaal/':
                return io.BytesIO(b'404 Not Found')
            return io.BytesIO(self.current)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            with self.assertRaisesRegex(RuntimeError, 'LEIF personal reader is missing or out of date'):
                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_eaigit_missing_or_empty_build_file_fails_before_network(self):
        for relative in verify_ui.EAIGIT_RELEASE_FILES:
            with self.subTest(file=relative):
                local = self.root / relative
                original = local.read_bytes()
                for remove in (True, False):
                    if remove:
                        local.unlink()
                    else:
                        local.write_bytes(b'')
                    try:
                        with patch.object(verify_ui, 'urlopen') as network:
                            with self.assertRaisesRegex(FileNotFoundError, 'EAIgit release file missing or empty'):
                                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)
                            network.assert_not_called()
                    finally:
                        local.write_bytes(original)

    def test_each_eaigit_live_file_must_match(self):
        for target in self.eaigit:
            with self.subTest(path=target):
                def response(request, **kwargs):
                    if urlsplit(request.full_url).path == target:
                        return io.BytesIO(self.eaigit[target] + b'changed')
                    return self.release_response(request, **kwargs)
                with patch.object(verify_ui, 'urlopen', side_effect=response):
                    with self.assertRaisesRegex(RuntimeError, 'EAIgit content mismatch: ' + target):
                        verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_eaigit_http_404_fails(self):
        from urllib.error import HTTPError
        target = '/tools/eaigit/'
        def response(request, **kwargs):
            if urlsplit(request.full_url).path == target:
                raise HTTPError(request.full_url, 404, 'Not Found', {}, None)
            return self.release_response(request, **kwargs)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            with self.assertRaisesRegex(RuntimeError, '404'):
                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_eaigit_html_only_accepts_known_beacon(self):
        target = '/tools/eaigit/'
        beacon = b'<script src="https://static.cloudflareinsights.com/beacon.min.js/v123abc" defer></script>'
        def response(request, **kwargs):
            if urlsplit(request.full_url).path == target:
                return io.BytesIO(self.eaigit[target].replace(b'</body>', beacon + b'</body>'))
            return self.release_response(request, **kwargs)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)
        beacon = beacon.replace(b' defer', b' onload="alert(1)"')
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            with self.assertRaisesRegex(RuntimeError, 'EAIgit content mismatch: ' + target):
                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_eaigit_prepared_page_is_not_fetched_twice(self):
        relative = 'tools/eaigit/index.html'
        target = '/tools/eaigit/'
        (self.root / relative).write_bytes(self.current)
        self.eaigit[target] = self.current
        self.manifest['pages'].append(relative)
        with patch.object(verify_ui, 'urlopen', side_effect=self.release_response) as network:
            verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)
        self.assertEqual(sum(urlsplit(call.args[0].full_url).path == target for call in network.call_args_list), 1)

    def test_empty_manifest_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_ui.expected_pages(self.root, {'pages': []})

    def test_parent_directory_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_ui.expected_pages(self.root, {'pages': ['../index.html']})


if __name__ == '__main__':
    unittest.main()
