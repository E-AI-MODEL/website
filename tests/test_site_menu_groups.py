"""Controleer dat het hoofdmenu bij de bezoeker begint en onderzoeksmodellen samenhoudt."""
import unittest
from bs4 import BeautifulSoup
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_ui import groups, navigation


class PublicMenuTests(unittest.TestCase):
    def test_vijf_ingangen_plus_over_beide_talen(self):
        for en in (False, True):
            with self.subTest(taal='en' if en else 'nl'):
                sections = groups(en)
                titles = [name for name, _ in sections]
                expected = (
                    ['The model', 'Education', 'Research', 'Articles', 'Try it yourself', 'About EAI']
                    if en else
                    ['Het model', 'Onderwijs', 'Onderzoek', 'Artikelen', 'Zelf aan de slag', 'Over EAI']
                )
                self.assertEqual(titles, expected)
                for title, links in sections:
                    self.assertTrue(links, title)
                    addresses = [href for _, href in links]
                    self.assertEqual(len(addresses), len(set(addresses)), title)

    def test_interactieve_onderwerpen_bij_een_ingang(self):
        for en in (False, True):
            with self.subTest(taal='en' if en else 'nl'):
                sections = dict(groups(en))
                subject = 'Try it yourself' if en else 'Zelf aan de slag'
                links = dict(sections[subject])
                self.assertIn('/tools/science-observatory/', links.values())
                self.assertIn(('/en/tools/' if en else '/nl/tools/'), links.values())
                self.assertFalse(any('/tools/anatomie/' == href for href in links.values()))
                self.assertFalse(any('/tools/llm-observatorium/' == href for href in links.values()))
                self.assertIn('/tools/science-observatory/', links.values())
                for title, choices in sections.items():
                    if title != subject:
                        self.assertNotIn('/tools/science-observatory/', [u for _, u in choices])
                self.assertNotIn('/tools/wihtml/', links.values())

    def test_hoofdmenu_heeft_vijf_directe_links_en_uitklapbaar_overzicht(self):
        for en, path in ((False, '/nl/tools/'), (True, '/en/tools/')):
            with self.subTest(taal='en' if en else 'nl'):
                soup = BeautifulSoup('<html><head></head><body></body></html>', 'html.parser')
                header = BeautifulSoup(navigation(soup, path, en), 'html.parser')
                primary = header.select('.eai-site-primary > a')
                menu = header.select('.eai-site-menu .eai-site-group')
                self.assertEqual(len(primary), 5)
                self.assertEqual(len(menu), 6)
                names = [a.get_text(strip=True) for a in primary]
                self.assertEqual(names[-1], 'Try it yourself' if en else 'Zelf aan de slag')
                self.assertEqual(primary[-1]['href'], '/en/tools/' if en else '/nl/tools/')
                self.assertEqual(primary[-1].get('aria-current'), 'page')
                headings = [item.summary.get_text(strip=True) for item in menu]
                self.assertIn('About EAI' if en else 'Over EAI', headings)
                self.assertNotIn('About EAI' if en else 'Over EAI', names)
                for item in menu:
                    addresses = [a.get('href') for a in item.select('a[href]')]
                    self.assertEqual(len(addresses), len(set(addresses)))


if __name__ == '__main__':
    unittest.main()
