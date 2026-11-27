"""Hoofdpagina's laten kiezen, zonder dubbele catalogi of verlies van subroutes."""
import sys
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from prepare_ui import LEGACY_HUB_REDIRECTS, groups, site_search_records

class HubStructureTests(unittest.TestCase):
    def test_primary_routes_are_five_and_each_has_one_owner(self):
        dutch = groups(False)
        english = groups(True)
        self.assertEqual([title for title, _ in dutch][:5],
                         ['Het model', 'Onderwijs', 'Onderzoek', 'Artikelen', 'Zelf aan de slag'])
        self.assertEqual([title for title, _ in english][:5],
                         ['The model', 'Education', 'Research', 'Articles', 'Explore & create'])
        self.assertEqual(len({links[0][1] for _, links in dutch[:5]}), 5)
        self.assertEqual(len({links[0][1] for _, links in english[:5]}), 5)
        self.assertEqual([links[0][1] for _, links in dutch[:5]],
                         ['/nl/model/', '/nl/onderwijs/', '/nl/onderzoek/',
                          '/nl/publicaties/', '/nl/tools/'])

    def test_english_and_dutch_home_expose_same_four_entry_tasks(self):
        for lang, choices in (
            ('nl', ['/nl/model/', '/nl/onderwijs/', '/nl/onderzoek/', '/nl/tools/']),
            ('en', ['/en/model/', '/en/education/', '/en/research/', '/en/tools/']),
        ):
            with self.subTest(lang=lang):
                template = BeautifulSoup((ROOT / f'content/home-model/home-{lang}.html')
                                         .read_text(encoding='utf-8'), 'html.parser')
                self.assertEqual(len(template.select('main h1')), 1)
                self.assertEqual([a.get('href') for a in template.select('.eai-landing-route')], choices)
                self.assertEqual(len(template.select('[data-dash-step]')), 4)
                self.assertFalse(template.select('.eai-dash-rail, .eai-dash-route-controls'))
                self.assertEqual(len(template.select('.eai-reading-feature')), 1)

    def test_articles_and_research_expose_news_without_repeating_same_card(self):
        for rel, urls in {
            'nl/publicaties/index.html': ['/nl/blog/wat-dot-tie-nou/',
                                           '/nl/onderzoek/zhang-genai-taal/'],
            'nl/onderzoek/index.html': ['/nl/onderzoek/zhang-genai-taal/',
                                         '/nl/onderzoek/leermiddelen/'],
            'en/publications/index.html': ['/en/research/zhang-genai-language/',
                                             '/en/research/teaching-tools/'],
            'en/research/index.html': ['/en/research/zhang-genai-language/',
                                        '/en/research/teaching-tools/'],
        }.items():
            with self.subTest(rel=rel):
                doc = BeautifulSoup((ROOT / rel).read_text(encoding='utf-8'), 'html.parser')
                articles = doc.select('.eai-hub-news-card')
                self.assertEqual(len(articles), 2)
                self.assertEqual([a.select_one('h3 a')['href'] for a in articles], urls)
                self.assertTrue(all(article.select_one('p') for article in articles))

    def test_new_dot_article_and_previous_essay_are_discoverable(self):
        blog = BeautifulSoup((ROOT / 'nl/blog/index.html').read_text(encoding='utf-8'), 'html.parser')
        new = '/nl/blog/wat-dot-tie-nou/'
        old = '/nl/blog/wat-ons-werk-ons-werk-maakt/'
        for route in (new, old):
            self.assertTrue(blog.select(f'main a[href="{route}"]'), route)
        self.assertIn(('Wat dot-tie nou?', new), dict(groups(False))['Artikelen'])
        records = {record['url']: record for record in site_search_records(ROOT / 'does-not-exist')}
        self.assertEqual(records[new]['title'], 'Wat dot-tie nou?')
        for term in ('Outlook', 'Microsoft 365', 'Google Workspace'):
            self.assertIn(term, records[new]['description'])
        self.assertIn(old, records)

    def test_tools_have_one_catalog_and_preserve_missing_items(self):
        doc = BeautifulSoup((ROOT / 'nl/tools/index.html').read_text(encoding='utf-8'), 'html.parser')
        self.assertEqual(len(doc.select('main .eai-explore-choice')), 8)
        self.assertEqual([a.select_one('strong').get_text(strip=True) for a in doc.select('main .eai-explore-choice')],
                         ['Natuurkunde', 'Wiskunde', 'Menselijk lichaam', 'Heelal',
                          'Oceanografie', 'Sport en bewegen', 'AI', 'Lessen en presentaties'])
        for url in ('/tools/eaigit/', '/tools/html-galerij/', '/tools/eaiwork/',
                    '/tools/science-observatory/', '/nl/llmscan/', '/nl/tools/verificatie/'):
            self.assertEqual(len(doc.select(f'main a[href="{url}"]')), 1, url)
        self.assertEqual(len(doc.select('main nav a[href^="#vak-"]')), 8)

    def test_old_hubs_link_to_only_one_current_page_and_children_survive(self):
        self.assertEqual(LEGACY_HUB_REDIRECTS, {
            '/onderwijs/': '/nl/onderwijs/', '/kennis/': '/nl/onderzoek/',
            '/publicaties/': '/nl/publicaties/', '/toepassingen/': '/nl/toepassingen/',
            '/over/': '/nl/over/', '/tools/': '/nl/tools/',
        })
        self.assertNotIn('/', LEGACY_HUB_REDIRECTS)
        self.assertNotIn('/model-monitor/', LEGACY_HUB_REDIRECTS)
        self.assertNotIn('/tools/anatomie/', LEGACY_HUB_REDIRECTS)
        build = ROOT / 'site-build'
        if not (build / 'nl/index.html').exists():
            self.skipTest('Check prepared handoffs only after build_site + prepare_ui')
        for old, destination in LEGACY_HUB_REDIRECTS.items():
            doc = BeautifulSoup((build / old.strip('/') / 'index.html')
                                 .read_text(encoding='utf-8'), 'html.parser')
            self.assertEqual(doc.find('link', rel='canonical')['href'],
                             'https://eaimodel.nl' + destination)
            self.assertIn(destination, doc.find('meta', attrs={'http-equiv':'refresh'})['content'])
            self.assertEqual(doc.select_one('main a')['href'], destination)
        for rel in ('tools/eaigit/index.html', 'tools/anatomie/index.html'):
            self.assertNotIn('http-equiv="refresh"', (build / rel).read_text(encoding='utf-8'))

    def test_public_subject_names_and_single_milky_way_entry(self):
        import json
        register = json.loads((ROOT / 'catalog/website-register.json').read_text(encoding='utf-8'))
        pages = {page['url']: page for page in register['pages']}
        self.assertEqual(pages['/tools/abyss/']['public_title_nl'], 'Oceanografie')
        self.assertEqual(pages['/tools/science-observatory/labs/melkweg/']['search_scope'], 'via_verwijzing')
        self.assertEqual(pages['/tools/melkweg-lab/']['public_title_nl'], 'De Melkweg')
        index = {r['url']: r for r in site_search_records(ROOT / 'does-not-exist')}
        self.assertEqual(index['/tools/melkweg-lab/']['title'], 'De Melkweg')
        self.assertEqual(index['/tools/abyss/']['title'], 'Oceanografie')
        self.assertNotIn('/tools/science-observatory/labs/melkweg/', index)
        self.assertEqual(sum(url.startswith('/tools/science-observatory/labs/natuurkunde/#') for url in index), 53)

    def test_search_keeps_deep_labs_and_workforms(self):
        index = {r['url'] for r in site_search_records(ROOT / 'does-not-exist')}
        for url in ('/werkvormen/first-attempt/',
                    '/tools/science-observatory/labs/natuurkunde/#lever',
                    '/tools/science-observatory/labs/wiskunde-a/#binom'):
            self.assertIn(url, index)
        self.assertNotIn('/tools/', index)
        self.assertNotIn('/publicaties/', index)

if __name__ == '__main__':
    unittest.main()
