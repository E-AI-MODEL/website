"""Static publication safety checks for the standalone LLM Observatory."""
from pathlib import Path
import json
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content" / "llm-observatorium" / "index.html"


class LlmObservatorySourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = SOURCE.read_text(encoding="utf-8")

    def test_standalone_document_and_visualization(self):
        html = self.html
        self.assertIn("<!doctype html>", html.lower())
        self.assertIn('id="universe"', html)
        self.assertIn('id="plot"', html)
        self.assertIn("function drawScene()", html)
        self.assertIn("function project(p)", html)
        self.assertIn("function rebuildWorld()", html)
        self.assertIn("requestAnimationFrame(tick)", html)

    def test_six_different_research_modes(self):
        for name in ("Opbouw", "Tekststukjes", "Experts", "Eerdere tekst", "Hoeveel tekst?", "Volgend stukje"):
            self.assertIn("name:'" + name + "'", self.html)
        self.assertIn("function drawAttention()", self.html)
        self.assertIn("function drawGeneration()", self.html)
        self.assertIn("function drawPlot()", self.html)

    def test_mobile_navigation_has_five_panels(self):
        for panel in ("modules", "graph", "settings", "learn", "sources"):
            self.assertIn('data-panel="' + panel + '"', self.html)
        self.assertIn("function openPanel(name)", self.html)
        self.assertIn("function closePanel()", self.html)

    def test_token_layer_inspector_is_interactive_and_small(self):
        html = self.html
        for element in ('layerInspectorPanel', 'layerTitle', 'layerPrev',
                        'layerNext', 'layerScrub', 'layerTokenRow',
                        'layerAttentionTrack', 'layerExpertList', 'layerAttentionReach'):
            self.assertIn('id="' + element + '"', html)
        for code in ("function updateLayerInspector()", "function selectLayer(index)",
                     "function selectLayerToken(index)", "function drawStream()",
                     "function journeyStep(direction)", "function updateJourneyUI()",
                     "state.playing=false"):
            self.assertIn(code, html)
        self.assertIn('id="layerTokenCount"', html)
        self.assertIn('id="layerAttentionBadge"', html)
        self.assertIn('id="layerExpertList"', html)
        self.assertIn('#app[data-mode="1"] .plot-panel', html)
        self.assertIn("span=Math.min(state.contextTokens,cfg.window)", html)
        self.assertIn("style.setProperty('--reach'", html)
        self.assertIn("for(const route of chooseRoute(state.layer))", html)
        self.assertNotIn('id="journeyPlay"', html)
        self.assertNotIn('id="journeyPrev"', html)
        self.assertNotIn("$('journeyPlay')", html)
        self.assertNotIn('id="answers"', html)
        self.assertNotIn('id="feedback"', html)
        self.assertNotIn('Probeer dit', html)
        self.assertIn("function makeTask()", html)

    def test_inline_javascript_parses(self):
        match = re.search(r"<script>\s*(.*?)\s*</script>", self.html, re.S)
        self.assertIsNotNone(match, "Inline JavaScript ontbreekt")
        result = subprocess.run(
            ["node", "--check", "-"], input=match.group(1),
            encoding="utf-8", capture_output=True, check=False, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_views_have_distinct_purpose_and_no_automatic_playback(self):
        for method in ("drawModelScan", "drawStream", "drawRouterSignals",
                       "drawAttention", "drawContextWindow",
                       "drawGeneration", "drawUsageWorld"):
            self.assertIn("function " + method + "()", self.html)
        self.assertIn("state.playing=false", self.html)
        self.assertNotIn("state.playing=state.mode!==1", self.html)
        self.assertIn("function layerX(layer)", self.html)
        self.assertIn("function expertGrid(expert)", self.html)
        self.assertIn("const points=corners(l).map(project)", self.html)
        self.assertIn("function highlightExpert()", self.html)
        self.assertIn("SCHEMATISCH BEREIK, GEEN GEMETEN", self.html)
        self.assertNotIn("Elke ring staat voor een laag.", self.html)
        self.assertIn("Een laag is een stap in de berekening.", self.html)


    def test_beginner_guide_keeps_research_features_available(self):
        html = self.html
        for marker in ('id="aiGuide"', "box.id='guidePrompt'", 'id="guideVisual"',
                       'id="guideInteractive"', 'id="guideTechnical"',
                       'id="guideNext"', 'id="guidePrev"',
                       'function setupGuide()', 'function guideSetVisible(open)',
                       'function guideTokenChips(parent,contextMode)',
                       'function guideDrawEmbedding()', 'function guideDrawOrder()',
                       'function guideDrawAttention()', 'function guideDrawExperts()',
                       'function guideDrawLayers()', 'function guideDrawBars()',
                       'function guideDrawAnswer()', 'function guideRender()',
                       'setupGuide();loadRealTokenizer();'):
            self.assertIn(marker, html)
        self.assertIn("const GUIDE_LABELS=['Jouw vraag','Echte tokens','Getallen','Volgorde'", html)
        self.assertIn("STAP 1 VAN 9", html)
        self.assertIn("llm-learning-math.js", html)
        self.assertIn("guideMath().miniTrace", html)
        self.assertIn("Deze vier waarden zijn lokaal berekend", html)
        self.assertIn("geen metingen uit een draaiend model", html)
        self.assertIn("function drawExpertsGrid()", html)
        self.assertIn("function renderInspector()", html)

    def test_explanations_start_with_a_clear_action(self):
        html = self.html
        for passage in (
            "Je zin valt uiteen",
            "Een tokennummer wordt een rij getallen",
            "De volgorde maakt verschil",
            "Welke eerdere tekst telt mee?",
            "Vier rekennetwerken doen mee",
            "De getallen veranderen per laag",
            "Welk stukje komt hierna?",
            "Een antwoord groeit token voor token",
            "De kansberekening is echt, maar de scores en woorden zijn voorbeelden.",
            "De technische weergave toont welke tekst bereikbaar is, niet hoeveel gewicht die krijgt.",
            "vooraf geschreven",
        ):
            self.assertIn(passage, html)

    def test_automatic_story_and_interactive_guide_share_steps(self):
        html = self.html
        self.assertIn("const STORY_PHASES=GUIDE_STEPS.map", html)
        self.assertNotIn("const STORY_PHASES=[", html)
        self.assertIn("storyExampleTrace()", html)
        self.assertIn("guideMath().softmax([2.45,1.50,.82,.24],state.temp)", html)
        self.assertIn("storyTokenRow($('vTokens'),state.promptWords,10)", html)
        self.assertIn("guideStep=storyState.phase", html)
        self.assertIn("guideOpenTechnical(true)", html)
        self.assertIn("const GUIDE_TECH_MODES=[0,1,1,1,3,2,0,5,5]", html)
        self.assertIn("function guideOpenTechnical(finish=false)", html)
        self.assertIn("repeat(9,minmax(0,1fr))", html)
        self.assertIn("VOORAF GESCHREVEN ANTWOORD", html)

    def test_real_training_trace_is_genuine_and_separate_from_gpt_oss(self):
        trace_path = ROOT / "assets" / "llm-real-trace.json"
        self.assertTrue(trace_path.is_file(), "De vooraf opgenomen echte meting ontbreekt")
        self.assertLess(trace_path.stat().st_size, 50_000,
                        "De echte meting moet zonder grote download op mobiel beschikbaar blijven")
        data = json.loads(trace_path.read_text(encoding="utf-8"))
        self.assertEqual(data["kind"], "recorded_model_execution")
        self.assertEqual(data["model"]["id"], "EphAsad/IllaryiaStories-1M")
        self.assertEqual(data["model"]["experts"], 0)
        self.assertEqual(data["model"]["tokenizer"],
                         "model-specific GPT-Neo/GPT-2 tokenizer, not o200k_harmony")
        self.assertEqual(data["prompt"], "Once upon a time,")
        self.assertEqual(len(data["steps"]), 4)
        self.assertIn('llm-real-trace-viewer.js', self.html)
        self.assertIn('function guideAddRealTrace(host)', self.html)
        self.assertIn('guideAddRealTrace(interactive)', self.html)
        viewer = (ROOT / "assets" / "llm-real-trace-viewer.js").read_text(encoding="utf-8")
        self.assertIn("/assets/llm-real-trace.json", viewer)
        self.assertIn("niet jouw vraag", viewer)
        self.assertIn("head 1 in de eerste laag is dus niet dezelfde head", viewer)

    def test_local_math_module_is_present(self):
        math = ROOT / "assets" / "llm-learning-math.js"
        self.assertTrue(math.is_file(), "De echte lokale berekeningen ontbreken")
        content = math.read_text(encoding="utf-8")
        for fn in ("function softmax(", "function attention(", "function routeExperts(",
                   "function miniTrace(", "function tokenVector("):
            self.assertIn(fn, content)
        self.assertIn("Geen activaties uit gpt-oss", content)

    def test_visual_first_story_and_mobile_panels(self):
        html = self.html
        self.assertIn('id="aiGuide" class="ai-guide" hidden', html)
        self.assertIn("guideNode('button','Stap voor stap'", html)
        self.assertIn("function visualSetScene(id)", html)
        self.assertIn("v-flow-svg", html)
        self.assertIn("v-score-list", html)
        self.assertIn("v-answer", html)
        self.assertIn("function storyOpen(){", html)
        self.assertIn('#app[data-panel]:not([data-panel=""])', html)

    def test_reasoning_and_token_costs(self):
        html = self.html
        self.assertIn("name:'Kosten'", html)
        self.assertIn("function usageBuckets()", html)
        self.assertIn("function drawUsageWorld()", html)
        self.assertIn("function drawUsagePlot()", html)
        self.assertIn("function usageRefresh()", html)
        self.assertIn("uReason:1024", html)
        self.assertIn("uOther:162", html)
        self.assertIn("uInput:75", html)
        self.assertIn("usageSummary", html)
        self.assertIn("reasoningLearning", html)
        self.assertIn("BRON + REKENSOM", html)

    def test_source_and_demo_distinction(self):
        self.assertIn("gpt-oss-120b/blob/main/config.json", self.html)
        self.assertIn("gpt-oss-20b/blob/main/config.json", self.html)
        self.assertIn("geen metingen uit een draaiend model", self.html)
        self.assertIn("geen echte token-id", self.html.lower())

    def test_tokenizer_ui_has_real_data_and_explicit_fallback(self):
        html = self.html
        for marker in (
            "o200k_harmony.js",
            "function tokenizeInput()",
            "async function loadRealTokenizer()",
            "function renderTokenPieces()",
            'id="tokenChips"',
            'id="tokenId"',
            "state.tokenStatus='real'",
            "state.tokenStatus='error'",
            "tokenSeed=state.promptWords[token]?.id??token",
            "loadRealTokenizer();",
        ):
            self.assertIn(marker, html)

    def test_published_page_is_exact_source_and_linked_from_tools(self):
        published = ROOT / "site-build/tools/llm-observatorium/index.html"
        self.assertTrue(published.is_file(), "Gepubliceerde LLM-pagina ontbreekt")
        self.assertEqual(SOURCE.read_bytes(), published.read_bytes(),
                         "Publicatie mag de zelfstandige HTML niet wijzigen")
        for rel in ("nl/tools/index.html", "en/tools/index.html"):
            with self.subTest(page=rel):
                page = ROOT / "site-build" / rel
                self.assertTrue(page.is_file())
                self.assertIn('href="/tools/llm-observatorium/"', page.read_text(encoding="utf-8"))
        sitemap = (ROOT / "site-build/sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("/tools/llm-observatorium/", sitemap)


if __name__ == "__main__":
    unittest.main()
