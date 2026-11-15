/* Editorial card stories: opt-in only, never used inside lesson simulations. */
(() => {
  'use strict';
  const body = document.body;
  if (!body || !body.classList.contains('eai-story-page')) return;

  const en = document.documentElement.lang === 'en';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const labels = en
    ? { previous: 'Previous card', next: 'Next card', cards: 'cards', search: 'Search the site', sidebar: 'Explore EAI', carousel: 'Card collection' }
    : { previous: 'Vorige kaart', next: 'Volgende kaart', cards: 'kaarten', search: 'Zoek op de site', sidebar: 'Verken EAI', carousel: 'Kaartenreeks' };

  // Reuse the actual main navigation so labels and destinations cannot drift.
  const navigation = document.querySelector('.eai-site-primary');
  if (navigation) {
    const rail = document.createElement('nav');
    rail.className = 'eai-story-rail';
    rail.setAttribute('aria-label', labels.sidebar);
    for (const link of navigation.querySelectorAll('a[href]')) {
      const copy = document.createElement('a');
      copy.href = link.getAttribute('href');
      copy.textContent = link.textContent.trim();
      copy.className = 'eai-story-rail-link';
      if (link.getAttribute('aria-current')) copy.setAttribute('aria-current', link.getAttribute('aria-current'));
      rail.append(copy);
    }
    const header = document.querySelector('.eai-masthead');
    if (header) header.after(rail);
    else document.body.append(rail);
  }

  const controls = document.querySelector('.eai-site-controls');
  const menu = document.querySelector('.eai-site-menu');
  const search = menu?.querySelector('#eai-site-search-input');
  if (controls && menu && search) {
    const find = document.createElement('button');
    find.type = 'button';
    find.className = 'eai-story-search-button';
    find.setAttribute('aria-label', labels.search);
    find.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/></svg>';
    find.addEventListener('click', event => {
      // The shared navigation closes on any document click outside the menu.
      // This separate search shortcut must not bubble into that close handler.
      event.stopPropagation();
      menu.open = true;
      // Focus immediately: delayed focus can race the user's first keystroke.
      search.focus({ preventScroll: true });
    });
    controls.insertBefore(find, controls.firstChild);
  }

  // Detailed hero diagrams remain available, but no longer delay the first
  // choice on a phone. Desktop keeps the original explanatory diagrams.
  const compact = window.matchMedia('(max-width: 620px)');
  for (const [selector, nl, english] of [
    ['.page-hero .education-route-visual', 'Bekijk de lesroute in drie stappen', 'View the learning route'],
    ['.page-hero .knowledge-depth', 'Wat vind je hier?', 'What is here?'],
    ['.page-hero .case-map', 'Bekijk de drie toepassingen', 'Explore the three examples']
  ]) {
    const guide = document.querySelector(selector);
    if (!guide) continue;
    const parent = guide.parentNode;
    const nextSibling = guide.nextSibling;
    const disclosure = document.createElement('details');
    disclosure.className = 'eai-story-mobile-detail';
    const summary = document.createElement('summary');
    summary.textContent = en ? english : nl;
    disclosure.append(summary);
    const adapt = () => {
      if (compact.matches && !disclosure.isConnected) {
        parent.insertBefore(disclosure, nextSibling);
        disclosure.append(guide);
      } else if (!compact.matches && disclosure.isConnected) {
        parent.insertBefore(guide, disclosure);
        disclosure.remove();
      }
    };
    compact.addEventListener('change', adapt);
    adapt();
  }

  const tracks = Array.from(document.querySelectorAll([
    'main .card-grid',
    'main .publication-grid',
    'main .tool-grid',
    'main .case-card-grid',
    'main .education-choice-grid',
    'main .model-principles',
    'main .eai-editorial-links',
    'main .knowledge-routes > .wrap'
  ].join(',')));

  for (const track of tracks) {
    if (track.closest('.eai-card-deck') || track.dataset.eaiCardDeck) continue;
    const cards = Array.from(track.children).filter(el => el.nodeType === 1);
    if (cards.length < 2) continue;
    // A route wrapper may also contain headings. Only transform real card rows.
    if (track.matches('.knowledge-routes > .wrap') && !cards.every(el => el.classList.contains('knowledge-route'))) continue;
    track.classList.add('eai-card-deck');
    track.dataset.eaiCardDeck = 'true';
    track.tabIndex = 0;
    const section = track.closest('section');
    const heading = section?.querySelector('h2, h1');
    track.setAttribute('role', 'region');
    track.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-label', heading?.textContent.trim() || labels.carousel);

    const tools = document.createElement('div');
    tools.className = 'eai-card-deck-tools';
    const count = document.createElement('output');
    count.className = 'eai-card-deck-count';
    count.setAttribute('aria-live', 'polite');
    count.setAttribute('aria-atomic', 'true');
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'eai-card-deck-previous';
    previous.setAttribute('aria-label', labels.previous);
    previous.textContent = '←';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'eai-card-deck-next';
    next.setAttribute('aria-label', labels.next);
    next.textContent = '→';
    const actions = document.createElement('div');
    actions.className = 'eai-card-deck-actions';
    actions.append(previous, next);
    tools.append(count, actions);
    track.before(tools);

    cards.forEach((card, index) => {
      card.classList.add('eai-card-deck-slide');
      card.setAttribute('aria-roledescription', 'slide');
      card.setAttribute('aria-label', (index + 1) + ' / ' + cards.length);
    });
    let current = 0;
    let scheduled = false;
    const update = () => {
      const left = track.scrollLeft;
      const positions = cards.map(card => Math.abs(card.offsetLeft - cards[0].offsetLeft - left));
      current = positions.indexOf(Math.min(...positions));
      count.textContent = (current + 1) + ' / ' + cards.length;
      previous.disabled = current === 0;
      next.disabled = current === cards.length - 1;
      scheduled = false;
    };
    const move = index => {
      const target = Math.max(0, Math.min(cards.length - 1, index));
      track.scrollTo({
        left: cards[target].offsetLeft - cards[0].offsetLeft,
        behavior: reducedMotion ? 'auto' : 'smooth'
      });
    };
    previous.addEventListener('click', () => move(current - 1));
    next.addEventListener('click', () => move(current + 1));
    track.addEventListener('scroll', () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    track.addEventListener('keydown', event => {
      if (event.target !== track) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(current + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(current - 1); }
    });
    window.addEventListener('resize', update, { passive: true });
    update();
  }
})();