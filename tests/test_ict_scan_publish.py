"""Static checks for the hidden, local-only ICT scan."""
from pathlib import Path
import shlex
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "ict-scan"

class ICTScanTests(unittest.TestCase):
    def test_files_exist(self):
        for filename in ("index.html", "style.css", "monitor.css", "inventory-index.js", "app.js", "enhancements.js", "github-sync.js", "rail-drawer.js", "visual-explorer.js", "visual-explorer.css", "record-cards.js", "record-github.js", "record-cards.css", "frameworks.json", "answer-engine.js", "answer-engine.css", "scene-navigation.js", "scene-navigation.css", "evidence-experience.js", "evidence-experience.css", "role-modes.js", "role-modes.css", "dashboard-composer.js", "dashboard-composer.css", "emmaus-logo.svg", "organisation.js", "assurance-ui.js", "assurance.css", "assurance/source-register.js", "assurance/engine.js", "assurance/profile.js", "assurance/adapter.js", "assurance/record-contract.js", "assurance/worker.js", "assurance/evaluation-corpus.json", "assurance/profiles/emmauscollege.json", "README.md"):
            self.assertTrue((TOOL / filename).is_file(), filename)

    def test_composer_and_edit_gate_assets_published(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        builder = (ROOT / "scripts" / "build_site.py").read_text(encoding="utf-8")
        for filename in ("composer-resize.js", "composer-resize.css", "edit-gate.css", "edit-gate.js"):
            self.assertTrue((TOOL / filename).is_file(), filename)
            self.assertIn(f'"{filename}"', builder, f"{filename} must be shipped")
            self.assertIn(f'./{filename}', html, f"{filename} must be referenced")
        app = (TOOL / "app.js").read_text(encoding="utf-8")
        cards = (TOOL / "record-cards.js").read_text(encoding="utf-8")
        self.assertIn("signalTarget.type,signalTarget.id,true", app)
        self.assertIn("focusEditField", cards)
        self.assertIn("EmmausEditGate?.request()", cards)

    def test_clear_dashboard_labels_and_published_styles(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        composer = (TOOL / "dashboard-composer.js").read_text(encoding="utf-8")
        builder = (ROOT / "scripts" / "build_site.py").read_text(encoding="utf-8")
        self.assertNotIn("Kies. De rest volgt.", html)
        self.assertNotIn("Dunne lijnen, direct filteren", composer)
        self.assertNotIn("De weergave volgt vanzelf", composer)
        for label in ("Gegevens en grafieken", "Welke gegevens?", "Hoe wil je ze bekijken?", "Bewaar in browser", "Download indeling"):
            self.assertIn(label, html)
        self.assertEqual(html.count('class="rail-label"'), 11)
        self.assertIn("ds-option-description", composer)
        self.assertIn("ds-option-count", composer)
        self.assertIn("ux-clarity.css", builder)
        self.assertIn('href="./ux-clarity.css', html)
        self.assertTrue((TOOL / "ux-clarity.css").is_file())

    def test_secret_not_security_and_litespeed_404_middle_zero(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        js = (TOOL / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="unlockZero"', html)
        self.assertNotIn('id="unlockFour"', html)
        self.assertIn('<title>404 Not Found</title>', html)
        self.assertIn('Proudly powered by LiteSpeed Web Server', html)
        self.assertIn('The resource requested could not be found on this server!', html)
        self.assertNotIn('class="mock-header"', html)
        self.assertIn("zero.addEventListener('dblclick'", js)
        self.assertIn("e.pointerType!=='touch'", js)
        self.assertNotIn("$('unlockFour')", js)
        css = (TOOL / 'monitor.css').read_text(encoding='utf-8')
        self.assertIn('#notFound.litespeed-404', css)
        self.assertIn('background: #000', css)
        self.assertIn('background: #474747', css)
        self.assertNotIn('id="gateInput"', html)
        self.assertNotIn('id="gateForm"', html)
        self.assertNotIn("gateForm", js)
        self.assertNotIn("gateInput", js)
        self.assertIn("document.dispatchEvent(new Event('ict-scan:opened'))", js)
        enhancements = (TOOL / "enhancements.js").read_text(encoding="utf-8")
        self.assertIn("document.addEventListener('ict-scan:opened',async()=>{await restoreSnapshot();document.dispatchEvent(new Event('ict-scan:local-restored'));})", enhancements)
        self.assertNotIn("gateForm", enhancements)
        self.assertIn('noindex,nofollow', html)
        self.assertIn("connect-src 'self' https://api.github.com", html)
        self.assertNotIn('analytics.js', html)
        self.assertNotIn('cloudflareinsights', html)

    def test_no_remote_scripts(self):
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        self.assertRegex(html, r'src="\./app\.js')
        self.assertRegex(html, r'src="\./enhancements\.js')
        self.assertRegex(html, r'src="\./github-sync\.js')
        self.assertRegex(html, r'src="\./rail-drawer\.js')
        self.assertRegex(html, r'src="\./visual-explorer\.js')
        self.assertRegex(html, r'href="\./visual-explorer\.css')
        self.assertRegex(html, r'src="\./record-cards\.js')
        self.assertRegex(html, r'src="\./record-github\.js')
        self.assertRegex(html, r'src="\./answer-engine\.js')
        self.assertRegex(html, r'href="\./answer-engine\.css')
        self.assertRegex(html, r'href="\./record-cards\.css')
        self.assertRegex(html, r'href="\./monitor\.css')
        self.assertRegex(html, r'src="\./emmaus-logo\.svg')
        self.assertNotIn('<script src="http', html)
        self.assertNotIn('https://cdn.', html)
        self.assertIn('src="./scene-navigation.js', html)
        self.assertIn('href="./scene-navigation.css', html)
        self.assertIn('src="./evidence-experience.js', html)
        self.assertIn('href="./evidence-experience.css', html)
        self.assertIn('href="./studio-interface.css', html)
        self.assertIn('href="./relationship-orbit.css', html)
        self.assertIn('id="roleModeFG"', html)
        self.assertIn('id="roleModeAI"', html)
        self.assertIn('class="fg-role-boundary"', html)
        self.assertIn('id="viewStudio"', html)
        self.assertIn('id="dsCanvas"', html)
        self.assertIn('id="dsDataOptions"', html)
        self.assertIn('id="dsPartOptions"', html)
        self.assertIn('src="./dashboard-composer.js', html)
        self.assertIn('href="./dashboard-composer.css', html)
        self.assertIn('src="./role-modes.js', html)
        self.assertIn('href="./role-modes.css', html)
        self.assertNotIn('<h2>DPIA-beoordelingen</h2>', html)
        self.assertIn('data-view="devices"', html)
        self.assertIn('id="deviceCoverage"', html)
        self.assertIn('data-report="devices"', html)
        self.assertIn('PDF-inhoud is niet beoordeeld', (TOOL / 'app.js').read_text(encoding='utf-8'))

    def test_github_sync_is_read_only_and_credentials_not_persisted(self):
        html = (TOOL / 'index.html').read_text(encoding='utf-8')
        js = (TOOL / 'github-sync.js').read_text(encoding='utf-8')
        self.assertIn('id="githubSyncStart"', html)
        self.assertIn('id="githubRepo"', html)
        self.assertIn('id="githubFolder"', html)
        self.assertIn('id="githubToken" type="password"', html)
        self.assertIn('https://api.github.com', js)
        self.assertIn("method:'GET'", js)
        self.assertNotIn("method:'POST'", js)
        self.assertNotIn("method:'PUT'", js)
        self.assertNotIn("localStorage", js)
        self.assertNotIn("sessionStorage", js)
        self.assertIn("githubToken').value=''", js)
        self.assertIn('await importOneFile(file)', js)
        self.assertIn('restoreState(backup)', js)

    def test_sources_share_project_folder_but_do_not_ship_in_site(self):
        data = TOOL / "bronnen"
        self.assertTrue(data.is_dir())
        for name in ("manifest.json", "2026-applicatielandschap.json", "2026-werkregister.json", "2026-faq.json"):
            self.assertTrue((data / name).is_file(), name)
        self.assertFalse((ROOT / "ict-scan").exists(), "Verouderde bronmap op repository-root")
        builder = (ROOT / "scripts" / "build_site.py").read_text(encoding="utf-8")
        self.assertNotIn("shutil.copytree(ict_scan_source", builder)
        self.assertIn('destination_file = out / "tools" / "ict-scan" / filename', builder)
        html = (TOOL / "index.html").read_text(encoding="utf-8")
        github = (TOOL / "record-github.js").read_text(encoding="utf-8")
        self.assertIn('value="tools/ict-scan/bronnen"', html)
        self.assertIn("SOURCE_DIR=profile.source.sourceDir+'/'", github)

    def test_routes_copied_by_builder(self):
        builder = (ROOT / 'scripts' / 'build_site.py').read_text(encoding='utf-8')
        self.assertIn('ict_scan_source = repo_root / "tools" / "ict-scan"', builder)
        self.assertNotIn('"/tools/ict-scan/"', builder.split('urls.extend(')[-1])

    def test_deploy_installs_ict_headers_before_html_without_replacing_root_headers(self):
        workflow = (ROOT / '.github' / 'workflows' / 'deploy-theory7.yml').read_text(encoding='utf-8')
        transfer = workflow.split("<<'EOF'", 1)[1].split('\n          EOF', 1)[0]
        commands = [shlex.split(line.strip()) for line in transfer.splitlines()
                    if line.strip() and not line.lstrip().startswith('#')]
        header_uploads = [(index, command) for index, command in enumerate(commands)
                          if command[0] == 'put' and any('.htaccess' in word for word in command)]
        self.assertEqual(len(header_uploads), 1, 'Only the ICT directory headers may be uploaded explicitly')
        upload_index, upload = header_uploads[0]
        self.assertEqual(upload, ['put', 'site-build/tools/ict-scan/.htaccess', '-o', '/tools/ict-scan/.htaccess'])
        directory_index = commands.index(['mkdir', '-p', '/tools/ict-scan'])
        self.assertLess(directory_index, upload_index)
        site_mirrors = [(index, command) for index, command in enumerate(commands)
                        if command[0] == 'mirror' and command[-2:] == ['site-build/', '/']]
        self.assertEqual(len(site_mirrors), 1)
        mirror_index, mirror = site_mirrors[0]
        self.assertLess(upload_index, mirror_index, 'Directory headers must precede the HTML publication')
        excluded = [mirror[index + 1] for index, word in enumerate(mirror[:-1]) if word == '--exclude-glob']
        self.assertIn('.htaccess', excluded, 'The host-managed root headers must remain excluded')
        self.assertTrue((TOOL / '.htaccess').is_file())

    def test_actual_upload_connection_verifies_certificate_and_hostname(self):
        workflow = (ROOT / '.github' / 'workflows' / 'deploy-theory7.yml').read_text(encoding='utf-8')
        transfer = workflow.split("<<'EOF'", 1)[1].split('\n          EOF', 1)[0]
        commands = [shlex.split(line.strip()) for line in transfer.splitlines()
                    if line.strip() and not line.lstrip().startswith('#')]
        settings = {command[1]: command[2] for command in commands
                    if len(command) == 3 and command[0] == 'set'}
        for option in ('ssl:verify-certificate', 'ssl:check-hostname', 'ftp:ssl-force', 'ftp:ssl-protect-data'):
            self.assertEqual(settings.get(option), 'true', option)
        self.assertEqual(settings.get('cmd:fail-exit'), 'yes')
        self.assertEqual(workflow.count('HOST: web0102.theory7.net'), 2, 'FTPS preflight and upload must use the certified server name')
        self.assertNotIn('HOST: ftp.eaimodel.nl', workflow)
        checks = (ROOT / '.github' / 'workflows' / 'check-ict-assurance.yml').read_text(encoding='utf-8')
        self.assertEqual(checks.count("- '.github/workflows/deploy-theory7.yml'"), 2)

    def test_deployment_requires_the_same_ict_checks_including_browser_validation(self):
        deploy = (ROOT / '.github' / 'workflows' / 'deploy-theory7.yml').read_text(encoding='utf-8')
        checks = (ROOT / '.github' / 'workflows' / 'check-ict-assurance.yml').read_text(encoding='utf-8')
        self.assertIn('  ict-controls:\n    uses: ./.github/workflows/check-ict-assurance.yml\n', deploy)
        self.assertIn('  deploy:\n    needs: ict-controls\n', deploy)
        self.assertIn('  workflow_call:\n', checks)
        self.assertIn('node tests/verify_ict_assurance_browser.mjs', checks)
        self.assertIn('group: ict-assurance-${{ github.workflow }}-${{ github.ref }}', checks,
                      'Standalone checks must not cancel the reusable deployment check')

    def test_expandable_sidebar_keeps_primary_navigation(self):
        html = (TOOL / 'index.html').read_text(encoding='utf-8')
        js = (TOOL / 'rail-drawer.js').read_text(encoding='utf-8')
        css = (TOOL / 'monitor.css').read_text(encoding='utf-8')
        for label in ('overview', 'apps', 'connections', 'ai', 'privacy', 'findings', 'reports', 'sources'):
            self.assertIn(f'data-view="{label}"', html)
        self.assertIn('id="railMore"', html)
        self.assertIn('id="railDrawer"', html)
        self.assertIn('id="railScrim"', html)
        self.assertNotIn('class="work-tabs"', html)
        for control in ('globalSearch', 'topImport', 'topGithubSync', 'topReports', 'topPdf', 'drawerExcel', 'drawerJson'):
            self.assertEqual(html.count(f'id="{control}"'), 1, control)
        self.assertIn("event.key==='Escape'", js)
        self.assertIn("event.key!=='/'", js)
        self.assertIn("openDrawer(true)", js)
        self.assertIn('.icon-rail .rail-more', css)
        self.assertIn('@media(max-width:720px)', css)

    def test_school_style_fixed_viewport_and_reports(self):
        css = (TOOL / 'monitor.css').read_text(encoding='utf-8')
        js = (TOOL / 'enhancements.js').read_text(encoding='utf-8')
        self.assertIn('height:100dvh', css.replace(' ', ''))
        self.assertIn('overflow:auto', css.replace(' ', ''))
        self.assertIn('function renderReports()', js)
        for report in ('schoolbreed','koppelingen','ai','privacy','controles'):
            self.assertIn(report, js)
        self.assertIn('indexedDB', js)
        self.assertIn('snapshotWrite', js)

if __name__ == '__main__':
    unittest.main()
