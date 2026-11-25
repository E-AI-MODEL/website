"""Source-safe correction and navigation eligibility regression checks."""
import sys
import unittest
from pathlib import Path
from bs4 import BeautifulSoup
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import archive_review

class ArchiveReviewTests(unittest.TestCase):
 def page(self):
  return BeautifulSoup('<html lang="nl"><head><title>Original title</title></head><body><header class="site-header"></header><main><h1>Original title</h1><p id="original">Original claim</p></main><footer class="site-footer"></footer></body></html>','html.parser')
 def test_retraction_is_explicit_and_original_retained(self):
  soup=self.page();self.assertTrue(archive_review.review(soup,'/publicaties/wang-fan-2025/'))
  self.assertIn('22 april 2026',soup.select_one('#archive-review-note').get_text())
  self.assertEqual(soup.select_one('.archive-original #original').get_text(),'Original claim')
  self.assertFalse(soup.select_one('.archive-original').has_attr('open'))
  archive_review.review(soup,'/publicaties/wang-fan-2025/')
  self.assertEqual(len(soup.select('#archive-review-note')),1)
  self.assertEqual(len(soup.select('h1')),1)
 def test_handoff_never_changed(self):
  for path in ['/houseoftalents/','/houseoftalents/3d/','/onderwijsin/houseoftalents/']:
   soup=self.page();before=str(soup)
   self.assertFalse(archive_review.review(soup,path));self.assertEqual(str(soup),before)
 def test_english_essay_metadata(self):
  soup=self.page();archive_review.review(soup,'/publicaties/the-act-of-learning-act-2/')
  self.assertEqual(soup.html['lang'],'en');self.assertIn('Part 2',soup.title.string)
 def test_ordinary_sources_receive_no_editorial_warning(self):
  soup=self.page();self.assertTrue(archive_review.review(soup,'/bronnen/'))
  self.assertFalse(soup.select('#archive-review-note'))
 def test_legacy_tool_modules_redirects_directly_to_mobile_ready_hub(self):
  import json
  from build_site import redirect
  root=Path(__file__).resolve().parents[1]
  page_path=root/'eai-tools-modules/index.html'
  source=BeautifulSoup(page_path.read_text(encoding='utf-8'),'html.parser')
  expected=BeautifulSoup(redirect('/nl/tools/'),'html.parser')
  for page in (source,expected):
   self.assertEqual(page.find('meta',attrs={'http-equiv':'refresh'})['content'],'0; url=/nl/tools/')
   self.assertEqual(page.find('meta',attrs={'name':'viewport'})['content'],'width=device-width,initial-scale=1')
   self.assertEqual(page.find('link',rel='canonical')['href'],'https://eaimodel.nl/nl/tools/')
   self.assertEqual(page.find('a')['href'],'/nl/tools/')
  register=json.loads((root/'catalog/website-register.json').read_text(encoding='utf-8'))
  self.assertEqual(next(p for p in register['pages'] if p['url']=='/eai-tools-modules/')['redirect_target'],'/nl/tools/')
  generated=root/'site-build/eai-tools-modules/index.html'
  if generated.exists():
   page=BeautifulSoup(generated.read_text(encoding='utf-8'),'html.parser')
   self.assertEqual(page.find('meta',attrs={'http-equiv':'refresh'})['content'],'0; url=/nl/tools/')
   self.assertEqual(page.find('meta',attrs={'name':'viewport'})['content'],'width=device-width,initial-scale=1')
if __name__=='__main__':unittest.main()
