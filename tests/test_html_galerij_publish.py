"""Regression checks for the new gallery without external Cloudflare credentials."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/html-galerij/index.html"
BUILD = ROOT / "site-build/tools/html-galerij/index.html"
WORKER = ROOT / "services/html-galerij/src/index.js"
SCHEMA = ROOT / "services/html-galerij/schema.sql"


class GalleryPublicationTests(unittest.TestCase):
    def test_gallery_is_built_without_modification(self):
        self.assertTrue(SOURCE.is_file())
        self.assertTrue(BUILD.is_file(), "The static site build must include HTML gallery")
        self.assertEqual(SOURCE.read_bytes(), BUILD.read_bytes())

    def test_upload_fields_and_preview_sandbox(self):
        html = SOURCE.read_text(encoding="utf-8")
        for token in ('id="author"', 'id="title"', 'id="file"', 'id="cards"',
                      'id="search"', 'turnstileToken', 'id="viewer-frame"',
                      'sandbox="allow-scripts allow-forms allow-modals allow-downloads"',
                      "https://eai-html-galerij.vis-c9d.workers.dev"):
            with self.subTest(token=token):
                self.assertIn(token, html)

    def test_worker_requires_challenge_and_isolates_html(self):
        worker = WORKER.read_text(encoding="utf-8")
        for token in ("TURNSTILE_SECRET", "verifyTurnstile(", "MAX_BYTES",
                      "validId(", "htmlHeaders()", "sandbox allow-scripts",
                      "frame-ancestors", "status = 'published'",
                      "'CF-Connecting-IP'", "RATE_LIMIT_SALT"):
            with self.subTest(token=token):
                self.assertIn(token, worker)
        self.assertNotIn("allow-same-origin", worker)
        self.assertTrue(SCHEMA.is_file())


if __name__ == "__main__":
    unittest.main()
