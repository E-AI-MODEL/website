"""Verify only the public login entry is included in the static website."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "beheer/index.html"
PUBLISHED = ROOT / "site-build/beheer/index.html"
WORKER_SOURCE = ROOT / "services/html-galerij/src"


class EaiSiteAdminPublication(unittest.TestCase):
    def test_public_login_entry_is_built(self):
        self.assertTrue(PUBLIC.is_file())
        self.assertTrue(PUBLISHED.is_file(), "The build must include /beheer/")
        self.assertEqual(PUBLIC.read_bytes(), PUBLISHED.read_bytes())

    def test_public_entry_never_includes_backend_code_or_data(self):
        page = PUBLIC.read_text(encoding="utf-8")
        self.assertIn("Inloggen bij EAI Beheer", page)
        self.assertIn("https://eai-html-galerij.vis-c9d.workers.dev/auth/login", page)
        self.assertIn('name="robots" content="noindex,nofollow,noarchive"', page)
        for forbidden in ("GALLERY_PASSWORD_HASH", "GALLERY_ADMIN_EMAIL",
                          "RATE_LIMIT_SALT", "site_admin_audit",
                          "Bearer ", "html_content", "document.cookie",
                          "SUPABASE_SERVICE_ROLE_KEY"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, page)

    def test_backend_logic_never_enters_the_static_build(self):
        for name in ("admin.js", "dashboard.js", "admin-client.js", "auth.js"):
            self.assertTrue((WORKER_SOURCE / name).is_file())
            self.assertFalse((ROOT / "site-build/beheer" / name).exists())


if __name__ == "__main__":
    unittest.main()
