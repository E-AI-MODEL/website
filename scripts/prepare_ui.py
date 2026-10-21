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
from home_model import install as install_home_model

ASSETS = ('site.css', 'site-refresh.js', 'site-ui.css', 'site-responsive.css', 'site-editorial.css', 'site-archive.css', 'site-home-model.css', 'site-navigation.js')
SKIP = {'.git', '.github', 'content', 'scripts', 'tests', 'assets', 'handoff', 'houseoftalents', 'onderwijsin', 'site-build'}
ALIASES = {'/': '/nl/', '/tools/': '/nl/tools/', '/publicaties/': '/nl/publicaties/', '/over/': '/nl/over/', '/onderwijs/': '/nl/onderwijs/', '/toepassingen/': '/nl/toepassingen/', '/kennis/': '/nl/onderzoek/', '/model-monitor/': '/nl/model-monitor/', '/llmscan/': '/nl/llmscan/'}
INDEX_PATHS = {'/nl/', '/en/', '/nl/model/', '/en/model/', '/nl/tools/', '/en/tools/', '/nl/onderwijs/', '/en/education/', '/nl/onderzoek/', '/en/research/', '/nl/toepassingen/', '/en/applications/', '/nl/over/', '/en/about/'}

def canonical(path: str) -> str:
    path = urlsplit(path).path.removesuffix('index.html')
    path = '/' + path.strip('/') + '/' if path.strip('/') else '/'
    return ALIASES.get(path, path)

def groups(en: bool):
    if en:
        return [('The model', [('The four-step approach', '/en/model/'), ('Background and evidence', '/en/research/')]), ('Education & practice', [('Lesson design and teaching', '/en/education/'), ('Examples in practice', '/en/applications/'), ('Onderwijs in: technical review (NL)', '/onderwijsin/')]), ('Research', [('Studies and sources', '/en/research/'), ('Articles and publications', '/en/publications/')]), ('Tools', [('Choose a tool', '/en/tools/'), ('AI Model Monitor', '/en/model-monitor/'), ('LLMscan: product reviews', '/en/llmscan/')]), ('About EAI', [('Hans Visser and EAI', '/en/about/')])]
    return [('Het model', [('Werkwijze: vier stappen', '/nl/model/'), ('Waarom deze volgorde?', '/twee-pijlers/')]), ('Onderwijs & praktijk', [('Lesontwerp en werkvormen', '/nl/onderwijs/'), ('Voorbeelden uit de praktijk', '/nl/toepassingen/'), ('Onderwijs in: technische verkenning', '/onderwijsin/')]), ('Onderzoek', [('Onderzoeken en onderbouwing', '/nl/onderzoek/'), ('Artikelen en publicaties', '/nl/publicaties/')]), ('Tools', [('Kies een hulpmiddel', '/nl/tools/'), ('AI Model Monitor', '/nl/model-monitor/'), ('LLMscan: AI-producten', '/nl/llmscan/')]), ('Over EAI', [('Hans Visser en het EAI-model', '/nl/over/')])]

def navigation(soup: BeautifulSoup, path: str, en: bool) -> str:
    home = '/en/' if en else '/nl/'
    language_links = []
    for language in ('nl', 'en'):
        alternate = soup.find('link', attrs={'hreflang': language})
        target = urlsplit(alternate.get('href', '')).path if alternate else '/' + language + '/'
        if canonical(path) == '/onderwijsin/':
            target = '/onderwijsin/' if language == 'nl' else '/en/applications/'
        target = target or '/' + language + '/'
        current = ' aria-current="true"' if language == ('en' if en else 'nl') else ''
        language_links.append(f'<a href="{html.escape(target, quote=True)}" lang="{language}" hreflang="{language}"{current} data-preserve-hash>{language.upper()}</a>')
    rendered = []
    for title, entries in groups(en):
        current_group = False
        links = []
        for label, target in entries:
            exact = canonical(path) == canonical(target)
            parent = canonical(target) not in ('/nl/', '/en/') and canonical(path).startswith(canonical(target))
            current_group |= exact or parent
            current = ' aria-current="page"' if exact and '#' not in target else ''
            links.append(f'<a href="{html.escape(target, quote=True)}"{current}>{html.escape(label)}</a>')
        classes = 'eai-site-group' + (' is-current' if current_group else '')
        rendered.append(f'<details class="{classes}" name="eai-navigation-theme"><summary>{html.escape(title)}</summary><div class="eai-site-group-links">{"".join(links)}</div></details>')
    nav_label = 'Main navigation' if en else 'Hoofdnavigatie'
    lang_label = 'Choose language' if en else 'Kies taal'
    menu_heading = 'Navigate to' if en else 'Ga naar'
    return f'<header class="eai-masthead" data-eai-static-nav><nav class="eai-site-nav" aria-label="{nav_label}"><a class="eai-site-brand" href="{home}" aria-label="EAI home"><img src="/assets/eai-logo.svg" width="32" height="32" alt=""><span>EAI</span></a><div class="eai-site-controls"><div class="eai-site-language" role="group" aria-label="{lang_label}">{"".join(language_links)}</div><details class="eai-site-menu"><summary aria-controls="eai-site-menu-panel"><svg aria-hidden="true" viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 3h18M1 9h18M1 15h18"/></svg><span>Menu</span></summary><div class="eai-site-menu-panel" id="eai-site-menu-panel"><span class="eai-menu-heading">{menu_heading}</span>{"".join(rendered)}</div></details></div></nav></header>'

def footer(en: bool) -> str:
    home = '/en/' if en else '/nl/'
    links = [('Research', '/en/research/'), ('Tools', '/en/tools/'), ('About', '/en/about/')] if en else [('Onderzoek', '/nl/onderzoek/'), ('Tools', '/nl/tools/'), ('Over EAI', '/nl/over/')]
    rendered = ''.join(f'<a href="{u}">{t}</a>' for t, u in links)
    rendered += '<a href="https://nl.linkedin.com/in/hans-visser-92531a105" target="_blank" rel="noopener noreferrer">LinkedIn</a>'
    return f'<footer class="eai-site-footer"><div class="eai-site-footer-inner"><div><a class="eai-site-brand" href="{home}"><img src="/assets/eai-logo.svg" width="32" height="32" alt=""><span>EAI</span></a><p>Hans Visser</p></div><nav aria-label="Footer">{rendered}</nav></div></footer>'

def prepare(root: Path) -> dict:
    install_home_model(root)
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
    revision = hashlib.sha256((json.dumps(manifest, sort_keys=True) + Path(__file__).read_text() + Path(__file__).with_name('editorial_ui.py').read_text() + Path(__file__).with_name('archive_review.py').read_text() + Path(__file__).with_name('home_model.py').read_text()).encode()).hexdigest()[:12]
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
        if not body.has_attr('data-home-model'):
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
        css_pattern = re.compile(r'^/assets/(?:site|site-ui|site-responsive|site-editorial|site-archive|site-home-model)(?:\.[a-f0-9]{12})?\.css(?:\?.*)?$')
        for tag in list(soup.find_all('link', href=True)):
            if css_pattern.match(tag['href']):
                tag.decompose()
        for name in ('site.css', 'site-ui.css', 'site-responsive.css', 'site-editorial.css', 'site-archive.css', 'site-home-model.css'):
            soup.head.append(soup.new_tag('link', rel='stylesheet', href=manifest[name]['url']))
        js_pattern = re.compile(r'^/assets/(?:site-refresh|site-navigation)(?:\.[a-f0-9]{12})?\.js(?:\?.*)?$')
        for tag in list(soup.find_all('script', src=True)):
            if js_pattern.match(tag['src']):
                tag.decompose()
        for name in ('site-refresh.js', 'site-navigation.js'):
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
