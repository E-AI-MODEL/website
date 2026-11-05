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

    def test_exact_release_and_all_manifest_routes_pass(self):
        visited = []
        def response(request, **kwargs):
            visited.append(urlsplit(request.full_url).path)
            path = urlsplit(request.full_url).path
            if path == '/leif/':
                return io.BytesIO(self.leif)
            if path == '/leif/continue/':
                return io.BytesIO(self.continuation)
            if path == '/leif/verhaal/':
                return io.BytesIO(self.story)
            return io.BytesIO(self.current)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)
        self.assertEqual(visited, ['/', '/nl/tools/', '/nl/publicaties/', '/en/llmscan/', '/404.html', '/leif/', '/leif/continue/', '/leif/verhaal/'])

    def test_old_html_same_ui_stamp_is_rejected(self):
        stale = self.current.replace(b'Updated content', b'Previous content')
        for target in ['/nl/tools/', '/nl/publicaties/', '/en/llmscan/']:
            with self.subTest(path=target):
                def response(request, **kwargs):
                    return io.BytesIO(stale if urlsplit(request.full_url).path == target else self.current)
                with patch.object(verify_ui, 'urlopen', side_effect=response):
                    with self.assertRaisesRegex(RuntimeError, 'HTML content mismatch: ' + target):
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

    def test_empty_manifest_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_ui.expected_pages(self.root, {'pages': []})

    def test_parent_directory_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_ui.expected_pages(self.root, {'pages': ['../index.html']})


if __name__ == '__main__':
    unittest.main()
