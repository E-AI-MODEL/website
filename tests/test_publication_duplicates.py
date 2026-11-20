"""Regressieproeven voor de dubbele-paginacontrole vóór publicatie."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from check_publication_duplicates import audit, known_pairs, summary_md


LONG_TEXT = " ".join(
    f"Een leerling oefent onderwerp nummer {i} en bekijkt de uitkomst opnieuw."
    for i in range(55)
)
OTHER_TEXT = " ".join(
    f"Een docent berekent voorbeeld {i} en controleert verschillende metingen."
    for i in range(55)
)


class PublicationDuplicatesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.site = Path(self.temp.name)

    def page(self, url, text=LONG_TEXT, title="Pagina", canonical=None,
             redirect=None, noindex=False):
        route = url.strip("/")
        target = self.site / route / "index.html" if route else self.site / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        links = '<link rel="canonical" href="https://eaimodel.nl' + (canonical or url) + '">'
        if redirect:
            links += f'<meta http-equiv="refresh" content="0;url={redirect}">'
        if noindex:
            links += '<meta name="robots" content="noindex">'
        target.write_text(
            f'<html><head><title>{title} | EAI</title>{links}</head>'
            f'<body><header>Algemeen menu</header><main><h1>{title}</h1>'
            f'<p>{text}</p></main><footer>Footer</footer></body></html>',
            encoding="utf-8",
        )

    def sitemap(self, *paths):
        (self.site / "sitemap.xml").write_text(
            '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            + "".join(f"<url><loc>https://eaimodel.nl{path}</loc></url>" for path in paths)
            + "</urlset>",
            encoding="utf-8",
        )

    def test_two_different_pages_are_fine(self):
        self.page("/een/", LONG_TEXT, "Eerste")
        self.page("/twee/", OTHER_TEXT, "Tweede")
        self.sitemap("/een/", "/twee/")
        result = audit(self.site, {})
        self.assertEqual("geen_afwijkingen", result["status"])

    def test_same_sitemap_url_blocks(self):
        self.page("/een/")
        self.sitemap("/een/", "/een/")
        result = audit(self.site, {})
        self.assertIn("dubbele_sitemap_url", [x["type"] for x in result["blocking"]])

    def test_two_canonicals_with_same_target_block(self):
        self.page("/een/", LONG_TEXT, "Eerste", canonical="/een/")
        self.page("/twee/", OTHER_TEXT, "Tweede", canonical="/een/")
        self.sitemap("/een/", "/twee/")
        kinds = {x["type"] for x in audit(self.site, {})["blocking"]}
        self.assertIn("dubbele_canonieke_eigenaar", kinds)
        self.assertIn("canoniek_wijst_naar_andere_pagina", kinds)

    def test_true_redirect_is_not_a_duplicate(self):
        self.page("/oud/", "Deze pagina is verhuisd", "Verhuisd",
                  canonical="/nieuw/", redirect="/nieuw/")
        self.page("/nieuw/", LONG_TEXT, "Nieuwe pagina")
        self.sitemap("/oud/", "/nieuw/")
        result = audit(self.site, {})
        self.assertEqual([], result["blocking"])
        self.assertEqual(1, result["counts"]["redirects"])

    def test_identical_main_content_blocks_even_if_titles_differ(self):
        self.page("/een/", LONG_TEXT, "Eerste")
        self.page("/twee/", LONG_TEXT, "Tweede")
        self.sitemap("/een/", "/twee/")
        self.assertIn("exact_dezelfde_pagina", [x["type"] for x in audit(self.site, {})["blocking"]])

    def test_nearly_identical_homepages_are_reported(self):
        self.page("/", LONG_TEXT, "Homepage")
        self.page("/nl/", LONG_TEXT + " Extra uitleg over de les.", "Homepage")
        self.sitemap("/", "/nl/")
        result = audit(self.site, {})
        self.assertIn("nieuwe_vermoedelijke_dubbeling", [x["type"] for x in result["blocking"]])

    def test_known_existing_duplicate_stays_visible_but_does_not_block(self):
        self.page("/", LONG_TEXT, "Homepage")
        self.page("/nl/", LONG_TEXT + " Extra uitleg over de les.", "Homepage")
        self.sitemap("/", "/nl/")
        known = {("/", "/nl/"): "Deze twee homepages moeten nog worden samengevoegd of omgeleid."}
        result = audit(self.site, known)
        self.assertEqual([], result["blocking"])
        self.assertIn("bekende_dubbeling_nog_open", [x["type"] for x in result["review"]])
        self.assertIn("Nog te beoordelen", summary_md(result))

    def test_unlisted_duplicate_is_reported_not_deleted(self):
        self.page("/een/", LONG_TEXT, "Eerste")
        self.page("/legacy/", LONG_TEXT, "Legacy")
        self.sitemap("/een/")
        result = audit(self.site, {})
        self.assertEqual([], result["blocking"])
        self.assertIn("dubbele_directe_route", [x["type"] for x in result["review"]])

    def test_missing_build_output_fails(self):
        self.page("/een/")
        self.sitemap("/een/", "/vergeten/")
        self.assertIn("ontbrekende_pagina", [x["type"] for x in audit(self.site, {})["blocking"]])

    def test_separate_topo_release_is_not_treated_as_missing(self):
        self.page("/een/")
        self.sitemap("/een/", "/topo/")
        self.assertEqual([], audit(self.site, {})["blocking"])

    def test_fast_preview_reports_unbuilt_anatomy_instead_of_calling_it_clean(self):
        self.page("/een/")
        self.sitemap("/een/", "/tools/anatomie/")
        quick = audit(self.site, {}, frozenset({"/tools/anatomie/"}))
        self.assertEqual([], quick["blocking"])
        self.assertEqual("aandacht", quick["status"])
        self.assertEqual(1, quick["counts"]["pas_in_volledige_release"])
        full = audit(self.site, {})
        self.assertIn("ontbrekende_pagina", [x["type"] for x in full["blocking"]])

    def test_arbitrary_deferred_page_is_forbidden(self):
        self.page("/een/")
        self.sitemap("/een/", "/twee/")
        with self.assertRaisesRegex(ValueError, "Onbekende uitgestelde pagina"):
            audit(self.site, {}, frozenset({"/twee/"}))

    def test_different_language_versions_do_not_block(self):
        self.page("/nl/", LONG_TEXT, "Les")
        self.page("/en/", OTHER_TEXT, "Les")
        self.sitemap("/nl/", "/en/")
        self.assertEqual([], audit(self.site, {})["blocking"])

    def test_known_review_requires_explanation(self):
        policy = self.site / "known.json"
        policy.write_text(json.dumps({
            "schema": "eai-publication-duplicates-v1",
            "open": [{"urls": ["/", "/nl/"], "reason": "Kort"}],
        }), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Toelichting"):
            known_pairs(policy)

    def test_publication_workflow_has_hard_gate(self):
        workflow = (ROOT / ".github/workflows/deploy-theory7.yml").read_text(encoding="utf-8")
        upload = workflow.find("Publish assets before HTML")
        guard = workflow.find("python scripts/check_publication_duplicates.py")
        self.assertGreater(guard, 0)
        self.assertLess(guard, upload)
        self.assertIn("GITHUB_STEP_SUMMARY", workflow)
        self.assertIn("--json", workflow)

    def test_own_workflow_checks_real_build(self):
        workflow = (ROOT / ".github/workflows/publication-duplicates.yml").read_text(encoding="utf-8")
        self.assertIn("python scripts/build_site.py", workflow)
        self.assertIn("python scripts/prepare_ui.py", workflow)
        self.assertIn("python scripts/check_publication_duplicates.py", workflow)
        self.assertIn("upload-artifact", workflow)


if __name__ == "__main__":
    unittest.main()
