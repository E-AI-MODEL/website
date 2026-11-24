"""EAI Dictionary en nieuwe menunamen: geen ontbrekende definities of gebroken routes."""
import unittest
import sys
import tempfile
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from prepare_ui import groups, site_search_records


class DictionaryAndMenuTests(unittest.TestCase):
    def test_beide_edities_bevatten_dezelfde_dertig_begrippen(self):
        seen = {}
        for language in ('nl', 'en'):
            source = ROOT / 'content' / ('eai-dictionary-' + language + '.html')
            soup = BeautifulSoup(source.read_text(encoding='utf-8'), 'html.parser')
            entries = soup.select('.eai-dictionary-term[id]')
            self.assertEqual(len(entries), 30, language)
            names = {item['id'] for item in entries}
            self.assertEqual(len(names), 30, language)
            self.assertIn('core-learning-action', names)
            self.assertIn('task-density', names)
            self.assertIn('independent-evidence', names)
            for item in entries:
                self.assertTrue(item.select_one('summary span'))
                self.assertTrue(item.select_one('.eai-dictionary-definition p'))
                self.assertTrue(item.select_one('summary em'))
            seen[language] = names
        self.assertEqual(seen['nl'], seen['en'])

    def test_alle_bestaande_routes_bewaard_en_nieuwe_woordenboekroutes_toegevoegd(self):
        nl = dict(groups(False))
        en = dict(groups(True))
        self.assertEqual(len(nl), 6)
        self.assertEqual(len(en), 6)
        self.assertEqual(list(nl)[:5], ['Het model', 'Onderwijs', 'Onderzoek', 'Artikelen', 'Zelf aan de slag'])
        self.assertEqual(list(en)[:5], ['The model', 'Education', 'Research', 'Articles', 'Explore & create'])
        self.assertIn('/nl/begrippen/', dict(nl['Het model']).values())
        self.assertIn('/en/glossary/', dict(en['The model']).values())
        self.assertEqual(dict(nl['Artikelen'])['Artikelen en publicaties'], '/nl/publicaties/')
        self.assertEqual(dict(nl['Zelf aan de slag'])['Kies een vakgebied of hulpmiddel'], '/nl/tools/')
        self.assertIn('/tools/science-observatory/', (ROOT / 'nl/tools/index.html').read_text(encoding='utf-8'))

    def test_begrippen_worden_als_directe_zoekresultaten_geindexeerd(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for lang, relative in (('nl', 'nl/begrippen/'), ('en', 'en/glossary/')):
                destination = root / relative / 'index.html'
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(
                    (ROOT / 'content' / ('eai-dictionary-' + lang + '.html')).read_text(encoding='utf-8'),
                    encoding='utf-8')
            data = {entry['url']: entry for entry in site_search_records(root)}
            for relative in ('/nl/begrippen/', '/en/glossary/'):
                self.assertIn(relative + '#task-density', data)
                self.assertIn(relative + '#core-learning-action', data)
                self.assertIn(relative + '#independent-evidence', data)
                self.assertGreater(len(data[relative + '#task-density']['description']), 35)
                self.assertEqual(len([key for key in data if key.startswith(relative + '#')]), 30)

    def test_nieuwe_paginas_worden_door_sitegenerator_opgebouwd(self):
        build = (ROOT / 'scripts' / 'build_site.py').read_text(encoding='utf-8')
        self.assertIn('nl/begrippen/index.html', build)
        self.assertIn('en/glossary/index.html', build)
        self.assertIn('hreflang="nl"', build)
        self.assertIn('hreflang="en"', build)


if __name__ == '__main__':
    unittest.main()
