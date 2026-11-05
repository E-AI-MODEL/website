"""Tests voor publicatie van WiHTML op eaimodel.nl."""
from pathlib import Path
from html.parser import HTMLParser
import json
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
        self.assertIn("/tools/wihtml/voorbeeld-lesinhoud.json", p.links)
        p = LinkParser()
        p.feed(tools.read_text(encoding="utf-8"))
        self.assertIn("/tools/wihtml/", p.links)

    def test_studio_has_teacher_functions(self):
        text = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        for marker in ('id="templateDialog"', 'id="export"', 'id="preview"',
                       'id="draw"', 'id="toolpop"', 'id="templateDownload"',
                       'id="newLesson"', 'Onderzoekstabel', 'Zelfstandig oefenen',
                       'Verklaren en vergelijken', 'tableView', 'practiceView', 'compareView',
                       'id="defaultLayout"', 'id="routePreset"', 'data-feature="drawing"',
                       'id="jsonExample"', 'normalizeLessonJSON',
                       'quizGroupView', 'mistakeView', 'chooseExperiment',
                       'graphPollSecond', 'id="deckTitle"', 'id="deckProgress"',
                       'questionChoices', 'data-answer-index',
                       'id="designCanvas"', 'id="designType"', 'id="advancedFields"',
                       'id="designPreview"', 'id="designCopy"', 'id="themeBg"',
                       'id="templateCodeDetails"', 'id="draftRestore"',
                       'WIHTML_DRAFT_KEY', 'renderDesigner', 'initDesignControls'):
            with self.subTest(marker=marker):
                self.assertIn(marker, text)

    def test_visual_controls_preserve_other_css(self):
        text = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        self.assertIn("const setDeclarations=(css,selector,declarations)=>", text)
        self.assertIn('let css=$("templateCSS").value;', text)
        self.assertIn("css=setDeclarations(css,'.wi-shell'", text)
        self.assertIn("css=setDeclarations(css,'.wi-content'", text)
        self.assertIn("css=setDeclarations(css,'.wi-bottom'", text)

    def test_every_editor_render_saves_after_initial_load(self):
        text = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        self.assertIn("let draftTrackingReady=false;", text)
        self.assertIn("if(draftTrackingReady)scheduleDraftSave();", text)
        self.assertIn("renderEditor();\\ndraftTrackingReady=true;".replace("\\n", "\n"), text)
        self.assertIn('renderDesigner();scheduleDraftSave();', text)
        self.assertIn('applyFeatures();scheduleDraftSave();', text)

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

    def test_json_example_is_published(self):
        source = ROOT / "content/wihtml/voorbeeld-lesinhoud.json"
        published = BUILD / "tools/wihtml/voorbeeld-lesinhoud.json"
        self.assertTrue(source.exists())
        self.assertTrue(published.exists())
        self.assertEqual(source.read_bytes(), published.read_bytes())
        data = json.loads(published.read_text(encoding="utf-8"))
        self.assertIn("vragen", data)
        self.assertIn("opgaven", data)

    def test_site_has_sitemap_entries(self):
        text = (BUILD / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://eaimodel.nl/tools/wihtml/</loc>", text)
        self.assertIn("https://eaimodel.nl/tools/wihtml/studio/</loc>", text)
        self.assertIn("https://eaimodel.nl/tools/wihtml/voorbeeld/</loc>", text)

if __name__ == "__main__":
    unittest.main()
