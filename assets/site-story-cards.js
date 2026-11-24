/* Homepage-style public pages: open cards, no parallel menu or swipe deck. */
(() => {
  'use strict';
  if (!document.body?.classList.contains('eai-story-page')) return;
  // The shared navigation owns search on every public page.
  // Hide only explanatory diagrams behind a disclosure on small screens.
  // All actual navigation cards always remain directly visible.
  const compact = matchMedia('(max-width: 620px)');
  for (const [selector,nl,en] of [
    ['.page-hero .education-route-visual','Bekijk de lesroute','View the lesson route'],
    ['.page-hero .case-map','Bekijk de toepassingen','Explore the applications'],
    ['.page-hero .knowledge-depth','Wat vind je hier?','What is here?']
  ]) {
    const diagram = document.querySelector(selector);
    if (!diagram) continue;
    const parent = diagram.parentNode;
    const next = diagram.nextSibling;
    const details = document.createElement('details');
    details.className = 'eai-story-mobile-detail';
    const summary = document.createElement('summary');
    summary.textContent = document.documentElement.lang === 'en' ? en : nl;
    details.append(summary);
    const adapt = () => {
      if (compact.matches && !details.isConnected) {
        parent.insertBefore(details, next);
        details.append(diagram);
      } else if (!compact.matches && details.isConnected) {
        parent.insertBefore(diagram, details);
        details.remove();
      }
    };
    compact.addEventListener('change', adapt);
    adapt();
  }
})();
