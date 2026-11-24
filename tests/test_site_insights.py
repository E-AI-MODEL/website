from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "site-build"

class SiteInsightsTests(unittest.TestCase):
    def test_real_data_is_requested(self):
        for lang in ("nl", "en"):
            source=(ROOT / lang / "insights" / "index.html").read_text()
            self.assertIn("eai-site-insights?days=",source.replace("service+'?days='","eai-site-insights?days="))
            self.assertIn("id=\"trend\"",source)
            self.assertIn("id=\"popular\"",source)
            self.assertIn("id=\"tools\"",source)
            self.assertIn("id=\"notice\"",source)
            self.assertNotIn("Math.random",source)
    def test_every_main_menu_has_insights(self):
        self.assertIn("/nl/insights/",(ROOT/"nl/index.html").read_text())
        self.assertIn("/nl/insights/",(ROOT/"index.html").read_text())
        self.assertIn("/en/insights/",(ROOT/"assets/site-refresh.js").read_text())
        self.assertIn("/nl/insights/",(ROOT/"scripts/build_site.py").read_text())
    def test_tracker_has_no_browser_identifiers(self):
        source=(ROOT/"assets/site-insights.js").read_text()
        for forbidden in ("localStorage","sessionStorage","document.cookie","userAgent","Math.random","searchParams","location.search"):
            self.assertNotIn(forbidden,source)
        for event in ("pagina","tool","gelezen"):
            self.assertIn("'"+event+"'",source)
        self.assertIn("globalPrivacyControl",source)
    def test_service_is_server_side_only(self):
        script=(ROOT/"backend/site-insights/index.ts").read_text()
        self.assertIn("SUPABASE_SECRET_KEYS",script)
        self.assertIn("p_path:body.path",script)
        self.assertIn("sitePath(body.path)",script)
        self.assertIn("allowed.has(origin)",script)
    def test_generated_pages_exist_when_build_is_present(self):
        if not BUILD.is_dir():self.skipTest("Sitebuild has not run")
        for path in ("nl/insights/index.html","en/insights/index.html","assets/site-insights.js"):
            self.assertTrue((BUILD/path).is_file(),path)
        self.assertIn("/assets/site-insights.js",(BUILD/"index.html").read_text())
        self.assertNotIn("site-insights.js",(BUILD/"leif/index.html").read_text())

if __name__ == "__main__":
    unittest.main()
