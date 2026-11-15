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

ASSETS = ('site.css', 'site-refresh.js', 'site-ui.css', 'site-responsive.css', 'site-redesign.css', 'site-editorial.css', 'site-archive.css', 'site-navigation.js', 'home-model.css', 'home-model.js')
SKIP = {'.git', '.github', 'content', 'scripts', 'tests', 'assets', 'handoff', 'houseoftalents', 'onderwijsin', 'leif', 'site-build'}
ALIASES = {'/': '/nl/', '/tools/': '/nl/tools/', '/publicaties/': '/nl/publicaties/', '/over/': '/nl/over/', '/onderwijs/': '/nl/onderwijs/', '/toepassingen/': '/nl/toepassingen/', '/kennis/': '/nl/onderzoek/', '/model-monitor/': '/nl/model-monitor/', '/llmscan/': '/nl/llmscan/'}
INDEX_PATHS = {'/nl/', '/en/', '/nl/model/', '/en/model/', '/nl/tools/', '/en/tools/', '/nl/onderwijs/', '/en/education/', '/nl/onderzoek/', '/en/research/', '/nl/toepassingen/', '/en/applications/', '/nl/over/', '/en/about/'}

def canonical(path: str) -> str:
    path = urlsplit(path).path.removesuffix('index.html')
    path = '/' + path.strip('/') + '/' if path.strip('/') else '/'
    return ALIASES.get(path, path)

@lru_cache(maxsize=2)
def groups(en: bool):
    """Publieke hoofdroutes, gescheiden van alle onderliggende proeven."""
    if en:
        return [
            ('EAI model', [('The EAI model', '/en/model/'), ('Applications', '/en/applications/')]),
            ('Education', [('Lessons and workforms', '/en/education/'), ('Applications', '/en/applications/')]),
            ('Articles & research', [('Articles', '/en/publications/'), ('Research and sources', '/en/research/')]),
            ('Experiments & models', [('All experiments', '/tools/science-observatory/'), ('Physics', '/tools/science-observatory/labs/natuurkunde/'), ('Mathematics A', '/tools/science-observatory/labs/wiskunde-a/'), ('Mathematics B', '/tools/science-observatory/labs/wiskunde-b/'), ('Human anatomy', '/tools/anatomie/'), ('Galactic Observatory', '/tools/science-observatory/labs/melkweg/'), ('LLM Observatory', '/tools/llm-observatorium/'), ('Sport and movement', '/tools/lo-aanvalslab/')]),
            ('Tools', [('All tools', '/en/tools/'), ('Prompt Framework', '/tools/prompt-framework/'), ('WiHTML Studio', '/tools/wihtml/'), ('EAIstudio', '/tools/eaistudio/'), ('EAImesh', '/tools/eaimesh/'), ('Upload HTML', '/tools/html-galerij/'), ('Process to prompt', '/tools/van-proces-naar-prompt/'), ('Model Monitor', '/en/model-monitor/'), ('LLMscan', '/en/llmscan/')]),
            ('About EAI', [('About EAI', '/en/about/'), ('Site insights', '/en/insights/')]),
        ]
    return [
        ('Het EAI-model', [('Het EAI-model', '/nl/model/'), ('Toepassingen', '/nl/toepassingen/')]),
        ('Onderwijs', [('Lessen en werkvormen', '/nl/onderwijs/'), ('Lesvoorbeelden', '/nl/toepassingen/')]),
        ('Artikelen & onderzoek', [('Blog', '/nl/blog/'), ('Publicaties', '/nl/publicaties/'), ('Onderzoek en bronnen', '/nl/onderzoek/'), ('Bronnenregister', '/bronnen/')]),
        ('Proeven & modellen', [('Alle proeven en modellen', '/tools/science-observatory/'), ('Natuurkunde', '/tools/science-observatory/labs/natuurkunde/'), ('Wiskunde A', '/tools/science-observatory/labs/wiskunde-a/'), ('Wiskunde B', '/tools/science-observatory/labs/wiskunde-b/'), ('Anatomie van de mens', '/tools/anatomie/'), ('Galactisch Observatorium', '/tools/science-observatory/labs/melkweg/'), ('Hoe werkt AI?', '/tools/llm-observatorium/'), ('Sport en bewegen', '/tools/lo-aanvalslab/')]),
        ('Tools', [('Alle tools', '/nl/tools/'), ('EAI Prompt Framework', '/tools/prompt-framework/'), ('WiHTML Docentstudio', '/tools/wihtml/'), ('EAIstudio', '/tools/eaistudio/'), ('EAImesh', '/tools/eaimesh/'), ('HTML uploaden', '/tools/html-galerij/'), ('Van proces naar prompt', '/tools/van-proces-naar-prompt/'), ('AI Model Monitor', '/nl/model-monitor/'), ('LLMscan', '/nl/llmscan/')]),
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
    for id_, model in zip(ids, catalogue):
        name = model['group'].replace('Electrodynamica', 'Elektrodynamica')
        physics_groups.setdefault(name, []).append((model['title'].strip('"'), '/tools/science-observatory/labs/natuurkunde/#' + id_, model['title']))
    maths = []
    for variant in ('a', 'b'):
        source = (sources / ('wiskunde-' + variant + '.html')).read_text(encoding='utf-8')
        config_match = re.search(r'<script\b[^>]*\bid="config"[^>]*>(.*?)</script>', source, re.DOTALL)
        if not config_match:
            raise ValueError('Wiskunde ' + variant.upper() + ' heeft geen modelcatalogus')
        modules = json.loads(config_match.group(1))['modules']
        maths.append(('Wiskunde ' + variant.upper(), [(m['short'], '/tools/science-observatory/labs/wiskunde-' + variant + '/#' + m['id'], m.get('subtitle', '')) for m in modules]))
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
        ('Human anatomy' if en else 'Anatomie van de mens', [('Anatomy and heart' if en else 'Lichaam en hart', [('The body in 3D' if en else 'Het lichaam in 3D', '/tools/anatomie/', ''), ('Heart and circulation' if en else 'Hart en bloedsomloop', '/tools/anatomie/labs/hartslag/', 'Hartslaglab hartslag hartkleppen bloedstroom hartcyclus')])]),
        ('Galactic Observatory' if en else 'Galactisch Observatorium', [('Original Observatory' if en else 'Oorspronkelijk observatorium', modes), ('Guided discovery' if en else 'Ontdekken met uitleg', [('Galactic Observatory: guided' if en else 'Melkweg met uitleg', '/tools/melkweg-lab/', '')] + guided_modes), ('Orbits' if en else 'Banen', [('Gravity and satellites' if en else 'Gravitatie en satellietbanen', '/tools/science-observatory/labs/gravitatie-banen/', '')])]),
        ('Language models' if en else 'Taalmodellen', [('AI' if en else 'AI onderzoeken', [('LLM Observatory' if en else 'Hoe werkt een taalmodel?', '/tools/llm-observatorium/', '')] + llm_modes)]),
        ('Sport and movement' if en else 'Sport en bewegen', [('Sports' if en else 'Sport en bewegen', [('Attack and defence' if en else 'Aanvallen en verdedigen', '/tools/lo-aanvalslab/', ''), ('Research and sources' if en else 'Onderbouwing van sportproeven', '/tools/lo-aanvalslab/onderbouwing/', '')])]),
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
        ('Hulp geven en feedback', 'Support and feedback (Dutch)', ('scaffolding', 'herstellen')),
        ('Eigen keuzes en zelfstandigheid', 'Self-regulation and independent work (Dutch)', ('zelfregulatie', 'zelfstandigheid')),
        ('Denken en leren zichtbaar maken', 'Evidence of thinking and learning (Dutch)', ('zichtbaar', 'bewijs')),
        ('Bronnen en argumenten beoordelen', 'Sources and arguments (Dutch)', ('argumentatie',)),
        ('Leerlingen begrijpen en beoordelen', 'Teaching decisions and evidence (Dutch)', ('professioneel-oordeel',)),
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
            ('Design and teaching', [('Prompt Framework', '/tools/prompt-framework/', ''), ('Process to prompt', '/tools/van-proces-naar-prompt/', ''), ('WiHTML', '/tools/wihtml/', ''), ('WiHTML Studio', '/tools/wihtml/studio/', ''), ('WiHTML Library', '/tools/wihtml/bibliotheek/', ''), ('WiHTML Example', '/tools/wihtml/voorbeeld/', ''), ('EAIstudio', '/tools/eaistudio/', ''), ('EAIstudio Editor', '/tools/eaistudio/studio/', '')]),
            ('Research and evaluation', [('LLMscan', '/en/llmscan/', ''), ('LLMscan research', '/nl/llmscan/onderzoek/', 'Dutch'), ('AI Model Monitor', '/en/model-monitor/', ''), ('Beyond Explainability', '/tools/beyond-explainability/', ''), ('Publication verification', '/nl/tools/verificatie/', 'Dutch')]),
            ('Explore and share', [('EAImesh', '/tools/eaimesh/', ''), ('EAImesh Start', '/tools/eaimesh/start/', ''), ('EAIwork', '/tools/eaiwork/', ''), ('Upload HTML', '/tools/html-galerij/', '')]),
        ]
    return [
        ('Ontwerpen en lesmateriaal', [('EAI Prompt Framework', '/tools/prompt-framework/', ''), ('Van proces naar prompt', '/tools/van-proces-naar-prompt/', ''), ('WiHTML Docentstudio', '/tools/wihtml/', ''), ('WiHTML Studio', '/tools/wihtml/studio/', ''), ('WiHTML Bibliotheek', '/tools/wihtml/bibliotheek/', ''), ('WiHTML Voorbeeld', '/tools/wihtml/voorbeeld/', ''), ('EAIstudio', '/tools/eaistudio/', ''), ('EAIstudio bewerken', '/tools/eaistudio/studio/', '')]),
        ('Onderzoek en controle', [('LLMscan', '/nl/llmscan/', ''), ('LLMscan onderzoek', '/nl/llmscan/onderzoek/', ''), ('AI Model Monitor', '/nl/model-monitor/', ''), ('Beyond Explainability', '/tools/beyond-explainability/', ''), ('Publicatie verifiëren', '/nl/tools/verificatie/', '')]),
        ('Bekijken en delen', [('EAImesh', '/tools/eaimesh/', ''), ('EAImesh starten', '/tools/eaimesh/start/', ''), ('EAIwork', '/tools/eaiwork/', ''), ('HTML uploaden', '/tools/html-galerij/', '')]),
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
        ('Onderzoek', [('Onderzoek en bronnen', '/nl/onderzoek/', ''), ('Bronnenregister', '/bronnen/', '')] + pages('nl/onderzoek')),
        ('Publicaties', [('Alle publicaties', '/nl/publicaties/', '')] + pages('publicaties')),
        ('Artikelen', [('Blog', '/nl/blog/', '')] + pages('nl/blog')),
        ('Archief', [('Oudere artikelen', '/eai-blog/', '')] + pages('eai-blog')),
    ]

def menu_named_sections(en: bool, sections: list, overview: tuple) -> str:
    def safe(value):
        return html.escape(value, quote=True)
    head = '<a class="eai-site-overview" href="' + safe(overview[1]) + '">' + safe(overview[0]) + '</a>'
    blocks = []
    for section, links in sections:
        items = ''.join('<a href="' + safe(url) + '">' + safe(label) + '</a>' for label, url, _ in links)
        blocks.append('<details class="eai-site-cluster"><summary>' + safe(section) + '<span>' + str(len(links)) + '</span></summary><div class="eai-site-cluster-links">' + items + '</div></details>')
    return head + '<div class="eai-site-topic-links">' + ''.join(blocks) + '</div>'


@lru_cache(maxsize=2)
def menu_topic_html(en: bool) -> str:
    def safe(value):
        return html.escape(value, quote=True)
    blocks = []
    for title, clusters in experiment_sections(en):
        total = sum(len(links) for _, links in clusters)
        groups_markup = []
        for subgroup, links in clusters:
            items = ''.join('<a href="' + safe(url) + '" title="' + safe(extra) + '">' + safe(label) + '</a>' for label, url, extra in links)
            groups_markup.append('<details class="eai-site-cluster"><summary>' + safe(subgroup) + '<span>' + str(len(links)) + '</span></summary><div class="eai-site-cluster-links">' + items + '</div></details>')
        blocks.append('<details class="eai-site-topic"><summary><span>' + safe(title) + '</span><small>' + str(total) + ' ' + ('topics' if en else 'onderdelen') + '</small></summary><div class="eai-site-topic-links">' + ''.join(groups_markup) + '</div></details>')
    return '<a class="eai-site-overview" href="/tools/science-observatory/">' + ('All experiments and models' if en else 'Alle proeven en modellen') + '</a>' + ''.join(blocks)


def site_search_records(root: Path) -> list:
    """Build a public, local search index from published paths and real module IDs."""
    records = {}
    def add(title, url, category, description=''):
        if not title or not url.startswith('/'):
            return
        description = str(description or '').strip()[:240]
        if url in records:
            # Category pages enter first with short labels. A published article
            # or a workform has a more useful description: keep that information.
            current = records[url]
            if len(description) > len(current['description']):
                current['description'] = description
                current['category'] = category
            return
        records[url] = {'title': str(title).strip(), 'url': url, 'category': category, 'description': description}
    for en in (False, True):
        for name, links in groups(en):
            for label, url in links:
                add(label, url, name)
        for title, groups_ in experiment_sections(en):
            for subgroup, entries in groups_:
                for label, url, description in entries:
                    add(label, url, title + ' · ' + subgroup, description)
        for title, groups_ in (('Tools', tool_sections(en)), ('Education' if en else 'Onderwijs', education_sections(en)), ('Articles & research' if en else 'Artikelen en onderzoek', reading_sections(en))):
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
        if url in records:
            continue
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
    menu = []
    for title, entries in groups(en):
        active = any((path_here == canonical(target) or path_here.startswith(canonical(target))) and canonical(target) not in ('/nl/', '/en/') for _, target in entries)
        active_cls = ' is-current' if active else ''
        model_group = title in ('Proeven & modellen', 'Experiments & models')
        if model_group:
            links = menu_topic_html(en)
        elif title == 'Tools':
            links = menu_named_sections(en, tool_sections(en), ('All tools' if en else 'Alle tools', '/en/tools/' if en else '/nl/tools/'))
        elif title in ('Education', 'Onderwijs'):
            links = menu_named_sections(en, education_sections(en), ('All education resources' if en else 'Alle onderwijsactiviteiten', '/en/education/' if en else '/nl/onderwijs/'))
        elif title in ('Artikelen & onderzoek', 'Articles & research'):
            links = menu_named_sections(en, reading_sections(en), ('All articles and research' if en else 'Alle artikelen en onderzoek', '/en/publications/' if en else '/nl/publicaties/'))
        else:
            links = ''.join(f'<a href="{html.escape(target, quote=True)}"' + (' aria-current="page"' if path_here == canonical(target) else '') + f'>{html.escape(label)}</a>' for label, target in entries)
        menu.append(f'<details class="eai-site-group{active_cls}" name="eai-navigation-theme"><summary>{html.escape(title)}</summary><div class="eai-site-group-links{" eai-site-model-links" if model_group else ""}">{links}</div></details>')
    primary = []
    for title, entries in groups(en):
        # About/Over blijft beschikbaar in Meer en in de voettekst.
        # Zo houdt de brede navigatie zes korte, inhoudelijke bestemmingen.
        if title in ('About EAI', 'Over EAI'):
            continue
        target = entries[0][1]
        current = ' aria-current="page"' if any(path_here == canonical(item[1]) or (canonical(item[1]) not in ('/nl/', '/en/') and path_here.startswith(canonical(item[1]))) for item in entries) else ''
        primary.append(f'<a href="{html.escape(target, quote=True)}"{current}>{html.escape(title)}</a>')
    nav_label = 'Main navigation' if en else 'Hoofdnavigatie'
    lang_label = 'Choose language' if en else 'Kies taal'
    menu_heading = 'Navigate' if en else 'Ga naar'
    more_label = 'More' if en else 'Meer'
    upload_label = "Upload HTML" if en else "HTML uploaden"
    upload_button = ('<a class="eai-site-upload" href="/tools/html-galerij/" aria-label="' + upload_label + '">'
                     '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>'
                     '<span>' + upload_label + '</span></a>')
    search_label = 'Search the site' if en else 'Zoek een proef, model of artikel'
    result_label = 'Search results' if en else 'Zoekresultaten'
    search_box = (f'<div class="eai-site-search"><label for="eai-site-search-input">{search_label}</label>'
                  f'<input id="eai-site-search-input" type="search" autocomplete="off" enterkeyhint="search"'
                  f' placeholder="{search_label}" aria-controls="eai-site-search-results"></div>'
                  f'<div class="eai-site-search-results" id="eai-site-search-results" aria-label="{result_label}" hidden></div>')
    return f'<header class="eai-masthead" data-eai-static-nav><nav class="eai-site-nav" aria-label="{nav_label}"><a class="eai-site-brand" href="{home}" aria-label="EAI home"><img src="/assets/eai-logo.svg" width="32" height="32" alt=""><span>EAI</span></a><div class="eai-site-primary" aria-label="{nav_label}">{"".join(primary)}</div><div class="eai-site-controls">{upload_button}<div class="eai-site-language" role="group" aria-label="{lang_label}">{"".join(language_links)}</div><details class="eai-site-menu"><summary aria-controls="eai-site-menu-panel" aria-label="{more_label}"><svg aria-hidden="true" viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 3h18M1 9h18M1 15h18"/></svg><span>{more_label}</span></summary><div class="eai-site-menu-panel" id="eai-site-menu-panel">{search_box}<div class="eai-site-menu-sections"><span class="eai-menu-heading">{menu_heading}</span>{"".join(menu)}</div></div></details></div></nav></header>'


def footer(en: bool) -> str:
    home = '/en/' if en else '/nl/'
    links = [('Blog', '/en/publications/'), ('Research', '/en/research/'), ('Tools', '/en/tools/'), ('About', '/en/about/')] if en else [('Model', '/nl/model/'), ('Onderwijs', '/nl/onderwijs/'), ('Blog', '/nl/blog/'), ('Onderzoek', '/nl/onderzoek/'), ('Tools', '/nl/tools/'), ('Over', '/nl/over/')]
    rendered = ''.join(f'<a href="{u}">{t}</a>' for t, u in links)
    rendered += '<a href="https://nl.linkedin.com/in/hans-visser-92531a105" target="_blank" rel="noopener noreferrer">LinkedIn</a>'
    return f'<footer class="eai-site-footer"><div class="eai-site-footer-inner"><div><a class="eai-site-brand" href="{home}"><img src="/assets/eai-logo.svg" width="32" height="32" alt=""><span>EAI</span></a><p>Hans Visser</p></div><nav aria-label="Footer">{rendered}</nav></div></footer>'

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
        original = page.read_text(encoding='utf-8')
        soup = BeautifulSoup(original, 'html.parser')
        body = soup.body
        path = '/' + relative.as_posix()
        if not body or not review_archive(soup, canonical(path)):
            continue
        en = soup.html.get('lang', '').startswith('en')
        if not body.get('data-home-model-layout'):
            apply_editorial(soup, canonical(path), en)
        before_content = soup.main.decode() if soup.main else None
        header = soup.select_one('header.eai-masthead, header.site-header, header.eai-site-nav')
        if header is None:
            raise ValueError(f'No site header in {relative}')
        header.replace_with(BeautifulSoup(navigation(soup, path, en), 'html.parser').header)
        old_footer = soup.select_one('footer.eai-site-footer, footer.site-footer')
        if old_footer:
            old_footer.replace_with(BeautifulSoup(footer(en), 'html.parser').footer)
        classes = [c for c in body.get('class', []) if c not in ('eai-ui', 'eai-index-page')]
        classes.append('eai-ui')
        if canonical(path) in INDEX_PATHS:
            classes.append('eai-index-page')
        body['class'] = classes
        body['data-ui-version'] = revision
        css_pattern = re.compile(r'^/assets/(?:site|site-ui|site-responsive|site-redesign|site-editorial|site-archive|home-model)(?:\.[a-f0-9]{12})?\.css(?:\?.*)?$')
        for tag in list(soup.find_all('link', href=True)):
            if css_pattern.match(tag['href']):
                tag.decompose()
        for name in ('site.css', 'site-ui.css', 'site-responsive.css', 'site-editorial.css', 'site-archive.css', 'home-model.css', 'site-redesign.css'):
            soup.head.append(soup.new_tag('link', rel='stylesheet', href=manifest[name]['url']))
        js_pattern = re.compile(r'^/assets/(?:site-refresh|site-navigation|home-model)(?:\.[a-f0-9]{12})?\.js(?:\?.*)?$')
        for tag in list(soup.find_all('script', src=True)):
            if js_pattern.match(tag['src']):
                tag.decompose()
        for name in ('site-refresh.js', 'site-navigation.js', 'home-model.js'):
            tag = soup.new_tag('script', src=manifest[name]['url'])
            tag['defer'] = ''
            soup.head.append(tag)
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
