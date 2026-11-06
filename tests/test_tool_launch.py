from pathlib import Path
from bs4 import BeautifulSoup
import unittest,json,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
BUILD=ROOT/'site-build'
class ToolLaunchTests(unittest.TestCase):
    def test_reviewed_tools_stay_exact(self):
        for source,target in [('content/eaimesh/start.html','tools/eaimesh/start/index.html'),('content/eaistudio/studio.html','tools/eaistudio/studio/index.html')]:
            with self.subTest(source=source):self.assertEqual((ROOT/source).read_bytes(),(BUILD/target).read_bytes())
    def test_tools_have_valid_scripts(self):
        for path in ['content/eaimesh/start.html','content/eaistudio/studio.html']:
            soup=BeautifulSoup((ROOT/path).read_text(),'html.parser')
            for tag in soup.find_all('script'):
                if tag.get('type')=='application/json':continue
                with tempfile.TemporaryDirectory() as folder:
                    file=Path(folder)/'check.js';file.write_text(tag.get_text());subprocess.run(['node','--check',str(file)],check=True,capture_output=True)
    def test_tools_in_both_languages_and_menu(self):
        for path in ['nl/tools/index.html','en/tools/index.html','tools/index.html']:
            soup=BeautifulSoup((BUILD/path).read_text(),'html.parser')
            for slug in ['eaimesh','eaistudio','wihtml']:
                with self.subTest(path=path,slug=slug):self.assertIsNotNone(soup.select_one(f'main a[href="/tools/{slug}/"]'))
        menu=(ROOT/'assets/site-refresh.js').read_text(encoding='utf-8')
        for slug in ['eaimesh','eaistudio','wihtml']:
            self.assertIn("'/tools/"+slug+"/'", menu)
    def test_pwa_assets_are_complete(self):
        root=BUILD/'tools/eaistudio/studio';manifest=json.loads((root/'manifest.webmanifest').read_text())
        for icon in manifest['icons']:self.assertTrue((root/icon['src']).is_file())
        for name in ['service-worker.js','icons/apple-touch-icon.png']:self.assertTrue((root/name).is_file())
        subprocess.run(['node','--check',str(root/'service-worker.js')],check=True,capture_output=True)
