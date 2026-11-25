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
    def test_checkout_uses_pinned_commit_even_after_upstream_advances(self):
        import subprocess
        import sys
        import tempfile
        sys.path.insert(0, str(ROOT / "scripts"))
        from build_anatomie import checkout_pinned_source

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            upstream = root / "upstream"
            upstream.mkdir()

            def git(*args):
                return subprocess.check_output(["git", *args], cwd=upstream, text=True).strip()

            git("init", "-b", "master")
            git("config", "user.name", "Anatomy fixture")
            git("config", "user.email", "fixture@example.invalid")
            (upstream / "fixture.txt").write_text("reviewed")
            git("add", "fixture.txt")
            git("commit", "-m", "Reviewed commit")
            pinned = git("rev-parse", "HEAD")
            (upstream / "fixture.txt").write_text("new, unreviewed")
            git("commit", "-am", "Advance upstream")
            self.assertNotEqual(git("rev-parse", "HEAD"), pinned)
            checkout = root / "checkout"
            checkout_pinned_source(checkout, upstream.as_uri(), pinned)
            self.assertEqual((checkout / "fixture.txt").read_text(), "reviewed")
            self.assertEqual(subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip(), pinned)

    def test_website_has_anatomy_route(self):
        page = ATLAS / "index.html"
        self.assertTrue(page.is_file(), "3D-atlas niet gebouwd")
        html = page.read_text(encoding="utf-8")
        self.assertIn("Het lichaam in 3D", html)
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
            self.assertTrue(
                src.startswith("/tools/anatomie/") or src == "/assets/site-analytics.js",
                f"Niet lokaal gehost script: {src}",
            )
            local = OUT / src.lstrip("/")
            self.assertTrue(local.is_file(), f"Script ontbreekt: {src}")

    def test_hartslaglab_is_published_inside_anatomy(self):
        lab = ATLAS / "labs" / "hartslag"
        page = lab / "index.html"
        self.assertTrue(page.is_file(), "Hartslaglab is geen onderdeel van de sitebuild")
        source = page.read_text(encoding="utf-8")
        self.assertIn('href="/tools/anatomie/"', source)
        self.assertIn('id="heartCanvas"', source)
        self.assertIn('id="flowOverlay"', source)
        self.assertIn('Gebruik twee vingers', source)
        import re
        revision = re.search(r'src="./heart[.]js[?]v=([0-9a-f]{12})"', source)
        self.assertIsNotNone(revision, "Heart JavaScript moet een echte versie hebben")
        release = revision.group(1)
        self.assertIn(f'href="./heart.css?v={release}"', source)
        self.assertIn('class="phase-story"', source)
        self.assertIn('id="heartOptions"', source)
        self.assertIn('id="layerMenu"', source)
        self.assertIn('id="quickMeasurements"', source)
        self.assertIn('id="moreTools"', source)
        self.assertNotIn('id="storyProgress"', source)
        self.assertNotIn('id="storySteps"', source)
        self.assertEqual(source.count('id="flowToggle"'), 1)
        self.assertEqual(source.count('id="labelsToggle"'), 1)
        self.assertEqual(source.count('class="layer-switch"'), 9)
        self.assertIn('data-layer="vesselSection"', source)
        self.assertIn('data-layer="outer"', source)
        self.assertIn('Hartwand in doorsnede', source)
        self.assertIn('data-layer="valve"', source)
        self.assertIn('data-layer="coronary"', source)
        self.assertIn('id="atlasLoading"', source)
        self.assertIn("Echte 3D-anatomie · BodyParts3D", source)
        self.assertNotIn('id="mechanicsToggle"', source,
                         "Een rijke anatomie mag niet overschakelen naar een grove tekening")
        self.assertIn('id="playbackDuration"', source,
                      "De verlengde afspeeltijd moet duidelijk zichtbaar zijn")
        for name in ("heart.js", "heart.css", "cycle.js", "anatomyGeometry.js"):
            asset = lab / name
            self.assertTrue(asset.is_file(), f"Hartslaglab mist {name}")
            self.assertGreater(asset.stat().st_size, 150)
        atlas_mesh = lab / "atlas-heart.bin"
        atlas_manifest = lab / "atlas-heart.json"
        self.assertTrue(atlas_mesh.is_file(), "De brongebonden hartmesh ontbreekt")
        self.assertGreater(atlas_mesh.stat().st_size, 10000)
        self.assertTrue(atlas_manifest.is_file(), "Het hartmesh-manifest ontbreekt")
        manifest = atlas_manifest.read_text(encoding="utf-8")
        for part_id in ('"ra"', '"rv"', '"la"', '"lv"'):
            self.assertIn(part_id, manifest)
        rich_mesh = lab / "atlas-heart-rich.bin"
        rich_manifest = lab / "atlas-heart-rich.json"
        self.assertTrue(rich_mesh.is_file(), "Uitgebreide hartatlas ontbreekt")
        self.assertGreater(rich_mesh.stat().st_size, 100000)
        self.assertTrue(rich_manifest.is_file(), "Uitgebreid hartmanifest ontbreekt")
        import json
        data = json.loads(rich_manifest.read_text(encoding="utf-8"))
        self.assertEqual(data.get("format"), 2)
        self.assertEqual(len(data["parts"]), 34)
        self.assertEqual(data["bytes"], rich_mesh.stat().st_size)
        ids = {part["id"] for part in data["parts"]}
        for part_id in ("ra", "rv", "la", "lv", "mitral", "tricuspid", "aortic", "pulmonary", "pap_lv", "pap_rv"):
            self.assertIn(part_id, ids)
        self.assertIn("BodyParts3D 4.0", data["source"])
        self.assertTrue((lab / "MODEL_SOURCE.md").is_file())
        script = (lab / "heart.js").read_text(encoding="utf-8")
        self.assertIn("getContext('webgl'", script)
        self.assertIn(f"from './cycle.js?v={release}'", script)
        self.assertIn(f"from './anatomyGeometry.js?v={release}'", script)
        self.assertIn(f"atlas-heart-rich',true", script)
        self.assertIn("const GUIDED_STEPS", script)
        self.assertIn("function selectGuideStep(index)", script)
        self.assertIn("function syncLearningMode()", script)
        self.assertNotIn("const STORY_PHASES", script)
        self.assertIn('id="guideStart"', source)
        self.assertIn('id="guideNext"', source)
        self.assertIn('id="guideExit"', source)
        self.assertIn('id="exploreStart"', source)
        self.assertIn("function isLayerVisible(part)", script)
        self.assertIn("function drawAtlasExterior(m,section=false)", script)
        self.assertIn("function makeAtlasFlowPaths(centers)", script)
        self.assertIn("function updateFlowOverlay(m)", script)
        self.assertIn("function cameraPan(dx,dy)", script)
        self.assertIn("const pointers=new Map()", script)
        self.assertIn("drawAtlasExterior(m,state.cutaway);", script)
        self.assertIn("if(part.kind==='space'||!isLayerVisible(part)||(!section&&part.kind==='wall'))continue;", script)
        self.assertIn("state.focusSide='both'", script)
        self.assertIn("requestAnimationFrame(frame)", script)
        self.assertIn("drawParticles(m)", script)
        self.assertIn("drawChart('pressureChart'", script)
        self.assertIn("drawChart('volumeChart'", script)
        atlas = (ATLAS / "index.html").read_text(encoding="utf-8")
        self.assertIn(f'href="/tools/anatomie/labs/hartslag/?v={release}"', atlas)
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

    def test_anatomie_route_in_catalogue_and_concise_navigation(self):
        # build_site runs before prepare_ui in one workflow. Both stages matter.
        from bs4 import BeautifulSoup
        for rel in ("nl/tools/index.html", "en/tools/index.html"):
            with self.subTest(page=rel):
                soup = BeautifulSoup((OUT / rel).read_text(encoding="utf-8"), "html.parser")
                self.assertEqual(len(soup.select('main a[href="/tools/anatomie/"]')), 1)
                if soup.select_one('.eai-site-menu'):
                    self.assertEqual(len(soup.select('.eai-site-menu a[href="/tools/anatomie/"]')), 1)
        old = BeautifulSoup((OUT / "tools/index.html").read_text(encoding="utf-8"), "html.parser")
        if old.find('meta', attrs={'http-equiv': 'refresh'}):
            self.assertEqual(old.select_one('main a[href]')['href'], '/nl/tools/')
        else:
            self.assertEqual(len(old.select('main a[href="/tools/anatomie/"]')), 1)
        navigation_source = (ROOT / "scripts/prepare_ui.py").read_text(encoding="utf-8")
        self.assertEqual(navigation_source.count("'/tools/anatomie/'"), 1)

    def test_build_reproducible_and_repository_local(self):
        source = (ROOT / "scripts" / "build_anatomie.py").read_text(encoding="utf-8")
        self.assertIn("8ca3b7421bcfbe88b85859eb1983d5cf79f21749", source)
        self.assertIn("git", source)
        self.assertIn("npm", source)
        self.assertNotIn("iframe", source.lower())
        self.assertNotIn("https://nqwrc.github.io/", source)


if __name__ == "__main__":
    unittest.main()
