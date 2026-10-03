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
    ("analyse", "Eerst begrijpen wat er verandert", "Pak één concrete taak. Wat moet de leerling leren, waar zit hij in dat leren en wat doet AI precies op die plek?"),
    ("zichtbaar", "Zichtbaar maken wat de leerling zelf deed", "Maak eerste pogingen, keuzes en veranderingen zichtbaar. Niet om elk klikje te volgen, maar om te zien waar de leerling zelf betekenis gaf."),
    ("zelfstandigheid", "Kijken wat de leerling zelf kan", "Geef de relevante handeling na hulp weer terug aan de leerling en kijk wat er dan nog zelfstandig beschikbaar is."),
    ("bewijs", "Niet alleen naar het eindproduct kijken", "Een goed product is nog geen bewijs van leren. Kijk ook wat de leerling zelfstandig, later en in een andere situatie kan."),
    ("herstellen", "Feedback gebruiken om opnieuw te doen", "Laat feedback leiden tot een nieuwe handeling van de leerling. De verbetering zelf blijft dus niet bij AI liggen."),
    ("zelfregulatie", "Zelf sturen en controleren", "Laat de leerling zelf bepalen waar hij vastloopt, wat hij gaat proberen en waaraan hij ziet of dat werkt."),
    ("argumentatie", "Argumenteren en bronnen wegen", "Houd bronkeuze, afweging, tegenargument en conclusie zichtbaar bij de leerling waar juist die stappen geleerd moeten worden."),
    ("professioneel-oordeel", "Professioneel oordeel", "Houd uit elkaar wat je werkelijk ziet, wat je daaruit afleidt en welk besluit je vervolgens neemt."),
    ("scaffolding", "Hulp geven zonder de stap over te nemen", "Geef precies genoeg hulp om de leerling verder te laten komen en bouw die hulp weer af zodra dat kan."),
    ("ontwerpen", "Een taak of toets opnieuw ontwerpen", "Begin bij het leren. Bepaal daarna welke rol AI krijgt en waar de leerling iets opnieuw zelf moet laten zien."),
]
WORKFORM_AUDIENCE_LABELS = {"learner": "Leerling", "teacher": "Docent", "team": "Team"}
WORKFORM_EVIDENCE_LABELS = {
    "design": "Ontwerp",
    "process": "Proces",
    "independent": "Zelfstandig",
    "retention": "Later nog",
    "transfer": "Andere situatie",
}
WORKFORM_ROUTE_LABELS = {
    "proces": "Proces",
    "fase": "Fase",
    "kernhandeling": "Kernhandeling",
    "taakdichtheid": "Wat doet AI?",
    "output": "Wat kun je nu zeggen?",
}

WORKFORM_INTENTS = [
    ("orient", "Eerst scherp krijgen wat er verandert", "Ik wil een taak eerst goed bekijken voordat ik iets aan AI verander."),
    ("diagnose", "Zien waar de leerling vastloopt", "Ik wil weten waar het voor het eerst misgaat of welke verklaring het beste past."),
    ("support", "Hulp geven zonder de stap over te nemen", "Ik wil ondersteunen, maar de relevante handeling bij de leerling houden."),
    ("return", "Een handeling teruggeven", "AI of ikzelf nam tijdelijk iets over; nu moet de leerling het weer zelf doen."),
    ("independent", "Kijken wat de leerling zelf kan", "Ik wil niet alleen het product zien, maar zelfstandige uitvoering."),
    ("retention-transfer", "Kijken of het later of ergens anders ook lukt", "Ik wil weten of het geleerde beschikbaar blijft buiten deze ene taak."),
    ("feedback", "Feedback laten leiden tot zelf verbeteren", "De leerling moet na feedback zelf weer handelen."),
    ("selfreg", "De regie bij de leerling houden", "Ik wil dat de leerling zelf plant, controleert, hulp kiest of bijstuurt."),
    ("argument", "Argumenten, bronnen en conclusies laten wegen", "De inhoudelijke afweging moet zichtbaar bij de leerling blijven."),
    ("professional", "Mijn professionele oordeel zelf vormen", "Ik wil AI gebruiken zonder observatie, interpretatie en besluit in elkaar te laten schuiven."),
    ("redesign", "Een taak, toets of AI-rol herontwerpen", "Ik wil vanuit het leren opnieuw bepalen wie welke handeling uitvoert."),
    ("make-visible", "Keuzes en proces zichtbaar maken", "Ik wil zien wat de leerling met een AI-bijdrage deed en waarom."),
]


PRIMARY_WORKFORM_ROUTES = [
    {
        "key": "diagnose",
        "title": "Ik wil zien waar het misgaat",
        "description": "Eerst begrijpen waar een leerling vastloopt voordat je hulp kiest.",
        "intents": ["diagnose"],
        "featured": ["find-my-impasse", "first-breakdown", "discriminating-probe", "foutanalyse"],
    },
    {
        "key": "support",
        "title": "Ik wil helpen zonder het over te nemen",
        "description": "Geef precies genoeg steun zodat de leerling zelf verder kan.",
        "intents": ["support", "feedback"],
        "featured": ["least-intrusive-support", "eliciting-question", "feedback-without-rewrite", "model-then-reperform"],
    },
    {
        "key": "independent",
        "title": "Ik wil weten wat de leerling zelf kan",
        "description": "Geef de handeling terug en kijk wat zonder dezelfde inhoudelijke hulp lukt.",
        "intents": ["independent", "return", "retention-transfer"],
        "featured": ["controlled-detachment", "hand-back-the-action", "fresh-item-same-operation", "delayed-reperformance"],
    },
    {
        "key": "visible",
        "title": "Ik wil keuzes en AI-gebruik zichtbaar maken",
        "description": "Zie wat de leerling zelf koos, veranderde, controleerde of verwierp.",
        "intents": ["make-visible", "selfreg", "argument"],
        "featured": ["first-attempt", "justification-mapping", "trace-back-prompting", "accept-adapt-reject"],
    },
    {
        "key": "redesign",
        "title": "Ik wil een taak of toets anders ontwerpen",
        "description": "Bepaal opnieuw wat de leerling doet, wat AI doet en welk bewijs je nodig hebt.",
        "intents": ["redesign", "orient"],
        "featured": ["kernhandeling-check", "task-density-scan", "ai-role-handback-plan", "assessment-redesign"],
    },
    {
        "key": "professional",
        "title": "Ik wil mijn professionele oordeel zelf vormen",
        "description": "Houd observatie, interpretatie, leerlingstem en besluit uit elkaar.",
        "intents": ["professional"],
        "featured": ["observation-vs-inference", "reconstruct-professional-judgement", "learner-voice-check", "proportionate-follow-up"],
    },
]

WORKFORM_MECHANISMS = {
    "analyse": {
        "title": "Eerst het leren en de taak begrijpen",
        "text": "Onderzoek naar AI in onderwijs laat geen simpel effect van 'wel of geen AI' zien. Het maakt uit welke rol AI krijgt, welke taak wordt uitgevoerd en welk menselijk werk overblijft. Daarom begint EAI met de concrete situatie en niet met een toolcategorie.",
        "basis": "EAI evidence claims CLM-001, CLM-005 en CLM-015",
        "anchor": "taak-en-ai",
    },
    "zichtbaar": {
        "title": "Een eindproduct laat het proces niet vanzelf zien",
        "text": "Wanneer AI meeschrijft of voorstellen doet, wordt de uiteindelijke output een zwakker spoor van wie welke keuze maakte. Procesinformatie, een eerste poging of een korte reconstructie kan die menselijke afweging weer zichtbaar maken.",
        "basis": "EAI evidence semantics en process-trace patronen",
        "anchor": "proces-en-bewijs",
    },
    "zelfstandigheid": {
        "title": "Ondersteunde prestatie is niet hetzelfde als zelfstandig kunnen",
        "text": "Een leerling kan met AI sterk presteren terwijl nog onbekend is of dezelfde handeling zonder die ondersteuning beschikbaar is. Daarom gebruikt EAI nieuwe uitvoering en gerichte handback wanneer zelfstandigheid de vraag is.",
        "basis": "CLM-002, CLM-003 en CLM-009",
        "anchor": "zelfstandigheid",
    },
    "bewijs": {
        "title": "Bewijs moet passen bij wat je wilt kunnen zeggen",
        "text": "Een product, een zelfstandige poging, later opnieuw uitvoeren en toepassen in een andere situatie zijn verschillende soorten bewijs. Ze mogen niet als één en dezelfde uitspraak over leren worden behandeld.",
        "basis": "CLM-009 en CLM-010",
        "anchor": "bewijs",
    },
    "herstellen": {
        "title": "Feedback wordt pas interessant wanneer de leerling daarna weer handelt",
        "text": "Feedback kan richting geven, maar wanneer de correctie zelf volledig wordt uitgevoerd door AI ontstaat weinig nieuw zicht op de leerlinghandeling. Daarom eindigen deze werkvormen in eigen revisie, controle of een nieuwe poging.",
        "basis": "feedbackliteratuur + EAI learner-reperformance",
        "anchor": "feedback",
    },
    "zelfregulatie": {
        "title": "Plannen, monitoren en hulp kiezen kunnen zelf leerhandelingen zijn",
        "text": "Zelfregulatie bestaat niet alleen uit 'zelfstandig werken'. Doelen stellen, voortgang controleren, een impasse herkennen, hulp kiezen en een strategie aanpassen zijn afzonderlijke handelingen die AI ook kan overnemen.",
        "basis": "self-regulated learning + EAI self-regulation registry",
        "anchor": "zelfregulatie",
    },
    "argumentatie": {
        "title": "Kritisch denken wordt concreet in afzonderlijke handelingen",
        "text": "Bronnen beoordelen, een verborgen aanname herkennen, perspectieven wegen en een conclusie begrenzen zijn verschillende activiteiten. Door ze uit elkaar te halen wordt zichtbaar waar AI helpt en waar de leerling zelf moet redeneren.",
        "basis": "EAI argumentation microstructure registry",
        "anchor": "argumentatie",
    },
    "professioneel-oordeel": {
        "title": "Een AI-advies is niet hetzelfde als professioneel oordeel",
        "text": "Bij professioneel handelen tellen niet alleen uitkomst en efficiëntie, maar ook observatie, interpretatie, onzekerheid, leerlingperspectief en verantwoordelijkheid. Die menselijke oordeelsvorming moet van een AI-aanbeveling te onderscheiden blijven.",
        "basis": "CLM-007, CLM-008 en pedagogical judgement registry",
        "anchor": "professioneel-oordeel",
    },
    "scaffolding": {
        "title": "Goede hulp is tijdelijk, passend en laat de leerling weer verder handelen",
        "text": "Scaffolding draait om afgestemde ondersteuning, het verminderen van hulp en het teruggeven van verantwoordelijkheid. AI maakt zeer veel hulp goedkoop beschikbaar; daardoor wordt juist de vraag hoeveel hulp hier nodig is belangrijker.",
        "basis": "scaffoldingliteratuur + CLM-003, CLM-004 en CLM-005",
        "anchor": "scaffolding",
    },
    "ontwerpen": {
        "title": "Ontwerp vanuit het leerdoel, niet vanuit de beschikbare AI-functie",
        "text": "Dezelfde AI-actie kan in instructie behulpzaam zijn en tijdens zelfstandige uitvoering de relevante leerhandeling vervangen. Daarom koppelt EAI taakontwerp en toetsing aan fase, kernhandeling en passend bewijs.",
        "basis": "CLM-001, CLM-009 en CLM-015",
        "anchor": "ontwerp",
    },
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

def load_didactic_models() -> dict:
    return json.loads(Path("content/didactic-models.json").read_text(encoding="utf-8"))

def render_route(route: list[str]) -> str:
    parts = []
    active = set(route)
    for key in ["proces", "fase", "kernhandeling", "taakdichtheid", "output"]:
        state = " is-active" if key in active else ""
        parts.append(f'<span class="route-chip{state}">{esc(WORKFORM_ROUTE_LABELS[key])}</span>')
    return '<div class="eai-route" aria-label="Plaats in de EAI-kijkvorm">' + "".join(parts) + "</div>"

def render_toolbox_card(item: dict) -> str:
    action = item.get("action_layer", {})
    verbs = action.get("verbs", {})
    teacher = verbs.get("teacher", [])[:3]
    learner = verbs.get("learner", [])[:3]
    intents = " ".join(action.get("intents", []))
    evidence = " ".join(item.get("evidence", []))
    audience = " ".join(item.get("audience", []))
    public_title = item.get("public_title", item["title"])
    search_parts = [
        public_title,
        item.get("title", ""),
        item.get("summary", ""),
        item.get("question", ""),
        " ".join(teacher),
        " ".join(learner),
        item.get("category", ""),
    ]
    search_text = " ".join(search_parts).lower()
    teacher_chain = '<span class="action-arrow">→</span>'.join(f'<b>{esc(value)}</b>' for value in teacher)
    learner_chain = '<span class="action-arrow">→</span>'.join(f'<b>{esc(value)}</b>' for value in learner)
    return (
        f'<article class="toolbox-result-card" data-workform-card data-slug="{esc(item["slug"])}" '
        f'data-category="{esc(item["category"])}" data-audience="{esc(audience)}" '
        f'data-evidence="{esc(evidence)}" data-intents="{esc(intents)}" data-search="{esc(search_text)}">'
        f'<div class="toolbox-result-top"><span class="toolbox-result-kicker">Werkvorm</span>'
        f'<button type="button" class="save-workform" data-save-slug="{esc(item["slug"])}" aria-pressed="false">Bewaar</button></div>'
        f'<h3>{esc(public_title)}</h3><p class="toolbox-result-summary">{esc(item["summary"])}</p>'
        f'<div class="toolbox-result-actions">'
        f'<div><span>Docent</span><p>{teacher_chain}</p></div>'
        f'<div><span>Leerling</span><p>{learner_chain}</p></div>'
        f'</div>'
        f'<a class="toolbox-result-link" href="/werkvormen/{esc(item["slug"])}/">Bekijk hoe →</a>'
        f'</article>'
    )

def render_workforms_index(items: list[dict], didactic_models: dict) -> str:
    cards = "".join(render_toolbox_card(item) for item in items)

    route_buttons = "".join(
        f'<button type="button" class="toolbox-route" data-route-key="{esc(route["key"])}" '
        f'data-route-intents="{esc(" ".join(route["intents"]))}" '
        f'data-route-featured="{esc(" ".join(route["featured"]))}" aria-pressed="false">'
        f'<span>{idx:02d}</span><strong>{esc(route["title"])}</strong><small>{esc(route["description"])}</small></button>'
        for idx, route in enumerate(PRIMARY_WORKFORM_ROUTES, start=1)
    )

    model_buttons = "".join(
        f'<button type="button" class="didactic-model-button" data-model-choice="{esc(model["id"])}" aria-pressed="false">'
        f'<span>{esc(model["short_name"])}</span><strong>{esc(model["name"])}</strong>'
        f'<small>{len(model["phases"])} {"fasen" if "phases" in model["kind"] else "functies"} · EAI Standard adapter {esc(model["adapter_id"])}</small></button>'
        for model in didactic_models["models"]
    )

    model_panels = []
    for model in didactic_models["models"]:
        phase_buttons = "".join(
            f'<button type="button" class="didactic-phase" data-phase-choice '
            f'data-model-name="{esc(model["short_name"])}" data-phase-name="{esc(phase["label"])}" '
            f'data-phase-purpose="{esc(phase["purpose"])}" data-phase-question="{esc(phase["eai_question"])}" '
            f'data-phase-workforms="{esc(" ".join(phase["workforms"]))}" aria-pressed="false">'
            f'<span>{int(phase["order"]):02d}</span><strong>{esc(phase["label"])}</strong>'
            f'<small>{esc(phase["purpose"])}</small></button>'
            for phase in model["phases"]
        )
        cross_cutting = "".join(f'<span>{esc(value)}</span>' for value in model.get("cross_cutting", []))
        model_panels.append(
            f'<section class="didactic-model-detail" data-model-panel="{esc(model["id"])}" hidden>'
            f'<div class="didactic-model-detail-head"><div><div class="kicker">Bronmodel</div>'
            f'<h3>{esc(model["name"])}</h3><p>{esc(model["intro"])}</p></div>'
            f'<div class="didactic-model-source"><span>{esc(model["source_reference"])}</span>'
            f'<a href="{esc(model["source_url"])}" target="_blank" rel="noopener">Bronmodel ↗</a>'
            f'<a href="{esc(model["standard_url"])}" target="_blank" rel="noopener">EAI-adapter ↗</a></div></div>'
            f'<div class="didactic-phase-grid">{phase_buttons}</div>'
            f'<div class="didactic-cross-cutting"><strong>Loopt door meerdere fasen heen</strong>{cross_cutting}</div>'
            f'</section>'
        )
    model_panels_html = "".join(model_panels)
    boundary_note = esc(didactic_models["notes"]["direct_instruction_boundary"])

    return f'''<main>
<section class="page-hero toolbox-hero"><div class="wrap"><div class="eyebrow">Werkvormen</div><h1>Waar wil je in je les mee verder?</h1><p class="lede">Begin bij een concrete onderwijsvraag, of vertrek vanuit het didactische model waarmee je al werkt. EAI voegt geen nieuw lesmodel toe.</p></div></section>

<section class="section toolbox-start"><div class="wrap">
<div class="toolbox-situation">
<div><div class="kicker">Dezelfde EAI-vraag, twee ingangen</div><h2>Wat moet de leerling hier zelf doen?</h2><p>Je kunt beginnen bij een probleem dat je in de les ziet. Of bij de fase van een bestaand didactisch model. In beide gevallen blijft de vraag hetzelfde: welke handeling draagt hier het leren?</p></div>
<div class="toolbox-situation-path" aria-label="EAI-kijkroute"><span>onderwijsmodel</span><b>→</b><span>fase</span><b>→</b><span>kernhandeling</span><b>→</b><span>AI</span><b>→</b><span>bewijs</span></div>
</div>

<div class="toolbox-mode-tabs" role="tablist" aria-label="Kies hoe je wilt beginnen">
<button type="button" class="toolbox-mode-tab" data-mode-tab="question" aria-pressed="true">Ik begin bij een onderwijsvraag</button>
<button type="button" class="toolbox-mode-tab" data-mode-tab="model" aria-pressed="false">Ik werk vanuit een didactisch model</button>
</div>

<section class="toolbox-mode-panel" data-mode-panel="question">
<div class="toolbox-route-head"><div><div class="kicker">Kies wat je nodig hebt</div><h2>Welke situatie herken je?</h2></div><p>Je hoeft geen EAI-term te kennen. Klik op wat je als docent probeert te bereiken.</p></div>
<div class="toolbox-route-grid" aria-label="Kies een onderwijssituatie">{route_buttons}</div>
</section>

<section class="toolbox-mode-panel didactic-model-mode" data-mode-panel="model" id="didactisch-model" hidden>
<div class="toolbox-route-head"><div><div class="kicker">Bestaand model, eigen fasen</div><h2>Met welk model werk je?</h2></div><p>EAI verandert de namen, volgorde of bedoeling van het bronmodel niet. We laten alleen zien welke EAI-vragen en werkvormen binnen een fase relevant kunnen zijn.</p></div>
<div class="didactic-model-grid">{model_buttons}</div>
<div class="didactic-model-panels">{model_panels_html}</div>
<p class="didactic-model-boundary">{boundary_note}</p>
</section>

<section class="toolbox-results" id="resultaten" aria-live="polite">
<div class="toolbox-results-head"><div><div class="kicker">Passende werkvormen</div><h2 id="toolbox-result-title">Kies hierboven een situatie of lesfase</h2><p id="toolbox-result-copy">Dan verschijnen hier eerst de werkvormen die daar inhoudelijk het best bij aansluiten.</p></div>
<div class="toolbox-results-tools">
<label class="toolbox-search"><span>Zoek</span><input id="toolbox-search" type="search" placeholder="Bijv. feedback, bron, vastlopen…" autocomplete="off"></label>
<button type="button" id="toolbox-show-saved">Bewaard <span id="saved-count">0</span></button>
</div></div>
<div class="toolbox-results-grid" id="toolbox-results-grid"></div>
<div class="toolbox-results-footer">
<button type="button" class="button secondary" id="toolbox-show-more" hidden>Toon alle passende werkvormen</button>
<button type="button" class="text-button" id="toolbox-clear-route" hidden>Wis keuze</button>
</div>
<p class="toolbox-empty" id="toolbox-empty" hidden>Hier vind ik nu geen passende werkvorm. Probeer een ander woord of wis je keuze.</p>
</section>

<details class="toolbox-library" id="alle-werkvormen">
<summary>Alle {len(items)} werkvormen bekijken</summary>
<div class="toolbox-library-tools">
<p>Voor wie al weet wat hij zoekt. Gebruik zoeken of de extra filters.</p>
<div class="toolbox-filters" aria-label="Filter alle werkvormen">
<label>Voor wie<select data-toolbox-filter="audience"><option value="all">Iedereen</option><option value="learner">Leerling</option><option value="teacher">Docent</option><option value="team">Team</option></select></label>
<label>Waar kijk je naar?<select data-toolbox-filter="evidence"><option value="all">Alles</option><option value="process">Proces</option><option value="independent">Zelfstandig</option><option value="retention">Later nog</option><option value="transfer">Andere situatie</option><option value="design">Ontwerp</option></select></label>
</div></div>
<div class="toolbox-library-grid" id="toolbox-library-grid"></div>
</details>

<div class="toolbox-card-pool" id="toolbox-card-pool" hidden>{cards}</div>

<aside class="toolbox-standard-note"><strong>Wat gebeurt hier precies?</strong><p>Een didactisch model organiseert het grotere onderwijsproces. EAI legt daar geen nieuwe route overheen. Binnen een fase kijken we alleen naar de kernhandeling, de rol van AI en welk bewijs daarna nog betekenis heeft. <a href="https://github.com/E-AI-MODEL/EAI-standard/tree/main/adapters" target="_blank" rel="noopener">Bekijk de bronbehoudende adapters ↗</a></p></aside>
</div></section>

<script>
(() => {{
  const sourceCards = [...document.querySelectorAll('#toolbox-card-pool [data-workform-card]')];
  const routeButtons = [...document.querySelectorAll('[data-route-key]')];
  const modeTabs = [...document.querySelectorAll('[data-mode-tab]')];
  const modePanels = [...document.querySelectorAll('[data-mode-panel]')];
  const modelButtons = [...document.querySelectorAll('[data-model-choice]')];
  const modelPanels = [...document.querySelectorAll('[data-model-panel]')];
  const phaseButtons = [...document.querySelectorAll('[data-phase-choice]')];
  const resultGrid = document.getElementById('toolbox-results-grid');
  const libraryGrid = document.getElementById('toolbox-library-grid');
  const search = document.getElementById('toolbox-search');
  const showMore = document.getElementById('toolbox-show-more');
  const clearRoute = document.getElementById('toolbox-clear-route');
  const empty = document.getElementById('toolbox-empty');
  const resultTitle = document.getElementById('toolbox-result-title');
  const resultCopy = document.getElementById('toolbox-result-copy');
  const savedCount = document.getElementById('saved-count');
  const showSaved = document.getElementById('toolbox-show-saved');
  const filters = [...document.querySelectorAll('[data-toolbox-filter]')];
  const STORAGE_KEY = 'eai-saved-workforms-v1';
  let activeRoute = null;
  let expanded = false;
  let savedOnly = false;

  const readSaved = () => {{
    try {{ return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }}
    catch (_) {{ return new Set(); }}
  }};
  const writeSaved = saved => {{ try {{ localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved])); }} catch (_) {{}} }};

  const resetSelections = () => {{
    routeButtons.forEach(item => item.setAttribute('aria-pressed', 'false'));
    phaseButtons.forEach(item => item.setAttribute('aria-pressed', 'false'));
  }};

  const cloneCard = card => {{
    const clone = card.cloneNode(true);
    const saved = readSaved();
    const save = clone.querySelector('[data-save-slug]');
    if (save) {{
      const on = saved.has(save.dataset.saveSlug);
      save.setAttribute('aria-pressed', on ? 'true' : 'false');
      save.textContent = on ? 'Bewaard' : 'Bewaar';
    }}
    return clone;
  }};

  const matchesFilters = card => filters.every(filter => {{
    if (filter.value === 'all') return true;
    return (card.dataset[filter.dataset.toolboxFilter] || '').split(' ').includes(filter.value);
  }});

  const routeMatches = card => {{
    if (!activeRoute) return true;
    if (activeRoute.exact) return activeRoute.featured.includes(card.dataset.slug);
    const values = (card.dataset.intents || '').split(' ');
    return activeRoute.intents.some(intent => values.includes(intent));
  }};

  const searchMatches = card => {{
    const q = search.value.trim().toLowerCase();
    return !q || (card.dataset.search || '').includes(q);
  }};

  const sortForRoute = cards => {{
    if (!activeRoute) return cards;
    const order = new Map(activeRoute.featured.map((slug, index) => [slug, index]));
    return [...cards].sort((a, b) => {{
      const ar = order.has(a.dataset.slug) ? order.get(a.dataset.slug) : 99;
      const br = order.has(b.dataset.slug) ? order.get(b.dataset.slug) : 99;
      return ar - br;
    }});
  }};

  const updateSavedCount = () => {{
    savedCount.textContent = String(readSaved().size);
  }};

  const render = () => {{
    const saved = readSaved();
    let matches = sourceCards.filter(card => routeMatches(card) && searchMatches(card) && matchesFilters(card));
    if (savedOnly) matches = matches.filter(card => saved.has(card.dataset.slug));
    matches = sortForRoute(matches);

    resultGrid.innerHTML = '';
    const visible = expanded || search.value.trim() || savedOnly || activeRoute?.exact ? matches : matches.slice(0, 4);
    visible.forEach(card => resultGrid.appendChild(cloneCard(card)));

    if (!activeRoute && !search.value.trim() && !savedOnly) {{
      resultTitle.textContent = 'Kies hierboven een situatie of lesfase';
      resultCopy.textContent = 'Dan verschijnen hier eerst de werkvormen die daar inhoudelijk het best bij aansluiten.';
      resultGrid.innerHTML = '';
    }} else if (savedOnly) {{
      resultTitle.textContent = 'Jouw bewaarde werkvormen';
      resultCopy.textContent = matches.length ? 'Deze werkvormen zijn alleen op dit apparaat bewaard.' : 'Je hebt nog geen werkvormen bewaard.';
    }} else if (activeRoute) {{
      resultTitle.textContent = activeRoute.title;
      resultCopy.textContent = activeRoute.copy;
    }} else {{
      resultTitle.textContent = 'Zoekresultaten';
      resultCopy.textContent = matches.length + ' werkvormen gevonden.';
    }}

    showMore.hidden = !activeRoute || activeRoute.exact || expanded || matches.length <= 4 || !!search.value.trim() || savedOnly;
    showMore.textContent = 'Toon alle ' + matches.length + ' passende werkvormen';
    clearRoute.hidden = !activeRoute && !search.value.trim() && !savedOnly;
    empty.hidden = matches.length !== 0 || (!activeRoute && !search.value.trim() && !savedOnly);

    libraryGrid.innerHTML = '';
    sourceCards.filter(card => searchMatches(card) && matchesFilters(card)).forEach(card => libraryGrid.appendChild(cloneCard(card)));
    updateSavedCount();
  }};

  modeTabs.forEach(tab => tab.addEventListener('click', () => {{
    const mode = tab.dataset.modeTab;
    modeTabs.forEach(item => item.setAttribute('aria-pressed', item === tab ? 'true' : 'false'));
    modePanels.forEach(panel => panel.hidden = panel.dataset.modePanel !== mode);
    activeRoute = null;
    expanded = false;
    savedOnly = false;
    resetSelections();
    render();
  }}));

  routeButtons.forEach(button => button.addEventListener('click', () => {{
    activeRoute = {{
      key: button.dataset.routeKey,
      intents: (button.dataset.routeIntents || '').split(' ').filter(Boolean),
      featured: (button.dataset.routeFeatured || '').split(' ').filter(Boolean),
      exact: false,
      title: button.querySelector('strong').textContent,
      copy: button.querySelector('small').textContent
    }};
    expanded = false;
    savedOnly = false;
    resetSelections();
    button.setAttribute('aria-pressed', 'true');
    render();
    document.getElementById('resultaten').scrollIntoView({{behavior:'smooth', block:'start'}});
  }}));

  modelButtons.forEach(button => button.addEventListener('click', () => {{
    const id = button.dataset.modelChoice;
    modelButtons.forEach(item => item.setAttribute('aria-pressed', item === button ? 'true' : 'false'));
    modelPanels.forEach(panel => panel.hidden = panel.dataset.modelPanel !== id);
    phaseButtons.forEach(item => item.setAttribute('aria-pressed', 'false'));
    activeRoute = null;
    render();
  }}));

  phaseButtons.forEach(button => button.addEventListener('click', () => {{
    activeRoute = {{
      key: 'model-phase',
      intents: [],
      featured: (button.dataset.phaseWorkforms || '').split(' ').filter(Boolean),
      exact: true,
      title: button.dataset.modelName + ' · ' + button.dataset.phaseName,
      copy: button.dataset.phaseQuestion
    }};
    expanded = true;
    savedOnly = false;
    resetSelections();
    button.setAttribute('aria-pressed', 'true');
    render();
    document.getElementById('resultaten').scrollIntoView({{behavior:'smooth', block:'start'}});
  }}));

  search.addEventListener('input', () => {{
    activeRoute = null;
    expanded = true;
    savedOnly = false;
    resetSelections();
    render();
  }});
  filters.forEach(filter => filter.addEventListener('change', render));
  showMore.addEventListener('click', () => {{ expanded = true; render(); }});
  clearRoute.addEventListener('click', () => {{
    activeRoute = null; expanded = false; savedOnly = false; search.value = '';
    filters.forEach(filter => filter.value = 'all');
    resetSelections();
    render();
  }});
  showSaved.addEventListener('click', () => {{
    savedOnly = !savedOnly; activeRoute = null; expanded = true; search.value = '';
    resetSelections();
    showSaved.setAttribute('aria-pressed', savedOnly ? 'true' : 'false');
    render();
  }});
  document.addEventListener('click', event => {{
    const button = event.target.closest('[data-save-slug]');
    if (!button) return;
    const saved = readSaved();
    const slug = button.dataset.saveSlug;
    if (saved.has(slug)) saved.delete(slug); else saved.add(slug);
    writeSaved(saved);
    render();
  }});
  render();
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

def workform_copy_text(item: dict) -> str:
    action = item.get("action_layer", {})
    role_steps = action.get("role_steps", {})
    public_title = item.get("public_title", item["title"])
    lines = [
        public_title,
        "",
        "Gebruik dit als:",
        item.get("lede", ""),
        "",
        "De vraag eronder:",
        item.get("question", ""),
    ]
    for label, key in [("Jij als docent", "teacher"), ("De leerling", "learner"), ("AI kan hier", "ai")]:
        steps = role_steps.get(key, [])
        if steps:
            lines.extend(["", label + ":"])
            lines.extend(f"{idx}. {step}" for idx, step in enumerate(steps, start=1))
    if action.get("ai_not"):
        lines.extend(["", "Niet automatisch doen:", action["ai_not"]])
    lines.extend(["", "Daarna kijk je naar:", item.get("result", "")])
    return "\n".join(lines)

def render_workform_quickstart(item: dict) -> str:
    action = item.get("action_layer", {})
    ai_not = action.get("ai_not", "")
    verbs = action.get("verbs", {})
    role_steps = action.get("role_steps", {})
    verb_rows = []
    for label, key in [("Docent", "teacher"), ("Leerling", "learner"), ("AI", "ai")]:
        values = verbs.get(key, [])
        if values:
            chain = '<span class="action-arrow">→</span>'.join(f'<b>{esc(value)}</b>' for value in values)
            verb_rows.append(f'<div><span>{label}</span><p>{chain}</p></div>')
    verbs_html = f'<div class="workform-verb-chain">{"".join(verb_rows)}</div>' if verb_rows else ""

    role_cards = []
    for label, key in [("Jij als docent", "teacher"), ("De leerling", "learner"), ("AI kan hier", "ai")]:
        steps = role_steps.get(key, [])
        if steps:
            steps_html = "".join(f'<li>{esc(step)}</li>' for step in steps)
            role_cards.append(f'<article><span>{label}</span><ol>{steps_html}</ol></article>')
        elif action.get(key):
            role_cards.append(f'<article><span>{label}</span><p>{esc(action[key])}</p></article>')
    roles_html = "".join(role_cards)
    copy_text = esc(workform_copy_text(item))

    return (
        '<section class="section workform-quickstart"><div class="wrap">'
        '<div class="workform-lesson-card" id="werkvormkaart">'
        '<div class="workform-toolbar"><div><span class="kicker">Morgen gebruiken</span><strong>Werkvormkaart</strong></div>'
        f'<div class="workform-toolbar-actions"><button type="button" data-copy-workform data-copy-text="{copy_text}">Kopieer</button>'
        '<button type="button" onclick="window.print()">Print</button><button type="button" data-share-workform>Deel</button></div></div>'
        '<div class="workform-use-grid">'
        f'<article><div class="kicker">Gebruik dit als</div><p>{esc(item.get("lede", ""))}</p></article>'
        f'<article><div class="kicker">De vraag eronder</div><p>{esc(item.get("question", ""))}</p></article>'
        '</div>'
        f'{verbs_html}'
        f'<div class="workform-role-grid">{roles_html}</div>'
        f'<div class="workform-boundary"><strong>Niet automatisch doen</strong><p>{esc(ai_not)}</p></div>'
        '</div></div>'
        '<script>(()=>{const copy=document.querySelector("[data-copy-workform]");const share=document.querySelector("[data-share-workform]");'
        'if(copy){copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(copy.dataset.copyText||"");const old=copy.textContent;copy.textContent="Gekopieerd";setTimeout(()=>copy.textContent=old,1400)}catch(_){}})}'
        'if(share){share.addEventListener("click",async()=>{if(navigator.share){try{await navigator.share({title:document.title,url:location.href})}catch(_){}}else{try{await navigator.clipboard.writeText(location.href);const old=share.textContent;share.textContent="Link gekopieerd";setTimeout(()=>share.textContent=old,1400)}catch(_){}}})}})();</script>'
        '</section>'
    )

def related_workforms(item: dict, all_items: list[dict], limit: int = 3) -> list[dict]:
    source_action = item.get("action_layer", {})
    source_intents = set(source_action.get("intents", []))
    source_evidence = set(item.get("evidence", []))
    source_route = set(item.get("route", []))
    scored = []
    for other in all_items:
        if other["slug"] == item["slug"]:
            continue
        other_intents = set(other.get("action_layer", {}).get("intents", []))
        score = 0
        score += 4 * len(source_intents & other_intents)
        score += 2 if other.get("category") == item.get("category") else 0
        score += len(source_evidence & set(other.get("evidence", [])))
        score += len(source_route & set(other.get("route", [])))
        if score:
            scored.append((score, other))
    scored.sort(key=lambda pair: (-pair[0], pair[1].get("public_title", pair[1]["title"])))
    return [other for _, other in scored[:limit]]

def render_related_workforms(item: dict, all_items: list[dict]) -> str:
    related = related_workforms(item, all_items)
    if not related:
        return ""
    cards = []
    for other in related:
        verbs = other.get("action_layer", {}).get("verbs", {})
        teacher = verbs.get("teacher", [])[:2]
        learner = verbs.get("learner", [])[:2]
        teacher_chain = " → ".join(teacher)
        learner_chain = " → ".join(learner)
        cards.append(
            f'<a class="related-workform-card" href="/werkvormen/{esc(other["slug"])}/">'
            f'<span>Kan hierna passen</span><h3>{esc(other.get("public_title", other["title"]))}</h3>'
            f'<p>{esc(other["summary"])}</p>'
            f'<div><b>Docent</b> {esc(teacher_chain)}</div><div><b>Leerling</b> {esc(learner_chain)}</div>'
            f'<strong>Bekijk →</strong></a>'
        )
    return (
        '<section class="section related-workforms"><div class="wrap">'
        '<div class="section-head"><div class="kicker">Wat kan hierna?</div><div><h2>Werkvormen die logisch aansluiten.</h2>'
        '<p>Niet als vaste route, wel omdat ze een volgende stap in dezelfde onderwijsafweging kunnen ondersteunen.</p></div></div>'
        f'<div class="related-workform-grid">{"".join(cards)}</div>'
        '<p class="related-all"><a href="/werkvormen/">Alle werkvormen bekijken →</a></p>'
        '</div></section>'
    )


def workform_standard_relation(item: dict) -> str:
    source = item.get("source", "")
    if "EAI Standard" in source and "MS-" in source:
        return "Direct gekoppeld aan één of meer kandidaat-microstructuren in de EAI Standard."
    if "EAI Standard" in source:
        return "Gekoppeld aan een EAI Standard-patroon voor evidence, remediatie of AI-interactie."
    refs = item.get("action_layer", {}).get("standard", [])
    if any(str(ref[0]).startswith(("MS-", "AIS-", "EV-", "REM-", "EAI-R")) for ref in refs):
        return "Werkvorm uit de EAI-praktijklaag met inhoudelijke aansluiting op Standard-termen of -patronen."
    return "Werkvorm uit de EAI-praktijklaag; de technische koppeling is nog geen directe Standard-microstructuur."

def render_workform_underpinning(item: dict) -> str:
    mechanism = WORKFORM_MECHANISMS.get(item.get("category"), {})
    action = item.get("action_layer", {})
    refs = action.get("standard", [])
    refs_html = "".join(
        f'<li><code>{esc(ref[0])}</code><span>{esc(ref[1])}</span></li>'
        for ref in refs
    )
    source = esc(item.get("source", "EAI"))
    if item.get("source_url"):
        source_html = f'<a href="{esc(item["source_url"])}" target="_blank" rel="noopener">{source}</a>'
    else:
        source_html = source
    return (
        '<section class="section workform-foundation"><div class="wrap">'
        '<div class="workform-foundation-grid">'
        '<div>'
        '<div class="kicker">Waarom dit kan helpen</div>'
        f'<h2>{esc(mechanism.get("title", "De handeling achter de werkvorm"))}</h2>'
        f'<p>{esc(mechanism.get("text", ""))}</p>'
        f'<p class="foundation-basis">Onderbouwing op de site: {esc(mechanism.get("basis", ""))}</p>'
        f'<p><a href="/onderbouwing/#{esc(mechanism.get("anchor", "eai-standard"))}">Lees de onderbouwing en beperkingen →</a></p>'
        '</div>'
        '<details class="standard-details"><summary>EAI Standard / technische laag</summary>'
        f'<p><strong>Relatie tot de Standard:</strong> {esc(workform_standard_relation(item))}</p>'
        '<p>De termen hieronder helpen om dezelfde handeling precies terug te vinden. Dit is geen kwaliteitsrangorde en maakt de werkvorm niet automatisch wetenschappelijk gevalideerd.</p>'
        f'<ul>{refs_html}</ul>'
        f'<p><strong>Bron van deze werkvorm:</strong> {source_html}</p>'
        '</details>'
        '</div></div></section>'
    )

def enrich_manual_workform(body: str, item: dict, all_items: list[dict]) -> str:
    quick = render_workform_quickstart(item)
    body = body.replace("</section>", "</section>" + quick, 1)
    tail = render_workform_example(item) + render_workform_underpinning(item) + render_related_workforms(item, all_items)
    return body.replace("</main>", tail + "</main>", 1)

def render_catalog_workform(item: dict, all_items: list[dict]) -> str:
    steps = "".join(f"<li>{esc(step)}</li>" for step in item.get("steps", []))
    audience = " · ".join(WORKFORM_AUDIENCE_LABELS.get(value, value) for value in item.get("audience", []))
    evidence = " · ".join(WORKFORM_EVIDENCE_LABELS.get(value, value) for value in item.get("evidence", []))
    public_title = item.get("public_title", item["title"])
    technical = item["title"] if public_title != item["title"] else ""
    technical_html = f'<p class="workform-technical-name detail">EAI-term: {esc(technical)}</p>' if technical else ""
    visual_html = render_workform_visual(item.get("visual"))
    visual_section = f'<section class="section"><div class="wrap">{visual_html}</div></section>' if visual_html else ""
    quickstart_html = render_workform_quickstart(item)
    example_html = render_workform_example(item)
    foundation_html = render_workform_underpinning(item)
    related_html = render_related_workforms(item, all_items)
    return f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm · {esc(audience)}</div><h1>{esc(public_title)}</h1>{technical_html}<p class="lede">{esc(item["summary"])}</p>{render_route(item.get("route", []))}</div></section>
{quickstart_html}
{visual_section}
{example_html}
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Zo doe je het</div><div><h2>Werk stap voor stap.</h2><p>Pas de formulering aan je vak en klas aan. De volgorde bewaakt dat de relevante leerlinghandeling niet ongemerkt uit beeld verdwijnt.</p></div></div><div class="panel workform-steps"><ol>{steps}</ol></div></div></section>
<section class="section"><div class="wrap"><div class="split"><article class="panel"><div class="kicker">Daarna</div><h3>Waar kijk je naar?</h3><p>{esc(item["result"])}</p></article><article class="panel"><div class="kicker">Let op</div><h3>Wat kun je nog niet concluderen?</h3><p>{esc(item["caution"])}</p></article></div><p><a href="/werkvormen/">← Terug naar de werkvormen</a></p></div></section>
{foundation_html}
{related_html}
</main>'''

TOOLS = [
    ("EAI Toolanalyse", "Analyseer een AI-toepassing op leerwaarde en didactische invloed.", "https://subtle-churros-4d44d5.netlify.app", "Open tool"),
    ("EAI Prompt Builder — Sturen met taal", "Zie hoe taal, meegegeven informatie en grenzen samen bepalen wat AI in een taak doet.", "https://eai-prompt.lovable.app/", "Open Prompt Builder"),
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

/* v3 cohesion and responsive system */
.workform-technical-name{font:700 .68rem/1.25 Inter,ui-sans-serif,sans-serif;letter-spacing:.04em;color:#7b8796;margin:-2px 0 10px}.workform-technical-name.detail{margin:8px 0 12px;text-transform:none}

.welcome{border-bottom:1px solid var(--line);background:linear-gradient(180deg,#fff 0%,#fbfaf7 100%)}
.welcome-grid{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(360px,.94fr);gap:58px;padding-top:76px;padding-bottom:44px;align-items:end}
.welcome-copy h1{font-size:clamp(3rem,5.7vw,5.35rem);max-width:12ch;margin:.16em 0 .28em}
.welcome-copy .lede{max-width:58ch;margin-bottom:20px}
.welcome-audience{max-width:58ch;margin:0;color:#5b6776;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.94rem}
.welcome-routes{display:grid;gap:10px}
.welcome-routes a{display:grid;grid-template-columns:1fr auto;grid-template-areas:"label label" "title arrow" "copy copy";gap:5px 18px;padding:18px 20px;border:1px solid var(--line);background:#fff;text-decoration:none;transition:.18s ease}
.welcome-routes a:hover{border-color:#aab3be;transform:translateY(-1px)}
.welcome-routes span{grid-area:label;font:800 .67rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#738094}
.welcome-routes strong{grid-area:title;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:1.18rem;line-height:1.2}
.welcome-routes p{grid-area:copy;margin:2px 0 0;color:var(--muted);font-size:.91rem;line-height:1.45}
.welcome-routes b{grid-area:arrow;align-self:center;font:800 .83rem/1 Inter,ui-sans-serif,sans-serif;white-space:nowrap}
.welcome-note{padding-bottom:34px}
.welcome-note p{max-width:76ch;margin:0;border-top:1px solid var(--line);padding-top:18px;color:#556171}
.model-intro{background:#fff}
.model-intro .hero-grid{padding-top:8px;padding-bottom:8px}
.model-intro h2{font-size:clamp(2.25rem,4vw,3.9rem);margin:10px 0 18px;max-width:12ch}
img{max-width:100%;height:auto}
iframe{max-width:100%}
.hero-grid>*,.profile-grid>*,.case-study>*,.media-feature>*,.app-showcase>*,.workform-detail-grid>*{min-width:0}
.mobile-nav{display:none;margin-left:auto;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.mobile-nav summary{cursor:pointer;list-style:none;border:1px solid var(--line);padding:8px 11px;font-weight:800;font-size:.82rem}
.mobile-nav summary::-webkit-details-marker{display:none}
.mobile-nav-panel{position:absolute;left:16px;right:16px;top:58px;background:#fff;border:1px solid var(--line);padding:10px;display:grid;box-shadow:0 12px 30px rgba(32,41,54,.12)}
.mobile-nav-panel a{padding:10px 8px;text-decoration:none;border-bottom:1px solid var(--line);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.92rem}
.mobile-nav-panel a:last-child{border-bottom:0}
.mobile-nav-panel a[aria-current="page"]{font-weight:800}

.model-stack{display:grid;gap:8px;align-self:center}
.model-stack>div{display:grid;grid-template-columns:42px minmax(0,1fr);column-gap:12px;align-items:start;border-top:1px solid var(--line);padding:12px 0}
.model-stack span{grid-row:1/3;font:800 .72rem/1 Inter,ui-sans-serif,sans-serif;color:var(--accent)}
.model-stack strong{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.96rem}
.model-stack p{margin:4px 0 0;color:var(--muted);font-size:.9rem;line-height:1.45}

.case-study{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.28fr);gap:28px;border:1px solid var(--line);padding:28px;background:#fff}
.case-study__task h3{font-size:clamp(1.55rem,2.5vw,2.3rem);margin:14px 0 12px}
.case-study__task p{color:var(--muted)}
.case-study__route{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.case-study__route>div{border-top:3px solid var(--accent);background:var(--soft);padding:14px 12px;min-width:0}
.case-study__route span{display:block;font:800 .66rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#6b7788}
.case-study__route strong{display:block;margin-top:8px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.9rem;line-height:1.35}

.profile-section{background:var(--soft)}
.profile-grid{display:grid;grid-template-columns:minmax(220px,.48fr) minmax(0,1.52fr);gap:42px;align-items:center}
.profile-grid--wide{grid-template-columns:minmax(260px,.55fr) minmax(0,1.45fr)}
.profile-photo{max-width:360px}
.profile-photo img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border:1px solid var(--line);background:#fff}
.profile-grid h2{font-size:clamp(2rem,3.4vw,3.2rem);margin:10px 0 14px}
.profile-lede{font-size:1.14rem;color:#435165;max-width:58ch}
.profile-grid p{max-width:66ch}

.model-principles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.model-principles article{border-top:3px solid var(--accent);padding:18px 14px;background:var(--soft);min-width:0}
.model-principles span{font:800 .7rem/1 Inter,ui-sans-serif,sans-serif;color:#7b8796}
.model-principles h3{font-size:1.05rem;margin:12px 0 8px}
.model-principles p{margin:0;color:var(--muted);font-size:.9rem}

.publication-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.publication-card{border:1px solid var(--line);background:#fff;text-decoration:none;display:flex;flex-direction:column;min-width:0}
.publication-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-bottom:1px solid var(--line)}
.publication-card--image img[alt="Hans Visser"]{aspect-ratio:1/1;object-fit:cover;object-position:center top}
.publication-card__body{padding:22px;display:flex;flex-direction:column;flex:1}
.publication-card .meta{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#718096}
.publication-card h3{font-size:1.45rem;margin:12px 0 10px}
.publication-card p{margin:0 0 18px;color:var(--muted)}
.publication-card .arrow{margin-top:auto;font-weight:800;font-family:Inter,ui-sans-serif,sans-serif}
.media-thumb{display:block;width:100%;border:1px solid var(--line)}
.media-embeds{display:grid;gap:14px}
.spotify-window{overflow:hidden;background:#fff}
.publication-links{margin-top:22px}

.toolbox-example-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.85fr);gap:30px;align-items:center;padding:24px 0 32px;border-bottom:1px solid var(--line);margin-bottom:32px}
.toolbox-example-intro h2{font-size:clamp(1.9rem,3vw,2.8rem);margin:8px 0 10px}
.toolbox-example-intro p{margin:0;color:var(--muted);max-width:62ch}
.toolbox-example-path{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.toolbox-example-path span{padding:12px 8px;border-top:3px solid var(--accent);background:var(--soft);font:800 .7rem/1.3 Inter,ui-sans-serif,sans-serif;text-align:center}

.workform-example-section{background:var(--soft)}
.workform-example-grid{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.3fr);gap:36px;align-items:start}
.workform-example-grid h2{font-size:clamp(1.7rem,3vw,2.6rem);margin:10px 0 0}
.workform-example-card{background:#fff;border-left:4px solid var(--accent);padding:24px 26px}
.workform-example-card p{margin:0;font-size:1.08rem;line-height:1.62;color:#3d4959}

@media(max-width:980px){
  .case-study{grid-template-columns:1fr}
  .case-study__route{grid-template-columns:repeat(5,minmax(120px,1fr));overflow-x:auto;padding-bottom:6px}
  .model-principles{grid-template-columns:repeat(2,minmax(0,1fr))}
  .publication-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .toolbox-example-intro{grid-template-columns:1fr}
}
@media(max-width:980px){.welcome-grid{grid-template-columns:1fr;gap:34px;padding-top:58px}.welcome-routes{grid-template-columns:repeat(3,minmax(0,1fr))}.welcome-routes a{display:grid;grid-template-columns:1fr;grid-template-areas:"label" "title" "copy" "arrow";gap:6px}.welcome-routes b{display:block;margin-top:10px;white-space:normal}}
@media(max-width:900px){
  html{scroll-padding-top:72px}
  .nav{min-height:58px;padding:10px 16px;align-items:center!important;display:flex!important;position:relative}
  .nav-links{display:none!important}
  .mobile-nav{display:block}
  .brand img{width:34px;height:34px}
  .hero-grid{padding:44px 0 38px!important;gap:28px}
  .section{padding:46px 0!important}
  .page-hero{padding:46px 0 30px!important}
  h1{font-size:clamp(2.45rem,12vw,3.7rem)!important;max-width:none}
  .lede{font-size:1.05rem}
  .case-study{padding:18px}
  .case-study__route{display:grid;grid-template-columns:1fr;overflow:visible}
  .case-study__route>div{padding:13px 14px}
  .profile-grid,.profile-grid--wide{grid-template-columns:1fr;gap:26px}
  .profile-photo{max-width:280px}
  .model-principles{grid-template-columns:1fr}
  .publication-grid{grid-template-columns:1fr}
  .media-feature{grid-template-columns:1fr!important}
  .toolbox-example-path{grid-template-columns:1fr}
  .toolbox-example-path span{text-align:left}
  .workform-example-grid{grid-template-columns:1fr;gap:18px}
  .toolbox-card-meta{flex-wrap:wrap;justify-content:flex-start}
  .pdf-figure{overflow:visible!important;padding:16px 12px}
  .pdf-figure svg{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;height:auto!important}
  .pillar-visual{max-width:100%}
  .embed-card{padding:8px}
  .embed-window,.embed-window.app{width:100%;max-width:100%}
  .app-showcase{grid-template-columns:1fr!important}
}
@media(max-width:700px){.welcome-grid{padding-top:42px;padding-bottom:28px;gap:28px}.welcome-copy h1{font-size:clamp(2.55rem,12vw,3.7rem)!important;max-width:none}.welcome-routes{grid-template-columns:1fr}.welcome-routes a{padding:17px}.welcome-note{padding-bottom:28px}.model-intro .hero-grid{padding-top:0!important;padding-bottom:0!important}}
@media(max-width:480px){
  .wrap{padding-left:17px;padding-right:17px}
  .button-row{display:grid;grid-template-columns:1fr}
  .button{text-align:center}
  .workform-visual{padding:16px}
  .workform-visual-node{min-height:0}
  .footer-grid{display:block}
}
/* Action-led toolbox and workform UX */
.workform-verb-chain{margin:6px 0 22px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.workform-verb-chain>div{display:grid;grid-template-columns:90px 1fr;gap:14px;align-items:center;padding:11px 0}
.workform-verb-chain>div+div{border-top:1px solid var(--line)}
.workform-verb-chain>div>span{font:800 .68rem/1.2 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#718096}
.workform-verb-chain p{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.workform-verb-chain b{font-size:.9rem;font-weight:750}
.action-arrow{color:#9aa5b2;font-weight:700}
.toolbox-intent-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 16px}
.toolbox-intent{appearance:none;text-align:left;border:1px solid var(--line);background:#fff;padding:16px;cursor:pointer;color:var(--ink);min-height:128px}
.toolbox-intent:hover{border-color:#a9b2bd}
.toolbox-intent[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink);background:var(--soft)}
.toolbox-intent strong{display:block;font:800 1rem/1.3 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.toolbox-intent span{display:block;margin-top:8px;color:var(--muted);font:400 .88rem/1.45 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.toolbox-intent-state{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:10px 0 22px;font:800 .8rem/1.3 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.toolbox-intent-state button{appearance:none;border:0;background:transparent;text-decoration:underline;text-underline-offset:4px;cursor:pointer;font:inherit;color:var(--ink)}
.toolbox-advanced{margin:0 0 12px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.toolbox-advanced summary{cursor:pointer;padding:14px 0;font:800 .85rem/1.3 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.toolbox-advanced .toolbox-filters{margin-bottom:16px}
.toolbox-card{min-height:250px}
.toolbox-card .eai-route{display:none}

.workform-quickstart{padding-top:48px;background:#fff}
.workform-use-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
.workform-use-grid article{border-top:3px solid var(--ink);padding:18px 0 4px}
.workform-use-grid p{font-size:1.12rem;line-height:1.58;max-width:60ch;margin:8px 0 0;color:#3e4958}
.workform-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:24px}
.workform-role-grid article{border:1px solid var(--line);background:var(--soft);padding:20px}
.workform-role-grid span{display:block;font:800 .72rem/1.2 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#637286}
.workform-role-grid p{margin:10px 0 0;color:#34404f;line-height:1.55}
.workform-role-grid ol{margin:12px 0 0;padding-left:1.25rem;color:#34404f}
.workform-role-grid li{padding-left:3px;line-height:1.5}
.workform-role-grid li+li{margin-top:8px}
.workform-role-grid article:first-child li::marker{font-weight:800}
.workform-boundary{margin-top:12px;border-left:4px solid var(--accent);background:#fff;padding:15px 18px}
.workform-boundary strong{font:800 .78rem/1.2 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-transform:uppercase;letter-spacing:.06em}
.workform-boundary p{margin:5px 0 0;color:#4b5665}
.workform-foundation{background:#fbfaf7}
.workform-foundation-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:42px;align-items:start}
.workform-foundation h2{font-size:clamp(1.8rem,3vw,2.7rem);margin:10px 0 14px}
.workform-foundation p{max-width:68ch}
.foundation-basis{font:600 .84rem/1.5 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#697688}
.standard-details{border:1px solid var(--line);background:#fff;padding:0 18px}
.standard-details summary{cursor:pointer;padding:16px 0;font:800 .86rem/1.3 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.standard-details p{font-size:.9rem;color:var(--muted)}
.standard-details ul{list-style:none;padding:0;margin:12px 0 18px}
.standard-details li{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:.84rem}
.standard-details code{font-size:.75rem;color:#294b73;background:var(--soft);padding:2px 5px;align-self:start}
.standard-details span{color:#4a5665}

.evidence-layer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.evidence-layer-grid article{border-top:3px solid var(--accent);background:var(--soft);padding:20px}
.evidence-layer-grid span{font:800 .7rem/1 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#718096}
.evidence-layer-grid h3{font-size:1.35rem;margin:12px 0 10px}
.evidence-layer-grid p{margin:0;color:var(--muted)}
.evidence-pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.evidence-pair article{border:1px solid var(--line);background:#fff;padding:22px}
.evidence-pair h3{font-size:1.35rem;margin:0 0 10px}
.evidence-pair p{color:var(--muted)}
.evidence-source-grid .publication-card{min-height:245px}

@media(max-width:900px){
  .toolbox-intent-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .workform-role-grid{grid-template-columns:1fr}
  .workform-foundation-grid{grid-template-columns:1fr}
  .evidence-layer-grid{grid-template-columns:1fr}
}
@media(max-width:700px){
  .toolbox-intent-grid{grid-template-columns:1fr}
  .toolbox-intent{min-height:0}
  .workform-use-grid{grid-template-columns:1fr}
  .workform-use-grid p{font-size:1rem}
  .evidence-pair{grid-template-columns:1fr}
  .standard-details li{grid-template-columns:1fr}
  .workform-verb-chain>div{grid-template-columns:1fr;gap:5px}
  .workform-verb-chain p{gap:6px}

}


/* Interface v4: landing, guided toolbox and reusable workform cards */
.skip-link{position:fixed;left:12px;top:10px;z-index:100000;transform:translateY(-160%);background:#fff;border:2px solid var(--ink);padding:9px 12px;font:800 .8rem/1 Inter,ui-sans-serif,sans-serif;text-decoration:none}
.skip-link:focus{transform:none}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}

.welcome-v4{background:#fff;border-bottom:1px solid var(--line)}
.welcome-v4-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(390px,.92fr);gap:64px;align-items:center;padding-top:72px;padding-bottom:44px}
.welcome-v4-copy h1{margin:.14em 0 .27em;max-width:11ch}
.welcome-v4-copy .lede{max-width:54ch;margin-bottom:16px}
.welcome-v4-copy .button-row{margin-top:26px}
.hero-eai-visual{border:1px solid var(--line);background:linear-gradient(145deg,#fff 0%,#f7f4ed 100%);padding:24px 24px 18px;box-shadow:0 18px 50px rgba(32,41,54,.07)}
.hero-eai-visual-head{display:flex;justify-content:space-between;gap:20px;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:3px;font-family:Inter,ui-sans-serif,sans-serif}
.hero-eai-visual-head span{font-size:.68rem;text-transform:uppercase;letter-spacing:.09em;color:#718096;font-weight:800}
.hero-eai-visual-head strong{font-size:1rem}
.hero-eai-step,.hero-eai-check{display:grid;grid-template-columns:42px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid var(--line);align-items:start}
.hero-eai-step>span,.hero-eai-check>span{font:800 .7rem/1.3 Inter,ui-sans-serif,sans-serif;color:#8894a3;padding-top:3px}
.hero-eai-step b,.hero-eai-check b{display:block;font:800 .96rem/1.25 Inter,ui-sans-serif,sans-serif}
.hero-eai-step small,.hero-eai-check small{display:block;margin-top:4px;color:#667283;font:400 .8rem/1.4 Inter,ui-sans-serif,sans-serif}
.hero-eai-step.is-core{margin:5px -12px;background:#fff3ed;border-left:4px solid var(--accent);padding-left:8px;padding-right:12px}
.hero-eai-step.is-core>span{color:var(--accent)}
.hero-eai-check{border-bottom:0;padding-bottom:5px}
.hero-eai-check>span{font-size:1rem;color:var(--accent)}
.welcome-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line)}
.welcome-shortcuts a{display:grid;grid-template-columns:1fr auto;gap:5px 14px;padding:20px 18px;text-decoration:none;border-right:1px solid var(--line);font-family:Inter,ui-sans-serif,sans-serif}
.welcome-shortcuts a:first-child{padding-left:0}.welcome-shortcuts a:last-child{border-right:0;padding-right:0}
.welcome-shortcuts span{grid-column:1/-1;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:#728094;font-weight:800}
.welcome-shortcuts strong{font-size:.94rem}.welcome-shortcuts b{font-size:.78rem;align-self:center}
.welcome-shortcuts a:hover strong{text-decoration:underline;text-underline-offset:4px}

.depth-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.depth-card{display:flex;flex-direction:column;min-height:260px;border:1px solid var(--line);padding:26px;text-decoration:none;background:#fff}
.depth-card--wide{grid-column:1/-1;min-height:220px}
.depth-card span{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#718096}
.depth-card h2{font-size:clamp(1.7rem,3vw,2.5rem);margin:14px 0 12px}
.depth-card p{color:var(--muted);max-width:60ch}.depth-card b{margin-top:auto;font-family:Inter,ui-sans-serif,sans-serif}
.depth-card:hover{border-color:#9ba6b3;transform:translateY(-1px)}

.toolbox-hero{padding-bottom:36px}
.toolbox-situation{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.8fr);gap:36px;align-items:end;padding:0 0 38px;border-bottom:1px solid var(--line);margin-bottom:42px}
.toolbox-situation h2{font-size:clamp(2rem,3.2vw,3rem);margin:8px 0 12px}.toolbox-situation p{max-width:60ch;color:var(--muted);margin:0}
.toolbox-situation-path{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-family:Inter,ui-sans-serif,sans-serif}
.toolbox-situation-path span{border-top:3px solid var(--accent);background:var(--soft);padding:10px 12px;font-size:.78rem;font-weight:800}.toolbox-situation-path b{color:#9aa5b2}
.toolbox-route-head{display:grid;grid-template-columns:1fr .8fr;gap:28px;align-items:end;margin-bottom:18px}.toolbox-route-head h2{font-size:clamp(2rem,3vw,2.8rem);margin:8px 0 0}.toolbox-route-head p{margin:0;color:var(--muted)}
.toolbox-route-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:48px}
.toolbox-route{appearance:none;border:1px solid var(--line);background:#fff;text-align:left;padding:20px;min-height:166px;cursor:pointer;color:var(--ink);display:grid;grid-template-columns:36px 1fr;grid-template-areas:"num title" "num copy";gap:8px 10px;align-content:start}
.toolbox-route>span{grid-area:num;font:800 .7rem/1.4 Inter,ui-sans-serif,sans-serif;color:#95a0ad}
.toolbox-route>strong{grid-area:title;font:800 1.05rem/1.25 Inter,ui-sans-serif,sans-serif}
.toolbox-route>small{grid-area:copy;color:var(--muted);font:400 .86rem/1.45 Inter,ui-sans-serif,sans-serif}
.toolbox-route:hover,.toolbox-route[aria-pressed="true"]{border-color:var(--ink);background:var(--soft)}
.toolbox-route[aria-pressed="true"]>span{color:var(--accent)}

.toolbox-results{scroll-margin-top:90px;border-top:1px solid var(--line);padding-top:34px}
.toolbox-results-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(310px,.7fr);gap:32px;align-items:end;margin-bottom:20px}
.toolbox-results-head h2{font-size:clamp(1.9rem,3vw,2.7rem);margin:8px 0 8px}.toolbox-results-head p{color:var(--muted);margin:0;max-width:60ch}
.toolbox-results-tools{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
.toolbox-search{display:grid;gap:5px;font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#687487}
.toolbox-search input{width:100%;border:1px solid var(--line);background:#fff;padding:11px 12px;font:400 .9rem/1.2 Inter,ui-sans-serif,sans-serif;color:var(--ink)}
#toolbox-show-saved{border:1px solid var(--line);background:#fff;padding:11px 12px;white-space:nowrap;font:750 .82rem/1 Inter,ui-sans-serif,sans-serif;cursor:pointer}
#toolbox-show-saved[aria-pressed="true"]{background:var(--ink);color:#fff;border-color:var(--ink)}
.toolbox-results-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.toolbox-result-card{border:1px solid var(--line);background:#fff;padding:20px;display:flex;flex-direction:column;min-height:310px}
.toolbox-result-top{display:flex;justify-content:space-between;gap:12px;align-items:center}
.toolbox-result-kicker{font:800 .66rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#728094}
.save-workform{appearance:none;border:0;background:transparent;text-decoration:underline;text-underline-offset:4px;font:750 .75rem/1 Inter,ui-sans-serif,sans-serif;cursor:pointer;color:#596576}
.save-workform[aria-pressed="true"]{color:var(--accent);text-decoration:none}
.toolbox-result-card h3{font-size:1.45rem;margin:14px 0 9px}.toolbox-result-summary{margin:0 0 16px;color:var(--muted)}
.toolbox-result-actions{margin-top:auto;border-top:1px solid var(--line);padding-top:12px}
.toolbox-result-actions>div{display:grid;grid-template-columns:66px 1fr;gap:8px;padding:5px 0;font-family:Inter,ui-sans-serif,sans-serif}
.toolbox-result-actions span{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#7b8796;font-weight:800}
.toolbox-result-actions p{display:flex;gap:5px;flex-wrap:wrap;margin:0;font-size:.78rem}.toolbox-result-actions b{font-weight:750}
.toolbox-result-link{margin-top:16px;font:800 .83rem/1 Inter,ui-sans-serif,sans-serif;text-underline-offset:4px}
.toolbox-results-footer{display:flex;gap:14px;align-items:center;margin:20px 0 44px}.text-button{appearance:none;border:0;background:transparent;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
.toolbox-library{border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:20px;padding:0}
.toolbox-library>summary{cursor:pointer;padding:18px 0;font:800 1rem/1.3 Inter,ui-sans-serif,sans-serif}.toolbox-library[open]>summary{border-bottom:1px solid var(--line)}
.toolbox-library-tools{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:18px 0}.toolbox-library-tools p{color:var(--muted);margin:0}
.toolbox-library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:0 0 24px}.toolbox-library-grid .toolbox-result-card{min-height:290px}
.toolbox-card-pool{display:none!important}

.workform-lesson-card{border:1px solid var(--ink);background:#fff;padding:24px}
.workform-toolbar{display:flex;justify-content:space-between;gap:20px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:22px;font-family:Inter,ui-sans-serif,sans-serif}
.workform-toolbar>div:first-child{display:grid;gap:3px}.workform-toolbar>div:first-child>strong{font-size:1.05rem}
.workform-toolbar-actions{display:flex;gap:7px;flex-wrap:wrap}.workform-toolbar-actions button{appearance:none;border:1px solid var(--line);background:#fff;padding:8px 10px;font:750 .75rem/1 Inter,ui-sans-serif,sans-serif;cursor:pointer}
.workform-toolbar-actions button:hover{border-color:var(--ink)}
.workform-lesson-card .workform-role-grid{margin-top:18px}
.related-workform-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.related-workform-card{border:1px solid var(--line);background:#fff;padding:20px;text-decoration:none;display:flex;flex-direction:column;min-height:280px}
.related-workform-card>span{font:800 .66rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#728094}
.related-workform-card h3{font-size:1.35rem;margin:12px 0 9px}.related-workform-card p{color:var(--muted);margin:0 0 14px}
.related-workform-card div{font:400 .78rem/1.4 Inter,ui-sans-serif,sans-serif;padding:4px 0;border-top:1px solid var(--line)}.related-workform-card div b{display:inline-block;min-width:58px}
.related-workform-card>strong{margin-top:auto;padding-top:14px;font-family:Inter,ui-sans-serif,sans-serif}.related-workform-card:hover{border-color:#9ba6b3}
.related-all{margin-top:22px}

@media(max-width:980px){
  .welcome-v4-grid{grid-template-columns:1fr;gap:34px}
  .hero-eai-visual{max-width:680px}
  .toolbox-route-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .toolbox-results-head,.toolbox-situation{grid-template-columns:1fr}
  .toolbox-library-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:760px){
  .welcome-v4-grid{padding-top:44px;padding-bottom:30px}
  .welcome-shortcuts{grid-template-columns:1fr}.welcome-shortcuts a,.welcome-shortcuts a:first-child,.welcome-shortcuts a:last-child{padding:15px 0;border-right:0;border-bottom:1px solid var(--line)}.welcome-shortcuts a:last-child{border-bottom:0}
  .hero-eai-visual{padding:18px 16px}.hero-eai-visual-head{display:grid;gap:4px}.hero-eai-step,.hero-eai-check{grid-template-columns:34px 1fr}
  .depth-grid{grid-template-columns:1fr}.depth-card--wide{grid-column:auto}
  .toolbox-route-grid{grid-template-columns:1fr}.toolbox-route{min-height:0}
  .toolbox-results-grid,.toolbox-library-grid,.related-workform-grid{grid-template-columns:1fr}
  .toolbox-results-tools,.toolbox-library-tools{grid-template-columns:1fr}
  .workform-toolbar{align-items:flex-start;display:grid}.workform-toolbar-actions{width:100%}.workform-toolbar-actions button{flex:1}
}
@media print{
  body:has(.workform-lesson-card) *{visibility:hidden!important}
  body:has(.workform-lesson-card) .workform-lesson-card,
  body:has(.workform-lesson-card) .workform-lesson-card *{visibility:visible!important}
  body:has(.workform-lesson-card) .workform-lesson-card{position:absolute;left:0;top:0;width:100%;border:0;padding:0}
  body:has(.workform-lesson-card) .workform-toolbar-actions{display:none!important}
}

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
    active_key = "verdieping" if active in {"onderbouwing", "praktijk", "publicaties", "tools", "pijlers"} else active
    links = [
        ("model", "/", "EAI"),
        ("werkvormen", "/werkvormen/", "Werkvormen"),
        ("verdieping", "/verdieping/", "Verdieping"),
        ("over", "/over/", "Over"),
    ]
    items = "".join(
        f'<a href="{href}"' + (' aria-current="page"' if key == active_key else "") + f'>{label}</a>'
        for key, href, label in links
    )
    mobile_items = "".join(
        f'<a href="{href}"' + (' aria-current="page"' if key == active_key else "") + f'>{label}</a>'
        for key, href, label in links
    )
    return (
        f'<header class="site-header"><nav class="nav" aria-label="Hoofdnavigatie">'
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
        f'<p><a href="/verdieping/">Verdieping</a> · <a href="/over/">Over EAI en Hans</a> · <a href="mailto:{EMAIL}">{EMAIL}</a> · '
        f'<a href="{GITHUB}" target="_blank" rel="noopener">GitHub</a></p></div></footer>'
    )

def doc(title: str, body: str, canonical_path: str, active: str = "", description: str = "") -> str:
    desc = description or "EAI — Educational AI, leren en eigenaarschap."
    canonical = f"{BASE_URL}{canonical_path}"
    body = body.replace("<main", '<main id="main-content"', 1)
    return f'<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · EAI</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{esc(canonical)}"><link rel="icon" href="/assets/eai-logo.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site.css"></head><body><a class="skip-link" href="#main-content">Ga naar de inhoud</a>{nav(active)}{body}{footer()}</body></html>'

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
    chrome = f'<header class="eai-site-nav"><div class="eai-site-nav__inner"><a class="eai-site-nav__brand" href="/" aria-label="EAI home"><img src="/assets/eai-logo.svg" alt="EAI" width="34" height="34"></a><div class="eai-site-nav__links"><a href="/">EAI</a><a href="/werkvormen/">Werkvormen</a><a href="/verdieping/">Verdieping</a><a href="/over/">Over</a><a href="mailto:{EMAIL}">Contact</a></div></div></header>'
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
<section class="welcome welcome-v4">
<div class="wrap welcome-v4-grid">
<div class="welcome-v4-copy">
<div class="eyebrow">Welkom bij EAI</div>
<h1>Wat moet de leerling hier eigenlijk leren?</h1>
<p class="lede">AI kan veel werk uit handen nemen. Dat is niet automatisch goed of slecht. Eerst wil je weten waar het leren in deze taak zit.</p>
<p class="welcome-audience">EAI helpt je die vraag scherp te krijgen en er een concrete onderwijskeuze van te maken.</p>
<div class="button-row"><a class="button" href="/werkvormen/">Werk met een eigen les</a><a class="button secondary" href="#model">Bekijk het model</a></div>
</div>
<div class="hero-eai-visual" aria-label="De EAI-kijkroute">
<div class="hero-eai-visual-head"><span>EAI-kijkroute</span><strong>Waar zit hier het leren?</strong></div>
<div class="hero-eai-step"><span>01</span><div><b>Wat moet de leerling leren?</b><small>Begin bij het doel, niet bij de tool.</small></div></div>
<div class="hero-eai-step"><span>02</span><div><b>Waar zit de leerling nu?</b><small>Dezelfde hulp kan in een andere fase iets anders doen.</small></div></div>
<div class="hero-eai-step is-core"><span>03</span><div><b>Welke stap moet de leerling zelf zetten?</b><small>Hier zit de kernhandeling.</small></div></div>
<div class="hero-eai-step"><span>04</span><div><b>Wat doet AI precies op die plek?</b><small>Helpt het, of voert het de stap al uit?</small></div></div>
<div class="hero-eai-check"><span>?</span><div><b>En daarna?</b><small>Wat weet je nu werkelijk over wat de leerling zelf kan?</small></div></div>
</div>
</div>
<div class="wrap welcome-shortcuts">
<a href="#model"><span>Nieuw bij EAI</span><strong>Begrijp het in één voorbeeld</strong><b>Start →</b></a>
<a href="/werkvormen/"><span>Voor je volgende les</span><strong>Kies een passende werkvorm</strong><b>Aan de slag →</b></a>
<a href="/verdieping/"><span>Verder kijken</span><strong>Onderbouwing, praktijk en publicaties</strong><b>Verdiep →</b></a>
</div>
</section>

<section class="section model-intro" id="model"><div class="wrap hero-grid">
<div><div class="eyebrow">Het EAI-model</div><h2>Leg eerst het onderwijs op tafel.</h2>
<p class="lede">Wat moet de leerling leren? Waar bevindt hij zich nu in dat leren? Aan welke stap moet hij in deze fase zelf inhoudelijke betekenis geven? Pas daarna komt de vraag wat AI precies op die plek doet.</p>
<p>En dan kijk je nog één keer terug: wat weet je nu werkelijk over wat de leerling zelf kan?</p>
<div class="button-row"><a class="button" href="#voorbeeld">Bekijk het voorbeeld</a><a class="button secondary" href="/over/">Over EAI</a></div></div>
<div class="model-stack" aria-label="De vier vragen van EAI">
<div><span>01</span><strong>Proces</strong><p>Wat moet de leerling uiteindelijk kennen of kunnen, en hoe komt hij daar?</p></div>
<div><span>02</span><strong>Fase</strong><p>Waar in dat leren bevindt de leerling zich nu?</p></div>
<div><span>03</span><strong>Kernhandeling</strong><p>Aan welke stap moet de leerling hier zelf inhoudelijke betekenis geven?</p></div>
<div><span>04</span><strong>AI</strong><p>Wat doet AI precies op díe plek?</p></div>
<div class="model-stack-check"><span>?</span><strong>En daarna</strong><p>Wat laat dit nu werkelijk zien over wat de leerling zelf kan?</p></div>
</div></div></section>

<section class="section" id="voorbeeld"><div class="wrap"><div class="section-head"><div class="kicker">EAI in één voorbeeld</div><div><h2>Dezelfde AI kan in de ene fase helpen en in de andere fase precies de verkeerde stap overnemen.</h2><p>Het verschil zit niet alleen in wat de tool doet, maar in waar de leerling zich bevindt en welke stap daar betekenis draagt.</p></div></div>
<div class="case-study">
<div class="case-study__task"><span class="badge">Situatie</span><h3>Een leerling schrijft met AI een betoog.</h3><p>De tekst is sterk. Maar de docent wil kunnen zeggen dat de leerling zelf argumenten kan wegen en een conclusie kan onderbouwen.</p></div>
<div class="case-study__route">
<div><span>Doel</span><strong>Argumenteren</strong></div>
<div><span>Fase</span><strong>Zelfstandig oefenen</strong></div>
<div><span>Kernhandeling</span><strong>Argumenten wegen</strong></div>
<div><span>AI</span><strong>Formulering en feedback</strong></div>
<div><span>Bewijs</span><strong>Nieuwe stelling zonder inhoudelijke AI-hulp</strong></div>
</div></div>
<p class="bridge"><strong>Daar zit de afweging.</strong> AI mag veel doen. Soms heel veel. Maar als argumenten wegen hier de kernhandeling is, moet de leerling juist aan die stap zelf betekenis geven. Daarna wil je ook kunnen zien of hij dat zonder dezelfde inhoudelijke hulp opnieuw kan.</p>
</div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Waarom twee pijlers?</div><div><h2>Je moet zowel leren als AI begrijpen.</h2><p>EAI verbindt onderwijskundige kennis met kennis van wat taalmodellen feitelijk doen. Zonder die combinatie blijft een oordeel over AI te algemeen.</p></div></div>
<div class="pillars"><article class="pillar"><div class="num">Pijler 01</div><h3>Hoe leren werkt</h3><p>Welke verwerking, oefening, fout, keuze of herhaling draagt in deze fase bij aan leren?</p><p><a href="/twee-pijlers/#leren">Lees verder →</a></p></article>
<article class="pillar"><div class="num">Pijler 02</div><h3>Hoe taalmodellen werken</h3><p>Welke stappen kan het systeem al structureren, voorspellen, formuleren, controleren of voorstellen?</p><p><a href="/twee-pijlers/#taalmodellen">Lees verder →</a></p></article></div></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Van vraag naar praktijk</div><div><h2>Pak nu één eigen taak.</h2><p>De werkvormen helpen om precies die vragen op je eigen les, toets of AI-toepassing te leggen. Begin bij het leren. Kies daarna pas de werkvorm.</p></div></div>
<div class="card-grid">
<a class="card" href="/werkvormen/kernhandeling-check/"><span class="meta">Start hier</span><h3>Kernhandeling-check</h3><p>Bepaal eerst welke menselijke handeling in deze fase inhoudelijk betekenis moet krijgen.</p><span class="arrow">Open →</span></a>
<a class="card" href="/werkvormen/ai-role-handback-plan/"><span class="meta">Ontwerp</span><h3>Wat doet AI, en wanneer gaat het terug naar de leerling?</h3><p>Schrijf niet alleen op dat AI 'ondersteunt'. Maak zichtbaar wat het systeem doet en waar de leerling het weer zelf moet uitvoeren.</p><span class="arrow">Open →</span></a>
<a class="card" href="/werkvormen/bewijs-van-leren/"><span class="meta">Bewijs</span><h3>Bewijs van leren</h3><p>Kijk welk bewijs je nodig hebt voor wat je over de leerling wilt kunnen zeggen.</p><span class="arrow">Open →</span></a>
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

    verdieping_body = '''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Verdieping</div><h1>Wil je verder dan de werkvorm?</h1><p class="lede">Hier vind je de onderbouwing, publicaties, praktijkvoorbeelden en tools achter EAI. Kies wat je nodig hebt; je hoeft niet alles te lezen om met EAI te kunnen werken.</p></div></section>
<section class="section"><div class="wrap"><div class="depth-grid">
<a class="depth-card depth-card--wide" href="/onderbouwing/"><span>Onderbouwing</span><h2>Waar rust EAI op?</h2><p>Didactiek, leerpsychologie, pedagogiek, professioneel oordeel en recent AI-onderzoek. Met expliciete grenzen aan wat EAI wel en niet claimt.</p><b>Bekijk de onderbouwing →</b></a>
<a class="depth-card" href="/publicaties/"><span>Publicaties & media</span><h2>Lees, kijk en luister verder.</h2><p>Eigen EAI-publicaties, externe bijdragen, podcast en video.</p><b>Naar publicaties →</b></a>
<a class="depth-card" href="/praktijk/"><span>Praktijk</span><h2>Wat gebeurt er als je het bouwt?</h2><p>Live demonstrators en toepassingen waarin dezelfde ontwerpvragen terugkomen.</p><b>Bekijk de praktijk →</b></a>
<a class="depth-card" href="/tools/"><span>Tools</span><h2>Van vraag naar ontwerp.</h2><p>Toepassingen die helpen bij analyse, prompts, eigenaarschap en lesontwerp.</p><b>Bekijk de tools →</b></a>
<a class="depth-card" href="/twee-pijlers/"><span>Achter het model</span><h2>Waarom leren én AI?</h2><p>De twee kennisgebieden die je nodig hebt om niet alleen over technologie te praten.</p><b>Lees de twee pijlers →</b></a>
</div></div></section>
</main>'''
    write(out, "verdieping/index.html", doc("Verdieping", verdieping_body, "/verdieping/", "verdieping", "Onderbouwing, publicaties, praktijk en tools achter het EAI-model."))

    pillars_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Twee pijlers</div><h1>Je hebt beide nodig om goede keuzes te maken.</h1><p class="lede">De ene pijler gaat over leren. De andere over de technologie die steeds meer stappen kan uitvoeren. Het onderwijskundige ontwerp ontstaat waar die twee kennisgebieden elkaar raken.</p></div></section>
<section class="section"><div class="wrap"><figure class="pdf-figure pillar-visual" aria-label="Twee pijlers die samenkomen in de ontwerpvraag"><svg viewBox="0 0 560 220" role="img"><g class="stroke"><rect x="105" y="58" width="82" height="112"/><path d="M126 93c14-10 25 10 39 0M126 113c14-10 25 10 39 0M126 133c14-10 25 10 39 0"/><rect x="373" y="58" width="82" height="112"/><rect x="396" y="92" width="36" height="36"/><path d="M396 100h-12M396 110h-12M396 120h-12M396 130h-12M432 100h12M432 110h12M432 120h12M432 130h12"/></g><path class="dash" d="M187 91c42 0 57 37 83 62M373 91c-42 0-57 37-83 62"/><circle class="accent-fill" cx="280" cy="164" r="8"/></svg><figcaption>De ontwerpvraag ontstaat niet in één pijler, maar precies waar leren en AI elkaar raken.</figcaption></figure></div></section>
<section class="section" id="leren"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 01</div><div><h2>Hoe leren werkt</h2><p>Leren is meer dan een correct eindproduct. De leerling haalt voorkennis op, geeft betekenis, legt relaties, oefent, maakt fouten, kiest, controleert en probeert kennis later opnieuw toe te passen.</p></div></div><div class="panel"><h3>De vraag</h3><p>Welke stap in dit proces moet door de leerling of professional zelf inhoudelijke betekenis krijgen?</p><p>Dat antwoord hangt af van het doel én van waar iemand zich in het proces bevindt. Een uitgewerkte redenering kan tijdens instructie passende steun zijn en tijdens zelfstandig oefenen precies het werk overnemen dat geleerd moest worden.</p></div></div></section>
<section class="section" id="taalmodellen"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 02</div><div><h2>Hoe taalmodellen werken</h2><p>Taalmodellen genereren vanuit patronen en context. Ze kunnen niet alleen formuleren, maar ook structureren, vergelijken, samenvatten, vragen formuleren, feedback geven en vervolgstappen voorstellen.</p></div></div><div class="panel"><h3>De vraag</h3><p>Wat doet het systeem in deze concrete taak feitelijk?</p><p>Niet de hoeveelheid tekst die AI produceert is bepalend. De relevante vraag is welke menselijke handeling door die bijdrage wordt ondersteund, veranderd of uitgevoerd.</p></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Eén taak, twee blikken</div><div><h2>Twee historische bronnen vergelijken.</h2><p>AI kan verschillen aanwijzen, belangen benoemen en een keurige vergelijking schrijven. Voor een docent kan dat efficiënt zijn. Voor een leerling die juist moet leren bronnen te vergelijken en wegen, kan hetzelfde systeem een belangrijk deel van de leerhandeling uitvoeren.</p></div></div><div class="pillars"><article class="pillar"><div class="num">Vanuit leren</div><h3>Wat moet de leerling doen?</h3><p>Bronnen wegen, verschillen betekenis geven en tot een eigen onderbouwde vergelijking komen.</p></article><article class="pillar"><div class="num">Vanuit AI</div><h3>Wat kan het systeem doen?</h3><p>Precies die verschillen selecteren, ordenen, interpreteren en formuleren. De technische mogelijkheid krijgt dus pas betekenis door het leerdoel en de fase.</p></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">De verbinding</div><div><h2>Hier begint EAI.</h2><p>Niet bij de tool. Leg eerst het leren op tafel en kijk daarna wat AI op precies die plek doet.</p></div></div><div class="workform"><div><span class="badge">1</span></div><div><strong>Proces</strong><p>Wat moet de leerling uiteindelijk kennen of kunnen, en hoe komt hij daar?</p></div><span></span></div><div class="workform"><div><span class="badge">2</span></div><div><strong>Fase</strong><p>Waar in dat leren bevindt de leerling zich nu?</p></div><span></span></div><div class="workform"><div><span class="badge">3</span></div><div><strong>Kernhandeling</strong><p>Aan welke stap moet de leerling in deze fase zelf inhoudelijke betekenis geven?</p></div><a href="/werkvormen/kernhandeling-check/">Probeer →</a></div><div class="workform"><div><span class="badge">4</span></div><div><strong>Wat doet AI daar?</strong><p>Voert AI die stap uit, ondersteunt het de leerling eromheen, of doet het iets anders?</p></div><span></span></div><div class="workform"><div><span class="badge">?</span></div><div><strong>Wat kun je daarna zeggen?</strong><p>Wat laat de uitvoering zien over wat de leerling met hulp, zelfstandig, later of in een andere situatie kan?</p></div><a href="/werkvormen/bewijs-van-leren/">Probeer →</a></div><p style="margin-top:30px"><a href="/publicaties/de-vraag-die-we-vergeten/">Lees de redenering achter deze volgorde →</a></p></div></section></main>'''
    write(out, "twee-pijlers/index.html", doc("Twee pijlers", pillars_body, "/twee-pijlers/", "pijlers", "Hoe leren werkt en hoe taalmodellen werken: de twee pijlers onder EAI."))

    evidence_body = '''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Onderbouwing</div><h1>Waar rust EAI op?</h1><p class="lede">Niet op één theorie. EAI brengt drie lagen bij elkaar: wat we al weten over leren en onderwijs, wat recent onderzoek laat zien over AI in onderwijs, en de ontwerpkeuzes die EAI daar zelf bovenop legt.</p></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Drie lagen</div><div><h2>Die lagen moeten uit elkaar blijven.</h2><p>Een bestaand didactisch mechanisme is iets anders dan een recente AI-studie. En geen van beide maakt een nieuw EAI-begrip vanzelf gevalideerd. Op deze site proberen we dat onderscheid zichtbaar te houden.</p></div></div>
<div class="evidence-layer-grid">
<article><span>01</span><h3>Didactiek & leerpsychologie</h3><p>Ophalen uit geheugen, feedback verwerken, zelfregulatie, scaffolding, afbouw van hulp, transfer en actieve verwerking zijn geen EAI-uitvindingen. EAI gebruikt zulke mechanismen wanneer AI een deel van de taak kan uitvoeren.</p></article>
<article><span>02</span><h3>Pedagogiek & professioneel oordeel</h3><p>Onderwijs gaat niet alleen over taakprestatie. Ook autonomie, leerlingstem, relatie, proportionaliteit, professionele verantwoordelijkheid en de vraag waartoe je onderwijst spelen mee.</p></article>
<article><span>03</span><h3>AI-specifiek onderzoek</h3><p>Recente studies laten zien dat effecten van generatieve AI sterk afhangen van taak, ondersteuning en wat AI precies overneemt. Daarom analyseert EAI handelingen in plaats van alleen 'AI-gebruik'.</p></article>
</div></div></section>

<section class="section" id="zelfstandigheid"><span id="proces-en-bewijs"></span><span id="bewijs"></span><div class="wrap"><div class="section-head"><div class="kicker">Zelfstandigheid</div><div><h2>Met hulp iets goed doen is niet hetzelfde als het zelf kunnen.</h2><p>Dat klinkt bijna te vanzelfsprekend. Toch wordt een sterk AI-ondersteund product gemakkelijk gelezen alsof het iets zegt over zelfstandige beheersing. EAI houdt ondersteunde prestatie, zelfstandig uitvoeren, later opnieuw uitvoeren en transfer daarom uit elkaar.</p></div></div>
<div class="evidence-pair"><article><h3>Onderwijswetenschappelijk</h3><p>Onderzoek naar retrieval en opnieuw uitvoeren laat zien waarom een nieuwe poging iets anders kan laten zien dan opnieuw bestuderen of herkennen.</p><p><a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener">Roediger &amp; Karpicke (2006) →</a></p></article>
<article><h3>AI-specifiek</h3><p>Recente studies onderscheiden eveneens sterke prestatie mét AI van wat later zonder dezelfde ondersteuning beschikbaar blijft.</p><p><a href="https://doi.org/10.1073/pnas.2422633122" target="_blank" rel="noopener">Bastani et al. (2025) →</a></p></article></div>
</div></section>

<section class="section" id="scaffolding"><div class="wrap"><div class="section-head"><div class="kicker">Hulp & scaffolding</div><div><h2>Goede hulp laat uiteindelijk meer van de handeling bij de leerling.</h2><p>Scaffolding gaat niet om zo min mogelijk helpen. Het gaat om passende hulp, contingentie, afbouw en overdracht van verantwoordelijkheid. Dat wordt extra relevant wanneer AI onbeperkt hints, uitleg en modellen kan geven.</p></div></div>
<div class="evidence-pair"><article><h3>Onderwijswetenschappelijk</h3><p>In de scaffoldingliteratuur keren juist contingentie, fading en transfer of responsibility steeds terug.</p><p><a href="https://doi.org/10.1007/s10648-010-9127-6" target="_blank" rel="noopener">Van de Pol, Volman &amp; Beishuizen (2010) →</a></p></article>
<article><h3>AI-specifiek</h3><p>AI-tutoring kan leren ondersteunen wanneer de hulp zo is ontworpen dat leerlingen actief blijven; onbeperkte antwoordvoorziening kan in sommige situaties juist latere prestaties schaden.</p><p><a href="https://doi.org/10.1038/s41598-025-97652-6" target="_blank" rel="noopener">Kestin et al. (2025) →</a></p></article></div>
</div></section>

<section class="section" id="feedback"><div class="wrap"><div class="section-head"><div class="kicker">Feedback</div><div><h2>Feedback is informatie voor een volgende handeling.</h2><p>Een verbeterde tekst is niet automatisch bewijs dat de leerling de verbetering zelf kon uitvoeren. Daarom eindigen EAI-werkvormen rond feedback vaak met revisie of een nieuwe poging door de leerling.</p></div></div>
<p><a href="https://doi.org/10.3102/003465430298487" target="_blank" rel="noopener">Hattie &amp; Timperley (2007), The Power of Feedback →</a></p>
</div></section>

<section class="section" id="zelfregulatie"><div class="wrap"><div class="section-head"><div class="kicker">Zelfregulatie</div><div><h2>Ook plannen, monitoren en hulp kiezen zijn handelingen.</h2><p>Wanneer AI automatisch doelen herformuleert, een route kiest, voortgang beoordeelt of hulp opschaalt, kan niet alleen inhoudelijk werk maar ook regulatie verschuiven. Daarom behandelt EAI die stappen afzonderlijk.</p></div></div>
<div class="evidence-pair"><article><h3>Leerpsychologie</h3><p>Zelfregulerend leren omvat doelgericht plannen, monitoren en bijstellen; het is meer dan leerlingen simpelweg alleen laten werken.</p><p><a href="https://doi.org/10.1207/s15430421tip4102_2" target="_blank" rel="noopener">Zimmerman (2002) →</a></p></article>
<article><h3>Motivatie & autonomie</h3><p>Autonomie, competentie en verbondenheid zijn relevante psychologische voorwaarden wanneer we nadenken over eigenaarschap en sturing in onderwijs.</p><p><a href="https://doi.org/10.1016/j.cedpsych.2020.101860" target="_blank" rel="noopener">Ryan &amp; Deci (2020) →</a></p></article></div>
</div></section>

<section class="section" id="argumentatie"><div class="wrap"><div class="section-head"><div class="kicker">Actieve verwerking</div><div><h2>Niet iedere zichtbare activiteit vraagt hetzelfde denkwerk.</h2><p>Een leerling kan selecteren, vergelijken, verklaren, wegen of zelf iets construeren. Zulke verschillen zijn belangrijk wanneer AI precies een van die bewerkingen kan uitvoeren.</p></div></div>
<p><a href="https://doi.org/10.1080/00461520.2014.965823" target="_blank" rel="noopener">Chi &amp; Wylie (2014), ICAP →</a></p>
</div></section>

<section class="section" id="professioneel-oordeel"><div class="wrap"><div class="section-head"><div class="kicker">Pedagogiek & professioneel oordeel</div><div><h2>Een professioneel besluit is meer dan het accepteren van een aanbeveling.</h2><p>EAI houdt observatie, interpretatie, leerlingperspectief, onzekerheid en beslissing uit elkaar. Dat is deels een vraag van professioneel handelen en deels een pedagogische vraag: welk doel dient de beslissing en hoe blijft de leerling daarin als persoon aanwezig?</p></div></div>
<div class="evidence-pair"><article><h3>Onderwijsdoel</h3><p>De vraag waartoe onderwijs dient kan niet worden vervangen door alleen meetbare opbrengsten of technische efficiëntie.</p><p><a href="https://doi.org/10.1007/s11092-008-9064-9" target="_blank" rel="noopener">Biesta (2009) →</a></p></article>
<article><h3>Teacher-AI samenwerking</h3><p>Recente studies beschrijven hoe initiatief, epistemische agency en professionele verantwoordelijkheid anders verdeeld kunnen raken wanneer docenten met AI werken.</p><p><a href="https://doi.org/10.1016/j.caeo.2026.100371" target="_blank" rel="noopener">Velander (2026) →</a></p></article></div>
</div></section>

<section class="section" id="taak-en-ai"><span id="ontwerp"></span><div class="wrap"><div class="section-head"><div class="kicker">Recente AI-evidence</div><div><h2>Het effect van AI hangt af van wat AI in de taak doet.</h2><p>De huidige literatuur is heterogeen. Gemiddelde positieve of negatieve effecten vertellen weinig zonder te weten welke taak, welk vak, welke ondersteuning en welke menselijke activiteit in beeld was.</p></div></div>
<div class="publication-grid evidence-source-grid">
<a class="publication-card" href="https://doi.org/10.1007/s10462-026-11665-9" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Meta-analyse · 2026</span><h3>Boolzen et al.</h3><p>STEM, generatieve AI en cognitieve leeruitkomsten. Onder meer relevant voor het onderscheid tussen augmenteren en vervangen van leerlingactiviteit.</p><span class="arrow">Bron →</span></div></a>
<a class="publication-card" href="https://cepr.org/publications/dp21577" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Working paper · 2026</span><h3>Stromberg, Lei &amp; Wu</h3><p>Langdurige data uit Chinees voortgezet onderwijs; homeworkprestaties en latere gesloten toetsen lopen niet automatisch gelijk.</p><span class="arrow">Bron →</span></div></a>
<a class="publication-card" href="https://doi.org/10.1057/s41599-026-07019-z" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Meta-analyse · 2026</span><h3>Wu et al.</h3><p>Gemiddeld positieve effecten, maar duidelijke moderatie door onder meer vak, duur en instructievorm.</p><span class="arrow">Bron →</span></div></a>
<a class="publication-card" href="https://doi.org/10.3390/educsci16060938" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Systematische review · 2026</span><h3>Costache et al.</h3><p>Teacher-AI samenwerking als verdeling van detecteren, diagnosticeren, beslissen en professioneel handelen.</p><span class="arrow">Bron →</span></div></a>
</div></div></section>

<section class="section" id="eai-standard"><div class="wrap"><div class="section-head"><div class="kicker">Wat EAI zelf toevoegt</div><div><h2>Een ontwerp- en analysetaal. Geen bewezen universele meettest.</h2><p>De EAI Standard koppelt context, doel, actor en fase aan een kernhandeling, kleinere microstructuren, concrete AI-acties en passend bewijs. De precieze EAI-taxonomie blijft kandidaat en vraagt verdere construct- en interbeoordelaarsvalidatie.</p></div></div>
<div class="split"><article class="panel"><h3>Wel claimen</h3><ul><li>Menselijke en AI-handelingen moeten apart beschreven kunnen worden.</li><li>Een ondersteund product is niet vanzelf bewijs van zelfstandige beheersing.</li><li>Bewijs moet passen bij de uitspraak die je wilt doen.</li><li>AI-effecten zijn afhankelijk van context, taak en rol.</li></ul></article>
<article class="panel"><h3>Niet claimen</h3><ul><li>Dat iedere EAI-werkvorm experimenteel gevalideerd is.</li><li>Dat één lijst kernhandelingen voor alle vakken en fasen geldt.</li><li>Dat AI per definitie goed of slecht is voor leren.</li><li>Dat de EAI-microstructuren al een gevalideerd meetinstrument vormen.</li></ul></article></div>
<p style="margin-top:28px"><a href="https://github.com/E-AI-MODEL/EAI-standard/blob/main/evidence/claims.yaml" target="_blank" rel="noopener">Bekijk de evidence claims in de EAI Standard →</a><br><a href="https://github.com/E-AI-MODEL/EAI-standard/blob/main/evidence/construct-map.yaml" target="_blank" rel="noopener">Bekijk de construct map en validatiestatus →</a></p>
</div></section>
</main>'''
    write(out, "onderbouwing/index.html", doc("Onderbouwing", evidence_body, "/onderbouwing/", "onderbouwing", "Didactische, leerpsychologische, pedagogische en AI-specifieke onderbouwing van EAI, met expliciete grenzen aan wat het model claimt."))

    workshop_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Workshop AI</div><h1>Van twee pijlers naar ontwerp.</h1><p class="lede">De drie workshops volgen steeds dezelfde beweging: kennisbasis, verdieping, een uitgewerkt voorbeeld, reflectie, een werkvorm en een concrete afsluiting. De werkvormen hieronder kun je ook los gebruiken.</p></div></section>
<section class="section"><div class="wrap"><figure class="pdf-figure" aria-label="Drie stappen van Workshop AI"><svg viewBox="0 0 760 210" role="img"><g class="stroke"><path d="M95 112h570"/><circle cx="160" cy="112" r="13"/><circle cx="380" cy="112" r="13"/><circle cx="600" cy="112" r="13"/><rect x="130" y="35" width="60" height="48" rx="4"/><rect x="350" y="35" width="60" height="48" rx="4"/><rect x="570" y="35" width="60" height="48" rx="4"/></g><path class="dash" d="M160 83v16M380 83v16M600 83v16"/><circle class="accent-fill" cx="160" cy="112" r="8"/><circle class="accent-fill" cx="380" cy="112" r="8"/><circle class="accent-fill" cx="600" cy="112" r="8"/><text x="160" y="154" text-anchor="middle" font-size="14" fill="#687487">twee pijlers</text><text x="380" y="154" text-anchor="middle" font-size="14" fill="#687487">wie doet welk werk?</text><text x="600" y="154" text-anchor="middle" font-size="14" fill="#687487">herontwerp</text></svg><figcaption>De workshop beweegt van begrijpen naar analyseren en daarna pas naar ontwerpen.</figcaption></figure></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 1</div><div><h2>Twee pijlers voor AI in onderwijs</h2><p>Eerst scherp krijgen hoe leren werkt én hoe taalmodellen werken. Daarna pas beoordelen wat een AI-toepassing in een onderwijsproces betekent.</p></div></div><div class="workform"><div><span class="badge">Basis</span></div><div><strong>Leg de twee pijlers naast elkaar</strong><p>Bekijk één concrete taak vanuit leren en vanuit de technische mogelijkheden van AI.</p></div><a href="/twee-pijlers/">Open →</a></div><div class="workform"><div><span class="badge">Toollab</span></div><div><strong>Dezelfde vraag, twee omgevingen</strong><p>Vergelijk een algemene AI met een brongebonden omgeving. Wat verandert er door context en bronnen?</p></div><a href="/werkvormen/toollab/">Open →</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 2</div><div><h2>Waaraan moet de leerling hier zelf betekenis geven?</h2><p>We pakken één taak, leggen het leerproces en de fase op tafel en zoeken de kernhandeling. Pas daarna kijken we welk deel AI uitvoert.</p></div></div><div class="workform"><div><span class="badge">Analyse</span></div><div><strong>Wie doet welk werk?</strong><p>Maak per stap zichtbaar wat de leerling doet en wat AI al voor hem uitvoert.</p></div><a href="/werkvormen/task-density-scan/">Open →</a></div><div class="workform"><div><span class="badge">Kern</span></div><div><strong>Kernhandeling-check</strong><p>Bepaal aan welke stap de leerling hier zelf inhoudelijke betekenis moet geven.</p></div><a href="/werkvormen/kernhandeling-check/">Open →</a></div><div class="workform"><div><span class="badge">Diagnose</span></div><div><strong>Foutanalyse</strong><p>Laat de leerling de eerste ontsporing aanwijzen, verklaren en herstellen.</p></div><a href="/werkvormen/foutanalyse/">Open →</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 3</div><div><h2>Van inzicht naar ontwerp</h2><p>Het leerproces, de fase, de kernhandeling en de rol van AI komen samen in het herontwerp van een taak.</p></div></div><div class="workform"><div><span class="badge">Keuzes</span></div><div><strong>Keuzes verantwoorden</strong><p>Maak zichtbaar wat uit AI-suggesties is overgenomen, verworpen of veranderd, en vooral waarom.</p></div><a href="/werkvormen/justification-mapping/">Open →</a></div><div class="workform"><div><span class="badge">Bewijs</span></div><div><strong>Bewijs van leren</strong><p>Kies bewijs dat past bij wat je werkelijk over de leerling wilt kunnen zeggen.</p></div><a href="/werkvormen/bewijs-van-leren/">Open →</a></div><div class="workform"><div><span class="badge">Voorbeeld</span></div><div><strong>Prompt Builder</strong><p>Bekijk hoe je met taal, meegegeven informatie en duidelijke grenzen bepaalt wat AI in deze taak wel en niet doet.</p></div><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open →</a></div></div></section></main>'''
    write(out, "workshop-ai/index.html", doc("Workshop AI", workshop_body, "/workshop-ai/", "workshop", "Workshopreeks over leren, taalmodellen, denkwerk en herontwerp."))

    workforms = load_workforms()
    workforms_by_slug = {item["slug"]: item for item in workforms}
    workforms_body = render_workforms_index(workforms)
    write(out, "werkvormen/index.html", doc("EAI Toolbox", workforms_body, "/werkvormen/", "werkvormen", "EAI-werkvormen om menselijk handelen, taakverdeling, bewijs en zelfstandigheid zichtbaar te maken."))

    jm_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm · Workshop AI</div><h1>Keuzes verantwoorden</h1><p class="workform-technical-name detail">EAI-term: Justification Mapping</p><p class="lede">AI kan een formulering, argument of route voorstellen. De vraag is vervolgens niet alleen wat de leerling overneemt, maar waarom hij dat doet.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Waarvoor?</div><div><h2>Niet alleen laten zien dát er een keuze is gemaakt.</h2><p>De werkvorm richt zich op de grens tussen AI-assistentie en menselijk begrip. Een leerling kan een AI-suggestie aanpassen zonder de inhoudelijke afweging zelf te hebben gemaakt. Daarom wordt juist de rationale zichtbaar.</p></div></div><figure class="pdf-figure" aria-label="Justification Mapping van AI-suggestie naar menselijke verantwoording"><svg viewBox="0 0 760 220" role="img"><g class="stroke"><rect x="70" y="74" width="130" height="70" rx="4"/><rect x="315" y="50" width="130" height="70" rx="4"/><rect x="315" y="130" width="130" height="70" rx="4"/><rect x="560" y="74" width="130" height="70" rx="4"/></g><path class="dash" d="M200 109h115M445 85h115M445 165c58 0 72-26 115-45"/><circle class="accent-fill" cx="258" cy="109" r="8"/><text x="135" y="114" text-anchor="middle" font-size="14" fill="#687487">AI-suggestie</text><text x="380" y="92" text-anchor="middle" font-size="14" fill="#687487">accepteren</text><text x="380" y="172" text-anchor="middle" font-size="14" fill="#687487">verwerpen / wijzigen</text><text x="625" y="114" text-anchor="middle" font-size="14" fill="#687487">waarom?</text></svg><figcaption>Niet alleen vastleggen wat veranderde, maar zichtbaar maken waarom de leerling iets overnam, verwierp of herschreef.</figcaption></figure><div class="panel"><h3>Breng één AI-ondersteunde keuze in kaart</h3><ol><li><strong>Suggestie:</strong> wat stelde AI voor?</li><li><strong>Accepteren:</strong> wat heb je overgenomen?</li><li><strong>Verwerpen:</strong> wat heb je bewust niet gebruikt?</li><li><strong>Waarom:</strong> welke inhoudelijke reden lag achter beide keuzes?</li><li><strong>Eigen wijziging:</strong> wat heb je zelf toegevoegd, veranderd of opnieuw opgebouwd?</li><li><strong>Verdedigen:</strong> kun je de uiteindelijke keuze zonder het systeem uitleggen en onderbouwen?</li></ol></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Belangrijk onderscheid</div><div><h2>Dit is procesverantwoording rond AI-assistentie.</h2><p>Binnen deze workshop is Justification Mapping geen algemene methodekeuzekaart. Het doel is zichtbaar maken waar een AI-bijdrage ophoudt en de inhoudelijke afweging van de leerling begint.</p></div></div><p><a class="button" href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Bekijk in Prompt Builder hoe de AI-rol wordt gestuurd</a></p></div></section></main>'''
    write(out, "werkvormen/justification-mapping/index.html", doc("Keuzes verantwoorden", enrich_manual_workform(jm_body, workforms_by_slug["justification-mapping"], workforms), "/werkvormen/justification-mapping/", "werkvormen", "Justification Mapping als EAI-werkvorm voor zichtbare keuzes en procesverantwoording."))
    core_action_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Kernhandeling-check</h1><p class="lede">Aan welke stap moet de leerling in deze fase zelf inhoudelijke betekenis geven om tot leren te komen? Dat is de kernhandeling waar deze werkvorm naar zoekt.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Werk van buiten naar binnen</h3><ol><li><strong>Proces:</strong> wat moet uiteindelijk geleerd, beheerst of professioneel beoordeeld worden?</li><li><strong>Fase:</strong> waar bevindt de leerling zich nu in dat leren?</li><li><strong>Handelingen:</strong> welke stappen worden hier uitgevoerd?</li><li><strong>Kernhandeling:</strong> aan welke stap moet de leerling hier zelf inhoudelijke betekenis geven?</li><li><strong>AI-check:</strong> voert AI precies die handeling uit, ondersteunt het eromheen, of doet het iets anders?</li><li><strong>Evidence:</strong> wat moet zichtbaar zijn als je later iets over menselijke beheersing of professioneel oordeel wilt zeggen?</li></ol></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Test</div><div><h2>Haal de AI-bijdrage denkbeeldig weg.</h2><p>Verdwijnt daarmee alleen routinewerk, of verdwijnt de stap waaraan de leerling juist zelf betekenis moest geven? Dat onderscheid bepaalt de volgende ontwerpkeuze.</p></div></div><p><a href="/publicaties/de-vraag-die-we-vergeten/">Lees de redenering achter deze vraag →</a></p></div></section></main>'''
    write(out, "werkvormen/kernhandeling-check/index.html", doc("Kernhandeling-check", enrich_manual_workform(core_action_body, workforms_by_slug["kernhandeling-check"], workforms), "/werkvormen/kernhandeling-check/", "werkvormen", "Bepaal eerst aan welke stap de leerling in deze fase zelf inhoudelijke betekenis moet geven."))
    td_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Wie doet welk werk?</h1><p class="workform-technical-name detail">EAI-term: Task Density Map</p><p class="lede">Niet hoeveel AI er wordt gebruikt is de kern. Kijk per stap wie het werk uitvoert en of AI juist de kernhandeling van deze fase overneemt.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Stap 1</div><div><h2>Neem één concrete opdracht.</h2><p>Schrijf niet “AI bij Nederlands” op. Kies één taak waarin een leerling iets moet leren of laten zien.</p></div></div><figure class="pdf-figure" aria-label="Task Density verdeelt handelingen tussen mens en AI"><svg viewBox="0 0 720 230" role="img"><g class="stroke"><circle cx="145" cy="70" r="24"/><path d="M105 155c7-34 23-50 40-50s33 16 40 50"/><rect x="535" y="52" width="72" height="58" rx="4"/><path d="M553 52v-10M571 52v-10M589 52v-10M553 110v10M571 110v10M589 110v10"/></g><path class="dash" d="M200 95h310"/><circle class="accent-fill" cx="285" cy="95" r="7"/><circle class="accent-fill" cx="430" cy="95" r="7"/><text x="145" y="195" text-anchor="middle" font-size="14" fill="#687487">mens</text><text x="570" y="195" text-anchor="middle" font-size="14" fill="#687487">AI</text><text x="360" y="135" text-anchor="middle" font-size="14" fill="#687487">welke handelingen verschuiven?</text></svg><figcaption>Task Density gaat niet om “hoeveel AI”, maar om welke relevante handelingen van actor veranderen.</figcaption></figure><div class="panel"><h3>Maak een kaart van de werkelijke handelingen</h3><ol><li>Ontleed de fase in concrete handelingen en deelhandelingen.</li><li>Noteer per handeling: mens, AI, gedeeld of nog onbekend.</li><li>Beschrijf wanneer AI in beeld komt: vóór, tijdens of na de kernhandeling.</li><li>Noteer welke opties, criteria of routes AI al heeft geselecteerd voordat de mens reageert.</li><li>Bekijk daarna welke menselijke handelingen verdwijnen, verschuiven of een andere betekenis krijgen.</li></ol><p>Gebruik werkwoorden die passen bij de concrete taak. Structureren, formuleren, controleren, kiezen, herzien en verantwoorden zijn voorbeelden, geen vaste checklist.</p></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Stap 2</div><div><h2>Zoek de handeling die ertoe doet.</h2><p>Welke van deze handelingen moet in deze fase door de leerling zelf inhoudelijke betekenis krijgen? Dat is belangrijker dan een totaalpercentage.</p></div></div><div class="panel"><h3>De beslisvraag</h3><p>Als AI deze handeling uitvoert, wat kan ik daarna nog betrouwbaar zeggen over het leren van de leerling?</p></div></div></section></main>'''
    write(out, "werkvormen/task-density-scan/index.html", doc("Wie doet welk werk?", enrich_manual_workform(td_body, workforms_by_slug["task-density-scan"], workforms), "/werkvormen/task-density-scan/", "werkvormen", "Analyseer wie welk denkwerk uitvoert in een AI-ondersteunde taak."))

    evidence_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Bewijs van leren</h1><p class="lede">Een goed eindproduct is bewijs van een goed eindproduct. Het is niet automatisch bewijs dat de onderliggende handeling zelfstandig beheerst wordt.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Kies bewust</div><div><h2>Wat wil je eigenlijk kunnen beweren?</h2><p>Lukt het mét hulp? Kan de leerling dezelfde handeling daarna zelfstandig uitvoeren? Kan hij dat later nog? En in een andere situatie?</p></div></div><figure class="pdf-figure" aria-label="Een goed product is niet automatisch bewijs van leren"><svg viewBox="0 0 720 220" role="img"><g class="stroke"><rect x="90" y="65" width="120" height="92"/><path d="M112 92h75M112 112h62M112 132h69"/><circle cx="580" cy="76" r="23"/><path d="M540 162c7-34 23-50 40-50s33 16 40 50"/></g><path class="dash" d="M210 111h116M394 111h146"/><circle class="accent-fill" cx="360" cy="111" r="8"/><text x="150" y="192" text-anchor="middle" font-size="14" fill="#687487">product</text><text x="360" y="192" text-anchor="middle" font-size="14" fill="#687487">≠ automatisch</text><text x="580" y="192" text-anchor="middle" font-size="14" fill="#687487">menselijke beheersing</text></svg><figcaption>Output kan goed zijn terwijl nog onduidelijk is wat de leerling zelfstandig kan uitvoeren.</figcaption></figure><div class="panel"><h3>Drie soorten bewijs</h3><ul><li><strong>Outputbewijs:</strong> laat zien wat is geproduceerd, maar niet vanzelf wie het relevante werk uitvoerde.</li><li><strong>Procesbewijs:</strong> laat keuzes, eerste pogingen, wijzigingen, controles en uitleg zien.</li><li><strong>Zelfstandig bewijs:</strong> laat een nieuwe of vergelijkbare uitvoering zien zonder de relevante AI-bijdrage.</li></ul><p>Wil je weten of de leerling het later nog kan, of ook in een andere situatie? Dan heb je opnieuw passend bewijs nodig. Begin dus steeds bij de vraag wat je werkelijk over het leren wilt kunnen zeggen.</p></div></div></section></main>'''
    write(out, "werkvormen/bewijs-van-leren/index.html", doc("Bewijs van leren", enrich_manual_workform(evidence_body, workforms_by_slug["bewijs-van-leren"], workforms), "/werkvormen/bewijs-van-leren/", "werkvormen", "Kies bewijs dat past bij wat je over het leren van de leerling wilt kunnen zeggen."))

    first_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Eerste poging en versie vergelijken</h1><p class="workform-technical-name detail">EAI-term: First Attempt &amp; Version Comparison</p><p class="lede">Laat eerst iets van de leerling zelf ontstaan. Vergelijk daarna wat met hulp veranderde en vraag waar de leerling zelf betekenis gaf.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Zo werkt het</h3><ol><li>Laat de leerling een korte eerste poging maken zonder AI.</li><li>Gebruik daarna AI voor een vooraf afgesproken vorm van ondersteuning.</li><li>Bewaar beide versies.</li><li>Laat de leerling drie veranderingen aanwijzen.</li><li>Vraag per verandering: wie stelde dit voor, waarom heb je het overgenomen of verworpen, en wat begrijp je nu anders?</li></ol><p>Het doel is niet bewijzen dat de leerling “zonder AI” werkte. Het doel is zichtbaar maken wat vóór en na ondersteuning door de leerling zelf is gedaan.</p></div></div></section></main>'''
    write(out, "werkvormen/first-attempt/index.html", doc("Eerste poging en versie vergelijken", enrich_manual_workform(first_body, workforms_by_slug["first-attempt"], workforms), "/werkvormen/first-attempt/", "werkvormen", "Vergelijk een eerste eigen poging met een latere AI-ondersteunde versie."))

    error_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Foutanalyse</h1><p class="lede">Een fout verbeteren is iets anders dan een fout herkennen, lokaliseren en verklaren.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Geef niet meteen de oplossing</h3><ol><li>Geef een foutieve redenering, eventueel door AI gegenereerd.</li><li>Laat de leerling aanwijzen waar het voor het eerst misgaat.</li><li>Laat uitleggen waarom die stap niet klopt.</li><li>Vraag wat er vanaf dat punt moet veranderen.</li><li>Laat pas daarna een volledige verbeterde versie maken.</li></ol><p>De kernhandeling ligt bij diagnosticeren en herstellen. AI kan materiaal leveren, maar hoeft het oordeel niet alvast te geven.</p></div></div></section></main>'''
    write(out, "werkvormen/foutanalyse/index.html", doc("Foutanalyse", enrich_manual_workform(error_body, workforms_by_slug["foutanalyse"], workforms), "/werkvormen/foutanalyse/", "werkvormen", "Werkvorm voor zichtbaar diagnosticeren en herstellen van fouten."))

    toollab_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Workshop AI · Toollab</div><h1>Dezelfde vraag, twee omgevingen.</h1><p class="lede">Niet elke AI-omgeving krijgt dezelfde context. Dat verandert wat het systeem kan aannemen, onderbouwen en teruggeven.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Werk in tweetallen</h3><ol><li>Kies een realistische leerlingvraag uit je eigen vak.</li><li>Voer die zonder extra context in een algemene AI in.</li><li>Noteer aannames, gaten en sterke punten in de output.</li><li>Gebruik daarna een brongebonden omgeving en voeg twee tot vier relevante bronnen toe.</li><li>Stel exact dezelfde vraag.</li><li>Vergelijk wat verandert en wat níet wordt opgelost door extra bronnen.</li></ol><p>De opbrengst is niet “welke tool wint?”, maar begrip van wat context, bronnen en systeeminrichting doen met het antwoord.</p></div></div></section></main>'''
    write(out, "werkvormen/toollab/index.html", doc("Toollab", enrich_manual_workform(toollab_body, workforms_by_slug["toollab"], workforms), "/werkvormen/toollab/", "werkvormen", "Vergelijk een algemene AI met een brongebonden omgeving."))

    for item in workforms:
        if item["slug"] in MANUAL_WORKFORMS:
            continue
        write(
            out,
            f'werkvormen/{item["slug"]}/index.html',
            doc(
                item.get("public_title", item["title"]),
                render_catalog_workform(item, workforms),
                f'/werkvormen/{item["slug"]}/',
                "werkvormen",
                item["summary"],
            ),
        )


    practice_body = '''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Praktijk</div><h1>Wat gebeurt er wanneer je deze vragen echt in een systeem bouwt?</h1><p class="lede">De voorbeelden hieronder zijn experimenten. Ze laten zien hoe je in een concrete omgeving kunt proberen om het leerproces, de kernhandeling en de rol van AI zichtbaar te houden.</p></div></section>
<section class="section"><div class="wrap">
<article class="app-showcase" id="classroom"><div class="app-copy"><span class="app-tag">Lespraktijk · live demo</span><h2>EAI Classroom</h2><p>Van leerdoel en succescriteria naar verwachte misconcepties, interventies en zichtbaar leerlingwerk. De omgeving laat vooral zien hoe didactische keuzes vóór de AI-interactie kunnen worden vastgelegd.</p><div class="button-row"><a class="button" href="https://eaiclassroom.lovable.app" target="_blank" rel="noopener">Open volledig</a><a class="button secondary" href="/twee-pijlers/">Bekijk de twee pijlers</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>eaiclassroom.lovable.app</span></div><div class="embed-window app"><iframe src="https://eaiclassroom.lovable.app" title="EAI Classroom live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
<article class="app-showcase" id="hub"><div class="app-copy"><span class="app-tag">Leeromgeving · live demo</span><h2>EAIHUB</h2><p>Een leeromgeving waarin de positie in het leerproces en de rol van ondersteuning centraal staan. Niet alleen het antwoord telt, maar ook wat de leerling zelf nog moet doen en laten zien.</p><div class="button-row"><a class="button" href="https://eaihub.lovable.app" target="_blank" rel="noopener">Open volledig</a><a class="button secondary" href="/werkvormen/">Naar de werkvormen</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>eaihub.lovable.app</span></div><div class="embed-window app"><iframe src="https://eaihub.lovable.app" title="EAIHUB live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
<article class="app-showcase" id="regio"><div class="app-copy"><span class="app-tag">Andere context · live demo</span><h2>Demo Regio</h2><p>EAI hoeft niet te stoppen bij een les of leerlingtaak. Deze demonstrator laat zien hoe dezelfde ontwerpvragen ook in een andere context kunnen worden uitgewerkt: wat is het menselijke proces, welke rol krijgt AI en waar moeten keuzes herleidbaar blijven?</p><div class="button-row"><a class="button" href="https://demo-regio.lovable.app" target="_blank" rel="noopener">Open volledig</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>demo-regio.lovable.app</span></div><div class="embed-window app"><iframe src="https://demo-regio.lovable.app" title="Demo Regio live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
</div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Ontwerpen</div><div><h2>Ook de taal waarmee je AI aanstuurt, maakt een onderwijskeuze.</h2><p>Een prompt bepaalt niet alleen de toon van een antwoord. Hij kan ook bepalen of AI een vraag stelt, een aanpak kiest, informatie selecteert of al een oordeel geeft. In de Prompt Builder kun je dat stap voor stap zichtbaar maken.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Taal & systeem</div><h2>Prompt Builder</h2><p>Beschrijf eerst wat AI in deze fase wel en niet moet doen. Daarna zie je hoe prompt, context, grenzen en volgorde dat gedrag sturen.</p><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder →</a></article><article class="tool-card"><div class="kicker">Werkvorm</div><h2>Justification Mapping</h2><p>Maak zichtbaar wat uit AI-suggesties is overgenomen, verworpen of veranderd en waarom.</p><a href="/werkvormen/justification-mapping/">Open de werkvorm →</a></article></div></div></section>
</main>'''
    write(out, "praktijk/index.html", doc("Praktijk", practice_body, "/praktijk/", "praktijk", "Live voorbeelden van EAI in verschillende contexten: EAI Classroom, EAIHUB, Demo Regio en Prompt Builder."))

    over_body = f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Over EAI</div><h1>De technologie werd steeds concreter. De onderwijs­vraag bleef te vaak vaag.</h1><p class="lede">We konden steeds beter uitleggen wat AI kan. Maar zinnen als 'AI mag ondersteunen' of 'de leerling moet kritisch blijven denken' hielpen mij nog niet om maandag een andere keuze te maken. EAI ontstond uit de behoefte om die onderwijs­vraag preciezer te maken.</p></div></section>
<section class="section"><div class="wrap"><div class="profile-grid profile-grid--wide">
<div class="profile-photo"><img src="{PORTRAIT_URL}" alt="Hans Visser" loading="eager" decoding="async" referrerpolicy="no-referrer"></div>
<div><div class="kicker">Hans Visser</div><h2>Onderwijsleider en ontwikkelaar van EAI.</h2>
<p class="profile-lede">Conrector op het Emmauscollege in Rotterdam. Daarnaast actief als AI-adviseur en spreker rond AI, leren en onderwijsontwerp.</p>
<p>Mijn vertrekpunt is meestal niet: welke AI-tool zullen we gebruiken? Ik wil eerst weten wat een leerling uiteindelijk moet leren, waar hij zich in dat leren bevindt en aan welke stap hij daar zelf inhoudelijke betekenis moet geven. Pas daarna kijk ik naar wat AI precies op die plek doet.</p>
<p>Die vragen kwamen steeds terug in lessen, studiedagen, gesprekken met docenten en experimenten met AI. Daaruit groeide EAI. Niet als lijst met toegestane tools, maar als een manier om samen beter naar een concrete onderwijssituatie te kijken.</p>
<div class="button-row"><a class="button secondary" href="https://onderwijs-ai.nl/over-ons/team/hans-visser" target="_blank" rel="noopener">Onderwijs AI-profiel</a><a class="button secondary" href="https://nl.linkedin.com/in/hans-visser-92531a105" target="_blank" rel="noopener">LinkedIn</a></div>
<p class="source-note">Portret wordt rechtstreeks geladen vanaf het openbare Onderwijs AI-profiel.</p>
</div></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Wat EAI probeert te voorkomen</div><div><h2>Een nette output verwarren met menselijk leren of oordeel.</h2><p>AI kan een sterke tekst, uitleg, diagnose of aanbeveling produceren. EAI vraagt daarom steeds wat die output nog bewijst over de mens die ermee werkte.</p></div></div>
<div class="model-principles"><article><span>01</span><h3>Leg het proces op tafel</h3><p>Wat moet de leerling uiteindelijk kennen of kunnen, en hoe komt hij daar?</p></article><article><span>02</span><h3>Zoek de fase</h3><p>Waar bevindt de leerling zich nu in dat leren?</p></article><article><span>03</span><h3>Zoek de kernhandeling</h3><p>Aan welke stap moet de leerling hier zelf inhoudelijke betekenis geven?</p></article><article><span>04</span><h3>Leg AI ernaast</h3><p>Wat doet AI precies op die plek? Helpt het, of voert het de kernhandeling al uit?</p></article><article><span>?</span><h3>Kijk wat je werkelijk weet</h3><p>Wat kun je nu zeggen over wat de leerling zelf kan, en welk extra bewijs heb je eventueel nodig?</p></article></div>
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

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Eigen publicaties</div><div><h2>Hoe de vragen achter EAI zich hebben ontwikkeld.</h2><p>In de oudere stukken staan soms andere of technischere termen. De lijn eronder is dezelfde: wie doet welk werk, waaraan geeft de mens zelf betekenis en wat kun je daarna werkelijk concluderen?</p></div></div><div class="card-grid">{"".join(pub_cards)}</div></div></section>

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

    tools_body = f'''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Tools</div><h1>Begin niet met de vraag welke tool je wilt gebruiken.</h1><p class="lede">Begin met één concrete situatie. Wat moet de leerling hier leren? Waar zit hij in dat proces? Wat moet hij zelf doen? De tools hieronder helpen pas daarna om een deel van die afweging uit te werken.</p></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Begrijpen & analyseren</div><div><h2>Wat gebeurt er met het denkwerk?</h2><p>Gebruik deze toepassingen om een bestaande taak of AI-interactie vanuit het leerproces te bekijken.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Analyse</div><h2>EAI Toolanalyse</h2><p>Bekijk een AI-toepassing op leerwaarde en didactische invloed. Gebruik de uitkomst als start van een professionele afweging, niet als automatisch oordeel.</p><a href="https://subtle-churros-4d44d5.netlify.app" target="_blank" rel="noopener">Open tool →</a></article><article class="tool-card"><div class="kicker">Interactief</div><h2>Act of Learning Game</h2><p>Verken de vraag wie in een concrete situatie het relevante denkwerk uitvoert.</p><a href="https://rainbow-tarsier-a88e9b.netlify.app/" target="_blank" rel="noopener">Open tool →</a></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Ontwerpen</div><div><h2>Wat wil je dat AI hier doet?</h2><p>Zodra leerdoel, fase en kernhandeling helder zijn, kun je de technische interactie veel preciezer ontwerpen.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Taal & systeem</div><h2>Prompt Builder · Sturen met taal</h2><p>Bekijk hoe de woorden in een prompt, de meegegeven informatie en de grenzen rond het systeem samen bepalen wat AI uiteindelijk doet. De technische termen staan in de tool zelf als je die laag nodig hebt.</p><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder →</a></article><article class="tool-card"><div class="kicker">Lesontwerp</div><h2>EAI What-If Machine</h2><p>Verken hoe een andere keuze in taak of AI-inzet het ontwerp verandert.</p><a href="https://what-if-lesson-designer.lovable.app/" target="_blank" rel="noopener">Open tool →</a></article></div></div></section>
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
    urls = ["/", "/twee-pijlers/", "/workshop-ai/", "/werkvormen/", "/verdieping/", "/onderbouwing/", "/praktijk/", "/publicaties/", "/publicaties/de-vraag-die-we-vergeten/", "/tools/", "/over/", "/eaa-model/", "/onderwijsin/"] + [f"/werkvormen/{item['slug']}/" for item in workforms] + [f"/publicaties/{slug}/" for slug, _, _, _ in PUBLICATIONS] + ["/tools/beyond-explainability/"]
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
