"""Controleer openbare menulinks en de echte broncatalogi van de proeven."""
import unittest
from bs4 import BeautifulSoup
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_ui import groups, navigation, experiment_sections, site_search_records


class PublicMenuTests(unittest.TestCase):
    def test_navigatie_onderscheidt_modelproeven_van_tools(self):
        for en in (False, True):
            with self.subTest(taal='en' if en else 'nl'):
                sections = dict(groups(en))
                self.assertEqual(len(sections), 6)
                name = 'Experiments & models' if en else 'Proeven & modellen'
                self.assertIn(name, sections)
                labs = dict(sections[name])
                tools = dict(sections['Tools'])
                self.assertIn('/tools/science-observatory/', labs.values())
                self.assertIn('/tools/science-observatory/labs/natuurkunde/', labs.values())
                self.assertIn('/tools/science-observatory/labs/wiskunde-a/', labs.values())
                self.assertIn('/tools/science-observatory/labs/wiskunde-b/', labs.values())
                self.assertIn('/tools/anatomie/', labs.values())
                self.assertIn('/tools/prompt-framework/', tools.values())
                self.assertIn('/tools/html-galerij/', tools.values())
                self.assertNotIn('/tools/anatomie/', tools.values())

    def test_proeven_hebben_allemaal_een_rechtstreekse_aanwezige_bestemming(self):
        for en in (False, True):
            with self.subTest(taal='en' if en else 'nl'):
                sections = experiment_sections(en)
                self.assertEqual(len(sections), 6)
                physic = sections[0][1]
                physics_urls = [url for _, entries in physic for _, url, _ in entries]
                self.assertEqual(len(physics_urls), 53)
                self.assertEqual(len(set(physics_urls)), 53)
                self.assertIn('/tools/science-observatory/labs/natuurkunde/#lever', physics_urls)
                self.assertIn('/tools/science-observatory/labs/natuurkunde/#projectile', physics_urls)
                maths = sections[1][1]
                self.assertEqual(len(maths), 2)
                for title, models in maths:
                    self.assertGreaterEqual(len(models), 6, title)
                    for label, url, _ in models:
                        self.assertTrue(label, title)
                        self.assertIn('/#', url)
                galaxy = sections[3][1][0][1]
                self.assertEqual(len(galaxy), 6)
                self.assertIn('/tools/science-observatory/labs/melkweg/#atlas', [u for _,u,_ in galaxy])
                self.assertIn('/tools/anatomie/labs/hartslag/', [u for _,grp in sections[2][1] for _,u,_ in grp])

    def test_zoekindex_en_menu_delen_dezelfde_bestemmingen(self):
        index = site_search_records(Path(__file__).resolve().parents[1] / 'does-not-exist')
        addresses = {record['url'] for record in index}
        self.assertEqual(len(addresses), len(index))
        self.assertIn('/tools/science-observatory/labs/natuurkunde/#lever', addresses)
        self.assertIn('/tools/science-observatory/labs/wiskunde-a/#binom', addresses)
        self.assertIn('/tools/science-observatory/labs/melkweg/#dynamics', addresses)
        self.assertIn('/tools/html-galerij/', addresses)

    def test_bereikbaar_menu_met_zoekveld_op_mobiel_en_desktop(self):
        for en, path in ((False,'/nl/tools/'),(True,'/en/tools/')):
            with self.subTest(taal='en' if en else 'nl'):
                soup = BeautifulSoup('<html><head></head><body></body></html>', 'html.parser')
                header = BeautifulSoup(navigation(soup, path, en), 'html.parser')
                self.assertEqual(len(header.select('.eai-site-primary > a')), 5)
                self.assertEqual(len(header.select('.eai-site-menu .eai-site-group')), 6)
                self.assertTrue(header.select_one('#eai-site-search-input[type=search]'))
                menu = header.select_one('.eai-site-model-links')
                self.assertIsNotNone(menu)
                self.assertEqual(len(menu.select('.eai-site-topic')), 6)
                physics = [a['href'] for a in menu.select('a[href*="/labs/natuurkunde/#"]')]
                self.assertEqual(len(physics), 53)
                maths = [a['href'] for a in menu.select('a[href*="/labs/wiskunde-"]') if '/#' in a['href']]
                self.assertGreaterEqual(len(maths), 12)
                self.assertIn('/tools/anatomie/labs/hartslag/', [a['href'] for a in menu.select('a[href]')])
                self.assertIn('/tools/science-observatory/labs/melkweg/#gaia', [a['href'] for a in menu.select('a[href]')])


if __name__ == '__main__':
    unittest.main()
