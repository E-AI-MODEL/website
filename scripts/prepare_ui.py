"""Prepare content-addressed assets, native navigation and dated archive corrections.
Run after build_site.py. Standalone handoff source files are not rewritten.
"""
from __future__ import annotations
import argparse
import hashlib
import html
import json
import re
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
from editorial_ui import apply_editorial
from archive_review import review as review_archive
from home_model import materialize as materialize_home_model
from home_continuity import enhance as enhance_home_continuity, ROUTES as CONTINUITY_PATHS

ASSETS = ('site.css', 'site-refresh.js', 'site-ui.css', 'site-responsive.css', 'site-redesign.css', 'site-editorial.css', 'site-archive.css', 'site-navigation.js', 'home-model.css', 'home-model.js', 'site-story-cards.css', 'site-story-cards.js', 'site-dashboard-cards.css', 'site-dashboard-cards.js', 'site-header.css')
SKIP = {'.git', '.github', 'content', 'scripts', 'tests', 'assets', 'handoff', 'houseoftalents', 'onderwijsin', 'leif', 'topo', 'site-build'}
ALIASES = {'/': '/nl/', '/tools/': '/nl/tools/', '/publicaties/': '/nl/publicaties/', '/over/': '/nl/over/', '/onderwijs/': '/nl/onderwijs/', '/toepassingen/': '/nl/toepassingen/', '/kennis/': '/nl/onderzoek/', '/model-monitor/': '/nl/model-monitor/', '/llmscan/': '/nl/llmscan/'}
# These are former index pages, not the many child routes underneath them.
# Keep the root homepage and independent monitor/tools unchanged.
LEGACY_HUB_REDIRECTS = {
    '/onderwijs/': '/nl/onderwijs/',
    '/kennis/': '/nl/onderzoek/',
    '/publicaties/': '/nl/publicaties/',
    '/toepassingen/': '/nl/toepassingen/',
    '/over/': '/nl/over/',
    '/tools/': '/nl/tools/',
}

# Editorial-only enhancement. Not loaded in interactive labs or article bodies.
STORY_PATHS = {
    '/nl/onderwijs/', '/en/education/',
    '/nl/onderzoek/', '/en/research/',
    '/nl/publicaties/', '/en/publications/',
    '/nl/toepassingen/', '/en/applications/',
    '/nl/tools/', '/en/tools/',
    '/nl/over/', '/en/about/',
    '/nl/blog/', '/nl/blog/wat-ons-werk-ons-werk-maakt/',
    '/nl/onderzoek/leermiddelen/', '/en/research/teaching-tools/',
    '/nl/onderzoek/zhang-genai-taal/', '/en/research/zhang-genai-language/',
}
DASH_CARD_PATHS = {'/nl/tools/', '/en/tools/', '/nl/onderwijs/', '/en/education/', '/nl/onderzoek/', '/en/research/', '/nl/toepassingen/', '/en/applications/', '/nl/publicaties/', '/en/publications/'}
INDEX_PATHS = {'/nl/', '/en/', '/nl/model/', '/en/model/', '/nl/tools/', '/en/tools/', '/nl/onderwijs/', '/en/education/', '/nl/onderzoek/', '/en/research/', '/nl/toepassingen/', '/en/applications/', '/nl/over/', '/en/about/'}

def canonical(path: str) -> str:
    path = urlsplit(path).path.removesuffix('index.html')
    path = '/' + path.strip('/') + '/' if path.strip('/') else '/'
    return ALIASES.get(path, path)

@lru_cache(maxsize=2)
def groups(en: bool):
    """One short public route per purpose; deep links stay in search and catalogs."""
    if en:
        return [
            ('The model', [('Explore the EAI model', '/en/model/'), ('Glossary', '/en/glossary/'),
                           ('The two pillars', '/twee-pijlers/')]),
            ('Education', [('Begin with a learning question', '/en/education/'),
                           ('EAI workforms', '/werkvormen/'), ('Language activities (Dutch)', '/taalwerkvormen/')]),
            ('Research', [('Research and evidence', '/en/research/'), ('Source register', '/bronnen/'),
                          ('Teaching tools research', '/en/research/teaching-tools/')]),
            ('Articles', [('Publications and media', '/en/publications/'),
                          ('The Act of Learning', '/publicaties/the-act-of-learning/'),
                          ('Research reviews', '/en/research/zhang-genai-language/')]),
            ('Explore & create', [('Explore and create', '/en/tools/')]),
            ('About EAI', [('About EAI', '/en/about/'), ('Site insights', '/en/insights/')]),
        ]
    return [
        ('Het model', [('Het EAI-model', '/nl/model/'), ('Begrippen en definities', '/nl/begrippen/'),
                       ('Twee pijlers', '/twee-pijlers/')]),
        ('Onderwijs', [('Begin bij je lesvraag', '/nl/onderwijs/'), ('EAI Toolbox', '/werkvormen/'),
                        ('TAALwerkvormen', '/taalwerkvormen/')]),
        ('Onderzoek', [('Onderzoek en onderbouwing', '/nl/onderzoek/'), ('Bronnenregister', '/bronnen/'),
                        ('Onderzoek leermiddelen', '/nl/onderzoek/leermiddelen/')]),
        ('Artikelen', [('Artikelen en publicaties', '/nl/publicaties/'), ('Blog', '/nl/blog/'),
                       ('De vraag die we vergeten', '/publicaties/de-vraag-die-we-vergeten/')]),
        ('Zelf aan de slag', [('Kies een vakgebied of hulpmiddel', '/nl/tools/')]),
        ('Over EAI', [('Over EAI', '/nl/over/'), ('Websitegebruik', '/nl/insights/')]),
    ]


@lru_cache(maxsize=2)
def experiment_sections(en: bool):
    """Use the model's own catalogue and IDs, never a second handwritten list."""
    sources = Path(__file__).resolve().parent.parent / 'content' / 'science-observatory' / 'labs'
    physics = (sources / 'natuurkunde.html').read_text(encoding='utf-8')
    catalogue_match = re.search(r'window\.CATALOG=(\[[^\n]+\]);</script>', physics)
    if not catalogue_match:
        raise ValueError('Natuurkundeproeven hebben geen leesbare catalogus')
    catalogue = json.loads(catalogue_match.group(1))
    specs = physics.split('const labSpecs = [', 1)[1].split('\n];', 1)[0]
    ids = re.findall(r"^\['([a-z][a-z0-9]*)',", specs, re.MULTILINE)
    if len(ids) != len(catalogue) or len(ids) != 53:
        raise ValueError('Catalogus en proef-ID’s verschillen')
    physics_groups = {}
    subject_labels = {
        'Mechanica': ('Krachten en beweging', 'Forces and motion'),
        'Trillingen en golven': ('Trillingen en golven', 'Oscillations and waves'),
        'Electrodynamica': ('Elektriciteit en magnetisme', 'Electricity and magnetism'),
        'Optica': ('Licht en lenzen', 'Light and lenses'),
        'Thermodynamica': ('Warmte en gassen', 'Heat and gases'),
        'Relativiteitstheorie': ('Ruimte en tijd', 'Space and time'),
        'Atoomfysica': ('Atomen en elektronen', 'Atoms and electrons'),
        'Kernfysica': ('Radioactiviteit en atoomkernen', 'Radioactivity and nuclei'),
        'Vastestoffysica': ('Vaste stoffen en kristallen', 'Solids and crystals'),
    }
    if {model['group'] for model in catalogue} != set(subject_labels):
        raise ValueError('De natuurkundige onderwerpindeling is veranderd; controleer de zichtbare namen')
    for id_, model in zip(ids, catalogue):
        dutch, english = subject_labels[model['group']]
        name = english if en else dutch
        physics_groups.setdefault(name, []).append(
            (model['title'].strip('"'), '/tools/science-observatory/labs/natuurkunde/#' + id_, ''))
    maths = []
    for variant in ('a', 'b'):
        source = (sources / ('wiskunde-' + variant + '.html')).read_text(encoding='utf-8')
        config_match = re.search(r'<script\b[^>]*\bid="config"[^>]*>(.*?)</script>', source, re.DOTALL)
        if not config_match:
            raise ValueError('Wiskunde ' + variant.upper() + ' heeft geen modelcatalogus')
        modules = json.loads(config_match.group(1))['modules']
        maths.append(('Wiskunde ' + variant.upper(), [(m['short'], '/tools/science-observatory/labs/wiskunde-' + variant + '/#' + m['id'], m.get('desc', m.get('subtitle', ''))) for m in modules]))
    galaxy = (sources / 'melkweg.html').read_text(encoding='utf-8')
    galaxy_doc = BeautifulSoup(galaxy, 'html.parser')
    modes = [(button.b.get_text(' ', strip=True), '/tools/science-observatory/labs/melkweg/#' + button['data-mode'], button.small.get_text(' ', strip=True) if button.small else '') for button in galaxy_doc.select('button.nav-btn[data-mode]') if button.b]
    if len(modes) != 6:
        raise ValueError('De zes originele Melkwegonderdelen zijn niet compleet')
    guided = BeautifulSoup((Path(__file__).resolve().parent.parent / 'content' / 'melkweg-lab' / 'index.html').read_text(encoding='utf-8'), 'html.parser')
    guided_modes = [(button.b.get_text(' ', strip=True), '/tools/melkweg-lab/#' + button['data-mode'], '') for button in guided.select('button.nav-btn[data-mode]') if button.b]
    if len(guided_modes) != 6:
        raise ValueError('De zes onderdelen van de Melkweg met uitleg zijn niet compleet')
    llm_source = (Path(__file__).resolve().parent.parent / 'content' / 'llm-observatorium' / 'index.html').read_text(encoding='utf-8')
    llm_match = re.search(r'const MODES=\[(.*?)\n\];', llm_source, re.DOTALL)
    llm_names = re.findall(r"name:'([^']+)'", llm_match.group(1)) if llm_match else []
    if len(llm_names) != 7:
        raise ValueError('De zeven LLM-onderdelen zijn niet compleet')
    llm_modes = [(name, '/tools/llm-observatorium/#' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'), '') for name in llm_names]
    return [
        ('Physics' if en else 'Natuurkunde', [(name, links) for name, links in physics_groups.items()]),
        ('Mathematics' if en else 'Wiskunde', maths),
        ('Human body' if en else 'Menselijk lichaam', [('Body and heart' if en else 'Lichaam en hart', [('The body in 3D' if en else 'Het lichaam in 3D', '/tools/anatomie/', ''), ('Heart and circulation' if en else 'Hart en bloedsomloop', '/tools/anatomie/labs/hartslag/', 'hartslag hartkleppen bloedstroom hartcyclus')])]),
        ('Space' if en else 'Heelal', [('The Milky Way' if en else 'De Melkweg', guided_modes), ('Constellations' if en else 'Sterrenbeelden', [('Leo in 3D (Dutch)' if en else 'Leeuw in 3D', '/tools/science-observatory/labs/leeuw/', 'Sterrenbeeld Leeuw, Leo, sterrenkaart, parallax, sterrenlicht en eigenbeweging')]), ('Orbits' if en else 'Banen', [('Gravity and satellites' if en else 'Gravitatie en satellietbanen', '/tools/science-observatory/labs/gravitatie-banen/', '')])]),
        ('Oceanography' if en else 'Oceanografie', [('Oceanography' if en else 'Oceanografie', [('Oceanography (Dutch)' if en else 'Oceanografie', '/tools/abyss/', 'Zeebodem, aardbevingen, plaattektoniek, stromingen en meetgegevens')])]),
        ('Sport and movement' if en else 'Sport en bewegen', [('Sports' if en else 'Sport en bewegen', [('Attack and defence' if en else 'Aanvallen en verdedigen', '/tools/lo-aanvalslab/', ''), ('Research and sources' if en else 'Onderbouwing van aanvallen en verdedigen', '/tools/lo-aanvalslab/onderbouwing/', '')])]),
        ('AI', [('Language models' if en else 'Taalmodellen', [('How does a language model work?' if en else 'Hoe werkt een taalmodel?', '/tools/llm-observatorium/', '')] + llm_modes)]),
    ]




@lru_cache(maxsize=2)
def education_sections(en: bool):
    """Group published workforms by their actual teaching purpose, not their initial letter."""
    root = Path(__file__).resolve().parent.parent
    intro = [
        ('Education and workforms' if en else 'Onderwijs en werkvormen', '/en/education/' if en else '/nl/onderwijs/', 'Begin bij een vraag uit je les.'),
        ('EAI workform collection' if en else 'Alle EAI-werkvormen', '/werkvormen/', 'Werkvormen voor leren en AI-gebruik.'),
        ('Language activities (Dutch)' if en else 'Taalwerkvormen', '/taalwerkvormen/', 'Oefenen met vaktaal en feedback.'),
        ('Teaching practice (Dutch)' if en else 'Voorbeelden uit de praktijk', '/praktijk/', 'Voorbeelden uit het onderwijs.'),
        ('Two pillars' if en else 'Twee pijlers', '/twee-pijlers/', 'Didactiek en AI-geletterdheid.'),
        ('AI workshop' if en else 'AI-workshop', '/workshop-ai/', 'Materialen voor een onderwijsworkshop.'),
    ]
    data = json.loads((root / 'content' / 'workforms.json').read_text(encoding='utf-8'))
    published = {page.parent.name for page in (root / 'werkvormen').glob('*/index.html')}
    source = {form['slug']: form for form in data['workforms']}
    if published != set(source):
        raise ValueError('Gepubliceerde werkvormen en brongegevens verschillen: ' + repr(sorted(published ^ set(source))))
    semantic_groups = [
        ('Opdrachten en de rol van AI', 'Planning tasks and AI roles (Dutch)', ('analyse', 'ontwerpen')),
        ('Hulp en feedback tijdens het leren', 'Support and feedback (Dutch)', ('scaffolding', 'herstellen')),
        ('Zelfstandigheid en zelfregulatie', 'Independent work and self-regulation (Dutch)', ('zelfregulatie', 'zelfstandigheid')),
        ('Denk- en leerproces zichtbaar maken', 'Evidence of thinking and learning (Dutch)', ('zichtbaar', 'bewijs')),
        ('Bronnen en argumenten beoordelen', 'Sources and arguments (Dutch)', ('argumentatie',)),
        ('Beoordelen en professioneel oordeel', 'Assessment and professional judgement (Dutch)', ('professioneel-oordeel',)),
    ]
    categories = [category for _, _, item_categories in semantic_groups for category in item_categories]
    if len(categories) != len(set(categories)) or set(categories) != {form['category'] for form in source.values()}:
        raise ValueError('Niet elke werkvormcategorie is precies eenmaal ingedeeld')
    groups_ = [('Start hier' if not en else 'Start here', intro)]
    total = 0
    for dutch, english, categories_here in semantic_groups:
        forms = [form for form in source.values() if form['category'] in categories_here]
        links = [(form.get('public_title') or form['title'],
                  '/werkvormen/' + form['slug'] + '/',
                  form['summary']) for form in forms]
        links.sort(key=lambda item: item[0].casefold())
        total += len(links)
        groups_.append((english if en else dutch, links))
    if total != len(published):
        raise ValueError('Niet alle EAI-werkvormen zijn via het menu te vinden')
    return groups_


@lru_cache(maxsize=2)
def tool_sections(en: bool):
    """Available public tools and their existing subpages."""
    if en:
        return [
            ('Create lessons and prompts', [('Prompt Framework', '/tools/prompt-framework/', ''), ('Process to prompt', '/tools/van-proces-naar-prompt/', ''), ('WiHTML', '/tools/wihtml/', ''), ('WiHTML Studio', '/tools/wihtml/studio/', ''), ('WiHTML Library', '/tools/wihtml/bibliotheek/', ''), ('WiHTML Example', '/tools/wihtml/voorbeeld/', ''), ('EAIstudio', '/tools/eaistudio/', ''), ('EAIstudio Editor', '/tools/eaistudio/studio/', '')]),
            ('Check models and publications', [('LLMscan', '/en/llmscan/', ''), ('LLMscan research', '/nl/llmscan/onderzoek/', 'Dutch'), ('AI Model Monitor', '/en/model-monitor/', ''), ('Beyond Explainability', '/tools/beyond-explainability/', ''), ('Publication verification', '/nl/tools/verificatie/', 'Dutch')]),
            ('Workspaces and sharing', [('EAImesh', '/tools/eaimesh/', ''), ('EAImesh Start', '/tools/eaimesh/start/', ''), ('EAIwork', '/tools/eaiwork/', ''), ('Upload HTML', '/tools/html-galerij/', '')]),
        ]
    return [
        ('Lesmateriaal en prompts maken', [('EAI Prompt Framework', '/tools/prompt-framework/', ''), ('Van proces naar prompt', '/tools/van-proces-naar-prompt/', ''), ('WiHTML Docentstudio', '/tools/wihtml/', ''), ('WiHTML Studio', '/tools/wihtml/studio/', ''), ('WiHTML Bibliotheek', '/tools/wihtml/bibliotheek/', ''), ('WiHTML Voorbeeld', '/tools/wihtml/voorbeeld/', ''), ('EAIstudio', '/tools/eaistudio/', ''), ('EAIstudio bewerken', '/tools/eaistudio/studio/', '')]),
        ('AI en publicaties controleren', [('LLMscan', '/nl/llmscan/', ''), ('LLMscan onderzoek', '/nl/llmscan/onderzoek/', ''), ('AI Model Monitor', '/nl/model-monitor/', ''), ('Beyond Explainability', '/tools/beyond-explainability/', ''), ('Publicatie verifiëren', '/nl/tools/verificatie/', '')]),
        ('Werkruimtes en delen', [('EAImesh', '/tools/eaimesh/', ''), ('EAImesh starten', '/tools/eaimesh/start/', ''), ('EAIwork', '/tools/eaiwork/', ''), ('HTML uploaden', '/tools/html-galerij/', '')]),
    ]


@lru_cache(maxsize=2)
def reading_sections(en: bool):
    """Use published article directories instead of an incomplete manual shortlist."""
    root = Path(__file__).resolve().parent.parent
    def pages(folder):
        entries = []
        for path in sorted((root / folder).glob('*/index.html')):
            soup = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
            heading = soup.select_one('h1')
            title = heading.get_text(' ', strip=True) if heading else (soup.title.get_text(' ', strip=True) if soup.title else path.parent.name)
            meta = soup.find('meta', attrs={'name': 'description'})
            summary = meta.get('content', '') if meta else ''
            entries.append((title, '/' + folder + '/' + path.parent.name + '/', summary))
        return sorted(entries, key=lambda row: row[0].casefold())
    if en:
        return [
            ('Research', [('Research and sources', '/en/research/', '')] + pages('en/research')),
            ('Publications', [('All publications', '/en/publications/', '')] + pages('publicaties')),
            ('Articles (Dutch)', [('Dutch blog', '/nl/blog/', '')] + pages('nl/blog')),
            ('Archive (Dutch)', [('Previous articles', '/eai-blog/', '')] + pages('eai-blog')),
        ]
    return [
        ('Onderzoeksdossiers', [('Onderzoek en bronnen', '/nl/onderzoek/', ''), ('Bronnenregister', '/bronnen/', '')] + pages('nl/onderzoek')),
        ('Publicaties', [('Alle publicaties', '/nl/publicaties/', '')] + pages('publicaties')),
        ('Blog', [('Blog', '/nl/blog/', '')] + pages('nl/blog')),
        ('Archief', [('Oudere artikelen', '/eai-blog/', '')] + pages('eai-blog')),
    ]

def menu_named_sections(en: bool, sections: list, overview: tuple) -> str:
    def safe(value):
        return html.escape(value, quote=True)
    head = '<a class="eai-site-overview" href="' + safe(overview[1]) + '">' + safe(overview[0]) + '</a>'
    descriptions = {
        '/nl/onderwijs/': 'Kies eerst het leerdoel; bekijk daarna de werkvorm die daarbij past.',
        '/en/education/': 'Start with the learning goal, then find a suitable activity.',
        '/nl/publicaties/': 'Lees analyses, artikelen en de bronnen waarop uitspraken steunen.',
        '/en/publications/': 'Read publications, research and the sources behind claims.',
        '/nl/tools/': 'Maak materiaal, controleer uitkomsten en deel werk.',
        '/en/tools/': 'Create materials, check results and share your work.',
    }
    if overview[1] in descriptions:
        head += '<p class="eai-site-topic-intro">' + safe(descriptions[overview[1]]) + '</p>'
    blocks = []
    for section, links in sections:
        items = ''.join('<a href="' + safe(url) + '">' + safe(label) + '</a>' for label, url, _ in links)
        blocks.append('<details class="eai-site-cluster"><summary>' + safe(section) + '<span>' + str(len(links)) + '</span></summary><div class="eai-site-cluster-links">' + items + '</div></details>')
    return head + '<div class="eai-site-topic-links">' + ''.join(blocks) + '</div>'


@lru_cache(maxsize=2)
def menu_topic_html(en: bool) -> str:
    def safe(value):
        return html.escape(value, quote=True)
    topic_descriptions = {
        'Natuurkunde': 'Beweging, kracht, elektriciteit, licht en meer.',
        'Physics': 'Motion, forces, electricity, light and more. Interactive material is in Dutch.',
        'Wiskunde': 'Kansverdelingen, grafieken, functies en berekeningen.',
        'Mathematics': 'Probability, graphs, functions and calculations. Models are in Dutch.',
        'Menselijk lichaam': 'Bekijk het lichaam in 3D en onderzoek een kloppend hart.',
        'Human anatomy': 'Explore the body in 3D and a beating heart.',
        'Heelal en ruimtevaart': 'Verander banen en onderzoek de Melkweg en planeten.',
        'Space and astronomy': 'Explore the Milky Way, orbits and planets.',
        'Heelal': 'De Melkweg, sterren en satellietbanen.',
        'Space': 'The Milky Way, stars and satellite orbits.',
        'Oceanografie': 'Zeebodem, aardbevingen, plaattektoniek en stromingen.',
        'Oceanography': 'Seafloor, earthquakes, plate tectonics and currents.',
        'Sport en bewegen': 'Aanvallen, verdedigen en opstellingen.',
        'Sport and movement': 'Attack, defence and lineups.',
        'AI': 'Onderzoek taalmodellen en de werking van AI.',
        'Human body': 'Explore the body in 3D and a beating heart.',
        'Hoe werkt AI?': 'Volg tokens, aandacht en tekstgeneratie in een taalmodel.',
        'How AI works': 'Explore tokens, attention and text generation.',
        'Sport en tactiek': 'Verander opstellingen en onderzoek keuzes in het spel.',
        'Sport and tactics': 'Change formations and explore tactical choices.',
    }
    blocks = []
    for title, clusters in experiment_sections(en):
        total = sum(len(links) for _, links in clusters)
        groups_markup = []
        for subgroup, links in clusters:
            items = ''.join('<a href="' + safe(url) + '"' + (' title="' + safe(extra) + '"' if extra else '') + '>' + safe(label) + '</a>' for label, url, extra in links)
            groups_markup.append('<details class="eai-site-cluster"><summary>' + safe(subgroup) + '<span>' + str(len(links)) + '</span></summary><div class="eai-site-cluster-links">' + items + '</div></details>')
        lead = '<p class="eai-site-topic-intro">' + safe(topic_descriptions[title]) + '</p>'
        blocks.append('<details class="eai-site-topic"><summary><span>' + safe(title) + '</span><small>' + str(total) + ' ' + ('topics' if en else 'onderdelen') + '</small></summary><div class="eai-site-topic-links">' + lead + ''.join(groups_markup) + '</div></details>')
    return '<a class="eai-site-overview" href="/tools/science-observatory/">' + ('Explore all subjects' if en else 'Alle vakgebieden') + '</a>' + ''.join(blocks)



def populate_physics_topics(soup: BeautifulSoup, en: bool) -> None:
    """Render links from the tested 53-item model catalog; no second manual list."""
    holder = soup.select_one('[data-eai-physics-list]')
    if holder is None:
        return
    for title, links in experiment_sections(en)[0][1]:
        section = soup.new_tag('section', attrs={'class': 'eai-explore-physics-group'})
        heading = soup.new_tag('h3')
        heading.string = title
        section.append(heading)
        listing = soup.new_tag('ul')
        for label, url, _ in links:
            item = soup.new_tag('li')
            anchor = soup.new_tag('a', href=url)
            anchor.string = label
            item.append(anchor)
            listing.append(item)
        section.append(listing)
        holder.append(section)


def site_search_records(root: Path) -> list:
    """Build a public, local search index from published paths and real module IDs."""
    records = {}
    register = json.loads((Path(__file__).resolve().parent.parent / 'catalog' / 'website-register.json').read_text(encoding='utf-8'))
    titles = {page['url']: page['public_title_nl'] for page in register['pages'] if page.get('public_title_nl')}
    excluded = {page['url'] for page in register['pages'] if page.get('search_scope') in ('via_verwijzing', 'intern', 'niet_indexeren')}
    def add(title, url, category, description=''):
        if url.split('#', 1)[0] in excluded:
            return
        title = titles.get(url, title)
        if url in LEGACY_HUB_REDIRECTS:
            return
        if not title or not url.startswith('/'):
            return
        description = str(description or '').strip()[:240]
        if url in records:
            # Category pages enter first with short labels. A published article
            # or a workform has a more useful description: keep that information.
            current = records[url]
            if len(description) > len(current['description']):
                current['description'] = description
                # The published page can improve the snippet, but its folder
                # name ('NL', 'TOOLS') must not replace the meaningful topic.
                if category not in ('NL', 'EN', 'TOOLS', 'PUBLICATIES', 'BRONNEN'):
                    current['category'] = category
            return
        records[url] = {'title': str(title).strip(), 'url': url, 'category': category, 'description': description}
    # Only explicitly approved public page titles are added from the register.
    # All other internal entries remain in their original application or library.
    taxonomy = json.loads((Path(__file__).resolve().parent.parent / 'catalog' / 'taxonomie.json').read_text(encoding='utf-8'))
    family_names = {family['id']: family['nl'] for family in taxonomy['families']}
    for page in register['pages']:
        if page.get('public_title_nl') and page.get('search_scope') == 'algemeen':
            add(page['public_title_nl'], page['url'], family_names.get(page['family'], 'Hulpmiddelen'))
    for en in (False, True):
        for name, links in groups(en):
            for label, url in links:
                add(label, url, name)
        for title, groups_ in experiment_sections(en):
            for subgroup, entries in groups_:
                for label, url, description in entries:
                    add(label, url, title + ' · ' + subgroup, description)
        for title, groups_ in (('Tools' if en else 'Hulpmiddelen', tool_sections(en)), ('Teaching' if en else 'Lespraktijk', education_sections(en)), ('Research & publications' if en else 'Onderzoek & publicaties', reading_sections(en))):
            for subgroup, entries in groups_:
                for label, url, description in entries:
                    add(label, url, title + ' · ' + subgroup, description)
    allowed = ('nl', 'en', 'tools', 'publicaties', 'bronnen')
    for path in sorted(root.rglob('index.html')):
        relative = path.relative_to(root)
        if not relative.parts or relative.parts[0] not in allowed:
            continue
        if any(part in ('admin', 'private', 'handoff', 'site-build', 'node_modules') for part in relative.parts):
            continue
        url = '/' + '/'.join(relative.parts[:-1]) + '/'
        try:
            soup = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
            heading = soup.select_one('main h1, h1')
            title = heading.get_text(' ', strip=True) if heading else (soup.title.get_text(' ', strip=True) if soup.title else '')
            description = soup.find('meta', attrs={'name':'description'})
            summary = description.get('content', '') if description else ''
            if title and '404' not in title:
                add(title, url, relative.parts[0].upper(), summary)
        except (UnicodeError, OSError):
            continue
    # Offer individual dictionary entries as search destinations, without
    # creating or changing existing public URLs.
    for locale, relative, heading in (
        ('nl', 'nl/begrippen/index.html', 'EAI begrijpen · begrippen'),
        ('en', 'en/glossary/index.html', 'Understand EAI · glossary'),
    ):
        page = root / relative
        if not page.exists():
            continue
        soup = BeautifulSoup(page.read_text(encoding='utf-8'), 'html.parser')
        for entry in soup.select('details.eai-dictionary-term[id]'):
            summary = entry.select_one('summary span')
            description = entry.select_one('.eai-dictionary-definition p')
            if not summary:
                continue
            label = str(summary.contents[0]).strip() if summary.contents else summary.get_text(' ', strip=True)
            add(label, '/' + relative.removesuffix('index.html') + '#' + entry['id'],
                heading, description.get_text(' ', strip=True) if description else '')
    return list(records.values())

def navigation(soup: BeautifulSoup, path: str, en: bool) -> str:
    home = '/en/' if en else '/nl/'
    path_here = canonical(path)
    language_links = []
    for language in ('nl', 'en'):
        alternate = soup.find('link', attrs={'hreflang': language})
        target = urlsplit(alternate.get('href', '')).path if alternate else '/' + language + '/'
        if canonical(path) == '/onderwijsin/':
            target = '/onderwijsin/' if language == 'nl' else '/en/applications/'
        target = target or '/' + language + '/'
        current = ' aria-current="true"' if language == ('en' if en else 'nl') else ''
        language_links.append(f'<a href="{html.escape(target, quote=True)}" lang="{language}" hreflang="{language}"{current} data-preserve-hash>{language.upper()}</a>')
    # Compact menu: the full 57-workform and 53-physics catalogs are reachable
    # through their own pages and site-wide search, not duplicated in the menu.
    menu = []
    for title, entries in groups(en):
        active = any(path_here == canonical(target) or
                     (canonical(target) not in ('/nl/', '/en/') and path_here.startswith(canonical(target)))
                     for _, target in entries)
        links = ''.join(
            f'<a href="{html.escape(target, quote=True)}"' +
            (' aria-current="page"' if path_here == canonical(target) else '') +
            f'>{html.escape(label)}</a>'
            for label, target in entries
        )
        menu.append(f'<details class="eai-site-group{" is-current" if active else ""}" name="eai-navigation-theme">'
                    f'<summary>{html.escape(title)}</summary><div class="eai-site-group-links">{links}</div></details>')
    primary = []
    for title, entries in groups(en):
        # About/Over blijft beschikbaar in Meer en in de voettekst.
        # De vijf directe routes blijven kort; achtergrondinformatie staat in Meer.
        if title in ('About EAI', 'Over EAI'):
            continue
        target = entries[0][1]
        current = ' aria-current="page"' if any(path_here == canonical(item[1]) or (canonical(item[1]) not in ('/nl/', '/en/') and path_here.startswith(canonical(item[1]))) for item in entries) else ''
        primary.append(f'<a href="{html.escape(target, quote=True)}"{current}>{html.escape(title)}</a>')
    nav_label = 'Main navigation' if en else 'Hoofdnavigatie'
    lang_label = 'Choose language' if en else 'Kies taal'
    more_label = 'Menu'
    home_label = 'EAI home' if en else 'EAI startpagina'
    upload_label = "Upload HTML" if en else "HTML uploaden"
    upload_button = ('<a class="eai-site-upload" href="/tools/html-galerij/" aria-label="' + upload_label + '">'
                     '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>'
                     '<span>' + upload_label + '</span></a>')
    search_trigger = ('<button type="button" class="eai-site-search-trigger"'
                      f' aria-label="{("Search" if en else "Zoeken")}"'
                      ' aria-controls="eai-site-menu-panel" aria-expanded="false">'
                      '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none"'
                      ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round">'
                      '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 5 5"/></svg>'
                      '</button>')
    search_label = 'Search this site' if en else 'Zoek op de website'
    result_label = 'Search results' if en else 'Zoekresultaten'
    search_box = (f'<div class="eai-site-search" hidden><label for="eai-site-search-input">{search_label}</label>'
                  f'<input id="eai-site-search-input" type="search" autocomplete="off" enterkeyhint="search"'
                  f' placeholder="{("Search articles, tools and terms" if en else "Zoek artikelen, tools en begrippen")}" aria-controls="eai-site-search-results"></div>'
                  f'<div class="eai-site-search-results" id="eai-site-search-results" aria-label="{result_label}" hidden></div>')
    return f'<header class="eai-masthead" data-eai-static-nav><nav class="eai-site-nav" aria-label="{nav_label}"><a class="eai-site-brand" href="{home}" aria-label="{home_label}"><img src="/assets/eai-logo.svg?v=20261117" width="32" height="32" alt=""><span class="eai-site-brand-name">EAI<span class="eai-site-brand-detail">model</span></span></a><div class="eai-site-primary" aria-label="{nav_label}">{"".join(primary)}</div><div class="eai-site-controls">{upload_button}{search_trigger}<div class="eai-site-language" role="group" aria-label="{lang_label}">{"".join(language_links)}</div><details class="eai-site-menu"><summary aria-controls="eai-site-menu-panel" aria-label="{more_label}"><svg aria-hidden="true" viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 3h18M1 9h18M1 15h18"/></svg><span>{more_label}</span></summary><div class="eai-site-menu-panel" id="eai-site-menu-panel">{search_box}<div class="eai-site-menu-sections">{"".join(menu)}</div></div></details></div></nav></header>'


def footer(en: bool) -> str:
    home = '/en/' if en else '/nl/'
    links = [('Blog', '/en/publications/'), ('Research', '/en/research/'), ('Tools', '/en/tools/'), ('About', '/en/about/')] if en else [('Model', '/nl/model/'), ('Onderwijs', '/nl/onderwijs/'), ('Blog', '/nl/blog/'), ('Onderzoek', '/nl/onderzoek/'), ('Tools', '/nl/tools/'), ('Over', '/nl/over/')]
    rendered = ''.join(f'<a href="{u}">{t}</a>' for t, u in links)
    rendered += '<a href="https://nl.linkedin.com/in/hans-visser-92531a105" target="_blank" rel="noopener noreferrer">LinkedIn</a>'
    return f'<footer class="eai-site-footer"><div class="eai-site-footer-inner"><div><a class="eai-site-brand" href="{home}"><img src="/assets/eai-logo.svg?v=20261117" width="32" height="32" alt=""><span class="eai-site-brand-name">EAI<span class="eai-site-brand-detail">model</span></span></a><p>Hans Visser</p></div><nav aria-label="Footer">{rendered}</nav></div></footer>'

def prepare(root: Path) -> dict:
    materialize_home_model(root)
    assets = root / 'assets'
    manifest = {}
    for name in ASSETS:
        source = assets / name
        if not source.is_file():
            raise FileNotFoundError(f'Missing UI source: {source}')
        data = source.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        target = f'{source.stem}.{digest[:12]}{source.suffix}'
        (assets / target).write_bytes(data)
        manifest[name] = {'url': '/assets/' + target, 'sha256': digest}
    templates = Path(__file__).resolve().parent.parent / 'content' / 'home-model'
    editorial_sources = ''.join(Path(__file__).with_name(name).read_text() for name in ('editorial_ui.py', 'archive_review.py', 'home_model.py'))
    editorial_sources += ''.join(p.read_text() for p in sorted(templates.glob('*.html')))
    revision = hashlib.sha256((json.dumps(manifest, sort_keys=True) + Path(__file__).read_text() + editorial_sources).encode()).hexdigest()[:12]
    # A single index for all public pages and every named model.
    # These URLs are existing routes; search never creates a new destination.
    (assets / 'site-search-index.json').write_text(
        json.dumps(site_search_records(root), ensure_ascii=False, separators=(',', ':')) + '\n',
        encoding='utf-8')
    changed = []
    for page in sorted(root.rglob('*.html')):
        relative = page.relative_to(root)
        if relative.as_posix() != 'onderwijsin/index.html' and any(part in SKIP for part in relative.parts):
            continue
        old_route = '/' + relative.as_posix().removesuffix('index.html')
        destination = LEGACY_HUB_REDIRECTS.get(old_route)
        if destination:
            # Static HTML handoff avoids two drifting catalogues. The query and
            # anchor are retained for existing bookmarks by the small script.
            # The visible link and meta refresh still work without JavaScript.
            title = 'Deze pagina is verhuisd'
            safe_url = html.escape(destination, quote=True)
            new_document = (
                '<!doctype html><html lang="nl"><head><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1">'
                f'<meta http-equiv="refresh" content="0;url={safe_url}">'
                f'<link rel="canonical" href="https://eaimodel.nl{safe_url}">'
                f'<title>{title} | EAI</title></head>'
                f'<body><main><h1>{title}</h1><p>Bekijk de actuele pagina: '
                f'<a href="{safe_url}">{safe_url}</a>.</p></main>'
                '<script>location.replace(' + json.dumps(destination) +
                ' + location.search + location.hash);</script></body></html>\n'
            )
            if page.read_text(encoding='utf-8') != new_document:
                page.write_text(new_document, encoding='utf-8')
                changed.append(relative.as_posix())
            continue
        original = page.read_text(encoding='utf-8')
        soup = BeautifulSoup(original, 'html.parser')
        if canonical('/' + relative.as_posix()) in ('/nl/tools/', '/en/tools/'):
            populate_physics_topics(soup, soup.html.get('lang', '').startswith('en'))
        body = soup.body
        path = '/' + relative.as_posix()
        if not body or not review_archive(soup, canonical(path)):
            continue
        en = soup.html.get('lang', '').startswith('en')
        if not body.get('data-home-model-layout'):
            apply_editorial(soup, canonical(path), en)
        enhance_home_continuity(soup, canonical(path), en)
        before_content = soup.main.decode() if soup.main else None
        header = soup.select_one('header.eai-masthead, header.site-header, header.eai-site-nav')
        if header is None:
            raise ValueError(f'No site header in {relative}')
        header.replace_with(BeautifulSoup(navigation(soup, path, en), 'html.parser').header)
        old_footer = soup.select_one('footer.eai-site-footer, footer.site-footer')
        if old_footer:
            old_footer.replace_with(BeautifulSoup(footer(en), 'html.parser').footer)
        classes = [c for c in body.get('class', []) if c not in ('eai-ui', 'eai-index-page', 'eai-dash-page', 'eai-card-index')]
        classes.append('eai-ui')
        if canonical(path) in INDEX_PATHS:
            classes.append('eai-index-page')
        dashboard_home = canonical(path) in ('/nl/', '/en/') and bool(soup.select_one('main.eai-dashboard-home'))
        if dashboard_home:
            classes.append('eai-dash-page')
            body['data-eai-dashboard-layout'] = 'cards-v1'
        if canonical(path) in DASH_CARD_PATHS:
            classes.append('eai-card-index')
        story_enabled = canonical(path) in STORY_PATHS
        if story_enabled:
            classes.append('eai-story-page')
            body['data-eai-story-layout'] = 'homepage-continuity-v1'
        body['class'] = classes
        body['data-ui-version'] = revision
        css_pattern = re.compile(r'^/assets/(?:site|site-ui|site-responsive|site-redesign|site-editorial|site-archive|home-model|site-story-cards|site-dashboard-cards)(?:\.[a-f0-9]{12})?\.css(?:\?.*)?$')
        for tag in list(soup.find_all('link', href=True)):
            if css_pattern.match(tag['href']):
                tag.decompose()
        for name in ('site.css', 'site-ui.css', 'site-responsive.css', 'site-editorial.css', 'site-archive.css', 'home-model.css', 'site-redesign.css'):
            soup.head.append(soup.new_tag('link', rel='stylesheet', href=manifest[name]['url']))
        if dashboard_home or canonical(path) in DASH_CARD_PATHS:
            soup.head.append(soup.new_tag('link', rel='stylesheet', href=manifest['site-dashboard-cards.css']['url']))
        # Keep the homepage-like editorial layer last, including over older
        # index/dashboard styles. The interactive labs never load this CSS.
        if story_enabled:
            soup.head.append(soup.new_tag('link', rel='stylesheet', href=manifest['site-story-cards.css']['url']))
        js_pattern = re.compile(r'^/assets/(?:site-refresh|site-navigation|home-model|site-story-cards|site-dashboard-cards)(?:\.[a-f0-9]{12})?\.js(?:\?.*)?$')
        for tag in list(soup.find_all('script', src=True)):
            if js_pattern.match(tag['src']):
                tag.decompose()
        for name in ('site-refresh.js', 'site-navigation.js', 'home-model.js'):
            tag = soup.new_tag('script', src=manifest[name]['url'])
            tag['defer'] = ''
            soup.head.append(tag)
        if story_enabled:
            tag = soup.new_tag('script', src=manifest['site-story-cards.js']['url'])
            tag['defer'] = ''
            soup.head.append(tag)
        if dashboard_home:
            tag = soup.new_tag('script', src=manifest['site-dashboard-cards.js']['url'])
            tag['defer'] = ''
            soup.head.append(tag)
        # Keep header rules after all editorial and dashboard CSS.
        soup.head.append(soup.new_tag('link', rel='stylesheet', href=manifest['site-header.css']['url']))
        if soup.main and soup.main.decode() != before_content:
            raise AssertionError(f'Unexpected main-content edit: {relative}')
        if canonical(path) in ('/nl/tools/', '/en/tools/'):
            for section in soup.select('main > section.section'):
                if section.select_one('.section-head a') and not section.select_one('.tool-grid'):
                    section['class'] = list(dict.fromkeys(section.get('class', []) + ['eai-tool-entry']))
        output = re.sub(r'^<!DOCTYPE html>\s*', '<!DOCTYPE html>\n', str(soup))
        page.write_text(output, encoding='utf-8')
        changed.append(relative.as_posix())
    result = {'version': revision, 'assets': manifest, 'pages': changed}
    (assets / 'ui-manifest.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('site-build'))
    args = parser.parse_args()
    result = prepare(args.root.resolve())
    print(f'Prepared {len(result["pages"])} pages; UI {result["version"]}')
