"""Ensure Cloudflare only measures public sitemap routes."""
import re
import unittest
from pathlib import Path

from scripts.build_site import (
    CLOUDFLARE_PUBLIC_BEACON, EAI_FIRST_PARTY_TRACKER, CLOUDFLARE_ANALYTICS_EXCLUDED,
    add_cloudflare_beacon_to_public_routes,
)
from tempfile import TemporaryDirectory


class CloudflareBeaconTest(unittest.TestCase):
    def test_public_beacon_markup(self):
        self.assertIn("https://static.cloudflareinsights.com/beacon.min.js", CLOUDFLARE_PUBLIC_BEACON)
        self.assertIn('data-cf-beacon=\'{"token":', CLOUDFLARE_PUBLIC_BEACON)
        self.assertNotIn("CLOUDFLARE_ANALYTICS_TOKEN", CLOUDFLARE_PUBLIC_BEACON)
        self.assertIn("/assets/site-analytics.js", EAI_FIRST_PARTY_TRACKER)

    def test_only_public_routes_and_idempotent_insertion(self):
        with TemporaryDirectory() as root:
            out = Path(root)
            paths = ["/", "/nl/", "/en/", "/tools/anatomie/", "/leif/continue/", "/leif/",
                     "/houseoftalents/", "/nl/auth/", "/statistieken/"]
            for path in paths:
                file = out / path.lstrip("/") / "index.html"
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text("<!doctype html><html><head><title>Test</title></head><body>OK</body></html>", encoding="utf-8")
            add_cloudflare_beacon_to_public_routes(out, paths)
            add_cloudflare_beacon_to_public_routes(out, paths)
            for path in paths:
                html = (out / path.lstrip("/") / "index.html").read_text(encoding="utf-8")
                private = any(seg in CLOUDFLARE_ANALYTICS_EXCLUDED for seg in path.lower().split("/") if seg)
                self.assertEqual(html.count("static.cloudflareinsights.com/beacon.min.js"), 0 if private else 1, path)
                self.assertEqual(html.count("/assets/site-analytics.js"), 0 if private else 1, path)
                self.assertEqual(html.count("</head>"), 1, path)
                if not private:
                    self.assertRegex(html, r"data-cf-beacon='\{\"token\":\"[a-f0-9]{32}\"\}'")

    def test_exact_source_pages_remain_unchanged(self):
        with TemporaryDirectory() as root:
            out = Path(root)
            paths = [
                "/tools/wihtml/studio/", "/tools/wihtml/voorbeeld/",
                "/tools/abyss/", "/tools/melkweg-lab/",
                "/tools/llm-observatorium/", "/tools/eaimesh/start/",
                "/tools/eaistudio/studio/",
                "/tools/eaigit/", "/tools/eaigit/hulp/", "/tools/eaigit/prompts/",
                "/tools/science-observatory/labs/wiskunde-a/",
            ]
            for path in paths:
                page = out / path.lstrip("/") / "index.html"
                page.parent.mkdir(parents=True, exist_ok=True)
                page.write_text("<html><head></head><body>Exact original</body></html>", encoding="utf-8")
            add_cloudflare_beacon_to_public_routes(out, paths)
            for path in paths:
                self.assertEqual(
                    (out / path.lstrip("/") / "index.html").read_text(encoding="utf-8"),
                    "<html><head></head><body>Exact original</body></html>", path,
                )

    def test_missing_routes_do_not_create_files(self):
        with TemporaryDirectory() as root:
            out = Path(root)
            add_cloudflare_beacon_to_public_routes(out, ["/not-found/", "/leif/continue/"])
            self.assertEqual(list(out.rglob("*.html")), [])


if __name__ == "__main__":
    unittest.main()
