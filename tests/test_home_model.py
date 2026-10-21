"""Regression tests for the five generated homepage/model routes."""
import sys
import tempfile
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from home_model import install, VERSION


class HomeModelTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        for lang in ('nl', 'en'):
            path = self.root / lang / 'index.html'
            path.parent.mkdir(parents=True)
            path.write_text(f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><title>Original</title><meta name="description" content="Original"><link rel="canonical" href="https://eaimodel.nl/{lang}/"><link rel="alternate" hreflang="nl" href="https://eaimodel.nl/nl/"><link rel="alternate" hreflang="en" href="https://eaimodel.nl/en/"></head><body class="eai-refresh"><header class="site-header"><nav>EAI</nav></header><main id="main-content"><h1>Original</h1></main><footer class="site-footer">Original footer</footer></body></html>''', encoding='utf-8')
        (self.root / 'sitemap.xml').write_text('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://eaimodel.nl/</loc></url></urlset>')
        self.handoff = self.root / 'houseoftalents/index.html'
        self.handoff.parent.mkdir()
        self.handoff.write_text('DO NOT MODIFY THIS HANDOFF')
        self.other = self.root / 'nl/tools/index.html'
        self.other.parent.mkdir()
        self.other.write_text('DO NOT MODIFY THE TOOLS CONTENT')
        self.paths = install(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def page(self, relative):
        return BeautifulSoup((self.root / relative).read_text(), 'html.parser')

    def test_exact_scope_and_untouched_neighbours(self):
        self.assertEqual(self.paths, ['index.html', 'nl/index.html', 'en/index.html', 'nl/model/index.html', 'en/model/index.html'])
        self.assertEqual(self.handoff.read_text(), 'DO NOT MODIFY THIS HANDOFF')
        self.assertEqual(self.other.read_text(), 'DO NOT MODIFY THE TOOLS CONTENT')

    def test_one_title_unique_ids_and_ordered_steps(self):
        for relative in self.paths:
            soup = self.page(relative)
            self.assertEqual(len(soup.select('h1')), 1, relative)
            self.assertEqual(soup.body['data-home-model'], VERSION)
            ids = [tag['id'] for tag in soup.select('[id]')]
            self.assertEqual(len(ids), len(set(ids)), relative)
            expected = ['Process', 'Stage', 'Meaningful action', 'AI'] if relative.startswith('en/') else ['Proces', 'Fase', 'Kernhandeling', 'AI']
            self.assertEqual([n.get_text() for n in soup.select('.hm-steps strong')], expected)

    def test_home_alias_and_existing_hash_links_survive(self):
        self.assertEqual(str(self.page('index.html').main), str(self.page('nl/index.html').main))
        for relative in ('index.html', 'nl/index.html', 'en/index.html'):
            soup = self.page(relative)
            for anchor in ('model', 'voorbeeld', 'verhaal', 'verder-lezen', 'beginnen'):
                self.assertIsNotNone(soup.find(id=anchor), (relative, anchor))
            self.assertEqual(len(soup.select('[data-eai-demo]')), 3)
            self.assertEqual(len(soup.select_one('#eai-demo-output')['data-scenarios'].split('|')), 3)
            self.assertEqual(len(soup.select('.hm-nojs-examples details')), 3)

    def test_model_definition_and_evidence_not_replaced_by_activity(self):
        soup = self.page('nl/model/index.html')
        self.assertIn('Aan welke stap moet de leerling in deze fase zelf inhoudelijke betekenis geven om tot leren te komen?', soup.select_one('#kernhandeling').get_text())
        self.assertIn('Iets toevoegen is niet hetzelfde als betekenis geven.', soup.get_text())
        self.assertIn('Ook een vraag kan al iets overnemen.', soup.get_text())
        self.assertEqual([n.get_text() for n in soup.select('.hm-proof-grid h3')], ['Met hulp', 'Zelfstandig', 'Later', 'In een andere situatie'])
        self.assertEqual([s['id'] for s in soup.select('.hm-model-step')], ['proces', 'fase', 'kernhandeling', 'ai'])

    def test_model_language_links_and_sitemap(self):
        for lang in ('nl', 'en'):
            soup = self.page(lang + '/model/index.html')
            self.assertEqual(soup.find('link', rel='canonical')['href'], 'https://eaimodel.nl/' + lang + '/model/')
            for other in ('nl', 'en'):
                self.assertEqual(soup.find('link', hreflang=other)['href'], 'https://eaimodel.nl/' + other + '/model/')
        sitemap = (self.root / 'sitemap.xml').read_text()
        self.assertEqual(sitemap.count('https://eaimodel.nl/nl/model/'), 1)
        self.assertEqual(sitemap.count('https://eaimodel.nl/en/model/'), 1)

    def test_repeated_build_is_idempotent(self):
        before = {p: (self.root / p).read_bytes() for p in self.paths + ['sitemap.xml']}
        install(self.root)
        after = {p: (self.root / p).read_bytes() for p in self.paths + ['sitemap.xml']}
        self.assertEqual(before, after)


if __name__ == '__main__':
    unittest.main()
