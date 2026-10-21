"""Read-only full-site inventory. HTTP reachability is not functional approval."""
from __future__ import annotations
import concurrent.futures as futures
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

ROOT = Path('site-build').resolve()
OUT = Path('audit-results')
BASE = 'https://eaimodel.nl'
OUT.mkdir(exist_ok=True)
(OUT / 'texts').mkdir(exist_ok=True)
EXTERNAL_HOSTS = ('netlify.app', 'lovable.app', 'vercel.app', 'github.io')


def parse(path: Path) -> BeautifulSoup:
    return BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')


def read(url: str) -> dict:
    result = {'url': url, 'checked_utc': datetime.now(timezone.utc).isoformat()}
    try:
        req = Request(url, headers={'User-Agent': 'EAI-site-audit/1.0', 'Cache-Control': 'no-cache'})
        with urlopen(req, timeout=18) as resp:
            data = resp.read(2_000_001)
            result.update(status=resp.status, final_url=resp.geturl(), content_type=resp.headers.get('Content-Type',''), truncated=len(data)>2_000_000)
            if 'html' in result['content_type']:
                soup = BeautifulSoup(data, 'html.parser')
                result.update(title=soup.title.get_text(' ',strip=True) if soup.title else '', main_text=len((soup.main or soup.body or soup).get_text(' ',strip=True)), ui_version=soup.body.get('data-ui-version') if soup.body else None)
            result['sha256'] = hashlib.sha256(data).hexdigest()
            result['state'] = 'reachable'
    except HTTPError as exc:
        result.update(status=exc.code, state='missing' if exc.code in (404,410) else 'access_unverified', error=str(exc))
    except Exception as exc:
        result.update(status=None, state='access_unverified', error=str(exc))
    return result


def main():
    pages, missing, fragments, external = [], [], [], defaultdict(list)
    for path in sorted(ROOT.rglob('*.html')):
        rel = path.relative_to(ROOT).as_posix()
        route = '/' + (rel[:-10] if rel.endswith('index.html') else rel)
        url = BASE + route
        soup = parse(path)
        body = soup.main or soup.body or soup
        for tag in list(body.select('script,style,nav,header,footer')):
            tag.decompose()
        text = body.get_text('\n',strip=True)
        (OUT / 'texts' / (rel.replace('/','__')+'.txt')).write_text(text,encoding='utf-8')
        original = parse(path)
        ids = [x['id'] for x in original.select('[id]')]
        row = {'path':rel,'url':url,'h1':[x.get_text(' ',strip=True) for x in original.select('h1')], 'words':len(text.split()),'native_menu':bool(original.select_one('.eai-site-menu')), 'duplicate_ids':[k for k,v in Counter(ids).items() if v>1], 'iframes':[], 'buttons':[x.get_text(' ',strip=True) for x in original.select('button')][:60]}
        for tag in original.select('[href],[src],[data-src]'):
            raw=tag.get('href') or tag.get('src') or tag.get('data-src') or ''
            if not raw or raw.startswith(('mailto:','tel:','javascript:','data:')):
                continue
            target=urljoin(url,raw); parsed=urlsplit(target)
            if parsed.scheme not in ('http','https'):
                continue
            if tag.name=='iframe': row['iframes'].append(target)
            if parsed.netloc in ('eaimodel.nl','www.eaimodel.nl'):
                local=ROOT/unquote(parsed.path).lstrip('/')
                if parsed.path.endswith('/') or not parsed.path: local=local/'index.html'
                if not local.is_file():
                    missing.append({'page':rel,'target':target,'element':tag.name})
                elif parsed.fragment and local.suffix=='.html':
                    dest=parse(local)
                    if not dest.find(id=unquote(parsed.fragment)) and not dest.find(attrs={'name':unquote(parsed.fragment)}):
                        fragments.append({'page':rel,'target':target,'requires_runtime_check':True})
            elif tag.name in ('a','iframe'):
                clean=parsed._replace(fragment='').geturl()
                external[clean].append({'page':rel,'element':tag.name,'label':tag.get_text(' ',strip=True)[:160]})
        pages.append(row)
    urls = sorted(set([p['url'] for p in pages] + list(external)))
    with futures.ThreadPoolExecutor(max_workers=6) as pool:
        responses=list(pool.map(read, urls))
    result={'checked_utc':datetime.now(timezone.utc).isoformat(),'base':BASE,'pages':pages,'local_missing_targets':missing,'unmatched_fragments':fragments,'external_referrers':dict(external),'http':responses,'limits':['HTTP response does not validate a tool output or scholarly claim.','403/429/network errors remain unverified, not proof of a broken site.','Fragment checks need manual review for dynamically generated content.','No private data, credentials or paid form submissions used.']}
    (OUT/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'pages':len(pages),'external_urls':len(external),'missing_internal':len(missing),'unmatched_fragments':len(fragments),'http_statuses':dict(Counter(str(x.get('status')) for x in responses))},indent=2))
    tools=sorted(u for u in external if any((urlsplit(u).hostname or '').endswith(h) for h in EXTERNAL_HOSTS))
    (OUT/'external-tools.json').write_text(json.dumps(tools,indent=2),encoding='utf-8')

if __name__=='__main__': main()
