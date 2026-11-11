"""Controleer de werkelijke menugroepen, niet alleen de namen in de broncode."""
import unittest
from bs4 import BeautifulSoup
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from prepare_ui import groups, navigation


class PublicMenuTests(unittest.TestCase):
    def test_nederlands_en_engels_scheiden_proeven_en_ontwerpen(self):
        for en in (False, True):
            with self.subTest(taal="en" if en else "nl"):
                navigation_groups = groups(en)
                self.assertEqual(len(navigation_groups), 7)
                sections = {title: links for title, links in navigation_groups}
                names = ("Observatories", "Tools") if en else ("Observatoria", "Tools")
                self.assertIn(names[0], sections)
                labs = dict(sections[names[0]])
                tools = dict(sections[names[1]])
                self.assertIn("/tools/science-observatory/", labs.values())
                self.assertIn("/tools/science-observatory/labs/natuurkunde/", labs.values())
                self.assertIn("/tools/anatomie/", labs.values())
                self.assertIn("/tools/prompt-framework/", tools.values())
                self.assertIn("/tools/wihtml/", tools.values())
                self.assertNotIn("/tools/anatomie/", tools.values())
                self.assertEqual(len({url for _,url in sections[names[0]]}), len(labs))
                self.assertEqual(len({url for _,url in sections[names[1]]}), len(tools))

    def test_zes_brede_navigatielinks_en_zeven_overzichtelijke_menugroepen(self):
        for en, path in ((False,"/nl/tools/"),(True,"/en/tools/")):
            with self.subTest(taal="en" if en else "nl"):
                soup = BeautifulSoup('<html><head></head><body></body></html>','html.parser')
                header = BeautifulSoup(navigation(soup,path,en),'html.parser')
                primary = header.select(".eai-site-primary > a")
                menu = header.select(".eai-site-menu .eai-site-group")
                self.assertEqual(len(primary), 6)
                self.assertEqual(len(menu), 7)
                headings = [item.summary.get_text(strip=True) for item in menu]
                self.assertIn("Observatories" if en else "Observatoria", headings)
                self.assertIn("About" if en else "Over", headings)
                self.assertNotIn("About" if en else "Over", [a.get_text(strip=True) for a in primary])
                for item in menu:
                    addresses = [a.get('href') for a in item.select("a[href]")]
                    self.assertEqual(len(addresses),len(set(addresses)))


if __name__ == "__main__":
    unittest.main()
