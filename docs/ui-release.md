# Public UI repair

The live site served mutable `site.css` and `site-refresh.js` with `Cache-Control: public, max-age=2592000`. Browsers could keep a previous layout and navigation for 30 days after deployment. The screenshots also showed inherited article styles in index layouts and nested grids restricting education-card copy.

## Source and release

`assets/site-ui.css` contains the shared native navigation and index-page presentation. `assets/site-responsive.css` handles the legacy global important mobile heading rule. `scripts/prepare_ui.py` applies the shared header/footer to opted-in `eai-refresh` pages and generates content-hashed asset names. It preserves the body copy and all main-content links. The House of Talents and Onderwijs in standalone pages are deliberately skipped.

The Theory7 workflow builds the release once, validates it, uploads assets first, then HTML, and reads live entry pages and exact SHA-256 asset hashes before reporting success. Existing remote files are not deleted by this upload; in particular previous hashed assets remain available for older cached HTML.

## Checks

```sh
python scripts/build_site.py --sources content/legacy --out site-build
python scripts/prepare_ui.py --root site-build
python scripts/verify_ui.py --root site-build
npm install --no-save playwright@1.56.1
npx playwright install chromium
node scripts/ui_smoke.mjs site-build
```

The browser test covers seven routes at widths 1440, 1024, 390 and 320; horizontal overflow; compressed text; one menu; subthemes; Escape/focus restoration; language destinations; the homepage example; and navigation with JavaScript disabled. Screenshots and JSON results are attached to the `Verify public UI` workflow.

This is a presentation repair, not a rewrite or new validation of the site's research claims. GitHub Pages and Theory7 are separate publication mechanisms; the production check targets `https://eaimodel.nl` explicitly.
