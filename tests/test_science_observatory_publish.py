"""Controleer de Science Observatory-proefpublicatie in de EAI-sitebuild."""
from pathlib import Path
from html.parser import HTMLParser
import unittest

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "site-build"
SOURCE = ROOT / "content" / "science-observatory"
PUBLISHED = BUILD / "tools" / "science-observatory"
SLUGS = ("melkweg", "gravitatie-banen", "natuurkunde", "wiskunde-a", "wiskunde-b", "leeuw")
PUBLISHED_LABS = SLUGS


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for key, value in attrs:
                if key == "href":
                    self.hrefs.append(value)


class ObservatoryPublicationTests(unittest.TestCase):
    def test_all_pilot_models_are_exact_source_copies(self):
        for slug in PUBLISHED_LABS:
            with self.subTest(slug=slug):
                source = SOURCE / "labs" / (slug + ".html")
                target = PUBLISHED / "labs" / slug / "index.html"
                self.assertTrue(source.is_file(), f"Bron ontbreekt: {slug}")
                self.assertTrue(target.is_file(), f"Publicatie ontbreekt: {slug}")
                self.assertEqual(source.read_bytes(), target.read_bytes(),
                                 f"Model tijdens websitebuild veranderd: {slug}")

    def test_catalogue_links_only_to_reviewed_pilot(self):
        landing = PUBLISHED / "index.html"
        self.assertTrue(landing.is_file())
        parser = Anchors()
        parser.feed(landing.read_text(encoding="utf-8"))
        for slug in SLUGS:
            self.assertIn(f"/tools/science-observatory/labs/{slug}/", parser.hrefs)
        self.assertEqual(
            {href for href in parser.hrefs if "/tools/science-observatory/labs/" in href},
            {f"/tools/science-observatory/labs/{slug}/" for slug in SLUGS},
        )

    def test_tools_pages_offer_an_observatory_entrance(self):
        for rel in ("nl/tools/index.html", "tools/index.html"):
            with self.subTest(page=rel):
                page = BUILD / rel
                self.assertTrue(page.exists(), rel)
                parser = Anchors()
                parser.feed(page.read_text(encoding="utf-8"))
                self.assertIn("/tools/science-observatory/", parser.hrefs)

    def test_generated_tools_page_keeps_the_new_observatory_section(self):
        page = (BUILD / "tools" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Vakinhoud en interactieve modellen", page)
        self.assertIn('id="observatoria"', page)
        self.assertIn("/tools/science-observatory/", page)
        self.assertIn("Wat wil je dat AI hier doet?", page)

    def test_publication_does_not_include_admin(self):
        self.assertFalse((PUBLISHED / "beheer").exists())
        self.assertFalse((PUBLISHED / "BEHEER.html").exists())
        self.assertFalse((PUBLISHED / "STUDIO_INRICHTEN.html").exists())
        self.assertEqual(len(list((PUBLISHED / "labs").rglob("index.html"))), len(PUBLISHED_LABS))

    def test_projectile_has_one_public_application_without_legacy_route(self):
        source = (SOURCE / "labs" / "natuurkunde.html").read_text(encoding="utf-8")
        self.assertNotIn('id="projectileStudioLink"', source)
        self.assertIn("['projectile','Schuine worp'", source)
        target = "/tools/science-observatory/labs/natuurkunde/#projectile"
        old = "/tools/science-observatory/labs/schuine-worp/"
        self.assertFalse((PUBLISHED / "labs" / "schuine-worp").exists())
        self.assertFalse((SOURCE / "labs" / "schuine-worp.html").exists())
        self.assertFalse((ROOT / old.strip("/") / "index.html").exists())
        import json
        register = json.loads((ROOT / "catalog/website-register.json").read_text(encoding="utf-8"))
        self.assertFalse(any(p["url"] == old for p in register["pages"]))
        self.assertTrue(any(p.get("url") == target for p in register["embedded_items"]))
        for rel in ("nl/tools/index.html", "en/tools/index.html"):
            for root in (ROOT, BUILD):
                with self.subTest(page=rel, root=root):
                    parser = Anchors()
                    parser.feed((root / rel).read_text(encoding="utf-8"))
                    self.assertNotIn(old, parser.hrefs)
                    self.assertIn(target, parser.hrefs)

    def test_names_and_model_limits_are_visible_without_internal_labels(self):
        catalog = (PUBLISHED / "index.html").read_text(encoding="utf-8")
        self.assertIn("<h3>De Melkweg</h3>", catalog)
        self.assertIn("Gravitatie en satellietbanen", catalog)
        self.assertIn("<h3>Het lichaam in 3D</h3>", catalog)
        self.assertIn("<h3>Oceanografie</h3>", catalog)
        self.assertIn("niet alle natuurkundige modellen", catalog.lower())
        self.assertIn("vereenvoudigde modellen", catalog)
        self.assertNotIn("NF / 01", catalog)
        self.assertNotIn("school-PTA", catalog)
        self.assertNotIn("Nieuwe proefversie", catalog)

    def test_gravity_has_six_real_research_modes_and_exit_ticket(self):
        source = (SOURCE / "labs" / "gravitatie-banen.html").read_text(encoding="utf-8")
        self.assertIn("function kepler(", source)
        self.assertIn("function transfer(", source)
        self.assertIn("function escape(", source)
        self.assertIn("function ground(", source)
        self.assertIn("function position(", source)
        self.assertIn("function renderSpace(", source)
        self.assertIn("function renderChart(", source)
        self.assertIn("const phaseNames=[", source)
        self.assertIn("Exit ticket", source)
        self.assertIn("data-mode=", source)



if __name__ == "__main__":
    unittest.main()
