"""Regressies voor het verwijderen van de oude Onderwijs in/House of Talents 3D-schets."""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RETIRED = (
    "content/legacy/onderwijsin-3d.html",
    "houseoftalents/3d/index.html",
    "onderwijsin/3d/index.html",
    "onderwijsin/houseoftalents/3d/index.html",
)
NORMAL = (
    "content/legacy/onderwijsin-embed1.html",
    "houseoftalents/index.html",
    "onderwijsin/index.html",
    "onderwijsin/houseoftalents/index.html",
)
VIEW_IDS = ("overzicht", "tekst", "pijplijn")


class RetiredOnderwijsIn3dTests(unittest.TestCase):
    def test_three_dimensional_sources_are_gone(self):
        for relative in RETIRED:
            with self.subTest(relative=relative):
                self.assertFalse((ROOT / relative).exists(), relative)

    def test_two_dimensional_standalone_pages_keep_three_functioning_views(self):
        for relative in NORMAL:
            with self.subTest(relative=relative):
                path = ROOT / relative
                self.assertTrue(path.is_file())
                source = path.read_text(encoding="utf-8")
                soup = BeautifulSoup(source, "html.parser")
                tabs = [tab.get("data-oi-view") for tab in soup.select('#oiViewTabs [data-oi-view]')]
                self.assertEqual(list(VIEW_IDS), tabs)
                self.assertIsNone(soup.select_one("#oiTab3d, #oi-panel-3d, #oi3dFrame"))
                self.assertIn("const views=['overzicht','tekst','pijplijn'];", source)
                self.assertIn("let activeView='overzicht';", source)
                self.assertNotIn("sync3dMode", source)
                self.assertNotIn("/onderwijsin/3d/", source)
                self.assertNotIn("./3d/index.html", source)
                for name in VIEW_IDS:
                    self.assertIsNotNone(soup.select_one("#oi-panel-" + name))
                self.assertIsNotNone(soup.select_one("#oiRepos"))
                self.assertIsNotNone(soup.select_one("#oiDialog"))

    def test_inline_javascript_remains_syntactically_valid(self):
        for relative in NORMAL:
            soup = BeautifulSoup((ROOT / relative).read_text(encoding="utf-8"), "html.parser")
            scripts = [tag.get_text() for tag in soup.find_all("script")
                       if not tag.get("src") and tag.get("type") != "application/json"
                       and tag.get_text().strip()]
            self.assertTrue(scripts, relative)
            for number, code in enumerate(scripts):
                with self.subTest(relative=relative, script=number):
                    with tempfile.TemporaryDirectory() as tmp:
                        file = Path(tmp) / "check.js"
                        file.write_text(code, encoding="utf-8")
                        result = subprocess.run(
                            ["node", "--check", str(file)],
                            capture_output=True, text=True, timeout=12, check=False,
                        )
                        self.assertEqual(0, result.returncode, result.stderr[:1000])

    def test_sitemap_and_register_exclude_all_three_routes(self):
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        register = json.loads((ROOT / "catalog/website-register.json").read_text(encoding="utf-8"))
        old_urls = ("/houseoftalents/3d/", "/onderwijsin/3d/",
                    "/onderwijsin/houseoftalents/3d/")
        urls = {p["url"] for p in register["pages"]}
        for url in old_urls:
            self.assertNotIn(url, urls)
            self.assertNotIn("https://eaimodel.nl" + url, sitemap)
        sources = {x["path"] for x in register["html_sources"]}
        self.assertNotIn("content/legacy/onderwijsin-3d.html", sources)
        for route in ("/onderwijsin/", "/houseoftalents/", "/onderwijsin/houseoftalents/"):
            self.assertIn(route, urls)
        self.assertIn("https://eaimodel.nl/onderwijsin/", sitemap)

    def test_generator_no_longer_reads_or_builds_three_dimensional_legacy_page(self):
        source = (ROOT / "scripts/build_site.py").read_text(encoding="utf-8")
        self.assertNotIn("onderwijsin-3d.html", source)
        self.assertNotIn('write(out, "onderwijsin/3d/index.html"', source)
        self.assertNotIn('"/onderwijsin/3d/"', source)

    def test_release_does_not_recreate_removed_3d_pages(self):
        site = ROOT / "site-build"
        if not site.is_dir():
            self.skipTest("Wordt na de websitebuild opnieuw getest")
        for relative in RETIRED[1:]:
            self.assertFalse((site / relative).exists(), relative)
        for relative in NORMAL[1:]:
            self.assertTrue((site / relative).is_file(), relative)

    def test_publication_only_deletes_explicit_four_files(self):
        workflow = (ROOT / ".github/workflows/deploy-theory7.yml").read_text(encoding="utf-8")
        start = workflow.index("Verwijder uitsluitend de vier vervallen Onderwijs in 3D-kopieën")
        end = workflow.index("Verify live HTML and exact asset hashes", start)
        section = workflow[start:end]
        deletions = re.findall(r"(?m)^\s+rm -f (/[^\n]+)$", section)
        self.assertEqual(["/" + path for path in RETIRED], deletions)
        self.assertNotIn("mirror --delete", section)
        self.assertNotIn("rm -rf", section)
        for path in ("topo/", "tools/delf-live/", "tools/eaispeak/", "tools/anatomie/"):
            self.assertFalse(any(item.startswith("/" + path) for item in deletions), path)
        self.assertLess(workflow.index("Publish assets before HTML"), start)


if __name__ == "__main__":
    unittest.main()
