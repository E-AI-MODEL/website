"""Static publication safety checks for the standalone LLM Observatory."""
from pathlib import Path
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
        for name in ("Modelstelsel", "Tokenreis", "Experts", "Attention", "Context", "Generatie"):
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
        self.assertIn("Elk vlak is een modellaag.", self.html)


    def test_beginner_guide_keeps_research_features_available(self):
        html = self.html
        for marker in ('id="aiGuide"', "box.id='guidePrompt'", 'id="guideVisual"',
                       'id="guideInteractive"', 'id="guideTechnical"',
                       'id="guideNext"', 'id="guidePrev"',
                       'function setupGuide()', 'function guideSetVisible(open)',
                       'function guideTokenChips(parent,contextMode)',
                       'function guideBarData()', 'function guideDrawBars()',
                       'function guideRender()', 'setupGuide();loadRealTokenizer();'):
            self.assertIn(marker, html)
        self.assertIn("Deze vier kansen zijn uitsluitend een demonstratie.", html)
        self.assertIn("De precieze verdeling wordt geladen.", html)
        self.assertIn("Deze pagina verstuurt je vraag niet naar een AI-model.", html)
        self.assertIn("function drawExpertsGrid()", html)
        self.assertIn("function renderInspector()", html)

    def test_reasoning_and_token_costs(self):
        html = self.html
        self.assertIn("name:'Redenering & kosten'", html)
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
        self.assertIn("Geen uitgelezen modelactivaties", self.html)
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
        for rel in ("tools/index.html", "nl/tools/index.html"):
            with self.subTest(page=rel):
                page = ROOT / "site-build" / rel
                self.assertTrue(page.is_file())
                self.assertIn('href="/tools/llm-observatorium/"', page.read_text(encoding="utf-8"))
        sitemap = (ROOT / "site-build/sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("/tools/llm-observatorium/", sitemap)


if __name__ == "__main__":
    unittest.main()
