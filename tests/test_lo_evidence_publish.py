"""De LO-onderbouwing blijft bereikbaar zonder het spel aan te passen."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "tools/lo-aanvalslab/index.html"
PAGE = ROOT / "tools/lo-aanvalslab/onderbouwing/index.html"
PATH = "/tools/lo-aanvalslab/onderbouwing/"

class LinkReader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.identifiers = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if "id" in attrs:
            self.identifiers.add(attrs["id"])

class LOEvidencePublishTests(unittest.TestCase):
    def test_footer_links_to_page_and_keeps_sources(self):
        lab = LAB.read_text(encoding="utf-8")
        reader = LinkReader()
        reader.feed(lab)
        self.assertEqual(reader.links.count(PATH), 1)
        self.assertIn('id="sourceDetail"', lab)
        self.assertIn("Meetbasis en bronnen", lab)
        self.assertIn("Wetenschappelijke onderbouwing", lab)

    def test_document_has_substance_and_real_references(self):
        page = PAGE.read_text(encoding="utf-8")
        reader = LinkReader()
        reader.feed(page)
        for section in ("didactiek", "model", "digitaal", "praktijkproef", "oordeel", "referenties"):
            with self.subTest(section=section):
                self.assertIn(section, reader.identifiers)
        self.assertIn("25 studies", page)
        self.assertIn("1.600 deelnemers", page)
        self.assertIn("Nog niet aangetoond", page)
        self.assertIn("eaimodel.nl/tools/lo-aanvalslab/onderbouwing/", page)
        self.assertTrue(any("doi.org/" in link for link in reader.links))
        self.assertIn("/tools/lo-aanvalslab/", reader.links)

    def test_deployment_keeps_page(self):
        build = (ROOT / "scripts/build_site.py").read_text(encoding="utf-8")
        self.assertIn('class="eai-refresh', PAGE.read_text(encoding="utf-8"))
        self.assertIn("repo_root.rglob(\"*.html\")", build)
        quick = (ROOT / ".github/workflows/deploy-lo-quick.yml").read_text(encoding="utf-8")
        self.assertIn("tools/lo-aanvalslab/onderbouwing/index.html", quick)

if __name__ == "__main__":
    unittest.main()
