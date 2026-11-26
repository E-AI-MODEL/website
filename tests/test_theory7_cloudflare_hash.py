"""Cloudflare mag alleen zijn eigen RUM-beacon aan een echte release toevoegen.

Alle overige wijzigingen, inclusief andere scripts en inhoud, breken de hash.
"""
from __future__ import annotations

import hashlib
import sys
import unittest
import io
import textwrap
from contextlib import redirect_stdout
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError
from urllib.parse import urlsplit
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from verify_ui import html_matches_release

BEACON = (
    b'<script type="text/javascript" '
    b'src="https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092" '
    b'integrity="sha512-ABC" '
    b'data-cf-beacon=\'{"version":"2024.11.0","token":"public-site-tag"}\' '
    b'crossorigin="anonymous"></script>'
)
ORIGINAL = b'<!doctype html><html><head><title>Niet gevonden</title></head><body><main>404</main></body></html>'
DIGEST = hashlib.sha256(ORIGINAL).hexdigest()


class CloudflareLiveHashTests(unittest.TestCase):
    def test_ongewijzigde_html_is_exact(self):
        self.assertEqual(html_matches_release(ORIGINAL, DIGEST), (True, False))

    def test_beacon_wordt_als_enige_cloudflare_toevoeging_herkend(self):
        with_beacon = ORIGINAL.replace(b"</body>", BEACON + b"</body>")
        self.assertEqual(html_matches_release(with_beacon, DIGEST), (True, True))

    def test_gewijzigde_inhoud_mag_niet_worden_goedgekeurd(self):
        modified = ORIGINAL.replace(b"<main>404</main>", b"<main>ander bericht</main>")
        self.assertEqual(html_matches_release(modified, DIGEST), (False, False))
        with_beacon = modified.replace(b"</body>", BEACON + b"</body>")
        self.assertEqual(html_matches_release(with_beacon, DIGEST), (False, False))

    def test_onbekende_scriptinjectie_mag_niet_worden_genegeerd(self):
        script = b'<script src="https://example.org/tracker.js"></script>'
        self.assertEqual(
            html_matches_release(ORIGINAL.replace(b"</body>", script + b"</body>"), DIGEST),
            (False, False)
        )

    def test_beacon_met_onveilig_event_handler_wordt_afgekeurd(self):
        script = BEACON.replace(b' crossorigin=', b' onload="alert(1)" crossorigin=')
        self.assertEqual(
            html_matches_release(ORIGINAL.replace(b"</body>", script + b"</body>"), DIGEST),
            (False, False)
        )

    def test_leif_public_pages_allow_only_verified_cloudflare_beacon(self):
        root = Path(__file__).resolve().parents[1]
        for relative in ('leif/index.html', 'leif/continue/index.html', 'leif/verhaal/index.html'):
            with self.subTest(relative=relative):
                source = (root / relative).read_bytes()
                digest = hashlib.sha256(source).hexdigest()
                self.assertIn(b'</body>', source)
                before, closing = source.rsplit(b'</body>', 1)
                injected = before + BEACON + b'\n</body>' + closing
                self.assertEqual(html_matches_release(injected, digest), (True, True))
                changed = injected.replace(b'<body', b'<body data-unauthorized="1"', 1)
                self.assertEqual(html_matches_release(changed, digest), (False, False))

    def test_standalone_tool_html_accepts_only_single_beacon(self):
        root = Path(__file__).resolve().parents[1]
        for relative in ('tools/eaimesh/start/index.html', 'tools/eaistudio/studio/index.html'):
            with self.subTest(relative=relative):
                source = (root / relative).read_bytes()
                digest = hashlib.sha256(source).hexdigest()
                first, last = source.rsplit(b'</body>', 1)
                injected = first + BEACON + b'\n</body>' + last
                self.assertEqual(html_matches_release(injected, digest), (True, True))
                tampered = injected.replace(b'<body', b'<body data-injected="yes"', 1)
                self.assertEqual(html_matches_release(tampered, digest), (False, False))

    def test_anatomie_live_checks_use_known_release_user_agent(self):
        workflow = (Path(__file__).resolve().parents[1] /
                    '.github/workflows/deploy-theory7.yml').read_text(encoding='utf-8')
        anatomy = workflow.split('      - name: Verify live anatomy JavaScript and stylesheets', 1)[1]
        self.assertEqual(anatomy.count('def release_open(url, timeout):'), 3)
        self.assertEqual(anatomy.count("'User-Agent': 'EAI-release-check/1.0'"), 3)
        self.assertNotIn('with urlopen(', anatomy)
        self.assertNotIn('html = urlopen(', anatomy)

    def test_retired_projectile_workflow_preserves_hash_and_route_checks(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/deploy-theory7.yml").read_text(encoding="utf-8")
        step = workflow.split("      - name: Verify the retired projectile route and retained physics lab", 1)[1]
        step = step.split("      - name: Verify exact live EAIspeak files and legacy redirect", 1)[0]
        code = textwrap.dedent(step.split("python - <<'PY'\n", 1)[1].rsplit("\n          PY", 1)[0])
        source = (root / "content/science-observatory/labs/natuurkunde.html").read_bytes()
        injected = source.replace(b"</body>", BEACON + b"\n</body>", 1)
        altered = injected.replace(b"<body", b'<body data-unauthorized="1"', 1)
        old = "/tools/science-observatory/labs/schuine-worp/"
        current = "/tools/science-observatory/labs/natuurkunde/"
        cases = [
            ("exact", (404, 404), 200, source, True, False),
            ("known beacon", (404, 410), 200, injected, True, True),
            ("changed content", (404, 404), 200, altered, False, False),
            ("retired page still exists", (200, 404), 200, injected, False, False),
            ("retired page redirects", (302, 404), 200, source, False, False),
            ("retired index still exists", (404, 200), 200, source, False, False),
            ("physics unavailable", (404, 404), 404, source, False, False),
        ]
        for name, old_status, kept_status, body, should_pass, beacon in cases:
            with self.subTest(case=name):
                def open_url(request, timeout):
                    path = urlsplit(request.full_url).path
                    statuses = {old: old_status[0], old + "index.html": old_status[1], current: kept_status}
                    self.assertIn(path, statuses)
                    status = statuses[path]
                    if status != 200:
                        raise HTTPError(request.full_url, status, "fixture", None, None)
                    response = MagicMock()
                    response.__enter__.return_value.status = status
                    response.__enter__.return_value.read.return_value = body if path == current else b"old"
                    return response

                opener = MagicMock()
                opener.open.side_effect = open_url
                output = io.StringIO()
                with patch("urllib.request.build_opener", return_value=opener) as factory, \
                     patch("pathlib.Path.read_bytes", return_value=source), \
                     patch("time.sleep"), patch.object(sys, "path", list(sys.path)), redirect_stdout(output):
                    if should_pass:
                        exec(compile(code, "retired-projectile-livecheck", "exec"), {})
                        self.assertIn("integrated physics matches validated build", output.getvalue())
                        self.assertEqual("Cloudflare RUM injection verified" in output.getvalue(), beacon)
                    else:
                        with self.assertRaisesRegex(AssertionError, "Retirement not verified"):
                            exec(compile(code, "retired-projectile-livecheck", "exec"), {})
                    handler = factory.call_args.args[0]
                    self.assertIsNone(handler.redirect_request(None, None, 302, "", {}, current))

    def test_geen_dubbele_of_meervoudige_injecties(self):
        extra = ORIGINAL.replace(b"</body>", BEACON + BEACON + b"</body>")
        self.assertEqual(html_matches_release(extra, DIGEST), (False, False))


if __name__ == "__main__":
    unittest.main()
