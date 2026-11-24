"""Controleer openbare menulinks en de echte broncatalogi van de proeven."""
import unittest
import tempfile
from bs4 import BeautifulSoup
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_ui import groups, navigation, experiment_sections, education_sections, site_search_records


class PublicMenuTests(unittest.TestCase):
    def test_vijf_directe_hoofdroutes_en_compact_meer_menu(self):
        for en in (False, True):
            with self.subTest(taal='en' if en else 'nl'):
                sections = dict(groups(en))
                self.assertEqual(len(sections), 6)
                self.assertEqual(list(sections)[:5],
                    ['The model', 'Education', 'Research', 'Articles', 'Explore & create'] if en else
                    ['Het model', 'Onderwijs', 'Onderzoek', 'Artikelen', 'Zelf aan de slag'])
                main = dict(sections['Explore & create' if en else 'Zelf aan de slag'])
                self.assertEqual(list(main.values()), ['/en/tools/' if en else '/nl/tools/'])
                self.assertNotIn('/tools/science-observatory/labs/natuurkunde/', main.values())
                header = BeautifulSoup(navigation(BeautifulSoup('<html><body></body></html>', 'html.parser'),
                                                   '/en/tools/' if en else '/nl/tools/', en), 'html.parser')
                self.assertEqual(len(header.select('.eai-site-primary > a')), 5)
                self.assertEqual(len(header.select('.eai-site-menu .eai-site-group')), 6)
                self.assertLessEqual(len(header.select('.eai-site-menu a')), 28)
                self.assertTrue(header.select_one('#eai-site-search-input[type=search]'))

    def test_proeven_hebben_allemaal_een_rechtstreekse_aanwezige_bestemming(self):
        for en in (False, True):
            with self.subTest(taal='en' if en else 'nl'):
                sections = experiment_sections(en)
                self.assertEqual(len(sections), 7)
                physic = sections[0][1]
                physics_urls = [url for _, entries in physic for _, url, _ in entries]
                self.assertEqual(len(physics_urls), 53)
                self.assertEqual(len(set(physics_urls)), 53)
                self.assertEqual(physic[0][0], 'Krachten en beweging' if not en else 'Forces and motion')
                self.assertIn('Elektriciteit en magnetisme' if not en else 'Electricity and magnetism',
                              [name for name, _ in physic])
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
                self.assertIn('/tools/melkweg-lab/#atlas', [u for _,u,_ in galaxy])
                self.assertEqual(len([entry for _, subgroup in sections[3][1] for entry in subgroup if '/tools/melkweg-lab/#' in entry[1]]), 6)
                self.assertIn('/tools/abyss/', [u for _, grp in sections[4][1] for _, u, _ in grp])
                self.assertIn('/tools/anatomie/labs/hartslag/', [u for _,grp in sections[2][1] for _,u,_ in grp])

    def test_alle_werkvormen_rechtstreeks_via_onderwijs_te_vinden(self):
        sections = education_sections(False)
        all_urls = [url for _, entries in sections for _, url, _ in entries]
        workforms = [url for url in all_urls if url.startswith('/werkvormen/') and url != '/werkvormen/']
        self.assertGreaterEqual(len(workforms), 50)
        self.assertEqual(len(set(workforms)), len(workforms))
        self.assertIn('/werkvormen/justification-mapping/', workforms)
        self.assertIn('/werkvormen/accept-adapt-reject/', workforms)
        names = [name for name, _ in sections]
        self.assertIn('Hulp en feedback tijdens het leren', names)
        self.assertIn('Bronnen en argumenten beoordelen', names)
        self.assertIn('Denk- en leerproces zichtbaar maken', names)
        self.assertNotIn('Werkvormen A–H', names)
        self.assertEqual(len(names), 7)
        soup = BeautifulSoup('<html><body></body></html>', 'html.parser')
        header = BeautifulSoup(navigation(soup, '/nl/onderwijs/', False), 'html.parser')
        self.assertEqual(len(header.select('.eai-site-menu a[href="/werkvormen/"]')), 1)
        self.assertEqual(len(header.select('.eai-site-menu a[href^="/werkvormen/"]')), 1)
        addresses = {entry['url'] for entry in site_search_records(Path(__file__).resolve().parents[1] / 'does-not-exist')}
        self.assertTrue(set(workforms).issubset(addresses))

    def test_zoekindex_en_menu_delen_dezelfde_bestemmingen(self):
        index = site_search_records(Path(__file__).resolve().parents[1] / 'does-not-exist')
        addresses = {record['url'] for record in index}
        self.assertEqual(len(addresses), len(index))
        self.assertIn('/tools/science-observatory/labs/natuurkunde/#lever', addresses)
        self.assertIn('/tools/science-observatory/labs/wiskunde-a/#binom', addresses)
        self.assertIn('/tools/melkweg-lab/#dynamics', addresses)
        self.assertIn('/tools/html-galerij/', addresses)
        self.assertNotIn('/beheer/', addresses)
        self.assertNotIn('/leif/beheer/', addresses)
        self.assertIn('/tools/abyss/', addresses)
        self.assertNotIn('/tools/science-observatory/labs/melkweg/', addresses)
        self.assertNotIn('/tools/science-observatory/labs/melkweg/#dynamics', addresses)
        by_url = {record['url']: record for record in index}
        workform = by_url['/werkvormen/justification-mapping/']
        self.assertIn('Keuzes', workform['title'])
        self.assertGreater(len(workform['description']), 35)
        self.assertIn('Denk- en leerproces zichtbaar maken', workform['category'])
        maths = by_url['/tools/science-observatory/labs/wiskunde-a/#binom']
        self.assertIn('kansverdeling', maths['description'].lower())
        self.assertIn('Wiskunde', maths['category'])

    def test_paginabeschrijving_behoudt_de_onderwerpcategorie(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'nl' / 'model' / 'index.html'
            target.parent.mkdir(parents=True)
            target.write_text(
                '<html><head><meta name="description" content="Een uitgewerkte uitleg van het EAI-model met proces, fase, kernhandeling en AI."></head>'
                '<body><h1>Begin bij het leren</h1></body></html>', encoding='utf-8')
            records = {item['url']: item for item in site_search_records(Path(temp))}
            model = records['/nl/model/']
            self.assertEqual(model['category'], 'Het model')
            self.assertIn('kernhandeling', model['description'])

    def test_menu_en_volledige_zoekindex_op_mobiel_en_desktop(self):
        for en, path in ((False, '/nl/tools/'), (True, '/en/tools/')):
            with self.subTest(taal='en' if en else 'nl'):
                soup = BeautifulSoup('<html><head></head><body></body></html>', 'html.parser')
                header = BeautifulSoup(navigation(soup, path, en), 'html.parser')
                self.assertEqual(len(header.select('.eai-site-primary > a')), 5)
                self.assertEqual(len(header.select('.eai-site-menu .eai-site-group')), 6)
                self.assertTrue(header.select_one('#eai-site-search-input[type=search]'))
                self.assertFalse(header.select('.eai-site-model-links'))
                self.assertFalse(header.select('a[href*="/labs/natuurkunde/#"]'))
                addresses = {item['url'] for item in site_search_records(Path(__file__).resolve().parents[1] / 'does-not-exist')}
                self.assertIn('/tools/science-observatory/labs/natuurkunde/#lever', addresses)
                self.assertIn('/tools/anatomie/labs/hartslag/', addresses)
                self.assertIn('/tools/melkweg-lab/#gaia', addresses)


if __name__ == '__main__':
    unittest.main()
