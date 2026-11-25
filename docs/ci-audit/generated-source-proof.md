# Repository cleanup: evidence before deletion

This branch is a temporary diagnostic, not a release. It does not change any
existing source file or deploy workflow. It tests the generator stage by
removing identical content/tools copies from a disposable worktree, then
compares every generated non-ICT output path and SHA-256.

- ICT scan remains outside the cleanup.
- The anatomy build and its generated output remain unchanged in this probe.
- A matching generator result is only evidence about build_site.py, not about
  preparation, browsers, tests that read root files, or GitHub Pages.
- Review path reference leads and retain all direct-source consumers.
- Confirm the GitHub Pages publishing source and all required routes before
  removing root output. Jekyll currently publishes directly from the repo.
- The generated anatomy assets can only be removed from version control after
  both publishing targets use tested build artifacts and the full anatomical
  regression tests pass without the tracked copies.
- Do not rewrite Git history, remove public URLs, delete upstream attribution,
  or deploy from this diagnostic branch.
