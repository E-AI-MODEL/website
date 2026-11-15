"""The public page must only link to the private authenticated gallery."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/html-galerij/index.html"
BUILD = ROOT / "site-build/tools/html-galerij/index.html"
SERVICE = ROOT / "services/html-galerij/src"
SCHEMA = ROOT / "services/html-galerij/schema.sql"


class GalleryPublicationTests(unittest.TestCase):
    def test_landing_is_built_without_modification(self):
        self.assertTrue(SOURCE.is_file())
        self.assertTrue(BUILD.is_file(), "Static site must include the sign-in landing")
        self.assertEqual(SOURCE.read_bytes(), BUILD.read_bytes())

    def test_public_page_has_no_gallery_controls_or_credentials(self):
        html = SOURCE.read_text(encoding="utf-8")
        self.assertIn("Inloggen met e-mail", html)
        self.assertIn("https://eai-html-galerij.vis-c9d.workers.dev/auth/login", html)
        for forbidden in ('id="secret-entrance"', 'id="upload-form"',
                          '/api/admin/uploads/', 'turnstileToken',
                          'GALLERY_PASSWORD_HASH', 'GALLERY_ADMIN_EMAIL'):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, html)

    def test_worker_authenticates_every_private_route(self):
        worker = (SERVICE / "index.js").read_text(encoding="utf-8")
        auth = (SERVICE / "auth.js").read_text(encoding="utf-8")
        ui = (SERVICE / "ui.js").read_text(encoding="utf-8")
        schema = SCHEMA.read_text(encoding="utf-8")
        for text in ('currentUser(request, env)', 'if (!user) return error(',
                     'sameOrigin(request)', r'\/api\/admin\/uploads\/',
                     "sandbox allow-scripts", "frame-ancestors 'self'",
                     "status = 'published'", "MAX_BYTES"):
            with self.subTest(text=text):
                self.assertIn(text, worker)
        for text in ('GALLERY_ADMIN_EMAIL', 'GALLERY_PASSWORD_HASH',
                     'PBKDF2', 'SameSite=Strict', 'HttpOnly',
                     'gallery_sessions', 'gallery_login_attempts'):
            with self.subTest(text=text):
                self.assertIn(text, auth)
        for text in ('gallery_sessions', 'gallery_login_attempts'):
            self.assertIn(text, schema)
        self.assertIn('Mijn HTML-galerij', ui)
        self.assertIn('Uitloggen', ui)
        self.assertNotIn("allow-same-origin", worker)
        self.assertNotIn('taps===3', worker)


if __name__ == "__main__":
    unittest.main()
