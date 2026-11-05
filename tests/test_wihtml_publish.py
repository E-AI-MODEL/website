"""Tests voor publicatie van WiHTML op eaimodel.nl."""
from pathlib import Path
from html.parser import HTMLParser
import unittest

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "site-build"

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])

class WiHTMLPublicationTests(unittest.TestCase):
    def test_studio_is_exact_copy_of_reviewed_source(self):
        source = ROOT / "content/wihtml/studio.html"
        published = BUILD / "tools/wihtml/studio/index.html"
        self.assertTrue(source.is_file(), "Bron ontbreekt")
        self.assertTrue(published.is_file(), "Gegenereerde studio ontbreekt")
        self.assertEqual(source.read_bytes(), published.read_bytes(),
                         "Websitebouw heeft de WiHTML-studio gewijzigd")

    def test_intro_and_tools_index_link_to_studio(self):
        entry = BUILD / "tools/wihtml/index.html"
        tools = BUILD / "tools/index.html"
        self.assertTrue(entry.exists())
        self.assertTrue(tools.exists())
        p = LinkParser()
        p.feed(entry.read_text(encoding="utf-8"))
        self.assertIn("/tools/wihtml/studio/", p.links)
        p = LinkParser()
        p.feed(tools.read_text(encoding="utf-8"))
        self.assertIn("/tools/wihtml/", p.links)

    def test_studio_has_teacher_functions(self):
        text = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        for marker in ('id="templateDialog"', 'id="export"', 'id="preview"',
                       'id="draw"', 'id="toolpop"', 'id="templateDownload"',
                       'id="newLesson"', 'Onderzoekstabel', 'Zelfstandig oefenen',
                       'Verklaren en vergelijken', 'tableView', 'practiceView', 'compareView'):
            with self.subTest(marker=marker):
                self.assertIn(marker, text)

    def test_complete_v9_lesson_is_preserved(self):
        source = ROOT / "content/wihtml/verdubbelen-halveren-v9.html"
        public = BUILD / "tools/wihtml/voorbeeld/index.html"
        self.assertTrue(source.is_file())
        self.assertTrue(public.is_file())
        self.assertEqual(source.read_bytes(), public.read_bytes())
        text = public.read_text(encoding="utf-8")
        for marker in ("quickMarker", "quickEraser", "toggleSpotlight", "toggleCurtain", "stopwatchToggle", "saveVotes", "compareVotes"):
            with self.subTest(marker=marker):
                self.assertIn(marker, text)

    def test_site_has_sitemap_entries(self):
        text = (BUILD / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://eaimodel.nl/tools/wihtml/</loc>", text)
        self.assertIn("https://eaimodel.nl/tools/wihtml/studio/</loc>", text)
        self.assertIn("https://eaimodel.nl/tools/wihtml/voorbeeld/</loc>", text)

if __name__ == "__main__":
    unittest.main()
