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

# The eight choices each receive a diagram about their own subject.
SUBJECT_ART = (
 '''<svg viewBox="0 0 260 100"><g stroke="#d5e5de" stroke-width="1"><path d="M20 19h220M20 39h220M20 59h220M20 79h220M45 10v78M90 10v78M135 10v78M180 10v78M225 10v78"/></g><path d="M20 69C48 69 50 23 78 25S116 75 141 60S180 18 206 30S229 62 241 22" stroke="#0e9c91" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="206" cy="30" r="5" fill="#e9bf6e" stroke="#fff" stroke-width="2"/></svg>''',
 '''<svg viewBox="0 0 260 100"><path d="M22 85h216M22 85V16" stroke="#7e9e90" stroke-width="1.5"/><g fill="#77cbb1"><rect x="44" y="72" width="15" height="13" rx="2"/><rect x="68" y="59" width="15" height="26" rx="2"/><rect x="92" y="43" width="15" height="42" rx="2"/><rect x="116" y="26" width="15" height="59" rx="2"/><rect x="140" y="34" width="15" height="51" rx="2"/><rect x="164" y="54" width="15" height="31" rx="2"/><rect x="188" y="69" width="15" height="16" rx="2"/></g><path d="M40 79Q120 -13 210 79" fill="none" stroke="#0e8f82" stroke-width="2.8"/></svg>''',
 '''<svg viewBox="0 0 260 100"><path d="M132 25c-8-17-32-10-32 11 0 22 32 44 32 44s32-22 32-44c0-21-24-28-32-11z" fill="#f2c6bd" stroke="#bf7769" stroke-width="2"/><path d="M132 24v22m0 0q-5 16-20 20m20-20q16 10 22 22" fill="none" stroke="#c77a70" stroke-width="3"/><path d="M100 34C62 17 48 49 80 69m84-35c38-17 52 15 20 35" fill="none" stroke="#5aa9c0" stroke-width="2.3" stroke-dasharray="4 4"/><circle cx="80" cy="69" r="4" fill="#4b9dc0"/><circle cx="184" cy="69" r="4" fill="#4b9dc0"/></svg>''',
 '''<svg viewBox="0 0 260 100"><g fill="none" stroke-width="1.6"><ellipse cx="130" cy="50" rx="110" ry="29" stroke="#83b2ab" transform="rotate(-14 130 50)"/><ellipse cx="130" cy="50" rx="79" ry="44" stroke="#b6d3d0" transform="rotate(23 130 50)"/><ellipse cx="130" cy="50" rx="52" ry="18" stroke="#d0b676" transform="rotate(-35 130 50)"/></g><circle cx="130" cy="50" r="12" fill="#efd079"/><circle cx="215" cy="27" r="5" fill="#53c2ac"/><circle cx="73" cy="22" r="4" fill="#89afe2"/><circle cx="103" cy="72" r="3.5" fill="#9da3e2"/><g fill="#6caa9a"><circle cx="33" cy="19" r="1.5"/><circle cx="242" cy="64" r="1.5"/><circle cx="24" cy="81" r="2"/></g></svg>''',
 '''<svg viewBox="0 0 260 100"><path d="M8 30q20-15 41 0t41 0t41 0t41 0t41 0t40 0" stroke="#2d9d9b" stroke-width="3" fill="none"/><path d="M0 34h260v66H0z" fill="#e1f2f0"/><path d="M0 49q28-4 50 6t48 4t56 14t52-10t54-1v38H0z" fill="#93c8bf"/><path d="M0 81q36-20 67-3t61-7t70 13t62-11v27H0z" fill="#3b8c84"/><g stroke="#fffc" stroke-dasharray="3 5" stroke-width="1.5"><path d="M70 24v59M147 24v49M220 24v56"/></g></svg>''',
 '''<svg viewBox="0 0 260 100"><rect x="26" y="10" width="208" height="80" rx="6" fill="#e7f1e9" stroke="#b9d9cb"/><path d="M130 10v80M26 50h208" stroke="#a4d2be" stroke-width="1.3"/><circle cx="130" cy="50" r="17" fill="none" stroke="#a4d2be" stroke-width="1.3"/><g fill="#20816f" stroke="#fff" stroke-width="1.5"><circle cx="60" cy="51" r="7"/><circle cx="100" cy="35" r="7"/><circle cx="98" cy="72" r="7"/></g><g fill="#78abcc" stroke="#fff" stroke-width="1.5"><circle cx="199" cy="50" r="7"/><circle cx="161" cy="29" r="7"/><circle cx="167" cy="73" r="7"/></g><path d="M106 34q22-16 47-4" stroke="#e9b858" stroke-width="2.8" fill="none"/><path d="m146 23 8 7-10 3" stroke="#e9b858" stroke-width="2.8" fill="none"/></svg>''',
 '''<svg viewBox="0 0 260 100"><g stroke="#bcd9d1" fill="#fff"><rect x="16" y="31" width="51" height="35" rx="5"/><rect x="106" y="31" width="51" height="35" rx="5"/><rect x="196" y="31" width="48" height="35" rx="5"/></g><g fill="#86c6b1"><rect x="26" y="41" width="30" height="5" rx="2"/><rect x="26" y="51" width="20" height="4" rx="2"/><rect x="116" y="41" width="30" height="5" rx="2"/><rect x="116" y="51" width="21" height="4" rx="2"/><rect x="206" y="41" width="28" height="5" rx="2"/><rect x="206" y="51" width="18" height="4" rx="2"/></g><path d="M69 49h34m-7-5 7 5-7 5M159 49h34m-7-5 7 5-7 5" stroke="#15977f" stroke-width="2" fill="none"/></svg>''',
 '''<svg viewBox="0 0 260 100"><rect x="33" y="21" width="145" height="65" rx="5" fill="#dcebe5" stroke="#a3cabb"/><rect x="48" y="11" width="147" height="68" rx="5" fill="#ecf3ed" stroke="#bcdacc"/><rect x="67" y="20" width="162" height="64" rx="5" fill="#fff" stroke="#c8dcd0"/><rect x="80" y="34" width="68" height="6" rx="2" fill="#7ab89d"/><path d="M80 51h132M80 60h107" stroke="#dbe7df" stroke-width="5" stroke-linecap="round"/><rect x="166" y="30" width="43" height="16" rx="3" fill="#e5f0e8"/></svg>''',
)

ASIDES = {
 '/en/education/': ('Start with learning', 'Choose what students practise and what help fits the next step.'),
 '/en/applications/': ('Follow a case', 'See which task AI does and what remains with the professional.'),
 '/nl/onderzoek/': ('Zelf controleren', 'Vind brongegevens, berekeningen en onderbouwing achter onderzoeksuitspraken.'),
 '/en/research/': ('Check the evidence', 'Find source data, calculations and the evidence behind a claim.'),
 '/nl/publicaties/': ('Verder lezen', 'Artikelen, essays, onderzoeksreviews en gesprekken, ieder met hun eigen bronnen.'),
 '/en/publications/': ('Read on', 'Articles, essays, research reviews and conversations.'),
 '/nl/over/': ('Het EAI-model', 'Proces, fase, handeling en AI. Lees waar deze vier stappen vandaan komen.'),
 '/en/about/': ('The EAI model', 'Process, phase, human action and AI. Read how the four steps developed.'),
 '/nl/tools/': ('8 keuzes', 'Natuurkunde, wiskunde, lichaam, heelal, oceanografie, sport, AI en lesmateriaal.'),
 '/en/tools/': ('8 choices', 'Physics, mathematics, the body, space, oceanography, sport, AI and lessons.'),
}
def _picture(soup, index, subject=None):
    el = soup.new_tag('div', attrs={'class':'eai-continuity-art','aria-hidden':'true'})
    source = SUBJECT_ART[subject] if subject is not None else ILLUSTRATIONS[index % len(ILLUSTRATIONS)]
    el.append(BeautifulSoup(source,'html.parser').find('svg'))
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
            subject = i if 'eai-explore-choice' in card.get('class',[]) else None
            pic = _picture(soup, i+shift, subject=subject)
            if subject is not None:
                card.append(pic) # Retain second span as the existing description.
            else:
                card.insert(0, pic)
