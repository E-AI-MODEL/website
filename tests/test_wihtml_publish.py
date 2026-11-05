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
        self.assertIn("selectors.split(',').some(x=>x.trim().split(/\\s+/).pop()===selector)", text)
        self.assertIn("css.replace(/([^{}]+)", text)
        self.assertIn('let css=$("templateCSS").value;', text)
        self.assertIn("css=setDeclarations(css,'.wi-shell'", text)
        self.assertIn("css=setDeclarations(css,'.wi-content'", text)
        self.assertIn("css=setDeclarations(css,'.wi-bottom'", text)

    def test_every_editor_render_saves_after_initial_load(self):
        text = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        self.assertIn("let draftTrackingReady=false;", text)
        self.assertIn("if(draftTrackingReady)scheduleDraftSave();", text)
        self.assertIn("renderEditor();\\nsetWorkMode(savedWorkMode(),false);\\ndraftTrackingReady=true;".replace("\\n", "\n"), text)
        self.assertIn('renderDesigner();scheduleDraftSave();', text)
        self.assertIn('applyFeatures();scheduleDraftSave();', text)

    def test_library_and_landing_are_published(self):
        landing = BUILD / "tools/wihtml/index.html"
        library = BUILD / "tools/wihtml/bibliotheek/index.html"
        self.assertTrue(landing.exists())
        self.assertTrue(library.exists())
        intro = landing.read_text(encoding="utf-8")
        catalogue = library.read_text(encoding="utf-8")
        self.assertIn("Zo werkt het", intro)
        self.assertIn("/tools/wihtml/bibliotheek/", intro)
        self.assertIn("/tools/wihtml/studio/?start=nieuw", intro)
        self.assertIn("/tools/wihtml/studio/?start=import", intro)
        self.assertIn('id="wi-level"', catalogue)
        self.assertIn('id="wi-topic"', catalogue)
        self.assertIn('id="wi-kind"', catalogue)
        for key in ("groeifactor", "lineair", "kansen"):
            with self.subTest(lesson=key):
                self.assertIn("lesson=" + key, catalogue)
        self.assertIn("/tools/wihtml/voorbeeld/", catalogue)

    def test_curated_library_json_is_an_editable_lesson(self):
        for name in ("lineaire-verbanden", "kansen-twee-worpen"):
            source = ROOT / "content/wihtml/bibliotheek" / (name + ".json")
            published = BUILD / "tools/wihtml/bibliotheek" / (name + ".json")
            with self.subTest(name=name):
                self.assertEqual(source.read_bytes(), published.read_bytes())
                lesson = json.loads(published.read_text(encoding="utf-8"))
                self.assertTrue(lesson["title"])
                self.assertTrue(lesson["goal"])
                self.assertGreaterEqual(len(lesson["slides"]), 3)
                for slide in lesson["slides"]:
                    self.assertIn(slide["type"], ("text", "question", "table", "steps", "practice", "compare"))
                    self.assertTrue(slide.get("student"))
                    if slide["type"] == "question":
                        self.assertIn(slide["correct"], range(len(slide["options"])))

    def test_studio_start_does_not_remove_interactions(self):
        studio = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        for marker in ('id="startDialog"', 'id="startNew"', 'id="startImport"',
                       'id="startRestore"', 'id="startSelectedLesson"',
                       'function startBlankLesson(route)', 'function loadLibraryLesson(key,showPreview=false)',
                       "if(document.documentElement.classList.contains('standalone'))return;",
                       "if(!draftAvailable()){", "openExample().finally(",
                       'const WIHTML_LIBRARY_FILES='):
            with self.subTest(marker=marker):
                self.assertIn(marker, studio)

    def test_quick_and_studio_use_one_lesson(self):
        studio = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        for marker in (
            'id="modeQuick"', 'id="modeStudio"', 'id="quickFocus"',
            'id="quickAdd"', 'id="quickInsertDialog"',
            'data-quick-type="graph"', 'data-quick-type="question"',
            'data-quick-type="practice"', 'function setWorkMode(mode,persist=true)',
            'function setFocusMode(enabled)', 'function openQuickInsert()',
            "setWorkMode(savedWorkMode(),false);",
            "lesson.slides.splice(selected+1,0,slide);",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, studio)
        self.assertIn("let workMode='quick';", studio)
        self.assertIn("if(workMode==='studio')setFocusMode(false)", studio)
        self.assertIn("if(workMode==='quick'){openQuickInsert();return}", studio)
        self.assertIn("const WIHTML_MODE_KEY='wihtml:docentstudio:modus:v1';", studio)

    def test_guided_flow_reuses_existing_lesson_and_export(self):
        studio = (BUILD / "tools/wihtml/studio/index.html").read_text(encoding="utf-8")
        for marker in (
            'id="guideFlow"', 'id="guideInfo"', 'id="guideSlide"',
            'id="guideNotes"', 'id="guideDesign"', 'id="guideTools"',
            'id="guideReview"', 'id="guideResult"',
            'id="guidePrevious"', 'id="guideNext"', 'id="guideProgress"',
            'id="guideDownloadHTML"', 'id="guideDownloadJSON"',
            'id="guideOutlineDialog"', 'id="guideFieldsDialog"',
            'function guidePages()', 'function guideShow(page)',
            'function guideMove(delta)', 'function guideRender()',
            'function guideSaveStep()',
            "guideShow({kind:'info'})",
            "if(document.documentElement.classList.contains('standalone'))return;",
            "guideReady=true;",
            "guideShow({kind:'slide',id:slide.id});",
            "if(guideReady)guideRender();",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, studio)
        self.assertIn("pages.push({kind:'slide',id:slide.id", studio)
        self.assertIn("if(workMode==='studio')pages.push({kind:'notes',id:slide.id", studio)
        self.assertIn("$('guideDownloadHTML').onclick=()=>$('export').click();", studio)
        self.assertIn("$('guideDownloadJSON').onclick=()=>$('save').click();", studio)
        self.assertIn("syncDesignForm(slide);renderDesigner();scheduleDraftSave();", studio)

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
        self.assertIn("https://eaimodel.nl/tools/wihtml/bibliotheek/</loc>", text)
        self.assertIn("https://eaimodel.nl/tools/wihtml/voorbeeld/</loc>", text)

if __name__ == "__main__":
    unittest.main()
