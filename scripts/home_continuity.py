"""Public editorial page decoration, with no changes to source content or routes."""
from bs4 import BeautifulSoup

HUBS = {
 '/nl/onderzoek/', '/en/research/', '/nl/onderwijs/', '/en/education/',
 '/nl/toepassingen/', '/en/applications/', '/nl/publicaties/', '/en/publications/',
 '/nl/over/', '/en/about/', '/nl/tools/', '/en/tools/',
}
ARTICLES = {
 '/nl/blog/', '/nl/blog/wat-ons-werk-ons-werk-maakt/',
 '/nl/onderzoek/leermiddelen/', '/en/research/teaching-tools/',
 '/nl/onderzoek/zhang-genai-taal/', '/en/research/zhang-genai-language/',
}
ROUTES = HUBS | ARTICLES

ILLUSTRATIONS = (
 '''<svg viewBox="0 0 260 100"><circle cx="51" cy="50" r="29" stroke="#d4e8e0" stroke-width="14" fill="none"/><path d="M51 21 A29 29 0 0 1 80 50" stroke="#52c9a9" stroke-width="14" fill="none"/><path d="M80 50 A29 29 0 0 1 51 79" stroke="#74bde2" stroke-width="14" fill="none"/><path d="M51 79 A29 29 0 0 1 22 50" stroke="#f0c36e" stroke-width="14" fill="none"/><text x="51" y="54" text-anchor="middle" font-size="12" font-weight="800" fill="#19493b">EAI</text><g font-size="10" fill="#47665e"><circle cx="125" cy="30" r="3" fill="#52c9a9"/><text x="135" y="34">Proces</text><circle cx="125" cy="48" r="3" fill="#74bde2"/><text x="135" y="52">Fase</text><circle cx="125" cy="66" r="3" fill="#f0c36e"/><text x="135" y="70">Handeling</text></g></svg>''',
 '''<svg viewBox="0 0 260 100"><rect x="16" y="12" width="228" height="76" rx="7" fill="#fff" stroke="#dbe8df"/><rect x="29" y="24" width="134" height="6" rx="3" fill="#75b49b"/><rect x="29" y="39" width="198" height="6" rx="3" fill="#dae6df"/><rect x="29" y="54" width="164" height="6" rx="3" fill="#dae6df"/><rect x="29" y="69" width="117" height="6" rx="3" fill="#a3c9b9"/><rect x="186" y="19" width="43" height="16" rx="3" fill="#dbf0e7"/><rect x="197" y="25" width="21" height="3" rx="1.5" fill="#1d846c"/></svg>''',
 '''<svg viewBox="0 0 260 100"><rect x="20" y="12" width="220" height="77" rx="5" fill="#fff" stroke="#e2eae4"/><g font-size="10" font-weight="700" fill="#46685f"><rect x="33" y="26" width="6" height="6" rx="1.5" fill="#4abf9e"/><text x="48" y="32">Bronnen</text><path d="M120 29h100" stroke="#dce6df" stroke-width="4" stroke-linecap="round"/><rect x="33" y="45" width="6" height="6" rx="1.5" fill="#e9bd64"/><text x="48" y="51">Analyse</text><path d="M120 48h85" stroke="#dce6df" stroke-width="4" stroke-linecap="round"/><rect x="33" y="64" width="6" height="6" rx="1.5" fill="#7c9ddb"/><text x="48" y="70">Duiding</text><path d="M120 67h95" stroke="#dce6df" stroke-width="4" stroke-linecap="round"/></g></svg>''',
 '''<svg viewBox="0 0 260 100"><g stroke="#d1e5e0" stroke-width="1"><path d="M20 19h221M20 39h221M20 59h221M20 79h221M45 9v80M90 9v80M135 9v80M180 9v80M225 9v80"/></g><path d="M20 69 C42 69 48 18 74 25 S111 77 136 62 S167 16 190 30 S217 72 241 19" stroke="#0c9c91" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="190" cy="30" r="5" fill="#f5c56d" stroke="white" stroke-width="2"/></svg>''',
)
ASIDES = {
 '/nl/onderzoek/': ('Zelf controleren', 'Vind brongegevens, berekeningen en onderbouwing achter onderzoeksuitspraken.'),
 '/en/research/': ('Check the evidence', 'Find source data, calculations and the evidence behind a claim.'),
 '/nl/publicaties/': ('Verder lezen', 'Artikelen, essays, onderzoeksreviews en gesprekken, ieder met hun eigen bronnen.'),
 '/en/publications/': ('Read on', 'Articles, essays, research reviews and conversations.'),
 '/nl/over/': ('Het EAI-model', 'Proces, fase, handeling en AI. Lees waar deze vier stappen vandaan komen.'),
 '/en/about/': ('The EAI model', 'Process, phase, human action and AI. Read how the four steps developed.'),
 '/nl/tools/': ('8 keuzes', 'Natuurkunde, wiskunde, lichaam, heelal, oceanografie, sport, AI en lesmateriaal.'),
 '/en/tools/': ('8 choices', 'Physics, mathematics, the body, space, oceanography, sport, AI and lessons.'),
}
def _picture(soup, index):
    el = soup.new_tag('div', attrs={'class':'eai-continuity-art','aria-hidden':'true'})
    el.append(BeautifulSoup(ILLUSTRATIONS[index % len(ILLUSTRATIONS)],'html.parser').find('svg'))
    return el

def enhance(soup, path, en):
    if path not in ROUTES or soup.main is None:
        return
    main = soup.main
    if path in ASIDES:
        hero = main.select_one('section.page-hero, section.eai-editorial-hero, header.eai-explore-hero')
        if hero:
            inner = hero.select_one('.wrap, .eai-explore-shell')
            if inner and not inner.select_one('.eai-continuity-aside'):
                # Existing grids have a single copy column. Plain hero wraps
                # contain h1/p directly and need a copy column of their own.
                direct = [tag for tag in inner.children if getattr(tag,'name',None)]
                if any(tag.name in ('h1','h2','p','span') for tag in direct):
                    copy = soup.new_tag('div', attrs={'class':'eai-continuity-hero-copy'})
                    for child in list(inner.contents):
                        copy.append(child.extract())
                    inner.append(copy)
                heading, summary = ASIDES[path]
                aside = soup.new_tag('aside', attrs={'class':'eai-continuity-aside'})
                label = soup.new_tag('span', attrs={'class':'eai-continuity-label'})
                label.string = 'EAI'
                title = soup.new_tag('h2')
                title.string = heading
                desc = soup.new_tag('p')
                desc.string = summary
                aside.extend([label,title,desc])
                inner.append(aside)
                inner['class'] = list(dict.fromkeys(inner.get('class',[])+['eai-continuity-hero-inner']))
    groups = [
        ('.education-choice-grid > a', 1),
        ('.knowledge-routes .knowledge-route > div:first-child', 2),
        ('.case-card-grid > .case-card', 0),
        ('.publication-grid > .publication-card', 3),
        ('.card-grid > .card', 3),
        ('.eai-hub-news-grid > .eai-hub-news-card', 2),
        ('.eai-explore-choices > .eai-explore-choice', 0),
    ]
    for selector, shift in groups:
        for i, card in enumerate(main.select(selector)):
            if card.select_one('.eai-continuity-art'):
                continue
            pic = _picture(soup, i+shift)
            if 'eai-explore-choice' in card.get('class',[]):
                card.append(pic) # Retain second span as the existing description.
            else:
                card.insert(0, pic)
