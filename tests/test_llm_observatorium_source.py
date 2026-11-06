"""Static publication safety checks for the standalone LLM Observatory."""
from pathlib import Path
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

    def test_token_journey_and_graph_are_interactive(self):
        html = self.html
        for element in ('journeyPanel', 'journeyWhere', 'journeyToken',
                        'journeyPrev', 'journeyNext', 'journeyPlay',
                        'journeyFill', 'plotSummary', 'startJourney'):
            self.assertIn('id="' + element + '"', html)
        self.assertIn('function drawStream()', html)
        self.assertIn('function journeyStep(direction)', html)
        self.assertIn('function selectAtGraph(x)', html)
        self.assertIn("plot.addEventListener('pointerup'", html)
        self.assertIn('screenJourney=pts', html)
        self.assertIn('function updateJourneyUI()', html)
        self.assertIn('state.follow=true', html)
        self.assertIn('state.follow=false', html)
        self.assertIn('function setCameraMatrix()', html)

    def test_source_and_demo_distinction(self):
        self.assertIn("gpt-oss-120b/blob/main/config.json", self.html)
        self.assertIn("gpt-oss-20b/blob/main/config.json", self.html)
        self.assertIn("Geen uitgelezen modelactivaties", self.html)
        self.assertIn("geen echte token-id", self.html.lower())

    def test_not_publicly_linked_until_review(self):
        # This PR intentionally changes neither the build script nor public navigation.
        build = (ROOT / "scripts" / "build_site.py").read_text(encoding="utf-8")
        self.assertNotIn('tools/llm-observatorium/index.html', build)


if __name__ == "__main__":
    unittest.main()
