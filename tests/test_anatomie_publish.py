"""Publicatiecontroles voor het zelf gehoste Anatomisch Observatorium."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site-build"
ATLAS = OUT / "tools" / "anatomie"
SYSTEMS = (
    "skeletal", "muscular", "joints", "cardiovascular",
    "lymphatic", "nervous", "visceral",
)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
        self.scripts = []
        self.iframes = []

    def handle_starttag(self, tag, attrs):
        vals = dict(attrs)
        if tag == "a" and "href" in vals:
            self.hrefs.append(vals["href"])
        if tag == "script" and "src" in vals:
            self.scripts.append(vals["src"])
        if tag == "iframe":
            self.iframes.append(vals.get("src", ""))


class AnatomyPublishTests(unittest.TestCase):
    def test_website_has_anatomy_route(self):
        page = ATLAS / "index.html"
        self.assertTrue(page.is_file(), "3D-atlas niet gebouwd")
        html = page.read_text(encoding="utf-8")
        self.assertIn("Anatomisch Observatorium", html)
        self.assertIn('lang="nl"', html)
        self.assertIn("BodyParts3D", html)
        self.assertIn("Z-Anatomy", html)
        links = Links()
        links.feed(html)
        self.assertEqual(links.iframes, [], "Geen externe atlas-embed toegestaan")
        self.assertIn("NOTICE.txt", links.hrefs)
        self.assertIn("LICENSE.txt", links.hrefs)
        self.assertTrue(links.scripts, "Geen 3D-bundel in de website")
        for src in links.scripts:
            self.assertTrue(src.startswith("/tools/anatomie/"),
                            f"Niet lokaal gehost script: {src}")
            local = OUT / src.lstrip("/")
            self.assertTrue(local.is_file(), f"Script ontbreekt: {src}")

    def test_real_source_meshes_and_decoder_are_local(self):
        for system in SYSTEMS:
            with self.subTest(system=system):
                model = ATLAS / "models" / (system + ".glb")
                self.assertTrue(model.is_file(), f"Model ontbreekt: {system}")
                self.assertGreater(model.stat().st_size, 10000)
                with model.open("rb") as handle:
                    self.assertEqual(handle.read(4), b"glTF")
        decoder = ATLAS / "draco"
        self.assertTrue(decoder.is_dir(), "Draco-decoder ontbreekt")
        self.assertTrue(any(decoder.rglob("*.wasm")) or any(decoder.rglob("*.js")),
                        "Draco kan de gecomprimeerde modellen niet decoderen")

    def test_model_licences_and_original_credit_are_included(self):
        licence = (ATLAS / "LICENSE.txt").read_text(encoding="utf-8")
        notice = (ATLAS / "NOTICE.txt").read_text(encoding="utf-8")
        self.assertIn("CC BY-NC-SA 4.0", licence)
        self.assertIn("BodyParts3D", notice)
        self.assertIn("Z-Anatomy", notice)
        self.assertTrue((ATLAS / "models" / "License.txt").exists())
        self.assertTrue((ATLAS / "UPSTREAM_COMMIT.txt").exists())

    def test_tools_menu_homepage_and_sitemap(self):
        for page in ("tools/index.html", "nl/tools/index.html", "nl/index.html"):
            with self.subTest(page=page):
                f = OUT / page
                self.assertTrue(f.is_file(), page)
                parser = Links()
                parser.feed(f.read_text(encoding="utf-8"))
                self.assertIn("/tools/anatomie/", parser.hrefs)
        sitemap = (OUT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("<loc>https://eaimodel.nl/tools/anatomie/</loc>", sitemap)

    def test_build_reproducible_and_repository_local(self):
        source = (ROOT / "scripts" / "build_anatomie.py").read_text(encoding="utf-8")
        self.assertIn("8ca3b7421bcfbe88b85859eb1983d5cf79f21749", source)
        self.assertIn("git", source)
        self.assertIn("npm", source)
        self.assertNotIn("iframe", source.lower())
        self.assertNotIn("https://nqwrc.github.io/", source)


if __name__ == "__main__":
    unittest.main()
