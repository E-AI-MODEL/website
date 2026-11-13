"""Prepare content-addressed assets, native navigation and dated archive corrections.
Run after build_site.py. Standalone handoff source files are not rewritten.
"""
from __future__ import annotations
import argparse
import hashlib
import html
import json
import re
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

def groups(en: bool):
    """Korte hoofdroutes; observatoria en ontwerptools hebben elk hun eigen plek."""
    if en:
        return [
            ('Model', [('The EAI model', '/en/model/'), ('Applications', '/en/applications/')]),
            ('Education', [('Lessons and workforms', '/en/education/')]),
            ('Blog', [('Publications', '/en/publications/')]),
            ('Research', [('Evidence and sources', '/en/research/')]),
            ('Observatories', [
                ('Interactief onderzoeken', '/tools/science-observatory/'),
                ('Physics experiments (Dutch)', '/tools/science-observatory/labs/natuurkunde/'),
                ('Human anatomy', '/tools/anatomie/'),
                ('LLM Observatory', '/tools/llm-observatorium/'),
                
                ('Galactic Observatory: guided version', '/tools/melkweg-lab/'),
                ('Sport and movement', '/tools/sport-en-bewegen/'),
            ]),
            ('Tools', [
                ('All tools', '/en/tools/'),
                ('Prompt Framework', '/tools/prompt-framework/'),
                ('WiHTML Studio', '/tools/wihtml/'),
                ('EAIstudio', '/tools/eaistudio/'),
                ('EAImesh', '/tools/eaimesh/'),
                ('Process to prompt', '/tools/van-proces-naar-prompt/'),
                ('Model Monitor', '/en/model-monitor/'),
                ('LLMscan', '/en/llmscan/'),
            ]),
            ('About', [('About EAI', '/en/about/'), ('Site insights', '/en/insights/')]),
        ]
    return [
        ('Model', [('Het EAI-model', '/nl/model/'), ('Toepassingen', '/nl/toepassingen/')]),
        ('Onderwijs', [('Lessen en werkvormen', '/nl/onderwijs/'), ('Lesvoorbeelden', '/nl/toepassingen/')]),
        ('Publicaties', [('Artikelen', '/nl/blog/'), ('Alle publicaties', '/nl/publicaties/')]),
        ('Onderzoek', [('Onderzoek en bronnen', '/nl/onderzoek/'), ('Bronnenregister', '/bronnen/')]),
        ('Onderzoeken', [
            ('Interactief onderzoeken', '/tools/science-observatory/'),
            ('Natuurkundeproeven', '/tools/science-observatory/labs/natuurkunde/'),
            ('Anatomie van de mens', '/tools/anatomie/'),
            ('LLM Observatorium', '/tools/llm-observatorium/'),
            
            ('Galactisch Observatorium met uitleg', '/tools/melkweg-lab/'),
            ('Sport en bewegen', '/tools/sport-en-bewegen/'),
        ]),
        ('Hulpmiddelen', [
            ('Alle hulpmiddelen', '/nl/tools/'),
            ('EAI Prompt Framework', '/tools/prompt-framework/'),
            ('WiHTML Docentstudio', '/tools/wihtml/'),
            ('EAIstudio', '/tools/eaistudio/'),
            ('EAImesh', '/tools/eaimesh/'),
            ('Van proces naar prompt', '/tools/van-proces-naar-prompt/'),
            ('AI Model Monitor', '/nl/model-monitor/'),
            ('LLMscan', '/nl/llmscan/'),
        ]),
        ('Over', [('Over EAI', '/nl/over/'), ('Websitegebruik', '/nl/insights/')]),
    ]


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
        links = ''.join(f'<a href="{html.escape(target, quote=True)}"' + (' aria-current="page"' if path_here == canonical(target) else '') + f'>{html.escape(label)}</a>' for label, target in entries)
        menu.append(f'<details class="eai-site-group{active_cls}" name="eai-navigation-theme"><summary>{html.escape(title)}</summary><div class="eai-site-group-links">{links}</div></details>')
    primary = []
    for title, entries in groups(en):
        # About/Over blijft beschikbaar in Meer en in de voettekst.
        # Zo houdt de brede navigatie zes korte, inhoudelijke bestemmingen.
        if title in ('About', 'Over'):
            continue
        target = entries[0][1]
        if title in ('Onderzoeken', 'Observatories'):
            target = '/en/tools/#observatoria' if en else '/nl/tools/#observatoria'
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
    return f'<header class="eai-masthead" data-eai-static-nav><nav class="eai-site-nav" aria-label="{nav_label}"><a class="eai-site-brand" href="{home}" aria-label="EAI home"><img src="/assets/eai-logo.svg" width="32" height="32" alt=""><span>EAI</span></a><div class="eai-site-primary" aria-label="{nav_label}">{"".join(primary)}</div><div class="eai-site-controls">{upload_button}<div class="eai-site-language" role="group" aria-label="{lang_label}">{"".join(language_links)}</div><details class="eai-site-menu"><summary aria-controls="eai-site-menu-panel" aria-label="{more_label}"><svg aria-hidden="true" viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 3h18M1 9h18M1 15h18"/></svg><span>{more_label}</span></summary><div class="eai-site-menu-panel" id="eai-site-menu-panel"><span class="eai-menu-heading">{menu_heading}</span>{"".join(menu)}</div></details></div></nav></header>'


def footer(en: bool) -> str:
    home = '/en/' if en else '/nl/'
    links = [('Blog', '/en/publications/'), ('Research', '/en/research/'), ('Tools', '/en/tools/'), ('About', '/en/about/')] if en else [('Model', '/nl/model/'), ('Onderwijs', '/nl/onderwijs/'), ('Publicaties', '/nl/blog/'), ('Onderzoek', '/nl/onderzoek/'), ('Hulpmiddelen', '/nl/tools/'), ('Over', '/nl/over/')]
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
