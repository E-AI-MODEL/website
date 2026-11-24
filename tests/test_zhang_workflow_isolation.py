"""Only the main Theory7 release may upload shared public HTML or JS."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAPID = ROOT / '.github/workflows/deploy-zhang-review-rapid.yml'

class ReviewWorkflowIsolation(unittest.TestCase):
    def test_rapid_workflow_cannot_rewrite_shared_site_content(self):
        source = RAPID.read_text(encoding='utf-8')
        self.assertIn('group: theory7-production', source)
        self.assertIn('cancel-in-progress: false', source)
        for forbidden in ('nl/publicaties/index.html', 'en/publications/index.html',
                          'nl/onderzoek/index.html', 'en/research/index.html',
                          'assets/site-refresh.js'):
            self.assertNotIn(forbidden, source, forbidden)
        start = source.index('      - name: Publish reviewed PDF files only')
        end = source.index('      - name: Verify live PDF files', start)
        ftp = source[start:end]
        uploaded = re.findall(r'^\s+put -O [^\n]+', ftp, re.MULTILINE)
        self.assertEqual(len(uploaded), 2)
        self.assertTrue(all('assets/research/zhang-genai-l2-review-' in line
                            and line.endswith('.pdf') for line in uploaded))

    def test_html_changes_are_owned_by_complete_release(self):
        rapid = RAPID.read_text(encoding='utf-8')
        full = (ROOT / '.github/workflows/deploy-theory7.yml').read_text(encoding='utf-8')
        self.assertIn('group: theory7-production', full)
        self.assertIn('site-build/', full)
        self.assertIn('Verify live HTML and exact asset hashes', full)
        self.assertNotIn('site-build/', rapid)

if __name__ == '__main__':
    unittest.main()
