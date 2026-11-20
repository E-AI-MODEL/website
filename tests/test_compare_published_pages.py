"""Tests voor de read-only FTPS-publicatievergelijking."""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from compare_published_pages import compare, url_for, normalize_path, owner, markdown


class ServerComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "index.html").write_text("<html><body>Home</body></html>", encoding="utf-8")

    def list(self, extra=()):
        return "\n".join(["/index.html"] + [f"/pagina-{i}/index.html" for i in range(22)] + list(extra))

    def test_clean_paths_and_directory_urls(self):
        self.assertEqual("topo/index.html", normalize_path("./topo/index.html"))
        self.assertEqual("/topo/", url_for("topo/index.html"))
        self.assertEqual("/", url_for("index.html"))
        self.assertEqual("/file.html", url_for("file.html"))
        self.assertIsNone(normalize_path("../private.html"))
        self.assertIsNone(normalize_path("/.well-known/secrets.html"))

    def test_only_server_and_only_build_are_distinct(self):
        (self.root / "nieuw").mkdir()
        (self.root / "nieuw/index.html").write_text("<html>Nieuw</html>", encoding="utf-8")
        report = compare(self.root, self.list(), http_limit=0)
        self.assertEqual(22, report["aantallen"]["alleen_ftp"])
        self.assertEqual(["nieuw/index.html"], report["alleen_build"])
        self.assertEqual(1, report["aantallen"]["dezelfde_bestandsroute"])
        self.assertIn("Server tegenover websitebuild", markdown(report))

    def test_independent_deploy_is_not_called_unowned(self):
        report = compare(self.root, self.list(["/topo/index.html", "/tools/delf-live/index.html"]), 0)
        self.assertEqual(2, report["aantallen"]["apart_gepubliceerd"])
        self.assertEqual("TOPO (eigen publicatie)", owner("topo/instellingen/index.html"))
        self.assertEqual("DELF (eigen publicatie)", owner("tools/delf-live/mobile-preview.html"))

    def test_published_source_copies_and_eaispeak_remain_separate(self):
        report = compare(self.root, self.list([
            "/content/bronnen-page.html", "/tools/eaispeak/index.html"
        ]), 0)
        self.assertEqual(1, report["aantallen"]["bronkopieen_op_ftp"])
        self.assertEqual(1, report["aantallen"]["eaispeak_buiten_build"])
        self.assertEqual(0, report["aantallen"]["apart_gepubliceerd"])
        labels = {x["bestand"]: x["beheer"] for x in report["alleen_ftp"]}
        self.assertIn("Bronkopie", labels["content/bronnen-page.html"])
        self.assertIn("EAIspeak", labels["tools/eaispeak/index.html"])

    def test_partial_scan_does_not_claim_deeper_build_routes_are_missing(self):
        deep = self.root / "tools/voorbeeld/extra/deeper/achter/index.html"
        deep.parent.mkdir(parents=True)
        deep.write_text("<html>Diep</html>", encoding="utf-8")
        report = compare(self.root, self.list(), http_limit=0, max_depth=4)
        self.assertNotIn("tools/voorbeeld/extra/deeper/achter/index.html", report["alleen_build"])
        self.assertEqual(4, report["scan_diepte"])

    def test_publication_checks_server_before_upload(self):
        workflow = (ROOT / ".github/workflows/deploy-theory7.yml").read_text(encoding="utf-8")
        self.assertLess(workflow.index("python scripts/compare_published_pages.py"),
                        workflow.index("Publish assets before HTML"))
        self.assertIn("find -d 10 /", workflow)
        self.assertNotIn("mirror -R --delete", workflow)

    def test_four_retired_3d_pages_are_marked_not_confused_with_live_sites(self):
        paths = [
            "/content/legacy/onderwijsin-3d.html",
            "/onderwijsin/3d/index.html",
            "/houseoftalents/3d/index.html",
            "/onderwijsin/houseoftalents/3d/index.html",
        ]
        report = compare(self.root, self.list(paths), http_limit=0)
        self.assertEqual(4, report["aantallen"]["oude_3d_kopieen"])
        named = {x["bestand"]: x["beheer"] for x in report["alleen_ftp"]}
        for path in paths:
            self.assertIn("Verouderde 3D-kopie", named[path.removeprefix("/")])

    def test_restricted_locations_never_enter_report(self):
        report = compare(self.root, self.list(["/admin/secret.html", "/leif/beheer/index.html"]), 0)
        self.assertNotIn("admin/secret.html", [x["bestand"] for x in report["alleen_ftp"]])
        self.assertNotIn("leif/beheer/index.html", [x["bestand"] for x in report["alleen_ftp"]])
        self.assertEqual(2, report["aantallen"]["afgeschermd_niet_gerapporteerd"])

    def test_incomplete_listing_fails_instead_of_green(self):
        with self.assertRaisesRegex(ValueError, "onvolledig"):
            compare(self.root, "/index.html", 0)

    def test_read_only_inventory_does_not_modify_files(self):
        original = (self.root / "index.html").read_bytes()
        compare(self.root, self.list(), 0)
        self.assertEqual(original, (self.root / "index.html").read_bytes())


if __name__ == "__main__":
    unittest.main()
