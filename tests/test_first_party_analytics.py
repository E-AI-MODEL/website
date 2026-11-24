"""HTTP contract and privacy regression checks for the PHP event collector."""
import json
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parents[1]
COLLECTOR = REPO / "statistieken" / "collect.php"


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class FirstPartyAnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("php") is None:
            raise unittest.SkipTest("PHP CLI is not installed")
        cls.temp = tempfile.TemporaryDirectory()
        cls.docroot = Path(cls.temp.name) / "public_html"
        (cls.docroot / "statistieken").mkdir(parents=True)
        shutil.copy2(COLLECTOR, cls.docroot / "statistieken" / "collect.php")
        (cls.docroot / "sitemap.xml").write_text(
            '<urlset><url><loc>https://eaimodel.nl/</loc></url>'
            '<url><loc>https://eaimodel.nl/nl/</loc></url>'
            '<url><loc>https://eaimodel.nl/statistieken/</loc></url></urlset>', encoding='utf-8')
        cls.port = port()
        cls.url = f"http://127.0.0.1:{cls.port}/statistieken/collect.php"
        cls.server = subprocess.Popen(["php", "-S", f"127.0.0.1:{cls.port}", "-t", str(cls.docroot)],
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(40):
            try:
                with urlopen(cls.url, timeout=1):
                    break
            except (URLError, TimeoutError):
                time.sleep(.1)
        else:
            raise RuntimeError("PHP collector test server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=10)
        cls.temp.cleanup()

    def post(self, visitor, session, event="view", path="/nl/", target=None, origin="https://eaimodel.nl"):
        payload = {"version": 1, "visitor": visitor, "session": session, "event": event, "path": path}
        if target is not None:
            payload["target"] = target
        request = Request(self.url, method="POST", data=json.dumps(payload).encode(),
                          headers={"Content-Type": "application/json", "Host": "eaimodel.nl", "Origin": origin})
        try:
            with urlopen(request, timeout=4) as response:
                return response.status
        except HTTPError as exc:
            return exc.code

    def stats(self):
        with urlopen(self.url, timeout=4) as response:
            self.assertEqual(response.headers.get_content_type(), "application/json")
            return json.load(response)

    def test_collect_and_keep_id_hashes_outside_public_root(self):
        visitors = [f"{n:032x}" for n in range(1, 7)]
        sessions = [f"{n + 101:032x}" for n in range(1, 7)]
        for v, s in zip(visitors, sessions):
            self.assertEqual(self.post(v, s), 204)
        self.assertEqual(self.post(visitors[0], sessions[0], "click", target="link:/statistieken/"), 204)
        self.assertEqual(self.post(visitors[1], sessions[1], "engage"), 204)
        report = self.stats()
        self.assertEqual(report["schema"], 2)
        self.assertEqual(report["visits"], 6)
        self.assertEqual(report["unique_visitors"], 6)
        self.assertEqual(report["clicks"], 1)
        self.assertEqual(report["bounce_rate"], None)
        self.assertTrue(report["pages"])
        self.assertEqual(report["pages"][0]["path"], "/nl/")
        storage = Path(self.temp.name) / ".eai-first-party-analytics"
        self.assertTrue(storage.exists())
        self.assertFalse((self.docroot / ".eai-first-party-analytics").exists())
        blob = (storage / (time.strftime("%Y-%m-%d", time.gmtime()) + ".json")).read_text()
        self.assertNotIn(visitors[0], blob)
        self.assertNotIn(sessions[0], blob)
        self.assertNotIn("eaimodel.nl/statistieken", blob)
        saved = json.loads(blob)
        for value in saved["sessions"].values():
            value["last"] = int(time.time()) - 1900
        (storage / (time.strftime("%Y-%m-%d", time.gmtime()) + ".json")).write_text(json.dumps(saved))
        report = self.stats()
        self.assertEqual(report["bounce_rate"], 66.7)
        self.assertEqual(report["pages"][0]["bounce_rate"], 66.7)

    def test_reject_private_paths_and_external_origin(self):
        visitor = "b" * 32
        session = "c" * 32
        self.assertEqual(self.post(visitor, session, path="/leif/"), 400)
        self.assertEqual(self.post(visitor, session, path="/nl/", origin="https://foreign.example"), 403)
        self.assertEqual(self.post(visitor, session, path="/nl/?secret=abc"), 400)
        self.assertEqual(self.post(visitor, session, event="click", target="knop:mail@example.com"), 400)
        self.assertEqual(self.post("not-an-id", session), 400)


if __name__ == "__main__":
    unittest.main()
