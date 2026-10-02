from __future__ import annotations

import argparse
import html
import re
import shutil
from pathlib import Path

from bs4 import BeautifulSoup

BASE_URL = "https://eaimodel.nl"
EMAIL = "vis@emmauscollege.nl"
GITHUB = "https://github.com/E-AI-MODEL"

PUBLICATIONS = [
    ("the-act-of-learning", "The Act of Learning", "eai-blog-the-act-of-learning-embed1.html", "Essay"),
    ("the-act-of-learning-act-2", "The Act of Learning, Part 2", "eai-blog-the-act-of-learning-act-2-embed1.html", "Essay"),
    ("beyond-explainability", "Beyond Explainability", "eai-blog-eai-beyond-explainability-embed1.html", "Paper"),
    ("task-density", "Task Density", "eai-blog-eai-task-density-embed1.html", "Paper"),
    ("ai-balans", "AI in het onderwijs: verdieping of oppervlakkigheid?", "eai-blog-eai-balans-embed1.html", "Artikel"),
    ("eai-stappenplan", "EAI Stappenplan", "eai-blog-eai-stappenplan-embed1.html", "Werkvorm"),
    ("wang-fan-2025", "Rapportage Wang & Fan (2025)", "eai-blog-rapportage-wang-fan-2025-embed1.html", "Rapportage"),
]

TOOLS = [
    ("EAI Toolanalyse", "Analyseer een AI-toepassing op leerwaarde en didactische invloed.", "https://subtle-churros-4d44d5.netlify.app", "Open tool"),
    ("EAI Prompt Builder — Sturen met taal", "Zie hoe woordkeuze, context, rol, workflow en guardrails samen bepalen wat een AI-systeem doet.", "https://eai-prompt.lovable.app/", "Open Prompt Builder"),
    ("EAI Toolkit: Beyond Explainability", "Werk met de begrippen uit Beyond Explainability in een praktische toolkit.", "/tools/beyond-explainability/", "Bekijk toolkit"),
    ("Act of Learning Game", "Interactieve toepassing rond de vraag wie het denkwerk uitvoert.", "https://rainbow-tarsier-a88e9b.netlify.app/", "Open tool"),
    ("EAI What-If Machine", "Verken alternatieven in lesontwerp en AI-inzet.", "https://what-if-lesson-designer.lovable.app/", "Open tool"),
    ("Toolkit The Act of Learning", "Engelstalige toolkit bij The Act of Learning.", "https://effortless-fenglisu-71cd58.netlify.app/", "Open tool"),
    ("EAA Model Tool", "Verken eigenaarschap, autonomie en agency in leren.", "https://sunny-blancmange-dec4a1.netlify.app", "Open tool"),
]

SITE_CSS = r'''
:root{--paper:#f4f0e8;--paper2:#fffdf8;--ink:#12161d;--muted:#5f6570;--line:#d7d0c4;--blue:#143a63;--accent:#efb83f;--max:1180px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}a{color:inherit}.site-header{position:sticky;top:0;z-index:20;background:rgba(244,240,232,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}.nav{max-width:var(--max);margin:0 auto;min-height:68px;padding:0 24px;display:flex;align-items:center;gap:28px}.brand{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;letter-spacing:.1em;text-decoration:none;font-size:1.02rem}.nav-links{margin-left:auto;display:flex;align-items:center;gap:22px;flex-wrap:wrap}.nav-links a{text-decoration:none;font-size:.93rem;color:#303641}.nav-links a:hover{text-decoration:underline;text-underline-offset:5px}.nav-cta{border:1px solid var(--ink);padding:8px 12px}.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}.hero{min-height:72vh;display:grid;align-items:center;border-bottom:1px solid var(--line)}.hero-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.55fr);gap:70px;padding:96px 0 86px}.eyebrow,.kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.12em;font-size:.76rem;font-weight:700;color:var(--blue)}h1,h2,h3{line-height:1.05}h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(3.8rem,8vw,7.6rem);font-weight:500;letter-spacing:-.055em;margin:.14em 0 .28em;max-width:11ch}.lede{font-size:clamp(1.12rem,2vw,1.38rem);max-width:65ch;color:#333943;margin:0 0 30px}.hero-note{border-left:4px solid var(--accent);padding:4px 0 4px 22px;align-self:end}.hero-note strong{font-size:1.1rem;display:block;margin-bottom:8px}.hero-note p{color:var(--muted);margin:0}.button-row{display:flex;gap:12px;flex-wrap:wrap}.button{display:inline-block;text-decoration:none;border:1px solid var(--ink);padding:11px 16px;font-weight:650;background:var(--ink);color:var(--paper2)}.button.secondary{background:transparent;color:var(--ink)}.button:hover{transform:translateY(-1px)}.section{padding:86px 0;border-bottom:1px solid var(--line)}.section-head{display:grid;grid-template-columns:220px 1fr;gap:32px;margin-bottom:44px}.section-head h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.3rem,4vw,4.2rem);font-weight:500;letter-spacing:-.035em;margin:0}.section-head p{max-width:60ch;color:var(--muted);margin:.4em 0 0}.split{display:grid;grid-template-columns:1fr 1fr;gap:22px}.panel{background:var(--paper2);border:1px solid var(--line);padding:30px;min-height:270px}.panel h3{font-family:Georgia,"Times New Roman",serif;font-size:2rem;font-weight:500;margin:14px 0 12px}.panel p{color:#414751}.panel ul{padding-left:20px}.badge{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--ink);padding:4px 8px}.card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:var(--paper2);border:1px solid var(--line);padding:26px;min-height:260px;display:flex;flex-direction:column;text-decoration:none;transition:.18s ease}.card:hover{border-color:#979083;transform:translateY(-2px)}.card .meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--blue)}.card h3{font-family:Georgia,"Times New Roman",serif;font-size:1.75rem;font-weight:500;letter-spacing:-.025em;margin:18px 0 12px}.card p{color:var(--muted);margin:0 0 22px}.card .arrow{margin-top:auto;font-weight:750}.list-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--line)}.list-item{padding:24px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:120px 1fr;gap:16px}.list-item:nth-child(odd){padding-right:28px}.list-item:nth-child(even){padding-left:28px;border-left:1px solid var(--line)}.list-item strong{font-size:1rem}.list-item p{color:var(--muted);margin:4px 0 0}.project{background:var(--blue);color:white}.project .section-head p{color:#d6e0eb}.project .kicker{color:#f4cf70}.project .button.secondary{border-color:white;color:white}.site-footer{padding:38px 0 52px}.footer-grid{display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.footer-grid p{margin:0;color:var(--muted);font-size:.9rem}.footer-grid a{text-underline-offset:4px}.page-hero{padding:96px 0 54px;border-bottom:1px solid var(--line)}.page-hero h1{font-size:clamp(3.2rem,6vw,6.2rem);max-width:14ch}.page-hero .lede{max-width:68ch}.tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.tool-card{background:var(--paper2);border:1px solid var(--line);padding:28px;display:flex;flex-direction:column;min-height:235px}.tool-card h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:2rem;margin:8px 0 12px}.tool-card p{color:var(--muted);margin:0 0 24px}.tool-card a{margin-top:auto;font-weight:750;text-underline-offset:5px}.notice{padding:18px 20px;background:#fff7dc;border:1px solid #e8ce79;color:#4e431d;margin:30px 0}.pillars{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--ink);background:var(--paper2)}.pillar{padding:38px;min-height:330px}.pillar+.pillar{border-left:1px solid var(--ink)}.pillar .num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}.pillar h3{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.2rem,4vw,3.4rem);font-weight:500;letter-spacing:-.035em;margin:20px 0 16px}.pillar p{max-width:42ch;color:#414751}.bridge{padding:24px 0 0;font-size:1.16rem;max-width:72ch}.workform{background:var(--paper2);border-top:1px solid var(--line);padding:24px 0;display:grid;grid-template-columns:180px 1fr 130px;gap:22px;align-items:start}.workform:last-child{border-bottom:1px solid var(--line)}.workform p{margin:0;color:var(--muted)}.workform a{font-weight:700;text-underline-offset:5px}.reading-strip{display:grid;grid-template-columns:1fr 1fr;gap:18px}.reading{border-top:3px solid var(--ink);padding-top:18px}.reading h3{font-family:Georgia,"Times New Roman",serif;font-size:1.8rem;font-weight:500;margin:0 0 10px}.reading p{color:var(--muted)}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:35px}.hero{min-height:auto}.section-head{grid-template-columns:1fr}.card-grid{grid-template-columns:1fr 1fr}.list-grid{grid-template-columns:1fr}.list-item:nth-child(odd),.list-item:nth-child(even){padding:22px 0;border-left:0}.tool-grid{grid-template-columns:1fr}.pillars{grid-template-columns:1fr}.pillar+.pillar{border-left:0;border-top:1px solid var(--ink)}.workform{grid-template-columns:1fr}.reading-strip{grid-template-columns:1fr}.nav{align-items:flex-start;padding-top:16px;padding-bottom:16px}.nav-links{gap:14px}.nav-cta{display:none}}
@media(max-width:620px){.nav{display:block}.nav-links{margin-top:10px}.hero-grid{padding:66px 0 60px}h1{font-size:clamp(3rem,16vw,4.8rem)}.section{padding:62px 0}.split,.card-grid{grid-template-columns:1fr}.footer-grid{display:block}.footer-grid p+p{margin-top:14px}}
'''

CHROME_CSS = r'''
.eai-site-nav{position:sticky;top:0;z-index:99999;background:rgba(244,240,232,.96);backdrop-filter:blur(10px);border-bottom:1px solid #d7d0c4;color:#12161d;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}.eai-site-nav *{box-sizing:border-box}.eai-site-nav__inner{max-width:1180px;margin:0 auto;min-height:62px;padding:0 22px;display:flex;align-items:center;gap:22px}.eai-site-nav a{color:#12161d!important;text-decoration:none!important;font-size:14px!important;line-height:1.2!important}.eai-site-nav__brand{font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;font-weight:800!important;letter-spacing:.1em!important}.eai-site-nav__links{margin-left:auto;display:flex;gap:18px;align-items:center;flex-wrap:wrap}.eai-site-nav__links a:hover{text-decoration:underline!important;text-underline-offset:5px!important}.eai-site-footer{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;max-width:980px;margin:50px auto 0;padding:28px 22px;border-top:1px solid #d7d0c4;color:#5f6570;font-size:14px!important}.eai-site-footer a{color:inherit!important;text-underline-offset:4px!important}
@media(max-width:700px){.eai-site-nav__inner{display:block;padding-top:13px;padding-bottom:13px}.eai-site-nav__links{margin-top:9px;gap:12px}.eai-site-nav__links a{font-size:12px!important}}
'''

LEGACY_REPLACEMENTS = {
    "https://sites.google.com/view/eaimodel/eai-blog/the-act-of-learning-act-2": "/publicaties/the-act-of-learning-act-2/",
    "https://sites.google.com/view/eaimodel/eai-blog/the-act-of-learning": "/publicaties/the-act-of-learning/",
    "https://sites.google.com/view/eaimodel/eai-blog/eai-beyond-explainability": "/publicaties/beyond-explainability/",
    "https://sites.google.com/view/eaimodel/eai-blog/eai-task-density": "/publicaties/task-density/",
    "https://sites.google.com/view/eaimodel/eai-blog/eai-balans": "/publicaties/ai-balans/",
    "https://sites.google.com/view/eaimodel/eai-blog/eai-stappenplan": "/publicaties/eai-stappenplan/",
    "https://sites.google.com/view/eaimodel/eai-blog/rapportage-wang-fan-2025": "/publicaties/wang-fan-2025/",
    "https://sites.google.com/view/eaimodel/eai-blog": "/publicaties/",
    "https://sites.google.com/view/eaimodel/eai-tools-modules": "/tools/",
    "https://sites.google.com/view/eaimodel/eaa-model": "/eaa-model/",
    "https://sites.google.com/view/eaimodel/onderwijsin": "/onderwijsin/",
    "https://sites.google.com/view/eaimodel/home": "/",
}

def esc(value: str) -> str:
    return html.escape(value, quote=True)

def nav(active: str = "") -> str:
    links = [("pijlers", "/twee-pijlers/", "Twee pijlers"), ("workshop", "/workshop-ai/", "Workshop AI"), ("werkvormen", "/werkvormen/", "Werkvormen"), ("praktijk", "/praktijk/", "Praktijk"), ("publicaties", "/publicaties/", "Publicaties"), ("tools", "/tools/", "Tools")]
    items = "".join(
        f'<a href="{href}"' + (' aria-current="page"' if key == active else "") + f'>{label}</a>'
        for key, href, label in links
    )
    return f'<header class="site-header"><nav class="nav"><a class="brand" href="/">EAI</a><div class="nav-links">{items}<a class="nav-cta" href="mailto:{EMAIL}">Contact</a></div></nav></header>'

def footer() -> str:
    return f'<footer class="site-footer"><div class="wrap footer-grid"><p><strong>EAI</strong> · Hans Visser<br>Educational AI, leren en eigenaarschap.</p><p><a href="mailto:{EMAIL}">{EMAIL}</a> · <a href="{GITHUB}" target="_blank" rel="noopener">GitHub</a></p></div></footer>'

def doc(title: str, body: str, canonical_path: str, active: str = "", description: str = "") -> str:
    desc = description or "EAI — Educational AI, leren en eigenaarschap."
    canonical = f"{BASE_URL}{canonical_path}"
    return f'<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · EAI</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{esc(canonical)}"><link rel="stylesheet" href="/assets/site.css"></head><body>{nav(active)}{body}{footer()}</body></html>'

def first_excerpt(source: Path, limit: int = 260) -> str:
    soup = BeautifulSoup(source.read_text(encoding="utf-8"), "html.parser")
    candidates = []
    for selector in [".abstract", "p"]:
        for node in soup.select(selector):
            text = " ".join(node.stripped_strings)
            if len(text) > 90:
                candidates.append(text)
        if candidates:
            break
    text = candidates[0] if candidates else " ".join(soup.stripped_strings)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text

def write(out: Path, path: str, content: str) -> None:
    target = out / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

def rewrite_legacy_links(markup: str) -> str:
    for old, new in LEGACY_REPLACEMENTS.items():
        markup = markup.replace(old, new)
    return markup

def inject_embed(source: Path, canonical_path: str, fallback_title: str, footer_back: str = "/publicaties/") -> str:
    src = source.read_text(encoding="utf-8")
    soup = BeautifulSoup(src, "html.parser")
    lang = (soup.html.get("lang") if soup.html else None) or "nl"
    title = soup.title.get_text(strip=True) if soup.title else fallback_title
    head_parts = []
    if soup.head:
        for node in soup.head.children:
            if getattr(node, "name", None) in {"style", "link", "meta", "script"}:
                head_parts.append(str(node))
    body_inner = soup.body.decode_contents() if soup.body else src
    body_inner = rewrite_legacy_links(body_inner)
    chrome = f'<header class="eai-site-nav"><div class="eai-site-nav__inner"><a class="eai-site-nav__brand" href="/">EAI</a><div class="eai-site-nav__links"><a href="/publicaties/">Publicaties</a><a href="/tools/">Tools</a><a href="/onderwijsin/">OnderwijsIn</a><a href="mailto:{EMAIL}">Contact</a></div></div></header>'
    foot = f'<footer class="eai-site-footer"><a href="{footer_back}">← Terug</a> · <a href="mailto:{EMAIL}">Contact</a></footer>'
    canonical = f"{BASE_URL}{canonical_path}"
    return f'<!doctype html><html lang="{esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · EAI</title><link rel="canonical" href="{esc(canonical)}">{"".join(head_parts)}<link rel="stylesheet" href="/assets/article-chrome.css"></head><body>{chrome}{body_inner}{foot}</body></html>'

def redirect(target: str) -> str:
    canonical = target if target.startswith("http") else f"{BASE_URL}{target}"
    return f'<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url={esc(target)}"><link rel="canonical" href="{esc(canonical)}"><title>Doorsturen…</title></head><body><p><a href="{esc(target)}">Ga verder</a></p></body></html>'

def require_sources(scrape: Path) -> None:
    required = [file for _, _, file, _ in PUBLICATIONS] + ["home-embed1.html", "onderwijsin-embed1.html", "eai-tools-modules-eai-toolkit-beyond-explainability-embed1.html"]
    missing = [name for name in required if not (scrape / name).exists()]
    if missing:
        raise SystemExit("Missing scraped sources: " + ", ".join(missing))

def build(scrape: Path, out: Path) -> None:
    require_sources(scrape)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    write(out, "assets/site.css", SITE_CSS)
    write(out, "assets/article-chrome.css", CHROME_CSS)

    home_body = f'''<main>
<section class="hero"><div class="wrap hero-grid"><div><div class="eyebrow">EAI · Educational AI</div><h1>Twee pijlers voor AI in onderwijs.</h1><p class="lede">Effectieve inzet van AI vraagt kennis van twee kanten: <strong>hoe leren werkt</strong> en <strong>hoe taalmodellen werken</strong>. Pas waar die twee elkaar raken, kun je bepalen wat AI in een concrete leerhandeling wel en niet moet doen.</p><div class="button-row"><a class="button" href="/twee-pijlers/">Bekijk de twee pijlers</a><a class="button secondary" href="/workshop-ai/">Naar Workshop AI</a></div></div><aside class="hero-note"><strong>Begin niet bij de tool</strong><p>Begin bij het leerdoel, de plek in het proces en de handeling die door de leerling of professional zelf betekenis moet krijgen. Kijk daarna pas wat AI toevoegt.</p></aside></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Het vertrekpunt</div><div><h2>Beide pijlers zijn nodig.</h2><p>Onderwijskundige kennis zonder zicht op de werking van AI mist een deel van de nieuwe werkelijkheid. Technische AI-kennis zonder inzicht in leren zegt nog niet of een toepassing onderwijskundig klopt.</p></div></div><div class="pillars"><article class="pillar"><div class="num">Pijler 01</div><h3>Hoe leren werkt</h3><p>Leren vraagt actieve verwerking: voorkennis ophalen, betekenis geven, relaties leggen, oefenen, fouten herstellen, keuzes maken en kennis opnieuw kunnen inzetten.</p><p><a href="/twee-pijlers/#leren">Lees verder →</a></p></article><article class="pillar"><div class="num">Pijler 02</div><h3>Hoe taalmodellen werken</h3><p>Taalmodellen genereren op basis van context en patronen. Ze kunnen structureren, formuleren, samenvatten en redeneringsstappen suggereren. Precies daardoor kunnen ze ondersteunen, maar ook menselijk denkwerk overnemen.</p><p><a href="/twee-pijlers/#taalmodellen">Lees verder →</a></p></article></div><p class="bridge"><strong>De ontwerpvraag zit ertussen.</strong> Welke menselijke handeling moet hier zichtbaar blijven, en welke AI-bijdrage past daarbij?</p></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Van inzicht naar handelen</div><div><h2>Niet alleen lezen. Proberen.</h2><p>De werkvormen maken het leerproces en de verdeling van denkwerk concreet in een eigen taak of les.</p></div></div><div class="workform"><div><span class="badge">Werkvorm</span></div><div><strong>Justification Mapping</strong><p>Maak zichtbaar welke keuze is gemaakt, welke alternatieven serieus waren en waarom een route is gekozen.</p></div><a href="/werkvormen/justification-mapping/">Open →</a></div><div class="workform"><div><span class="badge">Analyse</span></div><div><strong>Wie doet welk denkwerk?</strong><p>Ontleed structureren, formuleren, controleren, kiezen, herzien en verantwoorden.</p></div><a href="/werkvormen/">Bekijk →</a></div><div class="workform"><div><span class="badge">Ontwerp</span></div><div><strong>Bewijs van leren</strong><p>Bepaal vooraf wat zichtbaar moet worden om iets te kunnen zeggen over menselijke uitvoering of begrip.</p></div><a href="/werkvormen/">Bekijk →</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Samen met Onderwijs AI</div><div><h2>Dezelfde lijn in toetsing en implementatie.</h2><p>In gezamenlijke stukken komt dezelfde beweging terug: niet achteraf proberen AI te detecteren, maar leerdoelen, leeractiviteiten, toetsing en dagelijkse werkwijzen opnieuw ontwerpen.</p></div></div><div class="reading-strip"><article class="reading"><h3>De gevolgen van AI op toetsing</h3><p>Leren en presteren zijn niet hetzelfde. De hele keten van leerdoel tot beoordeling moet met een onderwijs- én een AI-bril worden bekeken.</p><a href="https://onderwijs-ai.nl/blog/de-gevolgen-van-ai-toetsing" target="_blank" rel="noopener">Lees bij Onderwijs AI →</a></article><article class="reading"><h3>AI-implementaties in kleine stappen</h3><p>AI invoeren is geen licentie- of toolvraag alleen. Het vraagt gedragsverandering en een route van inzicht naar nieuwe routines.</p><a href="https://onderwijs-ai.nl/blog/ai-implementatie-onderwijs-gedragsverandering" target="_blank" rel="noopener">Lees bij Onderwijs AI →</a></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Praktijk</div><div><h2>Wat gebeurt er als je dit bouwt?</h2><p>De projecten zijn voorbeelden van dezelfde ontwerpkeuzes in verschillende vormen. Ze zijn niet het model zelf.</p></div></div><div class="card-grid"><a class="card" href="/praktijk/"><span class="meta">Lespraktijk</span><h3>EAI Classroom</h3><p>Van leerdoel en succescriteria naar misconceptions, interventies en bewijs van leren.</p><span class="arrow">Bekijk →</span></a><a class="card" href="/praktijk/"><span class="meta">Leeromgeving</span><h3>EAI Hub</h3><p>Ondersteuning koppelen aan de positie in het leerproces en zichtbaar houden wat de leerling doet.</p><span class="arrow">Bekijk →</span></a><a class="card" href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener"><span class="meta">Taal & systeem</span><h3>Prompt Builder</h3><p>Een concreet voorbeeld van hoe woorden, context, workflow en guardrails bepalen welke rol AI krijgt.</p><span class="arrow">Open →</span></a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Publicaties</div><div><h2>Van output naar proces.</h2><p>De publicaties verdiepen de vraag wat er met leren en menselijk handelen gebeurt wanneer AI een deel van het werk uitvoert.</p></div></div><div class="card-grid"><a class="card" href="/publicaties/the-act-of-learning/"><span class="meta">Essay</span><h3>The Act of Learning</h3><p>Over Reverse Scaffolding en de ruimte die nodig blijft om zelf te denken, proberen en herzien.</p><span class="arrow">Lees →</span></a><a class="card" href="/publicaties/beyond-explainability/"><span class="meta">Paper</span><h3>Beyond Explainability</h3><p>Didactic Controllability en Task Density als manieren om menselijk handelen zichtbaar te houden.</p><span class="arrow">Lees →</span></a><a class="card" href="/publicaties/task-density/"><span class="meta">Paper</span><h3>Task Density</h3><p>Over de verdeling van cognitief werk tussen mens en systeem.</p><span class="arrow">Lees →</span></a></div><p style="margin-top:28px"><a href="/publicaties/">Alle publicaties bekijken →</a></p></div></section>
</main>'''
    write(out, "index.html", doc("Twee pijlers voor AI in onderwijs", home_body, "/", description="EAI vertrekt vanuit twee pijlers: hoe leren werkt en hoe taalmodellen werken."))

    pillars_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Twee pijlers</div><h1>Je hebt beide nodig om goede keuzes te maken.</h1><p class="lede">De ene pijler gaat over leren. De andere over de technologie die steeds meer stappen kan uitvoeren. Het onderwijskundige ontwerp ontstaat in de verbinding tussen die twee.</p></div></section><section class="section" id="leren"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 01</div><div><h2>Hoe leren werkt</h2><p>Een goed product is niet automatisch bewijs dat de relevante leerhandeling heeft plaatsgevonden. Daarom kijken we naar wat iemand zelf moet ophalen, ordenen, verbinden, oefenen, kiezen, herstellen of verantwoorden.</p></div></div><div class="panel"><h3>De vraag</h3><p>Welke stap in dit proces moet door de leerling of professional zelf inhoudelijke betekenis krijgen?</p><p>Die stap is contextafhankelijk. Hetzelfde werkwoord kan in een andere taak of op een ander moment iets anders betekenen.</p></div></div></section><section class="section" id="taalmodellen"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 02</div><div><h2>Hoe taalmodellen werken</h2><p>Een taalmodel kan een taak structureren, formuleren, aanvullen, herformuleren en op basis van context vervolgstappen genereren. Dat maakt de technologie krachtig, maar ook didactisch relevant: het systeem kan precies die handeling uitvoeren die je eigenlijk bij de mens wilde laten.</p></div></div><div class="panel"><h3>De vraag</h3><p>Wat doet het systeem in deze taak feitelijk, en welke menselijke handeling wordt daardoor ondersteund, veranderd of overgenomen?</p><p>Niet de hoeveelheid AI-output is bepalend. De relevante vraag is welke handeling verschuift.</p></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">De verbinding</div><div><h2>Hier begint EAI.</h2><p>Pas nadat beide pijlers helder zijn, heeft het zin om over een tool, prompt, agent of workflow te praten.</p></div></div><div class="workform"><div><span class="badge">1</span></div><div><strong>Proces en doel</strong><p>Wat probeert deze onderwijsactiviteit op te bouwen of zichtbaar te maken?</p></div><span></span></div><div class="workform"><div><span class="badge">2</span></div><div><strong>Core human action</strong><p>Welke menselijke handeling is op dit moment de inhoudelijke kern?</p></div><span></span></div><div class="workform"><div><span class="badge">3</span></div><div><strong>Observed AI action</strong><p>Wat doet het systeem daadwerkelijk in deze taak?</p></div><span></span></div><div class="workform"><div><span class="badge">4</span></div><div><strong>Human evidence</strong><p>Wat moet zichtbaar of opnieuw uitvoerbaar zijn om een claim over menselijk leren of handelen te dragen?</p></div><span></span></div></div></section></main>'''
    write(out, "twee-pijlers/index.html", doc("Twee pijlers", pillars_body, "/twee-pijlers/", "pijlers", "Hoe leren werkt en hoe taalmodellen werken: de twee pijlers onder EAI."))

    workshop_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Workshop AI</div><h1>Van kader naar ontwerp.</h1><p class="lede">De workshopreeks bouwt in drie stappen op: eerst de twee pijlers, daarna de verdeling van denkwerk, en vervolgens het herontwerp van taken en bewijs.</p></div></section><section class="section"><div class="wrap"><div class="card-grid"><article class="card"><span class="meta">Workshop 1</span><h3>Twee pijlers voor AI in onderwijs</h3><p>Hoe leren werkt, hoe taalmodellen werken en waarom output geen bewijs van leren is.</p><span class="arrow"><a href="/twee-pijlers/">Bekijk de basis →</a></span></article><article class="card"><span class="meta">Workshop 2</span><h3>Wie doet welk (denk)werk?</h3><p>Task Density, menselijke handelingen en de vraag welke kernhandeling beschermd of zichtbaar moet blijven.</p><span class="arrow"><a href="/werkvormen/">Naar de werkvormen →</a></span></article><article class="card"><span class="meta">Workshop 3</span><h3>Van inzicht naar ontwerp</h3><p>Procespositie, menselijke handeling, AI-rol en bewijs van leren samenbrengen in een herontwerp.</p><span class="arrow"><a href="/werkvormen/justification-mapping/">Start met Justification Mapping →</a></span></article></div></div></section></main>'''
    write(out, "workshop-ai/index.html", doc("Workshop AI", workshop_body, "/workshop-ai/", "workshop", "Workshopreeks over leren, taalmodellen, denkwerk en herontwerp."))

    workforms_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvormen</div><h1>Maak het denken zichtbaar.</h1><p class="lede">Geen losse AI-trucjes, maar korte manieren om te onderzoeken wie welke handeling uitvoert en welk bewijs nodig is.</p></div></section><section class="section"><div class="wrap"><div class="workform"><div><span class="badge">Keuze</span></div><div><strong>Justification Mapping</strong><p>Leg een keuze, alternatieven, criteria en onderbouwing naast elkaar.</p></div><a href="/werkvormen/justification-mapping/">Open →</a></div><div class="workform"><div><span class="badge">Analyse</span></div><div><strong>Task Density scan</strong><p>Ontleed welke denkhandelingen bij de mens en welke bij AI liggen.</p></div><span>Binnenkort</span></div><div class="workform"><div><span class="badge">Bewijs</span></div><div><strong>First attempt & version comparison</strong><p>Bewaar een eerste eigen poging en vergelijk later welke keuzes zijn veranderd.</p></div><span>Binnenkort</span></div><div class="workform"><div><span class="badge">Diagnose</span></div><div><strong>Foutanalyse</strong><p>Laat de mens benoemen waar een redenering ontspoort en waarom.</p></div><span>Binnenkort</span></div></div></section></main>'''
    write(out, "werkvormen/index.html", doc("Werkvormen", workforms_body, "/werkvormen/", "werkvormen", "EAI-werkvormen om menselijk denken, keuzes en bewijs zichtbaar te maken."))

    jm_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Justification Mapping</h1><p class="lede">Een eindkeuze vertelt weinig over het denkwerk ervoor. Justification Mapping maakt zichtbaar welke alternatieven zijn overwogen, welke criteria telden en waarom een route uiteindelijk is gekozen.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Wanneer?</div><div><h2>Gebruik het waar kiezen onderdeel van het leren is.</h2><p>Bij toepassen, verdiepen, reflecteren of een taak waarin AI alternatieven, feedback of formuleringen heeft aangeboden.</p></div></div><div class="panel"><h3>Werk met één echte keuze</h3><ol><li><strong>Keuze:</strong> wat heb je uiteindelijk besloten of gebruikt?</li><li><strong>Alternatieven:</strong> welke andere routes waren serieus mogelijk?</li><li><strong>Criteria:</strong> waarop heb je ze beoordeeld?</li><li><strong>Onderbouwing:</strong> welk bewijs, welke bron of welke redenering woog mee?</li><li><strong>Tegenargument:</strong> wat sprak tegen jouw keuze?</li><li><strong>Besluit:</strong> waarom past deze route hier het best?</li><li><strong>Herziening:</strong> welke nieuwe informatie zou je keuze kunnen veranderen?</li></ol></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Met AI</div><div><h2>AI mag opties geven. De verantwoording blijft menselijk.</h2><p>De werkvorm is niet bedoeld om achteraf een AI-log te reconstrueren. Het doel is dat de deelnemer de inhoudelijke afweging zelf kan uitleggen.</p></div></div><p><a class="button" href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Bekijk hoe taalkeuzes de AI-rol sturen</a></p></div></section></main>'''
    write(out, "werkvormen/justification-mapping/index.html", doc("Justification Mapping", jm_body, "/werkvormen/justification-mapping/", "werkvormen", "Justification Mapping als EAI-werkvorm voor zichtbare keuzes en procesverantwoording."))

    practice_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Praktijk</div><h1>Dezelfde principes, andere toepassing.</h1><p class="lede">Deze projecten laten zien hoe EAI-ideeën kunnen landen in lesontwerp, leeromgevingen en AI-systemen. De projecten zijn voorbeelden, niet de definitie van EAI.</p></div></section><section class="section"><div class="wrap"><div class="tool-grid"><article class="tool-card"><div class="kicker">Lespraktijk</div><h2>EAI Classroom</h2><p>Verbindt leerdoel, succescriteria, misconceptions, interventies en bewijs van leren in de voorbereiding en uitvoering van een les.</p><a href="https://github.com/E-AI-MODEL/eai-classroom" target="_blank" rel="noopener">Bekijk project →</a></article><article class="tool-card"><div class="kicker">Leeromgeving</div><h2>EAI Hub</h2><p>Onderzoekt hoe ondersteuning kan aansluiten op waar de leerling in het leerproces staat, zonder alleen op antwoordkwaliteit te sturen.</p><a href="https://github.com/E-AI-MODEL/eaihub" target="_blank" rel="noopener">Bekijk project →</a></article><article class="tool-card"><div class="kicker">Taal & systeem</div><h2>Prompt Builder</h2><p>Laat zien dat een prompt niet alleen een formulering is: ook rol, context, guardrails, workflow en agentgedrag sturen wat het systeem uitvoert.</p><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder →</a></article></div></div></section></main>'''
    write(out, "praktijk/index.html", doc("Praktijk", practice_body, "/praktijk/", "praktijk", "EAI in praktijk: Classroom, Hub en Prompt Builder."))

    pub_cards = []
    legacy = {
        "the-act-of-learning": "the-act-of-learning",
        "the-act-of-learning-act-2": "the-act-of-learning-act-2",
        "beyond-explainability": "eai-beyond-explainability",
        "task-density": "eai-task-density",
        "ai-balans": "eai-balans",
        "eai-stappenplan": "eai-stappenplan",
        "wang-fan-2025": "rapportage-wang-fan-2025",
    }
    for slug, title, filename, kind in PUBLICATIONS:
        source = scrape / filename
        excerpt = first_excerpt(source)
        pub_cards.append(f'<a class="card" href="/publicaties/{slug}/"><span class="meta">{esc(kind)}</span><h3>{esc(title)}</h3><p>{esc(excerpt)}</p><span class="arrow">Lees →</span></a>')
        write(out, f"publicaties/{slug}/index.html", inject_embed(source, f"/publicaties/{slug}/", title))
        write(out, f"eai-blog/{legacy[slug]}/index.html", redirect(f"/publicaties/{slug}/"))

    pubs_body = f'<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Publicaties</div><h1>Denken over AI vanuit het leerproces.</h1><p class="lede">De artikelen van de bestaande EAI-site, nu op één vaste plek en zonder Google Sites-frame.</p></div></section><section class="section"><div class="wrap"><div class="card-grid">{"".join(pub_cards)}</div></div></section></main>'
    write(out, "publicaties/index.html", doc("Publicaties", pubs_body, "/publicaties/", "publicaties", "Artikelen en analyses van EAI over AI, leren en eigenaarschap."))
    write(out, "eai-blog/index.html", redirect("/publicaties/"))

    tool_cards = "".join(
        f'<article class="tool-card"><div class="kicker">Tool</div><h2>{esc(name)}</h2><p>{esc(desc)}</p><a href="{esc(url)}"' + (' target="_blank" rel="noopener"' if url.startswith("http") else "") + f'>{esc(label)} →</a></article>'
        for name, desc, url, label in TOOLS
    )
    tools_body = f'<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Tools & modules</div><h1>Van idee naar bruikbare ingreep.</h1><p class="lede">De bruikbare tools uit de Google-site zijn hier rechtstreeks bereikbaar. Niet meer werkende pagina’s zijn niet meegenomen.</p></div></section><section class="section"><div class="wrap"><div class="tool-grid">{tool_cards}</div></div></section></main>'
    write(out, "tools/index.html", doc("Tools & modules", tools_body, "/tools/", "tools", "EAI-tools en modules voor onderwijs en AI."))
    write(out, "eai-tools-modules/index.html", redirect("/tools/"))

    toolkit = scrape / "eai-tools-modules-eai-toolkit-beyond-explainability-embed1.html"
    write(out, "tools/beyond-explainability/index.html", inject_embed(toolkit, "/tools/beyond-explainability/", "EAI Toolkit: Beyond Explainability", "/tools/"))

    eaa_body = '<main><section class="page-hero"><div class="wrap"><div class="eyebrow">EAA Model</div><h1>Eigenaarschap. Autonomie. Agency.</h1><p class="lede">Het EAA-model richt zich op menselijk leren, motivatie en regie. Het staat naast EAI en kan ook zonder AI worden gebruikt.</p><p><a class="button" href="https://sunny-blancmange-dec4a1.netlify.app" target="_blank" rel="noopener">Open de EAA Model Tool</a></p></div></section></main>'
    write(out, "eaa-model/index.html", doc("EAA Model", eaa_body, "/eaa-model/", description="EAA — eigenaarschap, autonomie en agency in leren."))

    onderwijs = scrape / "onderwijsin-embed1.html"
    write(out, "onderwijsin/index.html", inject_embed(onderwijs, "/onderwijsin/", "OnderwijsIn — technische anatomie", "/"))

    redirects = {
        "eai-toolanalyse": "https://subtle-churros-4d44d5.netlify.app",
        "eai-eduprompt-builder": "https://eai-prompt-architect.lovable.app/",
        "eai-toolkit-beyond-explainability": "/tools/beyond-explainability/",
        "act-of-learning-game-2": "https://rainbow-tarsier-a88e9b.netlify.app/",
        "eai-what-if-machine": "https://what-if-lesson-designer.lovable.app/",
        "eai-toolkit-the-act-of-learning-en": "https://effortless-fenglisu-71cd58.netlify.app/",
        "eaa-model-tool": "https://sunny-blancmange-dec4a1.netlify.app",
    }
    for slug, target in redirects.items():
        write(out, f"eai-tools-modules/{slug}/index.html", redirect(target))

    not_found = '<main><section class="page-hero"><div class="wrap"><div class="eyebrow">404</div><h1>Deze pagina is er niet meer.</h1><p class="lede">De oude Google-site bevatte ook een paar dode links. Ga terug naar de publicaties of tools.</p><div class="button-row"><a class="button" href="/publicaties/">Publicaties</a><a class="button secondary" href="/tools/">Tools</a></div></div></section></main>'
    write(out, "404.html", doc("Niet gevonden", not_found, "/404.html"))
    write(out, "robots.txt", "User-agent: *\nAllow: /\nSitemap: https://eaimodel.nl/sitemap.xml\n")
    urls = ["/", "/twee-pijlers/", "/workshop-ai/", "/werkvormen/", "/werkvormen/justification-mapping/", "/praktijk/", "/publicaties/", "/tools/", "/eaa-model/", "/onderwijsin/"] + [f"/publicaties/{slug}/" for slug, _, _, _ in PUBLICATIONS] + ["/tools/beyond-explainability/"]
    items = "".join(f"<url><loc>{BASE_URL}{path}</loc></url>" for path in urls)
    write(out, "sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>')

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scrape", type=Path, default=Path("scrape"))
    parser.add_argument("--out", type=Path, default=Path("site-build"))
    args = parser.parse_args()
    build(args.scrape, args.out)
    count = sum(1 for path in args.out.rglob("*") if path.is_file())
    print(f"Built {count} files at {args.out}")

if __name__ == "__main__":
    main()
