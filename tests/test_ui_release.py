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

    def test_exact_release_and_all_manifest_routes_pass(self):
        visited = []
        def response(request, **kwargs):
            visited.append(urlsplit(request.full_url).path)
            return io.BytesIO(self.current)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)
        self.assertEqual(visited, ['/', '/nl/tools/', '/nl/publicaties/', '/en/llmscan/', '/404.html'])

    def test_old_html_same_ui_stamp_is_rejected(self):
        stale = self.current.replace(b'Updated content', b'Previous content')
        for target in ['/nl/tools/', '/nl/publicaties/', '/en/llmscan/']:
            with self.subTest(path=target):
                def response(request, **kwargs):
                    return io.BytesIO(stale if urlsplit(request.full_url).path == target else self.current)
                with patch.object(verify_ui, 'urlopen', side_effect=response):
                    with self.assertRaisesRegex(RuntimeError, 'HTML content mismatch: ' + target):
                        verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_empty_manifest_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_ui.expected_pages(self.root, {'pages': []})

    def test_parent_directory_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_ui.expected_pages(self.root, {'pages': ['../index.html']})


if __name__ == '__main__':
    unittest.main()
