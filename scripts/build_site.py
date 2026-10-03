from __future__ import annotations

# v2 editorial build: two pillars -> workforms -> practice -> publications

import argparse
import html
import json
import re
import shutil
from pathlib import Path

from bs4 import BeautifulSoup

BASE_URL = "https://eaimodel.nl"
EMAIL = "vis@emmauscollege.nl"
GITHUB = "https://github.com/E-AI-MODEL"
PORTRAIT_URL = "https://onderwijs-ai.nl/_app/immutable/assets/hans-visser.CagpLyUi.png"
RESEARCHED_THUMB_URL = "https://files.sgbsg.nl/redeu/uploads/2026/04/08151244/POD-ThumbYT-71.png"

LOGO_SVG = r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-labelledby="title desc">
<title id="title">EAI</title><desc id="desc">Donker rond EAI-beeldmerk met blauwe en cyaan bogen.</desc>
<circle cx="100" cy="100" r="92" fill="#071426"/>
<path d="M116 17 A84 84 0 0 1 181 91" fill="none" stroke="#72DFF6" stroke-width="5" stroke-linecap="round"/>
<path d="M55 68 A58 58 0 0 0 55 132" fill="none" stroke="#557BFF" stroke-width="5" stroke-linecap="round"/>
<text x="100" y="114" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="36" font-weight="700" letter-spacing="5" fill="#FFFFFF">EAI</text>
</svg>'''

PUBLICATIONS = [
    ("the-act-of-learning", "The Act of Learning", "eai-blog-the-act-of-learning-embed1.html", "Essay"),
    ("the-act-of-learning-act-2", "The Act of Learning, Part 2", "eai-blog-the-act-of-learning-act-2-embed1.html", "Essay"),
    ("beyond-explainability", "Beyond Explainability", "eai-blog-eai-beyond-explainability-embed1.html", "Paper"),
    ("task-density", "Task Density", "eai-blog-eai-task-density-embed1.html", "Paper"),
    ("ai-balans", "AI in het onderwijs: verdieping of oppervlakkigheid?", "eai-blog-eai-balans-embed1.html", "Artikel"),
    ("eai-stappenplan", "EAI Stappenplan", "eai-blog-eai-stappenplan-embed1.html", "Werkvorm"),
    ("wang-fan-2025", "Rapportage Wang & Fan (2025)", "eai-blog-rapportage-wang-fan-2025-embed1.html", "Rapportage"),
]

PUBLICATION_INTROS = {
    "the-act-of-learning": "Wat verdwijnt wanneer AI het denkwerk zo vloeiend maakt dat twijfel, poging en herziening uit beeld raken?",
    "the-act-of-learning-act-2": "Vervolg over aanwezigheid, prestatie en de sporen waaraan leren herkenbaar blijft.",
    "beyond-explainability": "Oorspronkelijke uitwerking van Didactic Controllability en Task Density als lens op menselijke besluitvorming.",
    "task-density": "Oorspronkelijke paper over de verdeling van cognitief werk tussen leerling en AI. De actuele publiekslaag op deze site volgt Core/Standard.",
    "ai-balans": "Nederlandstalige verdieping over wanneer AI leren verdiept en wanneer een nette output het leerproces juist kan maskeren.",
    "eai-stappenplan": "Vroege interactieve werkvorm uit de ontwikkeling van EAI. Bewaard als publicatie, niet als actuele Core-specificatie.",
    "wang-fan-2025": "Historische rapportage uit een eerdere EAI-modelgeneratie. Relevant voor de ontwikkellijn, niet de actuele Core/Standard.",
}


WORKFORM_CATEGORIES = [
    ("analyse", "Analyseren wat AI verandert", "Breng eerst in kaart wat de taak vraagt en wat er verandert zodra AI meedoet."),
    ("zichtbaar", "Menselijk handelen zichtbaar maken", "Maak keuzes, eerste pogingen, revisies en afwegingen zichtbaar zonder elk klikje te hoeven volgen."),
    ("zelfstandigheid", "Zelfstandigheid terugbrengen", "Geef een relevante handeling na AI-hulp doelgericht terug aan de leerling en verzamel nieuw menselijk bewijs."),
    ("bewijs", "Leren aantonen", "Kies bewijs dat past bij de claim: huidige prestatie, zelfstandigheid, retentie of transfer."),
    ("herstellen", "Feedback, controle en herstellen", "Gebruik AI-output als aanleiding voor menselijk controleren, corrigeren en opnieuw uitvoeren."),
    ("zelfregulatie", "Zelfregulatie", "Laat de leerling zelf bepalen waar hij vastloopt, welke hulp nodig is en wanneer hij de regie weer overneemt."),
    ("argumentatie", "Argumenteren & bronnen", "Maak analyse, bronkeuze, tegenargumenten en conclusies zichtbaar zonder het inhoudelijke oordeel aan AI uit te besteden."),
    ("professioneel-oordeel", "Professioneel oordeel", "Scheid leerlingbewijs, interpretatie, onzekerheid en professionele beslissing voordat AI de conclusie inkleurt."),
    ("scaffolding", "Scaffolding & feedback", "Kies, doseer en bouw ondersteuning af zodat de relevante handeling terugkeert naar de leerling."),
    ("ontwerpen", "Ontwerpen als docent of team", "Herontwerp taken, AI-rollen en beoordeling vanuit het proces in plaats van vanuit de tool."),
]
WORKFORM_AUDIENCE_LABELS = {"learner": "Leerling", "teacher": "Docent", "team": "Team"}
WORKFORM_EVIDENCE_LABELS = {
    "design": "Ontwerp",
    "process": "Procesbewijs",
    "independent": "Zelfstandig bewijs",
    "retention": "Retentie",
    "transfer": "Transfer",
}
WORKFORM_ROUTE_LABELS = {
    "proces": "Proces / doel",
    "fase": "Fase",
    "kernhandeling": "Kernhandeling",
    "taakdichtheid": "Taakdichtheid",
    "output": "Output",
}
MANUAL_WORKFORMS = {
    "kernhandeling-check",
    "task-density-scan",
    "toollab",
    "first-attempt",
    "justification-mapping",
    "bewijs-van-leren",
    "foutanalyse",
}

def load_workforms() -> list[dict]:
    payload = json.loads(Path("content/workforms.json").read_text(encoding="utf-8"))
    return payload["workforms"]

def render_route(route: list[str]) -> str:
    parts = []
    active = set(route)
    for key in ["proces", "fase", "kernhandeling", "taakdichtheid", "output"]:
        state = " is-active" if key in active else ""
        parts.append(f'<span class="route-chip{state}">{esc(WORKFORM_ROUTE_LABELS[key])}</span>')
    return '<div class="eai-route" aria-label="Plaats in de EAI-kijkvorm">' + "".join(parts) + "</div>"

def render_workforms_index(items: list[dict]) -> str:
    cards_by_category = {key: [] for key, _, _ in WORKFORM_CATEGORIES}
    for item in items:
        audience = " ".join(item.get("audience", []))
        evidence = " ".join(item.get("evidence", []))
        audience_labels = " · ".join(WORKFORM_AUDIENCE_LABELS.get(value, value) for value in item.get("audience", []))
        evidence_labels = " · ".join(WORKFORM_EVIDENCE_LABELS.get(value, value) for value in item.get("evidence", []))
        card = (
            f'<article class="toolbox-card" data-workform-card data-category="{esc(item["category"])}" '
            f'data-audience="{esc(audience)}" data-evidence="{esc(evidence)}">'
            f'<div class="toolbox-card-meta"><span>{esc(audience_labels)}</span><span>{esc(evidence_labels)}</span></div>'
            f'<h3>{esc(item["title"])}</h3><p>{esc(item["summary"])}</p>'
            f'{render_route(item.get("route", []))}'
            f'<a class="toolbox-link" href="/werkvormen/{esc(item["slug"])}/">Open werkvorm →</a></article>'
        )
        cards_by_category[item["category"]].append(card)

    sections = []
    for key, title, description in WORKFORM_CATEGORIES:
        sections.append(
            f'<section class="toolbox-category" id="{esc(key)}" data-toolbox-group>'
            f'<div class="toolbox-category-head"><div><div class="kicker">Doel</div><h2>{esc(title)}</h2></div>'
            f'<p>{esc(description)}</p></div><div class="toolbox-grid">{"".join(cards_by_category[key])}</div></section>'
        )

    return f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvormen</div><h1>Van principe naar leshandeling.</h1><p class="lede">Elke werkvorm begint bij een concrete situatie: wat moet de leerling of professional hier zelf doen, welke hulp is passend en welk bewijs heb je daarna werkelijk in handen?</p></div></section>
<section class="section toolbox-start"><div class="wrap">
<div class="toolbox-example-intro"><div><div class="kicker">Zo werkt de toolbox</div><h2>Eerst de situatie. Dan de werkvorm.</h2><p>Voorbeeld: een leerling schrijft met AI een betoog. De vraag is niet alleen of AI gebruikt mag worden. De vraag is welke handeling de leerling zelf moet uitvoeren om te kunnen zeggen dat hij kan argumenteren. Vanuit die vraag kies je een werkvorm.</p></div><div class="toolbox-example-path"><span>Situatie</span><span>Kernhandeling</span><span>AI-rol</span><span>Werkvorm</span><span>Bewijs</span></div></div>
<div class="toolbox-intro"><div><div class="kicker">Zoek op je vraag</div><h2>Wat wil je hier kunnen zien of besluiten?</h2></div><p>Filter op doel, doelgroep en bewijsfunctie. Op iedere detailpagina staat een concreet klasvoorbeeld naast de werkroute.</p></div>
<nav class="toolbox-questions" aria-label="Veelvoorkomende startvragen">
<a href="#zelfstandigheid"><span>Ik wil weten</span><strong>wat de leerling zonder AI zelf kan.</strong></a>
<a href="#zichtbaar"><span>Ik wil zien</span><strong>hoe een keuze met AI tot stand kwam.</strong></a>
<a href="#zelfregulatie"><span>Ik wil voorkomen</span><strong>dat AI ook de route en regie overneemt.</strong></a>
<a href="#bewijs"><span>Ik wil bepalen</span><strong>welk bewijs mijn conclusie werkelijk draagt.</strong></a>
<a href="#argumentatie"><span>Ik wil oefenen</span><strong>met bronnen, tegenargumenten en conclusies.</strong></a>
<a href="#professioneel-oordeel"><span>Ik wil voorkomen</span><strong>dat AI mijn professionele interpretatie al invult.</strong></a>
<a href="#scaffolding"><span>Ik wil hulp geven</span><strong>zonder de kernhandeling over te nemen.</strong></a>
<a href="#ontwerpen"><span>Ik wil herontwerpen</span><strong>vanuit leerproces en kernhandeling.</strong></a>
</nav>
<div class="toolbox-filters" aria-label="Filter werkvormen">
<label>Doel<select data-toolbox-filter="category"><option value="all">Alle doelen</option>{''.join(f'<option value="{esc(key)}">{esc(title)}</option>' for key,title,_ in WORKFORM_CATEGORIES)}</select></label>
<label>Voor wie<select data-toolbox-filter="audience"><option value="all">Iedereen</option><option value="learner">Leerling</option><option value="teacher">Docent</option><option value="team">Team</option></select></label>
<label>Bewijsfunctie<select data-toolbox-filter="evidence"><option value="all">Alle functies</option><option value="process">Procesbewijs</option><option value="independent">Zelfstandig bewijs</option><option value="retention">Retentie</option><option value="transfer">Transfer</option><option value="design">Ontwerp</option></select></label>
</div>
<p class="toolbox-count"><strong id="toolbox-count">{len(items)}</strong> werkvormen zichtbaar</p>
<div class="toolbox-groups">{"".join(sections)}</div>
<p class="toolbox-empty" id="toolbox-empty" hidden>Geen werkvorm combineert deze filters. Kies een bredere combinatie.</p>
<aside class="toolbox-standard-note"><strong>Over de Standard-laag</strong><p>Een deel van de werkvormen is afgeleid van de EAI Standard 0.4-candidate. Daaronder vallen nu ook microstructuren voor professioneel oordeel en scaffolding. De Standard biedt een kandidaat-taxonomie en ontwerpgrammatica, geen gevalideerde meettest of geautomatiseerde beslisregel. Gebruik de werkvormen om menselijk handelen, ondersteuning, bewijs en professionele afweging preciezer te ontwerpen en bespreken.</p></aside>
</div></section>
<script>
(() => {{
  const filters = [...document.querySelectorAll('[data-toolbox-filter]')];
  const cards = [...document.querySelectorAll('[data-workform-card]')];
  const groups = [...document.querySelectorAll('[data-toolbox-group]')];
  const count = document.getElementById('toolbox-count');
  const empty = document.getElementById('toolbox-empty');
  const matches = (card, key, value) => {{
    if (value === 'all') return true;
    if (key === 'category') return card.dataset.category === value;
    return (card.dataset[key] || '').split(' ').includes(value);
  }};
  const apply = () => {{
    const values = Object.fromEntries(filters.map(el => [el.dataset.toolboxFilter, el.value]));
    let visible = 0;
    cards.forEach(card => {{
      const show = Object.entries(values).every(([key, value]) => matches(card, key, value));
      card.hidden = !show;
      if (show) visible += 1;
    }});
    groups.forEach(group => {{
      group.hidden = ![...group.querySelectorAll('[data-workform-card]')].some(card => !card.hidden);
    }});
    count.textContent = String(visible);
    empty.hidden = visible !== 0;
  }};
  filters.forEach(el => el.addEventListener('change', apply));
  apply();
}})();
</script>
</main>'''

def render_workform_visual(visual: dict | None) -> str:
    if not visual:
        return ""
    kind = visual.get("type")
    items = visual.get("items") or []
    if kind not in {"flow", "contrast"} or len(items) < 2:
        return ""

    nodes = []
    for item in items:
        label = esc(item.get("label", ""))
        text = esc(item.get("text", ""))
        nodes.append(
            f'<div class="workform-visual-node"><strong>{label}</strong><span>{text}</span></div>'
        )

    caption = visual.get("caption")
    caption_html = f'<figcaption>{esc(caption)}</figcaption>' if caption else ""
    return (
        f'<figure class="workform-visual workform-visual--{kind}" aria-label="Visuele samenvatting">'
        f'<div class="kicker">In één oogopslag</div>'
        f'<div class="workform-visual-items">{"".join(nodes)}</div>'
        f'{caption_html}</figure>'
    )

def render_workform_example(item: dict) -> str:
    example = item.get("example")
    if not example:
        return ""
    return (
        '<section class="section workform-example-section"><div class="wrap">'
        '<div class="workform-example-grid">'
        '<div><div class="kicker">Concreet voorbeeld</div><h2>Zo kan dit er in de klas uitzien.</h2></div>'
        f'<div class="workform-example-card"><p>{esc(example)}</p></div>'
        '</div></div></section>'
    )

def append_workform_example(body: str, item: dict) -> str:
    section = render_workform_example(item)
    if not section:
        return body
    return body.replace("</main>", section + "</main>", 1)

def render_catalog_workform(item: dict) -> str:
    steps = "".join(f"<li>{esc(step)}</li>" for step in item.get("steps", []))
    audience = " · ".join(WORKFORM_AUDIENCE_LABELS.get(value, value) for value in item.get("audience", []))
    evidence = " · ".join(WORKFORM_EVIDENCE_LABELS.get(value, value) for value in item.get("evidence", []))
    source = esc(item.get("source", "EAI"))
    visual_html = render_workform_visual(item.get("visual"))
    example_html = render_workform_example(item)
    if item.get("source_url"):
        source_html = f'<a href="{esc(item["source_url"])}" target="_blank" rel="noopener">{source}</a>'
    else:
        source_html = source
    return f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm · {esc(audience)}</div><h1>{esc(item["title"])}</h1><p class="lede">{esc(item["lede"])}</p>{render_route(item.get("route", []))}</div></section>
<section class="section"><div class="wrap"><div class="workform-detail-grid"><div class="workform-question"><div class="kicker">Kernvraag</div><h2>{esc(item["question"])}</h2></div><div class="workform-facts"><p><strong>Voor wie</strong><br>{esc(audience)}</p><p><strong>Bewijsfunctie</strong><br>{esc(evidence)}</p></div></div>{visual_html}</div></section>
{example_html}
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Zo werkt het</div><div><h2>Doe dit in deze volgorde.</h2><p>De stappen vormen een werkroute. Pas de formulering aan je vak en taak aan, maar houd de menselijke handeling en het bewijs expliciet.</p></div></div><div class="panel workform-steps"><ol>{steps}</ol></div></div></section>
<section class="section"><div class="wrap"><div class="split"><article class="panel"><div class="kicker">Opbrengst</div><h3>Waar kijk je daarna naar?</h3><p>{esc(item["result"])}</p></article><article class="panel"><div class="kicker">Let op</div><h3>Wat bewijst dit nog niet?</h3><p>{esc(item["caution"])}</p></article></div><p class="workform-source"><strong>Bronlaag:</strong> {source_html}</p><p><a href="/werkvormen/">← Terug naar de EAI Toolbox</a></p></div></section>
</main>'''

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
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}a{color:inherit}.site-header{position:sticky;top:0;z-index:20;background:rgba(244,240,232,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}.nav{max-width:var(--max);margin:0 auto;min-height:68px;padding:0 24px;display:flex;align-items:center;gap:28px}.brand{display:inline-flex;align-items:center;text-decoration:none;flex:0 0 auto}.brand img{display:block;width:38px;height:38px;transition:transform .18s ease}.brand:hover img{transform:translateY(-1px)}.nav-links{margin-left:auto;display:flex;align-items:center;gap:22px;flex-wrap:wrap}.nav-links a{text-decoration:none;font-size:.93rem;color:#303641}.nav-links a:hover{text-decoration:underline;text-underline-offset:5px}.nav-cta{border:1px solid var(--ink);padding:8px 12px}.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}.hero{min-height:72vh;display:grid;align-items:center;border-bottom:1px solid var(--line)}.hero-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.55fr);gap:70px;padding:96px 0 86px}.eyebrow,.kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.12em;font-size:.76rem;font-weight:700;color:var(--blue)}h1,h2,h3{line-height:1.05}h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(3.8rem,8vw,7.6rem);font-weight:500;letter-spacing:-.055em;margin:.14em 0 .28em;max-width:11ch}.lede{font-size:clamp(1.12rem,2vw,1.38rem);max-width:65ch;color:#333943;margin:0 0 30px}.hero-note{border-left:4px solid var(--accent);padding:4px 0 4px 22px;align-self:end}.hero-note strong{font-size:1.1rem;display:block;margin-bottom:8px}.hero-note p{color:var(--muted);margin:0}.button-row{display:flex;gap:12px;flex-wrap:wrap}.button{display:inline-block;text-decoration:none;border:1px solid var(--ink);padding:11px 16px;font-weight:650;background:var(--ink);color:var(--paper2)}.button.secondary{background:transparent;color:var(--ink)}.button:hover{transform:translateY(-1px)}.section{padding:86px 0;border-bottom:1px solid var(--line)}.section-head{display:grid;grid-template-columns:220px 1fr;gap:32px;margin-bottom:44px}.section-head h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.3rem,4vw,4.2rem);font-weight:500;letter-spacing:-.035em;margin:0}.section-head p{max-width:60ch;color:var(--muted);margin:.4em 0 0}.split{display:grid;grid-template-columns:1fr 1fr;gap:22px}.panel{background:var(--paper2);border:1px solid var(--line);padding:30px;min-height:270px}.panel h3{font-family:Georgia,"Times New Roman",serif;font-size:2rem;font-weight:500;margin:14px 0 12px}.panel p{color:#414751}.panel ul{padding-left:20px}.badge{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--ink);padding:4px 8px}.card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:var(--paper2);border:1px solid var(--line);padding:26px;min-height:260px;display:flex;flex-direction:column;text-decoration:none;transition:.18s ease}.card:hover{border-color:#979083;transform:translateY(-2px)}.card .meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--blue)}.card h3{font-family:Georgia,"Times New Roman",serif;font-size:1.75rem;font-weight:500;letter-spacing:-.025em;margin:18px 0 12px}.card p{color:var(--muted);margin:0 0 22px}.card .arrow{margin-top:auto;font-weight:750}.list-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--line)}.list-item{padding:24px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:120px 1fr;gap:16px}.list-item:nth-child(odd){padding-right:28px}.list-item:nth-child(even){padding-left:28px;border-left:1px solid var(--line)}.list-item strong{font-size:1rem}.list-item p{color:var(--muted);margin:4px 0 0}.project{background:var(--blue);color:white}.project .section-head p{color:#d6e0eb}.project .kicker{color:#f4cf70}.project .button.secondary{border-color:white;color:white}.site-footer{padding:38px 0 52px}.footer-grid{display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.footer-grid p{margin:0;color:var(--muted);font-size:.9rem}.footer-grid a{text-underline-offset:4px}.page-hero{padding:96px 0 54px;border-bottom:1px solid var(--line)}.page-hero h1{font-size:clamp(3.2rem,6vw,6.2rem);max-width:14ch}.page-hero .lede{max-width:68ch}.tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.tool-card{background:var(--paper2);border:1px solid var(--line);padding:28px;display:flex;flex-direction:column;min-height:235px}.tool-card h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:2rem;margin:8px 0 12px}.tool-card p{color:var(--muted);margin:0 0 24px}.tool-card a{margin-top:auto;font-weight:750;text-underline-offset:5px}.notice{padding:18px 20px;background:#fff7dc;border:1px solid #e8ce79;color:#4e431d;margin:30px 0}.pillars{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--ink);background:var(--paper2)}.pillar{padding:38px;min-height:330px}.pillar+.pillar{border-left:1px solid var(--ink)}.pillar .num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}.pillar h3{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.2rem,4vw,3.4rem);font-weight:500;letter-spacing:-.035em;margin:20px 0 16px}.pillar p{max-width:42ch;color:#414751}.bridge{padding:24px 0 0;font-size:1.16rem;max-width:72ch}.workform{background:var(--paper2);border-top:1px solid var(--line);padding:24px 0;display:grid;grid-template-columns:180px 1fr 130px;gap:22px;align-items:start}.workform:last-child{border-bottom:1px solid var(--line)}.workform p{margin:0;color:var(--muted)}.workform a{font-weight:700;text-underline-offset:5px}.reading-strip{display:grid;grid-template-columns:1fr 1fr;gap:18px}.reading{border-top:3px solid var(--ink);padding-top:18px}.reading h3{font-family:Georgia,"Times New Roman",serif;font-size:1.8rem;font-weight:500;margin:0 0 10px}.reading p{color:var(--muted)}.article-shell{padding:0 24px}.article-body{max-width:820px;margin:0 auto;padding:86px 0 110px;font-family:Georgia,"Times New Roman",serif;font-size:1.15rem;line-height:1.78}.article-header{padding-bottom:42px;margin-bottom:44px;border-bottom:1px solid var(--line)}.article-header h1{max-width:12ch;font-size:clamp(3.4rem,7vw,6.7rem);margin:.16em 0 .22em}.article-subtitle{font-size:1.35rem;color:#343a43;margin:0 0 12px}.article-meta{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.86rem;color:var(--muted)}.article-body>p,.article-body>ul,.article-body>ol,.article-body>blockquote{max-width:720px;margin-left:auto;margin-right:auto}.article-body h2{max-width:720px;margin:70px auto 22px;font-size:clamp(2rem,4vw,3.1rem);font-weight:500;letter-spacing:-.03em}.article-intro{font-size:1.27rem}.article-body blockquote{font-size:1.5rem;line-height:1.42;border-left:4px solid var(--accent);padding:10px 0 10px 24px;margin-top:34px;margin-bottom:34px}.article-body blockquote.question{font-style:italic}.article-steps{padding-left:26px}.article-steps li{padding:5px 0}.article-pillars{max-width:820px;margin:34px auto;display:grid;grid-template-columns:1fr 1fr;background:var(--paper2);border:1px solid var(--ink)}.article-pillars>div{padding:28px}.article-pillars>div+div{border-left:1px solid var(--ink)}.article-pillars strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:1.55rem;margin:18px 0 8px}.article-pillars p{margin:0;color:#424852}.article-action{max-width:820px;margin:58px auto;padding:30px;border:1px solid var(--line);background:var(--paper2);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.article-action h3{font-family:Georgia,"Times New Roman",serif;font-size:2rem;font-weight:500;margin:12px 0}.article-action p{max-width:65ch;color:#464c56}.article-action a{font-weight:750;text-underline-offset:5px}.article-action.final{border-color:var(--ink)}.article-signoff{font-style:italic;margin-top:36px}.feature-publication{display:grid;grid-template-columns:1.2fr .8fr;gap:40px;padding:38px;border:1px solid var(--ink);background:var(--paper2);margin-bottom:36px}.feature-publication h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.4rem,4vw,4rem);font-weight:500;letter-spacing:-.035em;margin:14px 0}.feature-publication p{color:#404650}.feature-publication .question-mark{font-family:Georgia,"Times New Roman",serif;font-size:10rem;line-height:.8;text-align:center;align-self:center;color:var(--blue)}.mini-note{font-size:.88rem;color:var(--muted)}.citation-box{max-width:720px;margin:26px auto 46px;padding:18px 20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.9rem}.citation-box p{margin:6px 0;color:#444a54}.citation-box code{font-size:.82rem;word-break:break-all}.media-feature{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:34px;align-items:center}.media-copy h2,.app-copy h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.35rem,4vw,4rem);font-weight:500;letter-spacing:-.035em;margin:10px 0 16px}.media-copy p,.app-copy p{color:var(--muted);max-width:58ch}.embed-card{background:var(--paper2);border:1px solid var(--line);padding:12px}.embed-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 4px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.embed-dots{display:inline-flex;gap:5px}.embed-dots i{width:7px;height:7px;border-radius:50%;background:#a8a29a}.embed-window{position:relative;width:100%;aspect-ratio:16/9;background:#0b1020;overflow:hidden}.embed-window.app{aspect-ratio:16/10;background:#fff}.embed-window iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.app-showcase{display:grid;grid-template-columns:minmax(250px,.42fr) minmax(0,1fr);gap:28px;align-items:center;padding:30px 0;border-top:1px solid var(--line)}.app-showcase:last-child{border-bottom:1px solid var(--line)}.app-copy .button-row{margin-top:22px}.app-tag{display:inline-block;margin-bottom:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--blue)}.source-note{font-size:.82rem;color:var(--muted);margin-top:12px}.source-note a{text-underline-offset:4px}

/* Editorial visual system derived from "De vraag die we vergeten in het AI-debat". */
:root{--paper:#ffffff;--paper2:#ffffff;--ink:#202936;--muted:#687487;--line:#dfe3e8;--blue:#294b73;--accent:#e8583a;--soft:#f4f0e7;--max:1140px}
html{scroll-padding-top:82px}
body{background:#fff;color:var(--ink);font-family:Georgia,"Times New Roman",serif;font-size:16.5px;line-height:1.64}
.site-header{background:rgba(255,255,255,.97);border-bottom:1px solid var(--line);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.nav{min-height:62px}
.nav-links a{color:#394452}
.nav-cta{border-color:#283240}
.eyebrow,.kicker,.badge,.card .meta,.pillar .num,.embed-top,.app-tag{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.eyebrow,.kicker{color:#5f7085;letter-spacing:.11em;font-weight:800}
h1,h2,h3,.panel h3,.card h3,.tool-card h2,.pillar h3,.reading h3,.media-copy h2,.app-copy h2,.feature-publication h2,.article-body h2,.article-action h3,.article-pillars strong{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);font-weight:800;letter-spacing:-.025em}
h1{font-size:clamp(3.05rem,5.8vw,5.25rem);max-width:13ch;letter-spacing:-.042em}
.lede{font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.02rem,1.65vw,1.22rem);color:#465467;line-height:1.55}
.hero{min-height:auto;background:#fff}
.hero-grid{grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:58px;padding:70px 0 66px}
.button{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#202936;color:#fff;border-color:#202936}
.button.secondary{background:#fff;color:#202936}
.section{padding:64px 0;background:#fff}
.section-head{grid-template-columns:165px 1fr;gap:28px;margin-bottom:34px}
.section-head h2{font-size:clamp(1.9rem,3.2vw,3rem)}
.section-head h2::before{content:"";display:block;width:36px;height:3px;background:var(--accent);margin:0 0 16px}
.section-head p{color:#4f5a69}
.page-hero{padding:68px 0 42px;background:#fff}
.page-hero h1{font-size:clamp(2.75rem,5vw,4.75rem)}
.panel,.card,.tool-card,.embed-card{background:#fff;border-color:var(--line);box-shadow:none}
.panel{min-height:0}
.card{min-height:220px}
.card:hover{border-color:#aeb7c2}
.card p,.tool-card p,.pillar p,.workform p,.reading p,.media-copy p,.app-copy p{color:#596576}
.badge{border:0;padding:0;color:#66788f;font-weight:800}
.pillars{border:1px solid var(--line);background:#fff}
.pillar{min-height:0;padding:32px}
.pillar+.pillar{border-left:1px solid var(--line)}
.pillar .num{color:#71829a}
.pillar h3{font-size:clamp(1.85rem,3vw,2.6rem)}
.bridge{font-family:Georgia,"Times New Roman",serif}
.workform{background:#fff;border-color:var(--line);padding:20px 0}
.reading{border-top:3px solid var(--accent)}
.notice{background:var(--soft);border:0;border-left:4px solid var(--accent);color:#3d4652}
.feature-publication{background:#fff;border-color:var(--line);padding:32px}
.feature-publication .question-mark{color:var(--accent);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:800}
.hero-note{background:var(--soft);border-left:4px solid var(--accent);padding:18px 20px}
.pdf-figure{margin:0;border:1px solid var(--line);background:#fff;padding:24px 22px}
.pdf-figure svg{display:block;width:100%;height:auto;max-height:270px}
.pdf-figure figcaption{margin-top:12px;color:#6f7b8b;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.8rem}
.pdf-figure .stroke{fill:none;stroke:#274d79;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.pdf-figure .dash{fill:none;stroke:#274d79;stroke-width:2.1;stroke-dasharray:6 6}
.pdf-figure .accent-fill{fill:var(--accent)}
.pdf-figure .accent-stroke{fill:none;stroke:var(--accent);stroke-width:2.2;stroke-linecap:round}
.pillar-visual{max-width:620px;margin:4px auto 30px}
.pillar-visual svg{max-height:195px}
.app-showcase[id],section[id]{scroll-margin-top:84px}
.article-body{max-width:780px;font-size:1.03rem;line-height:1.7;color:#384555;padding:68px 0 92px}.article-route{max-width:680px;margin:0 auto 34px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;gap:18px;flex-wrap:wrap;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.78rem}.article-route a{text-decoration:none;color:#5b6878}.article-route a:hover{text-decoration:underline;text-underline-offset:4px}.article-route+ .article-intro{margin-top:0}.article-visual{max-width:680px;margin:28px auto 34px}.article-visual figcaption{max-width:58ch}
.article-header{border-bottom:0;padding-bottom:20px;margin-bottom:26px}
.article-header::before{content:"AI, MENS & TAAL";display:block;padding-bottom:9px;border-bottom:1px solid var(--line);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.7rem;font-weight:800;letter-spacing:.12em;color:#7d8998}
.article-header h1{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:800;letter-spacing:-.035em;font-size:clamp(2.7rem,5vw,4.7rem);max-width:13ch}
.article-subtitle{font-family:Georgia,"Times New Roman",serif;font-style:italic;color:#53627a;font-size:1.18rem}
.article-body>p,.article-body>ul,.article-body>ol,.article-body>blockquote{max-width:680px;margin-left:auto;margin-right:auto}
.article-body>p{margin-top:0;margin-bottom:1.05em}
.article-body h2{max-width:680px;font-size:clamp(1.65rem,2.8vw,2.25rem);margin:52px auto 18px}
.article-body h2::before{content:"";display:block;width:34px;height:3px;background:var(--accent);margin-bottom:15px}
.article-body blockquote{background:var(--soft);border-left:4px solid var(--accent);padding:15px 18px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:750;font-size:1.1rem;color:#303946}
.article-body blockquote.question{background:transparent;border-left:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:Georgia,"Times New Roman",serif;font-weight:400;color:#566275}
.article-pillars{border-color:var(--line);background:#fff}
.article-pillars>div+div{border-color:var(--line)}
.article-action{background:var(--soft);border:0;border-left:4px solid var(--accent);margin:44px auto}
.article-action.final{border:0;border-left:4px solid var(--accent)}
.citation-box{border-color:var(--line)}
.site-footer{border-top:1px solid var(--line);background:#fff}
@media(max-width:900px){html{scroll-padding-top:126px}.app-showcase[id],section[id]{scroll-margin-top:128px}.hero-grid{grid-template-columns:1fr;gap:30px}.pillar+.pillar{border-left:0;border-top:1px solid var(--line)}}
@media(max-width:620px){body{font-size:16px}.hero-grid{padding:54px 0 48px}.section{padding:52px 0}.page-hero{padding:54px 0 34px}h1{font-size:clamp(2.65rem,13vw,4rem)}.article-body{font-size:1rem;padding-top:50px}.article-body h2{margin-top:44px}}

@media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:35px}.media-feature,.app-showcase{grid-template-columns:1fr}.hero{min-height:auto}.section-head{grid-template-columns:1fr}.card-grid{grid-template-columns:1fr 1fr}.list-grid{grid-template-columns:1fr}.list-item:nth-child(odd),.list-item:nth-child(even){padding:22px 0;border-left:0}.tool-grid{grid-template-columns:1fr}.pillars{grid-template-columns:1fr}.pillar+.pillar{border-left:0;border-top:1px solid var(--ink)}.workform{grid-template-columns:1fr}.reading-strip{grid-template-columns:1fr}.article-pillars{grid-template-columns:1fr}.article-pillars>div+div{border-left:0;border-top:1px solid var(--ink)}.feature-publication{grid-template-columns:1fr}.feature-publication .question-mark{display:none}.nav{align-items:flex-start;padding-top:16px;padding-bottom:16px}.nav-links{gap:14px}.nav-cta{display:none}}
@media(max-width:620px){.nav{display:block}.nav-links{margin-top:10px}.hero-grid{padding:66px 0 60px}h1{font-size:clamp(3rem,16vw,4.8rem)}.section{padding:62px 0}.split,.card-grid{grid-template-columns:1fr}.footer-grid{display:block}.footer-grid p+p{margin-top:14px}}

/* EAI Toolbox */
.toolbox-start{padding-top:52px}.toolbox-questions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 24px}.toolbox-questions a{display:flex;flex-direction:column;gap:4px;padding:15px 16px;border:1px solid var(--line);text-decoration:none;background:#fff}.toolbox-questions a:hover{border-color:#aeb7c2}.toolbox-questions span{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#718096}.toolbox-questions strong{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.94rem;line-height:1.35;color:var(--ink)}.toolbox-standard-note{margin-top:52px;padding:18px 20px;background:var(--soft);border-left:4px solid var(--accent)}.toolbox-standard-note p{margin:5px 0 0;color:var(--muted);max-width:80ch}.toolbox-intro{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:38px;align-items:end;margin-bottom:30px}.toolbox-intro h2{font-size:clamp(1.9rem,3vw,2.8rem);margin:8px 0 0}.toolbox-intro p{margin:0;color:var(--muted);max-width:62ch}.toolbox-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:18px;background:var(--soft);border-left:4px solid var(--accent)}.toolbox-filters label{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.78rem;font-weight:800;color:#4f5a69;letter-spacing:.04em;text-transform:uppercase}.toolbox-filters select{display:block;width:100%;margin-top:7px;padding:10px 12px;border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;text-transform:none;letter-spacing:0;font-weight:600}.toolbox-count{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--muted);font-size:.86rem;margin:15px 0 0}.toolbox-groups{margin-top:52px}.toolbox-category{padding:0 0 58px;scroll-margin-top:100px}.toolbox-category+.toolbox-category{padding-top:58px;border-top:1px solid var(--line)}.toolbox-category-head{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:38px;align-items:end;margin-bottom:24px}.toolbox-category-head h2{font-size:clamp(1.75rem,3vw,2.7rem);margin:8px 0 0}.toolbox-category-head p{margin:0;color:var(--muted);max-width:60ch}.toolbox-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.toolbox-card{border:1px solid var(--line);background:#fff;padding:24px;display:flex;flex-direction:column;min-height:280px}.toolbox-card[hidden]{display:none}.toolbox-card-meta{display:flex;justify-content:space-between;gap:12px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#718096}.toolbox-card h3{font-size:1.55rem;margin:18px 0 10px}.toolbox-card p{margin:0 0 18px;color:var(--muted)}.toolbox-link{margin-top:auto;padding-top:18px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:800;text-underline-offset:5px}.eai-route{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 20px}.route-chip{padding:4px 7px;border:1px solid var(--line);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.66rem;font-weight:700;color:#8a94a2}.route-chip.is-active{border-color:#9aa9ba;color:#294b73;background:#f6f8fa}.toolbox-empty{padding:24px;border:1px solid var(--line);background:var(--soft)}.workform-detail-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:46px;align-items:start}.workform-question h2{font-size:clamp(2rem,4vw,3.6rem);margin:12px 0;max-width:17ch}.workform-facts{border-left:4px solid var(--accent);padding:2px 0 2px 20px}.workform-facts p{margin:0 0 18px;color:var(--muted)}.workform-facts strong{color:var(--ink)}.workform-steps ol{margin:0;padding-left:24px}.workform-steps li{padding:8px 0}.workform-source{margin-top:28px;color:var(--muted);font-size:.9rem}.workform-source a{text-underline-offset:4px}.workform-visual{margin:34px 0 0;border:1px solid var(--line);background:#fff;padding:22px 24px}.workform-visual-items{margin-top:14px}.workform-visual-node{border:1px solid var(--line);background:var(--paper2);padding:16px 18px;min-height:104px}.workform-visual-node strong{display:block;font-size:.88rem;line-height:1.25}.workform-visual-node span{display:block;margin-top:7px;color:var(--muted);font-size:.9rem;line-height:1.45}.workform-visual--contrast .workform-visual-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.workform-visual--contrast .workform-visual-node{border-top:3px solid #9aa9ba}.workform-visual--flow .workform-visual-items{display:flex;align-items:stretch;gap:30px}.workform-visual--flow .workform-visual-node{position:relative;flex:1;border-top:3px solid var(--accent)}.workform-visual--flow .workform-visual-node:not(:last-child)::after{content:"→";position:absolute;right:-22px;top:50%;transform:translateY(-50%);font-weight:800;color:#718096}.workform-visual figcaption{margin-top:14px;color:var(--muted);font-size:.84rem;line-height:1.45}
@media(max-width:900px){.toolbox-intro,.toolbox-category-head,.workform-detail-grid{grid-template-columns:1fr}.toolbox-grid{grid-template-columns:1fr}.toolbox-filters{grid-template-columns:1fr}.toolbox-questions{grid-template-columns:1fr 1fr}.toolbox-category{scroll-margin-top:140px}}@media(max-width:620px){.toolbox-questions{grid-template-columns:1fr}}@media(max-width:760px){.workform-visual--flow .workform-visual-items{flex-direction:column;gap:26px}.workform-visual--flow .workform-visual-node:not(:last-child)::after{content:"↓";right:auto;left:50%;top:auto;bottom:-23px;transform:translateX(-50%)}}

/* Keep the PDF-led mobile rhythm after the legacy migration breakpoints. */
@media(max-width:900px){html{scroll-padding-top:126px}.app-showcase[id],section[id]{scroll-margin-top:128px}.hero-grid{grid-template-columns:1fr;gap:30px}.pillar+.pillar,.article-pillars>div+div{border-color:var(--line)}}
@media(max-width:620px){body{font-size:16px}.hero-grid{padding:54px 0 48px}.section{padding:52px 0}.page-hero{padding:54px 0 34px}h1{font-size:clamp(2.65rem,13vw,4rem)}.article-body{font-size:1rem;padding-top:50px}.article-body h2{margin-top:44px}.article-route{gap:12px;font-size:.75rem}.pdf-figure{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain}.pdf-figure svg{min-width:680px;max-width:none}.pillar-visual{max-width:100%}}
'''

CHROME_CSS = r'''
.eai-site-nav{position:sticky;top:0;z-index:99999;background:rgba(255,255,255,.97);backdrop-filter:blur(10px);border-bottom:1px solid #dfe3e8;color:#202936;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}.eai-site-nav *{box-sizing:border-box}.eai-site-nav__inner{max-width:1180px;margin:0 auto;min-height:62px;padding:0 22px;display:flex;align-items:center;gap:22px}.eai-site-nav a{color:#394452!important;text-decoration:none!important;font-size:14px!important;line-height:1.2!important}.eai-site-nav__brand{display:inline-flex!important;align-items:center!important}.eai-site-nav__brand img{display:block!important;width:34px!important;height:34px!important}.eai-site-nav__links{margin-left:auto;display:flex;gap:18px;align-items:center;flex-wrap:wrap}.eai-site-nav__links a:hover{text-decoration:underline!important;text-underline-offset:5px!important}.eai-site-footer{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;max-width:980px;margin:50px auto 0;padding:28px 22px;border-top:1px solid #dfe3e8;color:#687487;font-size:14px!important}.eai-site-footer a{color:inherit!important;text-underline-offset:4px!important}
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
    links = [
        ("model", "/", "EAI model"),
        ("werkvormen", "/werkvormen/", "Werkvormen"),
        ("praktijk", "/praktijk/", "Praktijk"),
        ("publicaties", "/publicaties/", "Publicaties"),
        ("tools", "/tools/", "Tools"),
        ("over", "/over/", "Over"),
    ]
    items = "".join(
        f'<a href="{href}"' + (' aria-current="page"' if key == active else "") + f'>{label}</a>'
        for key, href, label in links
    )
    mobile_items = "".join(
        f'<a href="{href}"' + (' aria-current="page"' if key == active else "") + f'>{label}</a>'
        for key, href, label in links
    )
    return (
        f'<header class="site-header"><nav class="nav">'
        f'<a class="brand" href="/" aria-label="EAI home"><img src="/assets/eai-logo.svg" alt="EAI"></a>'
        f'<div class="nav-links">{items}<a class="nav-cta" href="mailto:{EMAIL}">Contact</a></div>'
        f'<details class="mobile-nav"><summary>Menu</summary><div class="mobile-nav-panel">{mobile_items}<a href="mailto:{EMAIL}">Contact</a></div></details>'
        f'</nav></header>'
    )

def footer() -> str:
    return (
        f'<footer class="site-footer"><div class="wrap footer-grid">'
        f'<p style="display:flex;gap:12px;align-items:center"><img src="/assets/eai-logo.svg" alt="" width="42" height="42">'
        f'<span><strong>EAI</strong> · Hans Visser<br>AI, leren en professioneel handelen.</span></p>'
        f'<p><a href="/over/">Over EAI en Hans</a> · <a href="mailto:{EMAIL}">{EMAIL}</a> · '
        f'<a href="{GITHUB}" target="_blank" rel="noopener">GitHub</a></p></div></footer>'
    )

def doc(title: str, body: str, canonical_path: str, active: str = "", description: str = "") -> str:
    desc = description or "EAI — Educational AI, leren en eigenaarschap."
    canonical = f"{BASE_URL}{canonical_path}"
    return f'<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · EAI</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{esc(canonical)}"><link rel="icon" href="/assets/eai-logo.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site.css"></head><body>{nav(active)}{body}{footer()}</body></html>'

def render_article_fragment(fragment: Path, title: str, canonical_path: str, description: str) -> str:
    body = fragment.read_text(encoding="utf-8")
    return doc(title, f'<main class="article-shell">{body}</main>', canonical_path, "publicaties", description)

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
    chrome = f'<header class="eai-site-nav"><div class="eai-site-nav__inner"><a class="eai-site-nav__brand" href="/" aria-label="EAI home"><img src="/assets/eai-logo.svg" alt="EAI" width="34" height="34"></a><div class="eai-site-nav__links"><a href="/twee-pijlers/">Twee pijlers</a><a href="/workshop-ai/">Workshop AI</a><a href="/werkvormen/">Werkvormen</a><a href="/praktijk/">Praktijk</a><a href="/publicaties/">Publicaties</a><a href="/tools/">Tools</a><a href="mailto:{EMAIL}">Contact</a></div></div></header>'
    foot = f'<footer class="eai-site-footer"><a href="{footer_back}">← Terug</a> · <a href="mailto:{EMAIL}">Contact</a></footer>'
    canonical = f"{BASE_URL}{canonical_path}"
    return f'<!doctype html><html lang="{esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · EAI</title><link rel="canonical" href="{esc(canonical)}"><link rel="icon" href="/assets/eai-logo.svg" type="image/svg+xml">{"".join(head_parts)}<link rel="stylesheet" href="/assets/article-chrome.css"></head><body>{chrome}{body_inner}{foot}</body></html>'

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
    write(out, "assets/eai-logo.svg", LOGO_SVG)

    home_body = f'''<main>
<section class="hero"><div class="wrap hero-grid">
<div><div class="eyebrow">EAI model</div><h1>Wat moet de mens hier zelf blijven doen?</h1>
<p class="lede">EAI helpt je bepalen welke rol AI in een leer- of professioneel proces mag krijgen. Je begint bij het doel, de fase en de menselijke handeling die ertoe doet. Pas daarna bepaal je wat AI uitvoert en welk bewijs je nodig hebt.</p>
<div class="button-row"><a class="button" href="#model">Zo werkt EAI</a><a class="button secondary" href="/werkvormen/">Naar de werkvormen</a></div></div>
<div class="model-stack" aria-label="De vijf vragen van EAI">
<div><span>01</span><strong>Proces en doel</strong><p>Wat probeer je op te bouwen of zichtbaar te maken?</p></div>
<div><span>02</span><strong>Fase</strong><p>Waar bevindt de leerling of professional zich nu?</p></div>
<div><span>03</span><strong>Kernhandeling</strong><p>Welke handeling moet de mens hier zelf betekenis geven?</p></div>
<div><span>04</span><strong>Taakverdeling</strong><p>Wat doet de mens, wat doet AI en in welke volgorde?</p></div>
<div><span>05</span><strong>Output en bewijs</strong><p>Wat heb je daarna werkelijk gezien of aangetoond?</p></div>
</div></div></section>

<section class="section" id="model"><div class="wrap"><div class="section-head"><div class="kicker">EAI in één voorbeeld</div><div><h2>Een goed product zegt nog niet wie het relevante werk deed.</h2><p>Daarom kijkt EAI naar de handeling achter de output.</p></div></div>
<div class="case-study">
<div class="case-study__task"><span class="badge">Situatie</span><h3>Een leerling schrijft met AI een betoog.</h3><p>De tekst is sterk. Maar de docent wil kunnen zeggen dat de leerling zelf argumenten kan wegen en een conclusie kan onderbouwen.</p></div>
<div class="case-study__route">
<div><span>Doel</span><strong>Argumenteren</strong></div>
<div><span>Fase</span><strong>Zelfstandig oefenen</strong></div>
<div><span>Kernhandeling</span><strong>Argumenten wegen</strong></div>
<div><span>AI</span><strong>Formulering en feedback</strong></div>
<div><span>Bewijs</span><strong>Nieuwe stelling zonder inhoudelijke AI-hulp</strong></div>
</div></div>
<p class="bridge"><strong>De ontwerpkeuze volgt uit het leerproces.</strong> AI mag veel doen, zolang duidelijk blijft welke menselijke handeling je wilt opbouwen of beoordelen en waar die opnieuw zichtbaar wordt.</p>
</div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Waarom twee pijlers?</div><div><h2>Je moet zowel leren als AI begrijpen.</h2><p>EAI verbindt onderwijskundige kennis met kennis van wat taalmodellen feitelijk doen. Zonder die combinatie blijft een oordeel over AI te algemeen.</p></div></div>
<div class="pillars"><article class="pillar"><div class="num">Pijler 01</div><h3>Hoe leren werkt</h3><p>Welke verwerking, oefening, fout, keuze of herhaling draagt in deze fase bij aan leren?</p><p><a href="/twee-pijlers/#leren">Lees verder →</a></p></article>
<article class="pillar"><div class="num">Pijler 02</div><h3>Hoe taalmodellen werken</h3><p>Welke stappen kan het systeem al structureren, voorspellen, formuleren, controleren of voorstellen?</p><p><a href="/twee-pijlers/#taalmodellen">Lees verder →</a></p></article></div></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Van model naar praktijk</div><div><h2>Gebruik EAI om iets te doen.</h2><p>De toolbox vertaalt dezelfde vijf vragen naar concrete handelingen voor leerlingen, docenten en teams.</p></div></div>
<div class="card-grid">
<a class="card" href="/werkvormen/kernhandeling-check/"><span class="meta">Start hier</span><h3>Kernhandeling-check</h3><p>Bepaal eerst welke menselijke handeling in deze fase inhoudelijk betekenis moet krijgen.</p><span class="arrow">Open →</span></a>
<a class="card" href="/werkvormen/ai-role-handback-plan/"><span class="meta">Ontwerp</span><h3>AI Role &amp; Handback Plan</h3><p>Maak concreet wat AI doet en waar de relevante handeling teruggaat naar de mens.</p><span class="arrow">Open →</span></a>
<a class="card" href="/werkvormen/bewijs-van-leren/"><span class="meta">Bewijs</span><h3>Bewijs van leren</h3><p>Kies bewijs dat past bij de claim die je over menselijke beheersing wilt kunnen doen.</p><span class="arrow">Open →</span></a>
</div><p style="margin-top:28px"><a href="/werkvormen/">Bekijk alle 57 werkvormen →</a></p></div></section>

<section class="section profile-section"><div class="wrap"><div class="profile-grid">
<div class="profile-photo"><img src="{PORTRAIT_URL}" alt="Hans Visser" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>
<div><div class="kicker">Achter EAI</div><h2>Hans Visser</h2><p class="profile-lede">Onderwijsleider, AI-adviseur en ontwikkelaar van het EAI-model.</p>
<p>EAI ontstond uit een praktische onderwijs­vraag: wanneer AI steeds meer stappen van een taak kan uitvoeren, hoe bepalen we dan welk menselijk handelen voor leren en professioneel oordeel behouden moet blijven?</p>
<p>Ik werk als conrector op het Emmauscollege in Rotterdam en werk daarnaast met scholen en onderwijsorganisaties aan didactische en organisatorische keuzes rond AI.</p>
<div class="button-row"><a class="button secondary" href="/over/">Over EAI en Hans</a><a class="button secondary" href="https://onderwijs-ai.nl/over-ons/team/hans-visser" target="_blank" rel="noopener">Profiel bij Onderwijs AI</a></div></div>
</div></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Publicaties en gesprekken</div><div><h2>Dezelfde vraag, vanuit verschillende kanten.</h2><p>Publicaties, praktijkverhalen en gesprekken laten zien hoe de EAI-lijn zich heeft ontwikkeld.</p></div></div>
<div class="media-feature"><div class="media-copy"><div class="kicker">researchED Nederland Podcast #71</div><h2>AI in ons onderwijs</h2><p>Een gesprek over AI in onderwijs, leren en de keuzes die scholen zelf moeten blijven maken.</p><p class="source-note">9 april 2026 · researchED Nederland</p><div class="button-row"><a class="button secondary" href="https://researched.eu/2026/04/09/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel/" target="_blank" rel="noopener">Bekijk bij researchED</a></div></div>
<div class="embed-card"><div class="embed-top"><span>researchED Nederland</span><span>Podcast #71</span></div><div class="embed-window"><iframe src="https://www.youtube-nocookie.com/embed/4GpAPMdP5hA?rel=0" title="researchED Nederland Podcast #71 met Hans Visser" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></div></div>
<div class="reading-strip publication-links">
<article class="reading"><h3>De gevolgen van AI op toetsing</h3><p>Over leerdoelen, leeractiviteiten en beoordeling wanneer AI delen van het werk kan uitvoeren.</p><a href="https://onderwijs-ai.nl/blog/de-gevolgen-van-ai-toetsing" target="_blank" rel="noopener">Lees bij Onderwijs AI →</a></article>
<article class="reading"><h3>AI als (on)gewenste collega</h3><p>Kennisnet over de manier waarop AI op het Emmauscollege als onderwijs- en organisatievraag wordt benaderd.</p><a href="https://www.kennisnet.nl/artificial-intelligence/nadenken-over-ai-op-je-school-ai-als-ongewenste-collega/" target="_blank" rel="noopener">Lees bij Kennisnet →</a></article>
</div>
<p style="margin-top:28px"><a href="/publicaties/">Alle publicaties en media →</a></p></div></section>
</main>'''

    write(out, "index.html", doc("EAI model voor AI en leren", home_body, "/", "model", description="EAI helpt bepalen welke menselijke handeling in een leer- of professioneel proces betekenis moet houden wanneer AI meedoet."))

    pillars_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Twee pijlers</div><h1>Je hebt beide nodig om goede keuzes te maken.</h1><p class="lede">De ene pijler gaat over leren. De andere over de technologie die steeds meer stappen kan uitvoeren. Het onderwijskundige ontwerp ontstaat waar die twee kennisgebieden elkaar raken.</p></div></section>
<section class="section"><div class="wrap"><figure class="pdf-figure pillar-visual" aria-label="Twee pijlers die samenkomen in de ontwerpvraag"><svg viewBox="0 0 560 220" role="img"><g class="stroke"><rect x="105" y="58" width="82" height="112"/><path d="M126 93c14-10 25 10 39 0M126 113c14-10 25 10 39 0M126 133c14-10 25 10 39 0"/><rect x="373" y="58" width="82" height="112"/><rect x="396" y="92" width="36" height="36"/><path d="M396 100h-12M396 110h-12M396 120h-12M396 130h-12M432 100h12M432 110h12M432 120h12M432 130h12"/></g><path class="dash" d="M187 91c42 0 57 37 83 62M373 91c-42 0-57 37-83 62"/><circle class="accent-fill" cx="280" cy="164" r="8"/></svg><figcaption>De ontwerpvraag ontstaat niet in één pijler, maar precies waar leren en AI elkaar raken.</figcaption></figure></div></section>
<section class="section" id="leren"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 01</div><div><h2>Hoe leren werkt</h2><p>Leren is meer dan een correct eindproduct. De leerling haalt voorkennis op, geeft betekenis, legt relaties, oefent, maakt fouten, kiest, controleert en probeert kennis later opnieuw toe te passen.</p></div></div><div class="panel"><h3>De vraag</h3><p>Welke stap in dit proces moet door de leerling of professional zelf inhoudelijke betekenis krijgen?</p><p>Dat antwoord hangt af van het doel én van waar iemand zich in het proces bevindt. Een uitgewerkte redenering kan tijdens instructie passende steun zijn en tijdens zelfstandig oefenen precies het werk overnemen dat geleerd moest worden.</p></div></div></section>
<section class="section" id="taalmodellen"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 02</div><div><h2>Hoe taalmodellen werken</h2><p>Taalmodellen genereren vanuit patronen en context. Ze kunnen niet alleen formuleren, maar ook structureren, vergelijken, samenvatten, vragen formuleren, feedback geven en vervolgstappen voorstellen.</p></div></div><div class="panel"><h3>De vraag</h3><p>Wat doet het systeem in deze concrete taak feitelijk?</p><p>Niet de hoeveelheid tekst die AI produceert is bepalend. De relevante vraag is welke menselijke handeling door die bijdrage wordt ondersteund, veranderd of uitgevoerd.</p></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Eén taak, twee blikken</div><div><h2>Twee historische bronnen vergelijken.</h2><p>AI kan verschillen aanwijzen, belangen benoemen en een keurige vergelijking schrijven. Voor een docent kan dat efficiënt zijn. Voor een leerling die juist moet leren bronnen te vergelijken en wegen, kan hetzelfde systeem een belangrijk deel van de leerhandeling uitvoeren.</p></div></div><div class="pillars"><article class="pillar"><div class="num">Vanuit leren</div><h3>Wat moet de leerling doen?</h3><p>Bronnen wegen, verschillen betekenis geven en tot een eigen onderbouwde vergelijking komen.</p></article><article class="pillar"><div class="num">Vanuit AI</div><h3>Wat kan het systeem doen?</h3><p>Precies die verschillen selecteren, ordenen, interpreteren en formuleren. De technische mogelijkheid krijgt dus pas betekenis door het leerdoel en de fase.</p></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">De verbinding</div><div><h2>Hier begint EAI.</h2><p>Pas nadat beide pijlers helder zijn, heeft het zin om over een tool, prompt, agent of workflow te praten.</p></div></div><div class="workform"><div><span class="badge">1</span></div><div><strong>Proces en doel</strong><p>Wat probeert deze onderwijsactiviteit op te bouwen of zichtbaar te maken?</p></div><span></span></div><div class="workform"><div><span class="badge">2</span></div><div><strong>Fase / process position</strong><p>Waar bevindt de leerling of professional zich nu in dat proces?</p></div><span></span></div><div class="workform"><div><span class="badge">3</span></div><div><strong>Kernhandeling / core human action</strong><p>Welke menselijke handeling is op dit moment de inhoudelijke kern?</p></div><a href="/werkvormen/kernhandeling-check/">Probeer →</a></div><div class="workform"><div><span class="badge">4</span></div><div><strong>Observed AI action</strong><p>Wat doet het systeem daadwerkelijk in deze taak?</p></div><span></span></div><div class="workform"><div><span class="badge">5</span></div><div><strong>Human evidence</strong><p>Wat moet zichtbaar of opnieuw uitvoerbaar zijn om een claim over menselijk leren of handelen te dragen?</p></div><a href="/werkvormen/bewijs-van-leren/">Probeer →</a></div><p style="margin-top:30px"><a href="/publicaties/de-vraag-die-we-vergeten/">Lees waarom deze volgorde ertoe doet →</a></p></div></section></main>'''
    write(out, "twee-pijlers/index.html", doc("Twee pijlers", pillars_body, "/twee-pijlers/", "pijlers", "Hoe leren werkt en hoe taalmodellen werken: de twee pijlers onder EAI."))

    workshop_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Workshop AI</div><h1>Van twee pijlers naar ontwerp.</h1><p class="lede">De drie workshops volgen steeds dezelfde beweging: kennisbasis, verdieping, een uitgewerkt voorbeeld, reflectie, een werkvorm en een concrete afsluiting. De werkvormen hieronder kun je ook los gebruiken.</p></div></section>
<section class="section"><div class="wrap"><figure class="pdf-figure" aria-label="Drie stappen van Workshop AI"><svg viewBox="0 0 760 210" role="img"><g class="stroke"><path d="M95 112h570"/><circle cx="160" cy="112" r="13"/><circle cx="380" cy="112" r="13"/><circle cx="600" cy="112" r="13"/><rect x="130" y="35" width="60" height="48" rx="4"/><rect x="350" y="35" width="60" height="48" rx="4"/><rect x="570" y="35" width="60" height="48" rx="4"/></g><path class="dash" d="M160 83v16M380 83v16M600 83v16"/><circle class="accent-fill" cx="160" cy="112" r="8"/><circle class="accent-fill" cx="380" cy="112" r="8"/><circle class="accent-fill" cx="600" cy="112" r="8"/><text x="160" y="154" text-anchor="middle" font-size="14" fill="#687487">twee pijlers</text><text x="380" y="154" text-anchor="middle" font-size="14" fill="#687487">wie doet welk werk?</text><text x="600" y="154" text-anchor="middle" font-size="14" fill="#687487">herontwerp</text></svg><figcaption>De workshop beweegt van begrijpen naar analyseren en daarna pas naar ontwerpen.</figcaption></figure></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 1</div><div><h2>Twee pijlers voor AI in onderwijs</h2><p>Eerst scherp krijgen hoe leren werkt én hoe taalmodellen werken. Daarna pas beoordelen wat een AI-toepassing in een onderwijsproces betekent.</p></div></div><div class="workform"><div><span class="badge">Basis</span></div><div><strong>Leg de twee pijlers naast elkaar</strong><p>Bekijk één concrete taak vanuit leren en vanuit de technische mogelijkheden van AI.</p></div><a href="/twee-pijlers/">Open →</a></div><div class="workform"><div><span class="badge">Toollab</span></div><div><strong>Dezelfde vraag, twee omgevingen</strong><p>Vergelijk een algemene AI met een brongebonden omgeving. Wat verandert er door context en bronnen?</p></div><a href="/werkvormen/toollab/">Open →</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 2</div><div><h2>Wie doet welk (denk)werk?</h2><p>Niet de toolkeuze staat centraal, maar de verdeling van menselijk en door AI uitgevoerd werk. Welke handeling moet in deze fase bij de leerling blijven?</p></div></div><div class="workform"><div><span class="badge">Analyse</span></div><div><strong>Task Density scan</strong><p>Ontleed structureren, formuleren, controleren, kiezen, herzien en verantwoorden.</p></div><a href="/werkvormen/task-density-scan/">Open →</a></div><div class="workform"><div><span class="badge">Kern</span></div><div><strong>Kernhandeling-check</strong><p>Bepaal aan welke stap de leerling hier zelf inhoudelijke betekenis moet geven.</p></div><a href="/werkvormen/kernhandeling-check/">Open →</a></div><div class="workform"><div><span class="badge">Diagnose</span></div><div><strong>Foutanalyse</strong><p>Laat de leerling de eerste ontsporing aanwijzen, verklaren en herstellen.</p></div><a href="/werkvormen/foutanalyse/">Open →</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 3</div><div><h2>Van inzicht naar ontwerp</h2><p>Procespositie, kernhandeling, AI-bijdrage en zichtbaar bewijs komen samen in het herontwerp van een taak.</p></div></div><div class="workform"><div><span class="badge">Keuzes</span></div><div><strong>Justification Mapping</strong><p>Maak zichtbaar wat uit AI-suggesties is overgenomen, verworpen of veranderd, en vooral waarom.</p></div><a href="/werkvormen/justification-mapping/">Open →</a></div><div class="workform"><div><span class="badge">Bewijs</span></div><div><strong>Bewijs van leren</strong><p>Kies human evidence dat past bij de handeling waarover je iets wilt kunnen zeggen.</p></div><a href="/werkvormen/bewijs-van-leren/">Open →</a></div><div class="workform"><div><span class="badge">Voorbeeld</span></div><div><strong>Prompt Builder</strong><p>Bekijk hoe taal, context, rol, guardrails en workflow samen bepalen wat een AI-systeem uitvoert.</p></div><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open →</a></div></div></section></main>'''
    write(out, "workshop-ai/index.html", doc("Workshop AI", workshop_body, "/workshop-ai/", "workshop", "Workshopreeks over leren, taalmodellen, denkwerk en herontwerp."))

    workforms = load_workforms()
    workforms_by_slug = {item["slug"]: item for item in workforms}
    workforms_body = render_workforms_index(workforms)
    write(out, "werkvormen/index.html", doc("EAI Toolbox", workforms_body, "/werkvormen/", "werkvormen", "EAI-werkvormen om menselijk handelen, taakverdeling, bewijs en zelfstandigheid zichtbaar te maken."))

    jm_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm · Workshop AI</div><h1>Justification Mapping</h1><p class="lede">AI kan een formulering, argument, samenvatting of andere route voorstellen. Justification Mapping maakt zichtbaar wat de leerling daarvan accepteert, verwerpt of verandert, en waarom.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Waarvoor?</div><div><h2>Niet alleen laten zien dát er een keuze is gemaakt.</h2><p>De werkvorm richt zich op de grens tussen AI-assistentie en menselijk begrip. Een leerling kan een AI-suggestie aanpassen zonder de inhoudelijke afweging zelf te hebben gemaakt. Daarom wordt juist de rationale zichtbaar.</p></div></div><figure class="pdf-figure" aria-label="Justification Mapping van AI-suggestie naar menselijke verantwoording"><svg viewBox="0 0 760 220" role="img"><g class="stroke"><rect x="70" y="74" width="130" height="70" rx="4"/><rect x="315" y="50" width="130" height="70" rx="4"/><rect x="315" y="130" width="130" height="70" rx="4"/><rect x="560" y="74" width="130" height="70" rx="4"/></g><path class="dash" d="M200 109h115M445 85h115M445 165c58 0 72-26 115-45"/><circle class="accent-fill" cx="258" cy="109" r="8"/><text x="135" y="114" text-anchor="middle" font-size="14" fill="#687487">AI-suggestie</text><text x="380" y="92" text-anchor="middle" font-size="14" fill="#687487">accepteren</text><text x="380" y="172" text-anchor="middle" font-size="14" fill="#687487">verwerpen / wijzigen</text><text x="625" y="114" text-anchor="middle" font-size="14" fill="#687487">waarom?</text></svg><figcaption>Niet alleen vastleggen wat veranderde, maar zichtbaar maken waarom de leerling iets overnam, verwierp of herschreef.</figcaption></figure><div class="panel"><h3>Breng één AI-ondersteunde keuze in kaart</h3><ol><li><strong>Suggestie:</strong> wat stelde AI voor?</li><li><strong>Accepteren:</strong> wat heb je overgenomen?</li><li><strong>Verwerpen:</strong> wat heb je bewust niet gebruikt?</li><li><strong>Waarom:</strong> welke inhoudelijke reden lag achter beide keuzes?</li><li><strong>Eigen wijziging:</strong> wat heb je zelf toegevoegd, veranderd of opnieuw opgebouwd?</li><li><strong>Verdedigen:</strong> kun je de uiteindelijke keuze zonder het systeem uitleggen en onderbouwen?</li></ol></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Belangrijk onderscheid</div><div><h2>Dit is procesverantwoording rond AI-assistentie.</h2><p>Binnen deze workshop is Justification Mapping geen algemene methodekeuzekaart. Het doel is zichtbaar maken waar een AI-bijdrage ophoudt en de inhoudelijke afweging van de leerling begint.</p></div></div><p><a class="button" href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Bekijk in Prompt Builder hoe de AI-rol wordt gestuurd</a></p></div></section></main>'''
    write(out, "werkvormen/justification-mapping/index.html", doc("Justification Mapping", append_workform_example(jm_body, workforms_by_slug["justification-mapping"]), "/werkvormen/justification-mapping/", "werkvormen", "Justification Mapping als EAI-werkvorm voor zichtbare keuzes en procesverantwoording."))
    core_action_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Kernhandeling-check</h1><p class="lede">Welke stap moet hier door de leerling of professional zelf betekenis krijgen? In Core-termen: wat is in deze context de relevante <strong>core human action</strong>?</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Werk van buiten naar binnen</h3><ol><li><strong>Proces:</strong> wat moet uiteindelijk geleerd, beheerst of professioneel beoordeeld worden?</li><li><strong>Fase / process position:</strong> waar bevindt de persoon zich nu in dat proces?</li><li><strong>Handelingen:</strong> welke stappen worden hier uitgevoerd?</li><li><strong>Kern:</strong> aan welke stap moet de mens op dit moment zelf inhoudelijke betekenis geven?</li><li><strong>AI-check:</strong> voert AI precies die handeling uit, ondersteunt het eromheen, of doet het iets anders?</li><li><strong>Evidence:</strong> wat moet zichtbaar zijn als je later iets over menselijke beheersing of professioneel oordeel wilt zeggen?</li></ol></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Test</div><div><h2>Haal de AI-bijdrage denkbeeldig weg.</h2><p>Verdwijnt daarmee alleen routinewerk, of verdwijnt de stap waaraan de leerling juist zelf betekenis moest geven? Dat onderscheid bepaalt de volgende ontwerpkeuze.</p></div></div><p><a href="/publicaties/de-vraag-die-we-vergeten/">Lees de redenering achter deze vraag →</a></p></div></section></main>'''
    write(out, "werkvormen/kernhandeling-check/index.html", doc("Kernhandeling-check", append_workform_example(core_action_body, workforms_by_slug["kernhandeling-check"]), "/werkvormen/kernhandeling-check/", "werkvormen", "Bepaal de contextafhankelijke core human action voordat je AI inzet."))
    td_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Task Density scan</h1><p class="lede">Niet hoeveel AI er wordt gebruikt is de kern. De vraag is wie welk betekenisvol werk uitvoert.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Stap 1</div><div><h2>Neem één concrete opdracht.</h2><p>Schrijf niet “AI bij Nederlands” op. Kies één taak waarin een leerling iets moet leren of laten zien.</p></div></div><figure class="pdf-figure" aria-label="Task Density verdeelt handelingen tussen mens en AI"><svg viewBox="0 0 720 230" role="img"><g class="stroke"><circle cx="145" cy="70" r="24"/><path d="M105 155c7-34 23-50 40-50s33 16 40 50"/><rect x="535" y="52" width="72" height="58" rx="4"/><path d="M553 52v-10M571 52v-10M589 52v-10M553 110v10M571 110v10M589 110v10"/></g><path class="dash" d="M200 95h310"/><circle class="accent-fill" cx="285" cy="95" r="7"/><circle class="accent-fill" cx="430" cy="95" r="7"/><text x="145" y="195" text-anchor="middle" font-size="14" fill="#687487">mens</text><text x="570" y="195" text-anchor="middle" font-size="14" fill="#687487">AI</text><text x="360" y="135" text-anchor="middle" font-size="14" fill="#687487">welke handelingen verschuiven?</text></svg><figcaption>Task Density gaat niet om “hoeveel AI”, maar om welke relevante handelingen van actor veranderen.</figcaption></figure><div class="panel"><h3>Maak een kaart van de werkelijke handelingen</h3><ol><li>Ontleed de fase in concrete handelingen en deelhandelingen.</li><li>Noteer per handeling: mens, AI, gedeeld of nog onbekend.</li><li>Beschrijf wanneer AI in beeld komt: vóór, tijdens of na de kernhandeling.</li><li>Noteer welke opties, criteria of routes AI al heeft geselecteerd voordat de mens reageert.</li><li>Bekijk daarna welke menselijke handelingen verdwijnen, verschuiven of een andere betekenis krijgen.</li></ol><p>Gebruik werkwoorden die passen bij de concrete taak. Structureren, formuleren, controleren, kiezen, herzien en verantwoorden zijn voorbeelden, geen vaste checklist.</p></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Stap 2</div><div><h2>Zoek de handeling die ertoe doet.</h2><p>Welke van deze handelingen moet in deze fase door de leerling zelf inhoudelijke betekenis krijgen? Dat is belangrijker dan een totaalpercentage.</p></div></div><div class="panel"><h3>De beslisvraag</h3><p>Als AI deze handeling uitvoert, wat kan ik daarna nog betrouwbaar zeggen over het leren van de leerling?</p></div></div></section></main>'''
    write(out, "werkvormen/task-density-scan/index.html", doc("Task Density scan", append_workform_example(td_body, workforms_by_slug["task-density-scan"]), "/werkvormen/task-density-scan/", "werkvormen", "Analyseer wie welk denkwerk uitvoert in een AI-ondersteunde taak."))

    evidence_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Bewijs van leren</h1><p class="lede">Een goed eindproduct is bewijs van een goed eindproduct. Het is niet automatisch bewijs dat de onderliggende handeling zelfstandig beheerst wordt.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Kies bewust</div><div><h2>Wat wil je eigenlijk kunnen beweren?</h2><p>Lukt het mét hulp? Kan de leerling dezelfde handeling daarna zelfstandig uitvoeren? Kan hij dat later nog? En in een andere situatie?</p></div></div><figure class="pdf-figure" aria-label="Een goed product is niet automatisch bewijs van leren"><svg viewBox="0 0 720 220" role="img"><g class="stroke"><rect x="90" y="65" width="120" height="92"/><path d="M112 92h75M112 112h62M112 132h69"/><circle cx="580" cy="76" r="23"/><path d="M540 162c7-34 23-50 40-50s33 16 40 50"/></g><path class="dash" d="M210 111h116M394 111h146"/><circle class="accent-fill" cx="360" cy="111" r="8"/><text x="150" y="192" text-anchor="middle" font-size="14" fill="#687487">product</text><text x="360" y="192" text-anchor="middle" font-size="14" fill="#687487">≠ automatisch</text><text x="580" y="192" text-anchor="middle" font-size="14" fill="#687487">menselijke beheersing</text></svg><figcaption>Output kan goed zijn terwijl nog onduidelijk is wat de leerling zelfstandig kan uitvoeren.</figcaption></figure><div class="panel"><h3>Drie soorten bewijs</h3><ul><li><strong>Outputbewijs:</strong> laat zien wat is geproduceerd, maar niet vanzelf wie het relevante werk uitvoerde.</li><li><strong>Procesbewijs:</strong> laat keuzes, eerste pogingen, wijzigingen, controles en uitleg zien.</li><li><strong>Zelfstandig bewijs:</strong> laat een nieuwe of vergelijkbare uitvoering zien zonder de relevante AI-bijdrage.</li></ul><p>Retentie en transfer vragen vervolgens een later of betekenisvol ander bewijs-moment. Kies dus eerst welke claim je wilt kunnen doen.</p></div></div></section></main>'''
    write(out, "werkvormen/bewijs-van-leren/index.html", doc("Bewijs van leren", append_workform_example(evidence_body, workforms_by_slug["bewijs-van-leren"]), "/werkvormen/bewijs-van-leren/", "werkvormen", "Kies passend human evidence bij AI-ondersteund leren."))

    first_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>First attempt & version comparison</h1><p class="lede">Laat eerst iets van de leerling zelf ontstaan. Vergelijk daarna wat met hulp veranderde.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Zo werkt het</h3><ol><li>Laat de leerling een korte eerste poging maken zonder AI.</li><li>Gebruik daarna AI voor een vooraf afgesproken vorm van ondersteuning.</li><li>Bewaar beide versies.</li><li>Laat de leerling drie veranderingen aanwijzen.</li><li>Vraag per verandering: wie stelde dit voor, waarom heb je het overgenomen of verworpen, en wat begrijp je nu anders?</li></ol><p>Het doel is niet bewijzen dat de leerling “zonder AI” werkte. Het doel is zichtbaar maken wat vóór en na ondersteuning door de leerling zelf is gedaan.</p></div></div></section></main>'''
    write(out, "werkvormen/first-attempt/index.html", doc("First attempt & version comparison", append_workform_example(first_body, workforms_by_slug["first-attempt"]), "/werkvormen/first-attempt/", "werkvormen", "Vergelijk een eerste eigen poging met een latere AI-ondersteunde versie."))

    error_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Foutanalyse</h1><p class="lede">Een fout verbeteren is iets anders dan een fout herkennen, lokaliseren en verklaren.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Geef niet meteen de oplossing</h3><ol><li>Geef een foutieve redenering, eventueel door AI gegenereerd.</li><li>Laat de leerling aanwijzen waar het voor het eerst misgaat.</li><li>Laat uitleggen waarom die stap niet klopt.</li><li>Vraag wat er vanaf dat punt moet veranderen.</li><li>Laat pas daarna een volledige verbeterde versie maken.</li></ol><p>De kernhandeling ligt bij diagnosticeren en herstellen. AI kan materiaal leveren, maar hoeft het oordeel niet alvast te geven.</p></div></div></section></main>'''
    write(out, "werkvormen/foutanalyse/index.html", doc("Foutanalyse", append_workform_example(error_body, workforms_by_slug["foutanalyse"]), "/werkvormen/foutanalyse/", "werkvormen", "Werkvorm voor zichtbaar diagnosticeren en herstellen van fouten."))

    toollab_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Workshop AI · Toollab</div><h1>Dezelfde vraag, twee omgevingen.</h1><p class="lede">Niet elke AI-omgeving krijgt dezelfde context. Dat verandert wat het systeem kan aannemen, onderbouwen en teruggeven.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Werk in tweetallen</h3><ol><li>Kies een realistische leerlingvraag uit je eigen vak.</li><li>Voer die zonder extra context in een algemene AI in.</li><li>Noteer aannames, gaten en sterke punten in de output.</li><li>Gebruik daarna een brongebonden omgeving en voeg twee tot vier relevante bronnen toe.</li><li>Stel exact dezelfde vraag.</li><li>Vergelijk wat verandert en wat níet wordt opgelost door extra bronnen.</li></ol><p>De opbrengst is niet “welke tool wint?”, maar begrip van wat context, bronnen en systeeminrichting doen met het antwoord.</p></div></div></section></main>'''
    write(out, "werkvormen/toollab/index.html", doc("Toollab", append_workform_example(toollab_body, workforms_by_slug["toollab"]), "/werkvormen/toollab/", "werkvormen", "Vergelijk een algemene AI met een brongebonden omgeving."))

    for item in workforms:
        if item["slug"] in MANUAL_WORKFORMS:
            continue
        write(
            out,
            f'werkvormen/{item["slug"]}/index.html',
            doc(
                item["title"],
                render_catalog_workform(item),
                f'/werkvormen/{item["slug"]}/',
                "werkvormen",
                item["summary"],
            ),
        )


    practice_body = '''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Praktijk</div><h1>Kijken wat er gebeurt als je het bouwt.</h1><p class="lede">De projecten hieronder zijn geen definitie van EAI. Ze laten zien hoe dezelfde vragen in verschillende omgevingen terugkomen: waar zit de mens in het proces, wat voert het systeem uit en wat moet zichtbaar blijven?</p></div></section>
<section class="section"><div class="wrap">
<article class="app-showcase" id="classroom"><div class="app-copy"><span class="app-tag">Lespraktijk · live demo</span><h2>EAI Classroom</h2><p>Van leerdoel en succescriteria naar verwachte misconcepties, interventies en zichtbaar leerlingwerk. De omgeving laat vooral zien hoe didactische keuzes vóór de AI-interactie kunnen worden vastgelegd.</p><div class="button-row"><a class="button" href="https://eaiclassroom.lovable.app" target="_blank" rel="noopener">Open volledig</a><a class="button secondary" href="/twee-pijlers/">Bekijk de twee pijlers</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>eaiclassroom.lovable.app</span></div><div class="embed-window app"><iframe src="https://eaiclassroom.lovable.app" title="EAI Classroom live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
<article class="app-showcase" id="hub"><div class="app-copy"><span class="app-tag">Leeromgeving · live demo</span><h2>EAIHUB</h2><p>Een leeromgeving waarin de positie in het leerproces en de rol van ondersteuning centraal staan. Niet alleen het antwoord telt, maar ook wat de leerling zelf nog moet doen en laten zien.</p><div class="button-row"><a class="button" href="https://eaihub.lovable.app" target="_blank" rel="noopener">Open volledig</a><a class="button secondary" href="/werkvormen/">Naar de werkvormen</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>eaihub.lovable.app</span></div><div class="embed-window app"><iframe src="https://eaihub.lovable.app" title="EAIHUB live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
<article class="app-showcase" id="regio"><div class="app-copy"><span class="app-tag">Andere context · live demo</span><h2>Demo Regio</h2><p>EAI hoeft niet te stoppen bij een les of leerlingtaak. Deze demonstrator laat zien hoe dezelfde ontwerpvragen ook in een andere context kunnen worden uitgewerkt: wat is het menselijke proces, welke rol krijgt AI en waar moeten keuzes herleidbaar blijven?</p><div class="button-row"><a class="button" href="https://demo-regio.lovable.app" target="_blank" rel="noopener">Open volledig</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>demo-regio.lovable.app</span></div><div class="embed-window app"><iframe src="https://demo-regio.lovable.app" title="Demo Regio live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
</div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Ontwerpen</div><div><h2>Van principe naar systeemgedrag.</h2><p>De live omgevingen hierboven laten het resultaat zien. De Prompt Builder zit één stap eerder: welke instructies, context, grenzen en workflows sturen het systeemgedrag?</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Taal & systeem</div><h2>Prompt Builder</h2><p>Maak de rol van AI expliciet en vertaal didactische keuzes naar taal, context, guardrails en workflow.</p><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder →</a></article><article class="tool-card"><div class="kicker">Werkvorm</div><h2>Justification Mapping</h2><p>Maak zichtbaar wat uit AI-suggesties is overgenomen, verworpen of veranderd en waarom.</p><a href="/werkvormen/justification-mapping/">Open de werkvorm →</a></article></div></div></section>
</main>'''
    write(out, "praktijk/index.html", doc("Praktijk", practice_body, "/praktijk/", "praktijk", "Live voorbeelden van EAI in verschillende contexten: EAI Classroom, EAIHUB, Demo Regio en Prompt Builder."))

    over_body = f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Over EAI</div><h1>Ontstaan vanuit de onderwijspraktijk.</h1><p class="lede">EAI is ontwikkeld om een praktische vraag scherper te beantwoorden: wat moet een leerling of professional zelf blijven doen wanneer AI steeds meer stappen van een taak kan uitvoeren?</p></div></section>
<section class="section"><div class="wrap"><div class="profile-grid profile-grid--wide">
<div class="profile-photo"><img src="{PORTRAIT_URL}" alt="Hans Visser" loading="eager" decoding="async" referrerpolicy="no-referrer"></div>
<div><div class="kicker">Hans Visser</div><h2>Onderwijsleider en ontwikkelaar van EAI.</h2>
<p class="profile-lede">Conrector op het Emmauscollege in Rotterdam. Daarnaast actief als AI-adviseur en spreker rond AI, leren en onderwijsontwerp.</p>
<p>Mijn vertrekpunt is meestal niet: welke AI-tool zullen we gebruiken? Ik wil eerst weten wat er in het leren of professionele handelen moet gebeuren. Welke keuze, analyse, fout, afweging of uitvoering moet bij de mens blijven? Pas daarna krijgt AI een rol.</p>
<p>Die manier van kijken groeide vanuit schoolpraktijk, experimenten met AI en gesprekken met docenten, leerlingen, schoolleiders en ontwikkelaars. EAI maakt die afweging expliciet: proces en doel, fase, kernhandeling, taakverdeling en bewijs.</p>
<div class="button-row"><a class="button secondary" href="https://onderwijs-ai.nl/over-ons/team/hans-visser" target="_blank" rel="noopener">Onderwijs AI-profiel</a><a class="button secondary" href="https://nl.linkedin.com/in/hans-visser-92531a105" target="_blank" rel="noopener">LinkedIn</a></div>
<p class="source-note">Portret wordt rechtstreeks geladen vanaf het openbare Onderwijs AI-profiel.</p>
</div></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Wat EAI probeert te voorkomen</div><div><h2>Een nette output verwarren met menselijk leren of oordeel.</h2><p>AI kan een sterke tekst, uitleg, diagnose of aanbeveling produceren. EAI vraagt daarom steeds wat die output nog bewijst over de mens die ermee werkte.</p></div></div>
<div class="model-principles"><article><span>01</span><h3>Begin bij het proces</h3><p>Welke ontwikkeling of professionele taak staat hier centraal?</p></article><article><span>02</span><h3>Kijk naar de fase</h3><p>Dezelfde AI-hulp kan in instructie passend zijn en tijdens zelfstandige uitvoering te veel overnemen.</p></article><article><span>03</span><h3>Benoem de kernhandeling</h3><p>Welke menselijke handeling moet op dit moment zelf betekenis krijgen?</p></article><article><span>04</span><h3>Maak taakverdeling zichtbaar</h3><p>Welke stap doet de mens, welke AI, en in welke volgorde?</p></article><article><span>05</span><h3>Kies passend bewijs</h3><p>Wat moet je daarna zien om iets te kunnen zeggen over menselijke beheersing?</p></article></div>
</div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Publiek werk</div><div><h2>Van schoolpraktijk naar publicaties en gesprekken.</h2><p>Een paar openbare plekken waar dezelfde lijn terugkomt.</p></div></div>
<div class="publication-grid">
<a class="publication-card" href="https://www.kennisnet.nl/artificial-intelligence/nadenken-over-ai-op-je-school-ai-als-ongewenste-collega/" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Kennisnet · 2025</span><h3>AI als (on)gewenste collega</h3><p>Praktijkverhaal over AI op school, regie en de vraag welke taken je technologie wel en niet geeft.</p><span class="arrow">Lees →</span></div></a>
<a class="publication-card" href="https://onderwijs-ai.nl/blog/de-gevolgen-van-ai-toetsing" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Onderwijs AI · 2026</span><h3>De gevolgen van AI op toetsing</h3><p>Over leerdoelen, leeractiviteiten, bewijs van leren en toetsing in een wereld met generatieve AI.</p><span class="arrow">Lees →</span></div></a>
<a class="publication-card publication-card--image" href="https://researched.eu/2026/04/09/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel/" target="_blank" rel="noopener"><img src="{RESEARCHED_THUMB_URL}" alt="researchED Nederland Podcast #71" loading="lazy" decoding="async" referrerpolicy="no-referrer"><div class="publication-card__body"><span class="meta">researchED · 2026</span><h3>AI in ons onderwijs</h3><p>Podcastgesprek over AI en onderwijspraktijk.</p><span class="arrow">Bekijk →</span></div></a>
</div></div></section>
</main>'''
    write(out, "over/index.html", doc("Over EAI en Hans Visser", over_body, "/over/", "over", "Over het EAI-model en Hans Visser, onderwijsleider en ontwikkelaar van EAI."))

    article_source = Path("content/de-vraag-die-we-vergeten.html")
    if not article_source.exists():
        raise SystemExit("Missing content/de-vraag-die-we-vergeten.html")
    write(out, "publicaties/de-vraag-die-we-vergeten/index.html", render_article_fragment(
        article_source,
        "De vraag die we vergeten in het AI-debat",
        "/publicaties/de-vraag-die-we-vergeten/",
        "Over AI, leren en professioneel handelen: begin bij het leerproces en de kernhandeling, pas daarna bij de technologie.",
    ))

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
        excerpt = PUBLICATION_INTROS.get(slug, first_excerpt(source))
        pub_cards.append(f'<a class="card" href="/publicaties/{slug}/"><span class="meta">{esc(kind)}</span><h3>{esc(title)}</h3><p>{esc(excerpt)}</p><span class="arrow">Lees →</span></a>')
        write(out, f"publicaties/{slug}/index.html", inject_embed(source, f"/publicaties/{slug}/", title))
        write(out, f"eai-blog/{legacy[slug]}/index.html", redirect(f"/publicaties/{slug}/"))

    pubs_body = f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Publicaties & media</div><h1>Lees, kijk en luister verder.</h1><p class="lede">Eigen EAI-publicaties staan hier naast openbare artikelen en gesprekken waarin dezelfde vragen over leren, menselijk handelen en AI terugkomen.</p></div></section>
<section class="section"><div class="wrap"><article class="feature-publication"><div><div class="kicker">Start hier</div><h2>De vraag die we vergeten in het AI-debat</h2><p>De kern van EAI in gewone taal: begin bij het proces, de fase en de kernhandeling. Bepaal daarna pas wat AI mag doen.</p><p><a class="button" href="/publicaties/de-vraag-die-we-vergeten/">Lees het artikel</a></p></div><div class="question-mark">?</div></article></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Eigen publicaties</div><div><h2>De ontwikkellijn van EAI.</h2><p>Deze stukken laten zien hoe begrippen als Task Density, handback, bewijs en menselijke uitvoering zich hebben ontwikkeld.</p></div></div><div class="card-grid">{"".join(pub_cards)}</div></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Openbare publicaties</div><div><h2>EAI buiten deze site.</h2><p>Artikelen en praktijkverhalen waarin Hans Visser als auteur, mede-auteur of geïnterviewde voorkomt.</p></div></div>
<div class="publication-grid">
<a class="publication-card publication-card--image" href="https://onderwijs-ai.nl/over-ons/team/hans-visser" target="_blank" rel="noopener"><img src="{PORTRAIT_URL}" alt="Hans Visser" loading="lazy" decoding="async" referrerpolicy="no-referrer"><div class="publication-card__body"><span class="meta">Onderwijs AI</span><h3>Profiel en publicaties</h3><p>Publiek profiel met achtergrond en artikelen.</p><span class="arrow">Open →</span></div></a>
<a class="publication-card" href="https://onderwijs-ai.nl/blog/de-gevolgen-van-ai-toetsing" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Onderwijs AI · 8 mei 2026</span><h3>De gevolgen van AI op toetsing</h3><p>Over leerdoelen, leeractiviteiten en beoordeling wanneer AI delen van het werk kan uitvoeren.</p><span class="arrow">Lees →</span></div></a>
<a class="publication-card" href="https://onderwijs-ai.nl/blog/ai-implementatie-onderwijs-gedragsverandering" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Onderwijs AI · 20 september 2026</span><h3>AI-implementaties in kleine stappen</h3><p>Over gedragsverandering en dagelijkse routines bij invoering van AI in onderwijsorganisaties.</p><span class="arrow">Lees →</span></div></a>
<a class="publication-card" href="https://www.kennisnet.nl/artificial-intelligence/nadenken-over-ai-op-je-school-ai-als-ongewenste-collega/" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Kennisnet · 13 februari 2025</span><h3>AI als (on)gewenste collega</h3><p>Praktijkverhaal over het Emmauscollege, AI als collega en regie bij de mens.</p><span class="arrow">Lees →</span></div></a>
</div></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Kijken & luisteren</div><div><h2>researchED Nederland Podcast #71</h2><p>Hans Visser in gesprek met Jan van de Ven en Erik Ex over AI in het onderwijs.</p></div></div>
<div class="media-feature"><div class="media-copy"><img class="media-thumb" src="{RESEARCHED_THUMB_URL}" alt="researchED Nederland Podcast #71" loading="lazy" decoding="async" referrerpolicy="no-referrer"><p class="source-note">9 april 2026 · 48 minuten</p><div class="button-row"><a class="button secondary" href="https://researched.eu/2026/04/09/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel/" target="_blank" rel="noopener">researchED</a><a class="button secondary" href="https://open.spotify.com/episode/4ORaDFgdorGuJsP44N0T9E" target="_blank" rel="noopener">Spotify</a></div></div>
<div class="media-embeds"><div class="embed-card"><div class="embed-top"><span>Video</span><span>YouTube</span></div><div class="embed-window"><iframe src="https://www.youtube-nocookie.com/embed/4GpAPMdP5hA?rel=0" title="researchED Nederland Podcast #71 met Hans Visser" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></div>
<div class="embed-card"><div class="embed-top"><span>Audio</span><span>Spotify</span></div><div class="spotify-window"><iframe style="border-radius:12px" src="https://open.spotify.com/embed/episode/4ORaDFgdorGuJsP44N0T9E?utm_source=generator" width="100%" height="232" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div></div></div>
</div></div></section>
</main>'''
    write(out, "publicaties/index.html", doc("Publicaties", pubs_body, "/publicaties/", "publicaties", "Artikelen en analyses van EAI over AI, leren en professioneel handelen."))
    write(out, "eai-blog/index.html", redirect("/publicaties/"))

    tools_body = f'''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Tools</div><h1>Begin bij de vraag, niet bij de tool.</h1><p class="lede">Elke toepassing hieronder helpt bij een ander deel van het denk- of ontwerpproces. Geen van deze tools bewijst op zichzelf dat er geleerd is.</p></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Begrijpen & analyseren</div><div><h2>Wat gebeurt er met het denkwerk?</h2><p>Gebruik deze toepassingen om een bestaande taak of AI-interactie vanuit het leerproces te bekijken.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Analyse</div><h2>EAI Toolanalyse</h2><p>Bekijk een AI-toepassing op leerwaarde en didactische invloed. Gebruik de uitkomst als start van een professionele afweging, niet als automatisch oordeel.</p><a href="https://subtle-churros-4d44d5.netlify.app" target="_blank" rel="noopener">Open tool →</a></article><article class="tool-card"><div class="kicker">Interactief</div><h2>Act of Learning Game</h2><p>Verken de vraag wie in een concrete situatie het relevante denkwerk uitvoert.</p><a href="https://rainbow-tarsier-a88e9b.netlify.app/" target="_blank" rel="noopener">Open tool →</a></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Ontwerpen</div><div><h2>Wat wil je dat AI hier doet?</h2><p>Zodra leerdoel, fase en kernhandeling helder zijn, kun je de technische interactie veel preciezer ontwerpen.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Taal & systeem</div><h2>Prompt Builder · Sturen met taal</h2><p>Breng prompt, system prompt, RAG, guardrails, workflow en agentgedrag in samenhang. De woorden zijn geen decoratie; ze sturen de rol die het systeem krijgt.</p><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder →</a></article><article class="tool-card"><div class="kicker">Lesontwerp</div><h2>EAI What-If Machine</h2><p>Verken hoe een andere keuze in taak of AI-inzet het ontwerp verandert.</p><a href="https://what-if-lesson-designer.lovable.app/" target="_blank" rel="noopener">Open tool →</a></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Verdiepen</div><div><h2>Werk verder vanuit de publicaties.</h2><p>Deze toolkits horen bij eerdere EAI-publicaties en blijven bruikbaar als verdieping.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Toolkit</div><h2>Beyond Explainability</h2><p>Werk praktisch met de ideeën achter Didactic Controllability en Task Density.</p><a href="/tools/beyond-explainability/">Bekijk toolkit →</a></article><article class="tool-card"><div class="kicker">Toolkit · English</div><h2>The Act of Learning</h2><p>Engelstalige toolkit bij de publicatie over Reverse Scaffolding en zichtbaar leren.</p><a href="https://effortless-fenglisu-71cd58.netlify.app/" target="_blank" rel="noopener">Open toolkit →</a></article></div><p class="mini-note" style="margin-top:30px">Het EAA Model staat als afzonderlijk, ouder project nog beschikbaar via <a href="/eaa-model/">EAA Model</a>, maar vormt niet de actuele Core-laag van deze site.</p></div></section></main>'''
    write(out, "tools/index.html", doc("Tools", tools_body, "/tools/", "tools", "EAI-tools en werkvormen voor analyse, ontwerp en verdieping rond AI en leren."))
    write(out, "eai-tools-modules/index.html", redirect("/tools/"))

    toolkit = scrape / "eai-tools-modules-eai-toolkit-beyond-explainability-embed1.html"
    write(out, "tools/beyond-explainability/index.html", inject_embed(toolkit, "/tools/beyond-explainability/", "EAI Toolkit: Beyond Explainability", "/tools/"))

    eaa_body = '<main><section class="page-hero"><div class="wrap"><div class="eyebrow">EAA Model</div><h1>Eigenaarschap. Autonomie. Agency.</h1><p class="lede">Het EAA-model richt zich op menselijk leren, motivatie en regie. Het staat naast EAI en kan ook zonder AI worden gebruikt.</p><p><a class="button" href="https://sunny-blancmange-dec4a1.netlify.app" target="_blank" rel="noopener">Open de EAA Model Tool</a></p></div></section></main>'
    write(out, "eaa-model/index.html", doc("EAA Model", eaa_body, "/eaa-model/", description="EAA — eigenaarschap, autonomie en agency in leren."))

    onderwijs = scrape / "onderwijsin-embed1.html"
    write(out, "onderwijsin/index.html", inject_embed(onderwijs, "/onderwijsin/", "OnderwijsIn — technische anatomie", "/"))

    redirects = {
        "eai-toolanalyse": "https://subtle-churros-4d44d5.netlify.app",
        "eai-eduprompt-builder": "https://eai-prompt.lovable.app/",
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
    urls = ["/", "/twee-pijlers/", "/workshop-ai/", "/werkvormen/", "/praktijk/", "/publicaties/", "/publicaties/de-vraag-die-we-vergeten/", "/tools/", "/eaa-model/", "/onderwijsin/"] + [f"/werkvormen/{item['slug']}/" for item in workforms] + [f"/publicaties/{slug}/" for slug, _, _, _ in PUBLICATIONS] + ["/tools/beyond-explainability/"]
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
