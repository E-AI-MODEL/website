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

    def test_hartslaglab_is_published_inside_anatomy(self):
        lab = ATLAS / "labs" / "hartslag"
        page = lab / "index.html"
        self.assertTrue(page.is_file(), "Hartslaglab is geen onderdeel van de sitebuild")
        source = page.read_text(encoding="utf-8")
        self.assertIn('href="/tools/anatomie/"', source)
        self.assertIn('id="heartCanvas"', source)
        self.assertIn('src="./heart.js"', source)
        self.assertIn('href="./heart.css"', source)
        self.assertIn("Schematische doorsnede", source)
        for name in ("heart.js", "heart.css", "cycle.js"):
            asset = lab / name
            self.assertTrue(asset.is_file(), f"Hartslaglab mist {name}")
            self.assertGreater(asset.stat().st_size, 150)
        script = (lab / "heart.js").read_text(encoding="utf-8")
        self.assertIn("getContext('webgl'", script)
        self.assertIn("from './cycle.js'", script)
        self.assertIn("requestAnimationFrame(frame)", script)
        self.assertIn("drawParticles(m)", script)
        self.assertIn("drawChart('pressureChart'", script)
        self.assertIn("drawChart('volumeChart'", script)
        atlas = (ATLAS / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="/tools/anatomie/labs/hartslag/"', atlas)
        self.assertIn('eai-lab-link', atlas)
        self.assertIn('eai-lab-link', (ROOT / "content/anatomie/layout.css").read_text(encoding="utf-8"))
        site_nav = (ROOT / "scripts/build_site.py").read_text(encoding="utf-8")
        self.assertIn('("/tools/anatomie/labs/hartslag/", "Hartslaglab', site_nav)

    def test_css_js_and_anatomy_info_are_published_together(self):
        """Voorkom de witte pagina met enorme SVG's door ontbrekende assets."""
        html = (ATLAS / "index.html").read_text(encoding="utf-8")
        assets = re.findall(
            r'(?:src|href)="(/tools/anatomie/assets/[^"]+[.](?:css|js))"',
            html,
        )
        self.assertGreaterEqual(len(assets), 2, "3D-opmaak of scriptlink ontbreekt")
        self.assertTrue(any(p.endswith(".css") for p in assets))
        self.assertTrue(any(p.endswith(".js") for p in assets))
        for path in assets:
            with self.subTest(path=path):
                file = OUT / path.lstrip("/")
                self.assertTrue(file.is_file(), f"Ontbrekend 3D-bestand: {path}")
                self.assertGreater(file.stat().st_size, 1000, path)
        self.assertNotIn('id="eaiExplore"', html, "Geen dubbele stelselkeuze")
        self.assertIn('id="systemsOpen"', html)
        self.assertIn('id="infoSidebar"', html)
        self.assertEqual(html.count('id="threeCanvas"'), 1)
        synonyms = ATLAS / "data" / "synonyms.nl.json"
        self.assertTrue(synonyms.is_file(), "Nederlandse zoekwoorden ontbreken")
        data = __import__("json").loads(synonyms.read_text(encoding="utf-8"))
        self.assertIn("dijbeen", data["femur"])
        self.assertIn("knieschijf", data["patella"])
        guide = (ROOT / "content/anatomie/guide.js").read_text(encoding="utf-8")
        self.assertIn("'anterior cruciate ligament'", guide)
        self.assertIn("'fascia lata'", guide)
        self.assertIn("de grote beenzenuw vervoert signalen", guide.lower())
        self.assertIn("anatomyTeaching", (ROOT / "content/anatomie/eaiDetail.js").read_text(encoding="utf-8"))
        self.assertIn("teaching.js", (ROOT / "scripts/anatomie_refine.py").read_text(encoding="utf-8"))
        builder = (ROOT / "scripts/anatomie_refine.py").read_text(encoding="utf-8")
        self.assertIn("eaiGuide.js", builder)
        self.assertIn("depthSlider.js", builder)
        details = (ROOT / "content/anatomie/eaiDetail.js").read_text(encoding="utf-8")
        self.assertIn("Toon alleen dit", details)
        self.assertIn("Verberg dit onderdeel", details)

    def test_existing_dutch_search_names_are_reused_in_selection(self):
        """Nederlandse zoeknamen worden niet dubbel handmatig beheerd."""
        import json
        names = json.loads(
            (ROOT / "content/anatomie/synonyms.nl.json").read_text(encoding="utf-8")
        )
        self.assertGreaterEqual(len(names), 80)
        self.assertEqual(names["fibula"][0], "kuitbeen")
        self.assertEqual(names["humerus"][0], "opperarmbeen")

        refine = (ROOT / "scripts/anatomie_refine.py").read_text(encoding="utf-8")
        detail = (ROOT / "content/anatomie/eaiDetail.js").read_text(encoding="utf-8")
        self.assertIn('eaiNames.js', refine)
        self.assertIn('anatomyName(row.base', refine)
        self.assertIn('dutchName(base)', refine)
        self.assertIn('anatomyName(baseName, info)', detail)
        self.assertIn("Relaties in het 3D-model", detail)

        self.assertEqual(names["capitate bone"][0], "kopbeen")
        self.assertEqual(names["arytenoid cartilage"][0], "bekerkraakbeen")
        # De oude lagenkaart is verwijderd. De stelselselectie en
        # contextuele onderdeelacties blijven gescheiden van de camera.
        css = (ROOT / "content/anatomie/layout.css").read_text(encoding="utf-8")
        self.assertIn(".depth-control.eai-layer-control,.eai-camera-modes{display:none!important}", css)
        depth = (ROOT / "content/anatomie/depthSlider.js").read_text(encoding="utf-8")
        self.assertIn("initDepthSlider", depth)
        self.assertIn("resetDepthSlider", depth)
        self.assertNotIn("Gekozen onderdeel wegnemen", depth)
        self.assertNotIn("Blijft duidelijk zichtbaar", depth)
        self.assertNotIn("Stelsels vergelijken", depth)
        self.assertNotIn('type="range"', depth)
        drag = (ROOT / "content/anatomie/dragMode.js").read_text(encoding="utf-8")
        self.assertIn("THREE.TOUCH.DOLLY_PAN", drag)
        self.assertIn("canvas.style.touchAction = 'none'", drag)
        self.assertNotIn("eaiDragMode", drag)
        self.assertIn("centerOrbitOnSelection", refine)
        # De vrijwel onzichtbare fascia mag bij klikken niet vóór de spier
        # worden geselecteerd. Vervaagde spierweefsels blijven wel klikbaar.
        picking = (ROOT / "content/anatomie/picking.js").read_text(encoding="utf-8")
        self.assertIn("MIN_PICK_OPACITY = 0.10", picking)
        self.assertIn("picking.js", refine)
        self.assertIn("if (!isTouchableAnatomySurface(hit.object)) continue;", refine)
        self.assertIn("De oorspronkelijke bronbeschrijving", detail)
        self.assertIn("meegeleverde atlasgegevens", detail)

        # Test de werkelijk gebundelde naamfunctie, niet alleen de Python-patch.
        bundles = list((ATLAS / "assets").glob("*.js"))
        self.assertTrue(bundles, "Gebundelde 3D-code ontbreekt")
        combined = "\\n".join(bundle.read_text(encoding="utf-8") for bundle in bundles)
        self.assertIn("Kuitbeen", combined)
        self.assertIn("Opperarmbeen", combined)
        self.assertIn("Relaties in het 3D-model", combined)

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

    def test_anatomie_route_not_duplicated_in_menus(self):
        # The source pages are copied into the website build, while
        # prepare_ui.py generates the six-group language menus.
        for rel in ("tools/index.html", "nl/tools/index.html", "nl/index.html"):
            with self.subTest(page=rel):
                links = Links()
                links.feed((OUT / rel).read_text(encoding="utf-8"))
                # De gegenereerde Tools-pagina heeft één link in de inhoud
                # en één in elk van de afzonderlijke desktop-/mobiele menu's.
                expected = 3 if rel == "tools/index.html" else 1
                self.assertEqual(links.hrefs.count("/tools/anatomie/"), expected,
                                 f"Onverwacht aantal anatomievermeldingen in {rel}")
                if rel == "tools/index.html":
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup((OUT / rel).read_text(encoding="utf-8"), "html.parser")
                    for area in (soup.select_one(".nav-links"),
                                 soup.select_one(".mobile-nav-panel"),
                                 soup.select_one("main")):
                        self.assertIsNotNone(area)
                        self.assertEqual(len(area.select('a[href="/tools/anatomie/"]')), 1,
                                         "Anatomie mag per menu/inhoud eenmaal voorkomen")
        navigation_source = (ROOT / "scripts" / "prepare_ui.py").read_text(encoding="utf-8")
        self.assertEqual(navigation_source.count("'/tools/anatomie/'"), 2,
                         "Er hoort een anatomievermelding per taalmenu te zijn")

    def test_build_reproducible_and_repository_local(self):
        source = (ROOT / "scripts" / "build_anatomie.py").read_text(encoding="utf-8")
        self.assertIn("8ca3b7421bcfbe88b85859eb1983d5cf79f21749", source)
        self.assertIn("git", source)
        self.assertIn("npm", source)
        self.assertNotIn("iframe", source.lower())
        self.assertNotIn("https://nqwrc.github.io/", source)


if __name__ == "__main__":
    unittest.main()
