"""Release checks must distinguish strict canonical redirects from full UI pages."""
import sys
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from verify_ui import assert_live_ui_contract

class LiveRedirectContractTests(unittest.TestCase):
    def test_valid_canonical_redirect_needs_no_full_header(self):
        valid = BeautifulSoup('''<html><head>
            <link rel="canonical" href="https://eaimodel.nl/nl/onderzoek/">
            <meta http-equiv="refresh" content="0;url=/nl/onderzoek/">
            </head><body><main><a href="/nl/onderzoek/">Open actuele pagina</a></main></body></html>''',
            'html.parser')
        assert_live_ui_contract('/kennis/', valid, 'abcdef123456')
        with self.assertRaises(AssertionError):
            assert_live_ui_contract('/nl/onderzoek/', valid, 'abcdef123456')

    def test_bad_redirect_target_still_fails(self):
        bad = BeautifulSoup('''<html><head>
            <link rel="canonical" href="https://eaimodel.nl/over/">
            <meta http-equiv="refresh" content="0;url=/over/">
            </head><body><main><a href="/over/">Wrong target</a></main></body></html>''',
            'html.parser')
        with self.assertRaises(AssertionError):
            assert_live_ui_contract('/kennis/', bad, 'abcdef123456')

    def test_redirect_must_keep_visible_fallback_link(self):
        missing_fallback = BeautifulSoup('''<html><head>
            <link rel="canonical" href="https://eaimodel.nl/nl/onderzoek/">
            <meta http-equiv="refresh" content="0;url=/nl/onderzoek/">
            </head><body></body></html>''', 'html.parser')
        with self.assertRaises(AssertionError):
            assert_live_ui_contract('/kennis/', missing_fallback, 'abcdef123456')

    def test_full_page_requires_correct_version_and_menu(self):
        valid = BeautifulSoup('''<html><body data-ui-version="abcdef123456">
            <header><details class="eai-site-menu"><summary>Meer</summary></details></header>
            </body></html>''', 'html.parser')
        assert_live_ui_contract('/nl/onderzoek/', valid, 'abcdef123456')
        with self.assertRaises(AssertionError):
            assert_live_ui_contract('/nl/onderzoek/', valid, 'outdated')
        with self.assertRaises(AssertionError):
            assert_live_ui_contract('/nl/publicaties/', BeautifulSoup('<html><body data-ui-version="abcdef123456"></body></html>', 'html.parser'), 'abcdef123456')

if __name__ == '__main__':
    unittest.main()
