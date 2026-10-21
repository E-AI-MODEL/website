"""Render the agreed home and model pages before shared navigation preparation.
Only /, /nl/, /en/, /nl/model/ and /en/model/ are written. No handoff edits.
Templates are human-authored content, not generated copy or research results.
"""
from __future__ import annotations
from copy import deepcopy
from pathlib import Path
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

VERSION = '20261021-home-model'
TEMPLATES = Path(__file__).resolve().parent.parent / 'content' / 'home-model'
ROUTES = (('index.html', 'nl', 'home'), ('nl/index.html', 'nl', 'home'),
          ('en/index.html', 'en', 'home'), ('nl/model/index.html', 'nl', 'model'),
          ('en/model/index.html', 'en', 'model'))
DESCRIPTIONS = {
 ('nl', 'home'): 'Wat neemt AI over in het leren? Bekijk een bronnenvoorbeeld en de vier vragen van het EAI-model.',
 ('en', 'home'): 'What does AI take over in learning? Explore a source-comparison example and the four questions of EAI.',
 ('nl', 'model'): 'Proces, fase, kernhandeling en AI: het EAI-model uitgewerkt met een voorbeeld over historische bronnen.',
 ('en', 'model'): 'Process, stage, meaningful action and AI: the EAI model explained through an example with historical sources.',
}


def materialize(root: Path) -> None:
    """Build both languages from the existing site shell, repeatably."""
    prototypes = {}
    for lang in ('nl', 'en'):
        source = root / lang / 'index.html'
        if not source.is_file():
            raise FileNotFoundError(f'Missing home shell: {source}')
        prototypes[lang] = BeautifulSoup(source.read_text(encoding='utf-8'), 'html.parser')
    for rel, lang, kind in ROUTES:
        soup = deepcopy(prototypes[lang])
        if not soup.main or not soup.body or not soup.head:
            raise ValueError(f'Incomplete shell: {rel}')
        template = TEMPLATES / f'{kind}-{lang}.html'
        main = BeautifulSoup(template.read_text(encoding='utf-8'), 'html.parser').main
        if main is None or len(main.find_all('h1')) != 1:
            raise ValueError(f'Template must have one main and one h1: {template}')
        soup.main.replace_with(main)
        soup.html['lang'] = lang
        classes = [c for c in soup.body.get('class', []) if c not in
                   ('eai-home', 'eai-editorial-home', 'eai-hm', 'hm-home', 'hm-model')]
        soup.body['class'] = list(dict.fromkeys(classes + ['eai-refresh', 'eai-hm', 'hm-' + kind]))
        soup.body['data-home-model-layout'] = VERSION
        soup.body.attrs.pop('data-editorial-layout', None)
        title = ('Het EAI-model | EAI' if lang == 'nl' else 'The EAI model | EAI') if kind == 'model' else ('EAI | Leren en AI' if lang == 'nl' else 'EAI | Learning and AI')
        soup.title.string = title
        description = soup.find('meta', attrs={'name': 'description'})
        if description is None:
            description = soup.new_tag('meta', attrs={'name': 'description'})
            soup.head.append(description)
        description['content'] = DESCRIPTIONS[(lang, kind)]
        path = '/' if rel == 'index.html' else '/' + rel.removesuffix('index.html')
        for tag in list(soup.select('link[rel="canonical"], link[rel="alternate"][hreflang]')):
            tag.decompose()
        soup.head.append(soup.new_tag('link', rel='canonical', href='https://eaimodel.nl' + path))
        suffix = 'model/' if kind == 'model' else ''
        for language in ('nl', 'en'):
            soup.head.append(soup.new_tag('link', rel='alternate', hreflang=language,
                                         href=f'https://eaimodel.nl/{language}/{suffix}'))
        soup.head.append(soup.new_tag('link', rel='alternate', hreflang='x-default',
                                     href='https://eaimodel.nl/nl/model/' if kind == 'model' else 'https://eaimodel.nl/'))
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(str(soup), encoding='utf-8')
    sitemap = root / 'sitemap.xml'
    if sitemap.is_file():
        namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
        ET.register_namespace('', namespace)
        tree = ET.parse(sitemap)
        urls = {el.text for el in tree.getroot().findall('.//{' + namespace + '}loc')}
        for language in ('nl', 'en'):
            url = f'https://eaimodel.nl/{language}/model/'
            if url not in urls:
                entry = ET.SubElement(tree.getroot(), '{' + namespace + '}url')
                ET.SubElement(entry, '{' + namespace + '}loc').text = url
        tree.write(sitemap, encoding='utf-8', xml_declaration=True)
