import io
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError
from urllib.request import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from verify_live_cloudflare import EXPECTED_TOKEN, EXPECTED_URL, HEADERS, has_beacon, check_route


def beacon(token=EXPECTED_TOKEN, src=EXPECTED_URL):
    return f"""<script defer src="{src}" data-cf-beacon='{{"token":"{token}"}}'></script>"""


class Response(io.BytesIO):
    status = 200

    def __init__(self, html, url="https://eaimodel.nl/nl/"):
        super().__init__(html.encode())
        self.url = url

    def geturl(self):
        return self.url


class LiveCloudflareTests(unittest.TestCase):
    def test_token_and_script_must_belong_to_same_element(self):
        self.assertTrue(has_beacon(beacon()))
        self.assertFalse(has_beacon(beacon("incorrect")))
        self.assertFalse(has_beacon(beacon(src="https://example.com/beacon.min.js")))
        self.assertFalse(has_beacon(f'<script src="{EXPECTED_URL}"></script>{EXPECTED_TOKEN}'))
        self.assertFalse(has_beacon(f'<script src="{EXPECTED_URL}" data-cf-beacon="broken"></script>'))
        self.assertTrue(has_beacon(beacon(src=EXPECTED_URL+"?v=1")))

    def test_success_on_canonical_host_redirect(self):
        opener = Mock(return_value=Response(beacon(), "https://www.eaimodel.nl/nl/"))
        pause = Mock()
        self.assertIsNone(check_route("eaimodel.nl", "/nl/", "123", opener, pause))
        request = opener.call_args.args[0]
        self.assertIsInstance(request, Request)
        self.assertEqual(request.full_url, "https://eaimodel.nl/nl/?eai_beacon_check=123")
        self.assertEqual(request.get_header("User-agent"), HEADERS["User-Agent"])
        self.assertEqual(opener.call_args.kwargs["timeout"], 18)
        pause.assert_not_called()

    def test_http_failure_is_not_reported_as_missing_beacon(self):
        opener = Mock(side_effect=lambda *a, **kw: (_ for _ in ()).throw(
            HTTPError("https://eaimodel.nl/", 403, "Forbidden", {"CF-Ray": "fixture"}, io.BytesIO(b""))))
        pause = Mock()
        error = check_route("eaimodel.nl", "/", "123", opener, pause)
        self.assertIn("HTTP 403", error)
        self.assertNotIn("beacon ontbreekt", error)
        self.assertEqual(opener.call_count, 3)
        self.assertEqual(pause.call_count, 2)

    def test_missing_beacon_and_unexpected_origin_fail(self):
        for html, url, expected in [
            ("<html></html>", "https://eaimodel.nl/", "beacon ontbreekt"),
            (beacon(), "https://example.com/", "onverwachte eind-URL"),
        ]:
            with self.subTest(url=url):
                opener = Mock(side_effect=lambda *a, **kw: Response(html, url))
                error = check_route("eaimodel.nl", "/", "123", opener, Mock())
                self.assertIn(expected, error)
                self.assertEqual(opener.call_count, 3)

    def test_retry_can_recover(self):
        opener = Mock(side_effect=[
            Response("<html></html>"), Response(beacon())])
        pause = Mock()
        self.assertIsNone(check_route("eaimodel.nl", "/nl/", "123", opener, pause))
        self.assertEqual(opener.call_count, 2)
        pause.assert_called_once_with(3)


if __name__ == "__main__":
    unittest.main()
