"""Regression checks for authored homepage/model content and build scope."""
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
import unittest
from bs4 import BeautifulSoup
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from home_model import materialize, VERSION

SHELL = '<!doctype html><html lang="{lang}"><head><title>EAI</title></head><body class="eai-refresh eai-home"><header class="site-header"></header><main><h1>Old</h1></main><footer class="site-footer"></footer></body></html>'

class HomeModelTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for lang in ('nl', 'en'):
            (self.root / lang).mkdir()
            (self.root / lang / 'index.html').write_text(SHELL.format(lang=lang))
        (self.root / 'index.html').write_text(SHELL.format(lang='nl'))
        (self.root / 'houseoftalents').mkdir()
        (self.root / 'houseoftalents/index.html').write_text('handoff must not change')
        (self.root / 'sitemap.xml').write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>')

    def test_routes_language_links_and_single_headings(self):
        materialize(self.root)
        for rel in ('index.html', 'nl/index.html', 'en/index.html', 'nl/model/index.html', 'en/model/index.html'):
            soup = BeautifulSoup((self.root / rel).read_text(), 'html.parser')
            self.assertEqual(len(soup.select('main')), 1)
            self.assertEqual(len(soup.select('h1')), 1)
            self.assertEqual(soup.body['data-home-model-layout'], VERSION)
            self.assertIn('eai-hm', soup.body['class'])
            self.assertEqual(len(soup.select('link[rel="canonical"]')), 1)
        for lang in ('nl', 'en'):
            soup = BeautifulSoup((self.root / lang / 'model/index.html').read_text(), 'html.parser')
            for other in ('nl', 'en'):
                self.assertEqual(soup.find('link', hreflang=other)['href'], f'https://eaimodel.nl/{other}/model/')
            self.assertEqual([s['id'] for s in soup.select('.hm-model-step')], ['proces', 'fase', 'kernhandeling', 'ai'])
        self.assertEqual((self.root / 'houseoftalents/index.html').read_text(), 'handoff must not change')

    def test_no_js_content_and_preserved_deep_links(self):
        materialize(self.root)
        soup = BeautifulSoup((self.root / 'nl/index.html').read_text(), 'html.parser')
        for anchor in ('model', 'voorbeeld', 'verhaal', 'verder-lezen', 'beginnen', 'schoolafspraken', 'leren-en-toetsen'):
            self.assertIsNotNone(soup.find(id=anchor), anchor)
        self.assertEqual(soup.select_one('h1#eh-home-title').get_text(' ', strip=True), 'Wat ons werk ons werk maakt')
        self.assertEqual(len(soup.select('.eai-landing-route')), 4)
        self.assertEqual(len(soup.select('.eai-landing-reading-grid a')), 3)
        self.assertIsNotNone(soup.select_one('a[href="/nl/blog/wat-ons-werk-ons-werk-maakt/"]'))
        self.assertIsNone(soup.select_one('.eh-case-output'))
        self.assertIsNone(soup.select_one('details.eh-case-source'))
        self.assertNotIn('✎', soup.main.get_text())
        # Actual emoji glyphs are banned from editorial and navigation surfaces.
        import re
        glyphs = re.compile('[' + chr(0x1F300) + '-' + chr(0x1FAFF) + chr(0x2600) + '-' + chr(0x27BF) + ']')
        for rel in ('nl/blog/index.html', 'nl/blog/wat-ons-werk-ons-werk-maakt/index.html'):
            text = (Path(__file__).resolve().parents[1] / rel).read_text(encoding='utf-8')
            self.assertIsNone(glyphs.search(BeautifulSoup(text, 'html.parser').get_text(' ', strip=True)), rel)
        self.assertIsNone(glyphs.search(soup.main.get_text(' ', strip=True)), 'homepage')

        model = (self.root / 'nl/model/index.html').read_text()
        self.assertIn('Aan welke stap moet de leerling in deze fase zelf inhoudelijke betekenis geven om tot leren te komen?', model)
        self.assertIn('zonder dat er een nieuw product ontstaat', model)
        self.assertNotIn('\u2014', soup.main.get_text())

    def test_blog_pages_and_home_entry(self):
        root = Path(__file__).resolve().parents[1]
        landing = BeautifulSoup((root / 'nl/blog/index.html').read_text(encoding='utf-8'), 'html.parser')
        article = BeautifulSoup((root / 'nl/blog/wat-ons-werk-ons-werk-maakt/index.html').read_text(encoding='utf-8'), 'html.parser')
        self.assertEqual(landing.h1.get_text(' ', strip=True), 'Wat moeten we samen bespreken over AI?')
        self.assertEqual(article.h1.get_text(' ', strip=True), 'Wat ons werk ons werk maakt')
        self.assertIsNotNone(landing.select_one('a[href="/nl/blog/wat-ons-werk-ons-werk-maakt/"]'))
        self.assertIn('efficiënt', article.get_text(' ', strip=True).lower())
        self.assertEqual(len(article.select('.eai-story-example')), 3)
        self.assertEqual(len(article.select('.eai-story-phase-grid li')), 4)
        self.assertEqual(len(article.select('.eai-story-mail-card')), 2)
        self.assertEqual(len(article.select('.eai-story-questions li')), 4)
        self.assertEqual(len(article.select('figure')), 4)
        self.assertEqual(len(article.select('main h1')), 1)
        self.assertIn('/assets/site-editorial.css', [a.get('href') for a in article.select('link[rel=stylesheet]')])
        self.assertNotIn('—', article.main.get_text())

    def test_repeatable_render(self):
        materialize(self.root)
        first = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        materialize(self.root)
        self.assertEqual(first, {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob('*') if p.is_file()})

if __name__ == '__main__':
    unittest.main()
