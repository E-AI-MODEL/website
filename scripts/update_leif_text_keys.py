"""Vaste tekstcodes. Bestaande codes behouden bij redactie en nieuwe releases.

Bij verplaatsen van een tekst: verplaats zijn sleutel in tekstvelden.js mee.
Dit script voegt uitsluitend nieuwe vindplaatsen toe; het vervangt geen codes.
"""
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Comment

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'leif/tekstvelden.js'
PAGES = {'start':'leif/index.html', 'mijn':'leif/mijn/index.html',
         'vervolg':'leif/continue/index.html', 'verhaal':'leif/verhaal/index.html',
         'beheer':'leif/beheer/index.html'}
EXCLUDE = ('script,style,svg,textarea,select,option,input,code,pre,[contenteditable],'
           '[data-leif-locked],#protected-text,#answerReadout,#testerAnswers,#participants,'
           '#testerList,#testerDetail,#codePanel,#testerInvite,.reader,.report-page,'
           '.reportlist,.report-section,.entry,#reportBody,#detail,#personName,#personMeta,'
           '.personal,.quote-list,.answer-piece,.narrative-copy,.readonly,.readout,'
           '.text-answer,#welcome,[role=status],[role=alert],.save-status,.error,.status,.meta#identity')
ALLOWED = {'h1','h2','h3','h4','p','span','small','button','a','label','strong','summary','li','dt','dd'}

def hash_text(value):
    a, b = 2166136261, 0x811c9dc5
    for c in value:
        n = ord(c)
        if n > 0xffff:
            n = 0xd800 + ((n - 0x10000) >> 10)
        a = ((a ^ n) * 16777619) & 0xffffffff
        b = ((b ^ n) * 2246822519) & 0xffffffff
    return f'{a:08x}{b:08x}'

def location(element, text_index):
    parts = []
    while element and element.name != 'body':
        if element.get('id'):
            parts.insert(0, '#' + element['id'])
            break
        index = 1 + len(element.find_previous_siblings(element.name))
        parts.insert(0, f'{element.name}:{index}')
        element = element.parent
    return '/'.join(parts) + ':' + str(text_index)

def collect(html, page):
    soup = BeautifulSoup(html, 'html.parser')
    excluded = set(id(e) for e in soup.select(EXCLUDE))
    found = {}
    for node in soup.find_all(string=True):
        if isinstance(node, Comment) or not node.parent:
            continue
        parents = list(node.parents)
        if any(id(p) in excluded for p in parents) or not any(p.name in ALLOWED for p in parents):
            continue
        original = re.sub(r'\s+', ' ', str(node)).strip()
        if not 3 <= len(original) <= 6000 or not re.search(r'[A-Za-zÀ-ÿ]', original):
            continue
        texts = [c for c in node.parent.children if isinstance(c, NavigableString) and not isinstance(c, Comment)]
        index = next(i for i, item in enumerate(texts) if item is node)
        path = page + '|' + location(node.parent, index)
        found[path] = hash_text(path + '|' + original)
    for element in soup.select('[placeholder],[title]'):
        if any(id(p) in excluded for p in [element, *element.parents]):
            continue
        for attribute in ('placeholder','title'):
            original = re.sub(r'\s+', ' ', element.get(attribute, '')).strip()
            if not 3 <= len(original) <= 6000 or not re.search(r'[A-Za-zÀ-ÿ]', original):
                continue
            path = page + '|' + location(element, -1) + '|@' + attribute
            found[path] = hash_text(path + '|' + original)
    return found

def main():
    keys = json.loads(TARGET.read_text().split('Object.freeze(',1)[1].rsplit(');',1)[0]) if TARGET.exists() else {}
    for page, path in PAGES.items():
        for location_key, field_key in collect((ROOT/path).read_text(), page).items():
            keys.setdefault(location_key, field_key)
    TARGET.write_text('/* Vaste tekstcodes. Behoud codes bij bronwijzigingen; verplaats ze mee bij een andere HTML-indeling. */\nwindow.LeifTextKeys=Object.freeze(' + json.dumps(keys, ensure_ascii=False, indent=2, sort_keys=True) + ');\n')

if __name__ == '__main__':
    main()
