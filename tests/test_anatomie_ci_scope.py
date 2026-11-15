"""CI-controles voor het afsplitsen van 3D-tests en publicatiebewijs."""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from anatomie_ci_scope import must_test_anatomy
from verify_eaigit_live import FILES, check, verify


class AnatomyScopeTests(unittest.TestCase):
    def test_onverwante_prs_hoeven_geen_zware_3d_proef(self):
        for path in ("assets/eaigit/wizard.mjs", "tools/eaigame/index.html",
                     "tests/test_projecthulp.mjs", "docs/readme.md"):
            with self.subTest(path=path):
                self.assertFalse(must_test_anatomy([path]))

    def test_3d_en_websitebouw_wijzigingen_behouden_de_proef(self):
        for path in ("content/anatomie/labs/hartslag/index.html",
                     "scripts/build_anatomie.py", "scripts/extract_hart_rich.mjs",
                     "tools/anatomie/index.html", "assets/site.css",
                     "scripts/prepare_ui.py", ".github/workflows/verify-ui.yml"):
            with self.subTest(path=path):
                self.assertTrue(must_test_anatomy([path]))

    def test_workflow_bouwt_anatomie_een_keer_en_test_main_altijd(self):
        workflow = (ROOT / ".github/workflows/verify-ui.yml").read_text()
        self.assertEqual(workflow.count("python scripts/build_anatomie.py --out"), 1)
        self.assertIn('if [ "$GITHUB_EVENT_NAME" = "push" ]', workflow)
        self.assertEqual(workflow.count("if: steps.anatomy_scope.outputs.run == 'true'"), 3)
        self.assertIn("git diff --name-only -z 'HEAD^1' HEAD", workflow)


class LiveProofTests(unittest.TestCase):
    def sample_site(self, root):
        for path in FILES:
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((path + ": eigen release").encode())

    def test_live_bestanden_moeten_letterlijk_met_de_build_overeenkomen(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.sample_site(root)
            fetcher = lambda url: (root / url.split("https://eaimodel.nl/", 1)[1]).read_bytes()
            check(root, "https://eaimodel.nl", fetcher)

    def test_een_verouderd_live_bestand_moet_publicatie_afkeuren(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.sample_site(root)
            def fetcher(url):
                relative = url.split("https://eaimodel.nl/", 1)[1]
                if relative == "tools/eaigit/index.html":
                    return b"oude of ontbrekende wizard"
                return (root / relative).read_bytes()
            with self.assertRaisesRegex(RuntimeError, "verschilt"):
                check(root, "https://eaimodel.nl", fetcher)
            with self.assertRaisesRegex(RuntimeError, "niet bevestigd"):
                verify(root, "https://eaimodel.nl", 0, fetcher, lambda _: None)

    def test_onveilig_of_verkeerd_domein_wordt_geweigerd(self):
        with tempfile.TemporaryDirectory() as temp:
            for origin in ("http://eaimodel.nl", "https://example.org"):
                with self.subTest(origin=origin):
                    with self.assertRaisesRegex(ValueError, "productie-HTTPS"):
                        verify(Path(temp), origin, 0, lambda _: b"", lambda _: None)

    def test_deploy_parallel_en_strenge_live_verificatie(self):
        workflow = (ROOT / ".github/workflows/deploy-theory7.yml").read_text()
        self.assertEqual(workflow.count("mirror -R --parallel=3"), 3)
        self.assertIn("timeout-minutes: 30", workflow)
        self.assertIn("set xfer:use-temp-file yes", workflow)
        self.assertIn("Verify Theory7 FTPS certificate fingerprint", workflow)
        self.assertIn("verify_eaigit_live.py --root site-build", workflow)
        self.assertNotIn("mirror -R --delete", workflow)


if __name__ == "__main__":
    unittest.main()
