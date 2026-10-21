"""Regression: stale page content cannot pass by retaining the UI revision."""
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
        self.manifest = {'version': 'same-ui-assets', 'assets': {}}
        self.current = b'<html><body data-ui-version="same-ui-assets"><details class="eai-site-menu"></details><main>Updated content</main></body></html>'
        for path in verify_ui.CHECKS:
            file = self.root / path.lstrip('/') / 'index.html'
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(self.current)

    def test_exact_release_passes(self):
        with patch.object(verify_ui, 'urlopen', side_effect=lambda *_args, **_kwargs: io.BytesIO(self.current)):
            verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

    def test_old_html_same_ui_stamp_is_rejected(self):
        stale = self.current.replace(b'Updated content', b'Previous content')
        def response(request, **kwargs):
            return io.BytesIO(stale if urlsplit(request.full_url).path == '/nl/tools/' else self.current)
        with patch.object(verify_ui, 'urlopen', side_effect=response):
            with self.assertRaisesRegex(RuntimeError, 'HTML content mismatch: /nl/tools/'):
                verify_ui.verify_live('https://example.test', self.manifest, 0, self.root)

if __name__ == '__main__':
    unittest.main()
