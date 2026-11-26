import json
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
class VisibilityTests(unittest.TestCase):
    def test_listed_and_searchable(self):
        from prepare_ui import tool_sections
        for en in (False,True):
            self.assertTrue(any(u=="/tools/eaispeak/" for _,items in tool_sections(en) for _,u,_ in items))
        for path in ("nl/tools/index.html","en/tools/index.html"):
            self.assertIn('href="/tools/eaispeak/"',(ROOT/path).read_text())
        reg=json.loads((ROOT/"catalog/website-register.json").read_text())
        record=next(x for x in reg["pages"] if x["url"]=="/tools/eaispeak/")
        self.assertEqual(record["search_scope"],"algemeen")
        self.assertEqual(record["public_title_nl"],"EAIspeak")
        self.assertIn("https://eaimodel.nl/tools/eaispeak/",(ROOT/"sitemap.xml").read_text())
