/* Homepage-style public pages: open cards, no parallel menu or swipe deck. */
(() => {
  'use strict';
  if (!document.body?.classList.contains('eai-story-page')) return;
  const controls = document.querySelector('.eai-site-controls');
  const menu = document.querySelector('.eai-site-menu');
  const search = menu?.querySelector('#eai-site-search-input');
  if (controls && menu && search && !controls.querySelector('.eai-story-search-button')) {
    const button = document.createElement('button');
    button.className = 'eai-story-search-button';
    button.type = 'button';
    button.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Search the site' : 'Zoek op de site');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/></svg>';
    button.addEventListener('click', event => {
      event.stopPropagation();
      menu.open = true;
      requestAnimationFrame(() => search.focus({preventScroll:true}));
    });
    controls.insertBefore(button, controls.firstChild);
  }
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
