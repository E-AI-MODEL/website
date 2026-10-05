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
LINKEDIN = "https://nl.linkedin.com/in/hans-visser-92531a105"
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
    ("zelfstandigheid", "Kijken wat de leerling zelf kan", "Geef de leerstap na hulp weer terug aan de leerling en kijk wat daarna zelfstandig lukt."),
    ("bewijs", "Niet alleen naar het eindproduct kijken", "Een goed product is nog geen bewijs van leren. Kijk ook wat de leerling zelfstandig, later en in een andere situatie kan."),
    ("herstellen", "Feedback gebruiken om opnieuw te doen", "Laat feedback leiden tot een nieuwe poging van de leerling. De verbetering zelf blijft dus niet bij AI liggen."),
    ("zelfregulatie", "Zelf sturen en controleren", "Laat de leerling zelf bepalen waar hij vastloopt, wat hij gaat proberen en waaraan hij ziet of dat werkt."),
    ("argumentatie", "Argumenteren en bronnen wegen", "Houd bronkeuze, afweging, tegenargument en conclusie zichtbaar bij de leerling waar juist die stappen geleerd moeten worden."),
    ("professioneel-oordeel", "Professioneel oordeel", "Houd uit elkaar wat je werkelijk ziet, wat je daaruit afleidt en welk besluit je vervolgens neemt."),
    ("scaffolding", "Hulp geven zonder de stap over te nemen", "Geef precies genoeg hulp om de leerling verder te laten komen en bouw die hulp weer af zodra dat kan."),
    ("ontwerpen", "Een taak of toets opnieuw ontwerpen", "Begin bij het leren. Bepaal daarna welke rol AI krijgt en waar de leerling iets opnieuw zelf moet laten zien."),
]
WORKFORM_AUDIENCE_LABELS = {"learner": "Leerling", "teacher": "Docent", "team": "Team"}
WORKFORM_EVIDENCE_LABELS = {
    "design": "Les of opdracht ontwerpen",
    "process": "Hoe de leerling werkt",
    "independent": "Wat de leerling zelf kan",
    "retention": "Of het later nog lukt",
    "transfer": "Of het in een nieuwe situatie lukt",
}
WORKFORM_ROUTE_LABELS = {
    "proces": "Wat is de opdracht?",
    "fase": "Waar zit je in de les?",
    "kernhandeling": "Welke leerstap staat centraal?",
    "taakdichtheid": "Wat doet AI?",
    "output": "Wat kun je daarna zien?",
}

WORKFORM_INTENTS = [
    ("orient", "Eerst scherp krijgen wat er verandert", "Ik wil een taak eerst goed bekijken voordat ik iets aan AI verander."),
    ("diagnose", "Zien waar de leerling vastloopt", "Ik wil weten waar het voor het eerst misgaat of welke verklaring het beste past."),
    ("support", "Hulp geven zonder de leerstap over te nemen", "Ik wil ondersteunen, maar de leerstap bij de leerling houden."),
    ("return", "De leerstap teruggeven", "AI of ikzelf nam tijdelijk een leerstap over; nu moet de leerling die weer zelf zetten."),
    ("independent", "Kijken wat de leerling zelf kan", "Ik wil niet alleen het product zien, maar zelfstandige uitvoering."),
    ("retention-transfer", "Kijken of het later of ergens anders ook lukt", "Ik wil weten of het geleerde beschikbaar blijft buiten deze ene taak."),
    ("feedback", "Feedback laten leiden tot zelf verbeteren", "De leerling moet na feedback zelf weer handelen."),
    ("selfreg", "De regie bij de leerling houden", "Ik wil dat de leerling zelf plant, controleert, hulp kiest of bijstuurt."),
    ("argument", "Argumenten, bronnen en conclusies laten wegen", "De inhoudelijke afweging moet zichtbaar bij de leerling blijven."),
    ("professional", "Mijn professionele oordeel zelf vormen", "Ik wil AI gebruiken zonder observatie, interpretatie en besluit in elkaar te laten schuiven."),
    ("redesign", "Een taak, toets of AI-rol herontwerpen", "Ik wil vanuit het leren opnieuw bepalen wie welke leerstap zet en waar AI helpt."),
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
        "description": "Geef de leerstap terug aan de leerling en kijk wat zonder dezelfde inhoudelijke hulp lukt.",
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
        "title": "Met hulp lukt het. Maar lukt het daarna ook zelf?",
        "text": "Een leerling kan met een goed voorbeeld, een hint of AI tot sterk werk komen. Dat vertelt nog niet of dezelfde stap daarna zelfstandig lukt. Daarom laat deze groep werkvormen de leerling na de hulp opnieuw zelf handelen.",
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
        "text": "Feedback kan richting geven, maar wanneer AI de verbetering zelf volledig uitvoert, zie je weinig van de leerstap van de leerling. Daarom eindigen deze werkvormen in eigen revisie, controle of een nieuwe poging.",
        "basis": "feedbackliteratuur + EAI learner-reperformance",
        "anchor": "feedback",
    },
    "zelfregulatie": {
        "title": "Plannen, controleren en hulp kiezen kunnen zelf leerstappen zijn",
        "text": "Zelfregulatie bestaat niet alleen uit 'zelfstandig werken'. Een doel stellen, voortgang controleren, merken waar je vastloopt, hulp kiezen en je aanpak aanpassen zijn afzonderlijke leerstappen die AI ook kan overnemen.",
        "basis": "self-regulated learning + EAI self-regulation registry",
        "anchor": "zelfregulatie",
    },
    "argumentatie": {
        "title": "Kritisch denken bestaat uit verschillende leerstappen",
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
        "text": "Dezelfde AI-actie kan tijdens instructie behulpzaam zijn en tijdens zelfstandig oefenen juist de leerstap overnemen die de leerling zelf moet zetten. Daarom kijkt EAI naar fase, leerstap en passend bewijs.",
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

def validate_public_workform_language(items: list[dict]) -> None:
    """Keep technical EAI vocabulary out of the public teacher-facing workform layer."""
    banned = ("kernhandeling", "doelhandeling", "leerhandeling", "relevante handeling", "onderliggende handeling")
    skip_keys = {"slug", "title", "route", "source", "source_url", "standard"}

    def walk(value, path: str, slug: str) -> None:
        if isinstance(value, str):
            lowered = value.lower()
            for term in banned:
                if term in lowered:
                    raise SystemExit(
                        f"Public terminology error in {slug} at {path}: use 'leerstap' or 'werkstap' instead of '{term}'."
                    )
            return
        if isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}[{index}]", slug)
            return
        if isinstance(value, dict):
            for key, child in value.items():
                if key in skip_keys:
                    continue
                walk(child, f"{path}.{key}", slug)

    for item in items:
        walk(item, "workform", item.get("slug", "<unknown>"))



def load_content_fragment(filename: str) -> str:
    path = Path("content") / filename
    if not path.exists():
        raise SystemExit(f"Missing content fragment: {path}")
    return path.read_text(encoding="utf-8")

def render_route(route: list[str]) -> str:
    parts = []
    active = set(route)
    for key in ["proces", "fase", "kernhandeling", "taakdichtheid", "output"]:
        state = " is-active" if key in active else ""
        parts.append(f'<span class="route-chip{state}">{esc(WORKFORM_ROUTE_LABELS[key])}</span>')
    return '<div class="eai-route" aria-label="Plaats in de EAI-kijkvorm">' + "".join(parts) + "</div>"

def render_toolbox_card(item: dict) -> str:
    action = item.get("action_layer", {})
    intents = " ".join(action.get("intents", []))
    evidence = " ".join(item.get("evidence", []))
    audience = " ".join(item.get("audience", []))
    public_title = item.get("public_title", item["title"])
    teacher_copy = item.get("card_teacher") or action.get("teacher", "")
    learner_copy = item.get("card_learner") or action.get("learner", "")
    search_parts = [
        public_title,
        item.get("title", ""),
        item.get("summary", ""),
        item.get("question", ""),
        teacher_copy,
        learner_copy,
        item.get("category", ""),
    ]
    search_text = " ".join(search_parts).lower()
    teacher_html = f'<div><span>Als docent</span><p>{esc(teacher_copy)}</p></div>' if teacher_copy else ""
    learner_html = f'<div><span>De leerling</span><p>{esc(learner_copy)}</p></div>' if learner_copy else ""
    return (
        f'<article class="toolbox-result-card" data-workform-card data-slug="{esc(item["slug"])}" '
        f'data-category="{esc(item["category"])}" data-audience="{esc(audience)}" '
        f'data-evidence="{esc(evidence)}" data-intents="{esc(intents)}" data-search="{esc(search_text)}">'
        f'<div class="toolbox-result-top"><span class="toolbox-result-kicker">Werkvorm</span>'
        f'<button type="button" class="save-workform" data-save-slug="{esc(item["slug"])}" aria-pressed="false">Bewaar</button></div>'
        f'<h3>{esc(public_title)}</h3><p class="toolbox-result-summary">{esc(item["summary"])}</p>'
        f'<div class="toolbox-result-actions">{teacher_html}{learner_html}</div>'
        f'<a class="toolbox-result-link" href="/werkvormen/{esc(item["slug"])}/">Zo werkt deze werkvorm →</a>'
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
        f'<small>{len(model["phases"])} {"fasen" if "phases" in model["kind"] else "functies"} · kies een fase om werkvormen te bekijken</small></button>'
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
<section class="page-hero toolbox-hero"><div class="wrap"><div class="eyebrow">Werkvormen</div><h1>Waar wil je in je les mee verder?</h1><p class="lede">Kies eerst welke verzameling bij je vraag past. De EAI Toolbox helpt bij leren en AI. TAALwerkvormen combineert vaktaal met formatief handelen.</p></div></section>

<section class="section workform-collections"><div class="wrap"><div class="workform-collection-grid">
<a class="workform-collection-card is-eai" href="#eai-toolbox"><span>EAI Toolbox</span><strong>{len(items)} EAI-werkvormen</strong><p>Begin bij iets wat je in de les ziet of wilt bereiken. Kies daarna een werkvorm die helpt om leerlingwerk, hulp en zelfstandigheid zichtbaar te maken.</p><b>Werk met de EAI Toolbox ↓</b></a>
<a class="workform-collection-card is-taal" href="/taalwerkvormen/"><span>TAALwerkvormen · Emmauscollege</span><strong>15 complete werkvormkaarten</strong><p>Vaktaal, formatief handelen, redo en volledige LLM-prompts in één zelfstandige verzameling.</p><b>Bekijk 15 TAALwerkvormen →</b></a>
</div></div></section>

<section class="section toolbox-start" id="eai-toolbox"><div class="wrap">
<div class="toolbox-situation">
<div><div class="kicker">Twee manieren om te beginnen</div><h2>Wat moet de leerling hier zelf doen?</h2><p>Je kunt beginnen bij iets wat je in de les ziet, of bij een fase uit een didactisch model waarmee je al werkt. De vraag blijft praktisch: welke stap wil je dat de leerling zelf leert uitvoeren, en waar kan AI helpen?</p></div>
<div class="toolbox-situation-path" aria-label="Van lesvraag naar passende AI-hulp"><span>wat gebeurt er in de les?</span><b>→</b><span>wat moet de leerling leren?</span><b>→</b><span>welke hulp is nodig?</span><b>→</b><span>wat doet AI?</span><b>→</b><span>wat wil je daarna zien?</span></div>
</div>

<div class="toolbox-mode-tabs" role="tablist" aria-label="Kies hoe je wilt beginnen">
<button type="button" class="toolbox-mode-tab" data-mode-tab="question" aria-pressed="true">Ik begin bij een onderwijsvraag</button>
<button type="button" class="toolbox-mode-tab" data-mode-tab="model" aria-pressed="false">Ik werk vanuit een didactisch model</button>
</div>

<section class="toolbox-mode-panel" data-mode-panel="question">
<div class="toolbox-route-head"><div><div class="kicker">Begin bij wat je in de les ziet</div><h2>Welke situatie herken je?</h2></div><p>Je hoeft geen EAI-term te kennen. Kies de situatie die het meest lijkt op wat je als docent probeert te bereiken.</p></div>
<div class="toolbox-route-grid" aria-label="Kies een onderwijssituatie">{route_buttons}</div>
</section>

<section class="toolbox-mode-panel didactic-model-mode" data-mode-panel="model" id="didactisch-model" hidden>
<div class="toolbox-route-head"><div><div class="kicker">Bestaand model, eigen fasen</div><h2>Met welk model werk je?</h2></div><p>Je eigen didactische model blijft het vertrekpunt. Kies een fase of functie en bekijk welke werkvormen daar kunnen helpen bij leerlingdenken, ondersteuning en zelfstandig werken.</p></div>
<div class="didactic-model-grid">{model_buttons}</div>
<div class="didactic-model-catalog-note"><div><strong>Je hoeft niet met één van deze modellen te werken.</strong><p>Staat jouw model er niet bij? Begin dan bij een concrete onderwijsvraag. De werkvormen zijn niet afhankelijk van één vaste lesstructuur.</p></div><button type="button" data-switch-question>Begin bij mijn onderwijsvraag</button></div>
<div class="didactic-model-panels">{model_panels_html}</div>
<p class="didactic-model-boundary">{boundary_note}</p>
</section>

<section class="toolbox-results" id="resultaten" aria-live="polite">
<div class="toolbox-results-head"><div><div class="kicker">Werkvormen bij jouw vraag</div><h2 id="toolbox-result-title">Kies hierboven wat je in je les wilt bereiken</h2><p id="toolbox-result-copy">Je ziet daarna eerst een kleine selectie werkvormen die bij die vraag kunnen helpen.</p></div>
<div class="toolbox-results-tools">
<label class="toolbox-search"><span>Zoek</span><input id="toolbox-search" type="search" placeholder="Bijv. feedback, bron, vastlopen…" autocomplete="off"></label>
<button type="button" id="toolbox-show-saved">Bewaard <span id="saved-count">0</span></button>
</div></div>
<div class="toolbox-results-grid" id="toolbox-results-grid"></div>
<div class="toolbox-results-footer">
<button type="button" class="button secondary" id="toolbox-show-more" hidden>Bekijk meer werkvormen bij deze vraag</button>
<button type="button" class="text-button" id="toolbox-clear-route" hidden>Wis keuze</button>
</div>
<p class="toolbox-empty" id="toolbox-empty" hidden>Bij deze combinatie verschijnt nu geen werkvorm. Probeer een andere zoekterm of wis één van je keuzes.</p>
</section>

<details class="toolbox-library" id="alle-werkvormen">
<summary>Blader zelf door alle {len(items)} werkvormen</summary>
<div class="toolbox-library-tools">
<p>Weet je al ongeveer wat je nodig hebt? Filter op wie ermee werkt en op wat je bij de leerling wilt zien.</p>
<div class="toolbox-filters" aria-label="Filter alle werkvormen">
<label>Wie werkt ermee?<select data-toolbox-filter="audience"><option value="all">Alle werkvormen</option><option value="learner">Leerling</option><option value="teacher">Docent</option><option value="team">Docententeam</option></select></label>
<label>Wat wil je zien?<select data-toolbox-filter="evidence"><option value="all">Alle doelen</option><option value="process">Hoe de leerling werkt</option><option value="independent">Wat de leerling zelf kan</option><option value="retention">Of het later nog lukt</option><option value="transfer">Of het in een nieuwe situatie lukt</option><option value="design">Een les of opdracht ontwerpen</option></select></label>
</div></div>
<div class="toolbox-library-grid" id="toolbox-library-grid"></div>
</details>

<div class="toolbox-card-pool" id="toolbox-card-pool" hidden>{cards}</div>

<aside class="toolbox-standard-note"><strong>Waarom werkt de toolbox zo?</strong><p>Je lesdoel en didactische aanpak komen eerst. De werkvormen helpen daarna bij een concretere vraag: wat wil je dat de leerling zelf doet, welke hulp is passend en wat wil je na die hulp bij de leerling kunnen zien?</p><details><summary>Technische achtergrond</summary><p>De koppeling met didactische modellen is technisch vastgelegd in de EAI Standard. <a href="https://github.com/E-AI-MODEL/EAI-standard/tree/main/adapters" target="_blank" rel="noopener">Bekijk die technische laag ↗</a></p></details></aside>
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
  const switchQuestion = document.querySelector('[data-switch-question]');
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
      resultTitle.textContent = 'Hier verschijnen werkvormen bij jouw vraag';
      resultCopy.textContent = 'Kies een situatie of lesfase. Je ziet daarna eerst een kleine selectie werkvormen die bij die vraag kunnen helpen.';
      resultGrid.innerHTML = '';
    }} else if (savedOnly) {{
      resultTitle.textContent = 'Jouw bewaarde werkvormen';
      resultCopy.textContent = matches.length ? 'Deze werkvormen zijn alleen op dit apparaat bewaard.' : 'Je hebt nog geen werkvormen bewaard.';
    }} else if (activeRoute) {{
      resultTitle.textContent = activeRoute.title;
      resultCopy.textContent = activeRoute.copy;
    }} else {{
      resultTitle.textContent = 'Gevonden werkvormen';
      resultCopy.textContent = 'Je zoekterm komt voor bij ' + matches.length + ' werkvormen.';
    }}

    showMore.hidden = !activeRoute || activeRoute.exact || expanded || matches.length <= 4 || !!search.value.trim() || savedOnly;
    showMore.textContent = 'Bekijk meer werkvormen bij deze vraag';
    clearRoute.hidden = !activeRoute && !search.value.trim() && !savedOnly;
    empty.hidden = matches.length !== 0 || (!activeRoute && !search.value.trim() && !savedOnly);

    libraryGrid.innerHTML = '';
    sourceCards.filter(card => searchMatches(card) && matchesFilters(card)).forEach(card => libraryGrid.appendChild(cloneCard(card)));
    updateSavedCount();
  }};

  const setMode = (mode, options = {{}}) => {{
    const matchingTab = modeTabs.find(item => item.dataset.modeTab === mode);
    if (!matchingTab) return;
    modeTabs.forEach(item => item.setAttribute('aria-pressed', item === matchingTab ? 'true' : 'false'));
    modePanels.forEach(panel => panel.hidden = panel.dataset.modePanel !== mode);
    activeRoute = null;
    expanded = false;
    savedOnly = false;
    resetSelections();
    render();
    if (options.scroll) {{
      const target = mode === 'model' ? document.getElementById('didactisch-model') : matchingTab;
      target?.scrollIntoView({{behavior:'smooth', block:'start'}});
    }}
  }};

  modeTabs.forEach(tab => tab.addEventListener('click', () => {{
    setMode(tab.dataset.modeTab);
  }}));
  if (switchQuestion) switchQuestion.addEventListener('click', () => setMode('question', {{scroll:true}}));

  const applyHashMode = () => {{
    if (location.hash === '#didactisch-model') {{
      setMode('model');
      window.setTimeout(() => document.getElementById('didactisch-model')?.scrollIntoView({{block:'start'}}), 0);
    }}
  }};
  window.addEventListener('hashchange', applyHashMode);

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
  applyHashMode();
  const routeParam = new URLSearchParams(location.search).get('route');
  if (routeParam) {{
    const routeButton = routeButtons.find(button => button.dataset.routeKey === routeParam);
    if (routeButton) window.setTimeout(() => routeButton.click(), 0);
  }}
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
    lesson = item.get("lesson_card")
    public_title = item.get("public_title", item["title"])
    if lesson:
        lines = [
            public_title,
            "",
            "Doel:",
            lesson.get("goal", ""),
            "",
            "Wanneer:",
            lesson.get("when", ""),
            "",
            f'Tijd: {lesson.get("duration", "")}',
            f'Werkvorm: {lesson.get("grouping", "")}',
            "",
            "Startscript:",
        ]
        lines.extend(f"- {value}" for value in lesson.get("teacher_script", []))
        lines.extend(["", "Zo werkt het:"])
        lines.extend(f"{idx}. {step}" for idx, step in enumerate(item.get("steps", []), start=1))
        lines.extend(["", "Succescriteria voor de leerling:"])
        lines.extend(f"- {value}" for value in lesson.get("success_criteria", []))
        lines.extend(["", "Doorvragen:"])
        lines.extend(f"- {value}" for value in lesson.get("follow_up_questions", []))
        lines.extend(["", "Bewijs van leren:", lesson.get("evidence", "")])
        lines.extend(["", "Rol van AI:", lesson.get("ai_role", "")])
        lines.extend(["", "Let op:", item.get("caution", "")])
        return "\n".join(lines)

    action = item.get("action_layer", {})
    role_steps = action.get("role_steps", {})
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


def render_rich_lesson_card(item: dict) -> str:
    lesson = item["lesson_card"]
    copy_text = esc(workform_copy_text(item))

    facts = [
        ("Doel", lesson.get("goal", "")),
        ("Wanneer", lesson.get("when", "")),
        ("Tijd", lesson.get("duration", "")),
        ("Werkvorm", lesson.get("grouping", "")),
    ]
    facts_html = "".join(
        f'<article><span>{esc(label)}</span><p>{esc(value)}</p></article>'
        for label, value in facts if value
    )

    script_html = "".join(f'<li>“{esc(value)}”</li>' for value in lesson.get("teacher_script", []))
    steps_html = "".join(
        f'<li><span>{idx:02d}</span><p>{esc(step)}</p></li>'
        for idx, step in enumerate(item.get("steps", []), start=1)
    )
    success_html = "".join(f'<li>{esc(value)}</li>' for value in lesson.get("success_criteria", []))
    questions_html = "".join(f'<li>{esc(value)}</li>' for value in lesson.get("follow_up_questions", []))
    decisions_html = "".join(
        '<article>'
        f'<p><strong>Je ziet:</strong> {esc(rule.get("signal", ""))}</p>'
        f'<p><strong>Doe dan:</strong> {esc(rule.get("response", ""))}</p>'
        '</article>'
        for rule in lesson.get("decision_rules", [])
    )

    return (
        '<section class="section workform-quickstart workform-quickstart--rich"><div class="wrap">'
        '<div class="workform-lesson-card workform-lesson-card--rich" id="werkvormkaart">'
        '<div class="workform-toolbar"><div><span class="kicker">Morgen gebruiken</span><strong>Werkvormkaart</strong></div>'
        f'<div class="workform-toolbar-actions"><button type="button" data-copy-workform data-copy-text="{copy_text}">Kopieer</button>'
        '<button type="button" onclick="window.print()">Print</button><button type="button" data-share-workform>Deel</button></div></div>'
        f'<div class="lesson-facts">{facts_html}</div>'
        '<div class="lesson-card-grid">'
        '<section class="lesson-card-main">'
        f'<div class="lesson-purpose"><span>Waar deze werkvorm om draait</span><p>{esc(item.get("lede", ""))}</p>'
        f'<strong>{esc(item.get("question", ""))}</strong></div>'
        '<div class="lesson-block lesson-script"><div><span>Startscript</span><h2>Zo kun je beginnen.</h2></div>'
        f'<ul>{script_html}</ul></div>'
        '<div class="lesson-block"><div><span>Uitvoering</span><h2>Zo werkt het.</h2></div>'
        f'<ol class="lesson-steps">{steps_html}</ol></div>'
        '<div class="lesson-two-col">'
        '<div class="lesson-block compact"><div><span>Succescriteria</span><h3>Dit moet de leerling laten zien.</h3></div>'
        f'<ul class="lesson-checklist">{success_html}</ul></div>'
        '<div class="lesson-block compact"><div><span>Doorvragen</span><h3>Vragen die het denken openhouden.</h3></div>'
        f'<ul class="lesson-question-list">{questions_html}</ul></div>'
        '</div>'
        '</section>'
        '<aside class="lesson-card-side">'
        '<section class="lesson-example"><span>Voorbeeld uit de klas</span>'
        f'<p>{esc(item.get("example", ""))}</p></section>'
        '<section class="lesson-evidence"><span>Bewijs van leren</span>'
        f'<p>{esc(lesson.get("evidence", ""))}</p></section>'
        '<section class="lesson-ai-role"><span>Wat kan AI hier doen?</span>'
        f'<p>{esc(lesson.get("ai_role", ""))}</p></section>'
        '</aside>'
        '</div>'
        f'<div class="lesson-decisions"><div class="lesson-decisions-head"><span>Bijsturen tijdens de les</span><h2>Wat doe je als het niet loopt zoals bedoeld?</h2></div><div class="lesson-decision-grid">{decisions_html}</div></div>'
        '<div class="lesson-card-bottom">'
        '<article><span>Variant</span><p>' + esc(lesson.get("variant", "")) + '</p></article>'
        '<article class="lesson-caution"><span>Wat kun je hierna nog niet zeggen?</span><p>' + esc(item.get("caution", "")) + '</p></article>'
        '</div>'
        '</div></div>'
        '<script>(()=>{const copy=document.querySelector("[data-copy-workform]");const share=document.querySelector("[data-share-workform]");'
        'if(copy){copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(copy.dataset.copyText||"");const old=copy.textContent;copy.textContent="Gekopieerd";setTimeout(()=>copy.textContent=old,1400)}catch(_){}})}'
        'if(share){share.addEventListener("click",async()=>{if(navigator.share){try{await navigator.share({title:document.title,url:location.href})}catch(_){}}else{try{await navigator.clipboard.writeText(location.href);const old=share.textContent;share.textContent="Link gekopieerd";setTimeout(()=>share.textContent=old,1400)}catch(_){}}})}})();</script>'
        '</section>'
    )


def render_workform_quickstart(item: dict) -> str:
    if item.get("lesson_card"):
        return render_rich_lesson_card(item)

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
        action = other.get("action_layer", {})
        teacher_copy = other.get("card_teacher") or action.get("teacher", "")
        learner_copy = other.get("card_learner") or action.get("learner", "")
        teacher_html = f'<div><b>Als docent</b> {esc(teacher_copy)}</div>' if teacher_copy else ""
        learner_html = f'<div><b>De leerling</b> {esc(learner_copy)}</div>' if learner_copy else ""
        cards.append(
            f'<a class="related-workform-card" href="/werkvormen/{esc(other["slug"])}/">'
            f'<span>Mogelijke vervolgstap</span><h3>{esc(other.get("public_title", other["title"]))}</h3>'
            f'<p>{esc(other["summary"])}</p>'
            f'{teacher_html}{learner_html}'
            f'<strong>Bekijk deze werkvorm →</strong></a>'
        )
    return (
        '<section class="section related-workforms"><div class="wrap">'
        '<div class="section-head"><div class="kicker">Mogelijke vervolgstappen</div><div><h2>Wat kun je hierna proberen?</h2>'
        '<p>Kies alleen een vervolg dat past bij wat je zojuist bij de leerling zag. Dit is geen vaste volgorde.</p></div></div>'
        f'<div class="related-workform-grid">{"".join(cards)}</div>'
        '<p class="related-all"><a href="/werkvormen/">Blader door alle werkvormen →</a></p>'
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
        f'<h2>{esc(mechanism.get("title", "De leerstap achter de werkvorm"))}</h2>'
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

def render_teacher_explanation(item: dict) -> str:
    info = item.get("teacher_explanation")
    if not info:
        return ""

    why_html = "".join(
        '<article>'
        f'<h3>{esc(block.get("title", ""))}</h3>'
        f'<p>{esc(block.get("text", ""))}</p>'
        '</article>'
        for block in info.get("why_it_matters", [])
    )

    watch_html = "".join(
        '<article>'
        f'<div><span>Je ziet</span><p>{esc(block.get("signal", ""))}</p></div>'
        f'<div><span>Dat kan betekenen</span><p>{esc(block.get("meaning", ""))}</p></div>'
        f'<div class="teacher-watch-move"><span>Jouw volgende stap</span><p>{esc(block.get("teacher_move", ""))}</p></div>'
        '</article>'
        for block in info.get("what_to_watch", [])
    )

    interpretation_html = "".join(
        '<article>'
        f'<span>{esc(block.get("label", ""))}</span>'
        f'<p>{esc(block.get("text", ""))}</p>'
        '</article>'
        for block in info.get("interpretation", [])
    )

    examples_html = "".join(
        '<article>'
        f'<span>{esc(block.get("subject", ""))}</span>'
        f'<p><strong>Start:</strong> {esc(block.get("situation", ""))}</p>'
        f'<p><strong>Vergelijk:</strong> {esc(block.get("compare", ""))}</p>'
        f'<p><strong>Daarna zelf:</strong> {esc(block.get("reconstruct", ""))}</p>'
        f'<p><strong>Kijk naar:</strong> {esc(block.get("look_for", ""))}</p>'
        '</article>'
        for block in info.get("subject_examples", [])
    )

    council = info.get("onderwijsraad", {})
    council_html = "".join(
        '<article>'
        f'<div class="teacher-council-source"><span>Onderwijsraad · {esc(src.get("year", ""))}</span>'
        f'<h3>{esc(src.get("title", ""))}</h3></div>'
        f'<p><strong>Wat de Onderwijsraad zegt:</strong> {esc(src.get("principle", ""))}</p>'
        f'<p><strong>Vertaling naar deze werkvorm:</strong> {esc(src.get("translation", ""))}</p>'
        f'<a href="{esc(src.get("url", ""))}" target="_blank" rel="noopener">Bekijk de bron bij de Onderwijsraad ↗</a>'
        '</article>'
        for src in council.get("sources", [])
    )

    return (
        '<section class="section teacher-explanation"><div class="wrap">'
        '<div class="teacher-explanation-intro">'
        '<div><div class="kicker">Voor de docent</div>'
        f'<h2>{esc(info.get("title", ""))}</h2></div>'
        f'<p>{esc(info.get("intro", ""))}</p>'
        '</div>'
        f'<div class="teacher-why-grid">{why_html}</div>'
        '<div class="teacher-watch-section">'
        '<div class="section-head"><div class="kicker">Tijdens de uitvoering</div><div><h2>Waar kijk je naar?</h2>'
        '<p>De reactie van de leerling bepaalt je volgende stap. Deze signalen helpen om verschil te zien tussen herkennen, toepassen en zelfstandig uitvoeren.</p></div></div>'
        f'<div class="teacher-watch-grid">{watch_html}</div>'
        '</div>'
        '<div class="teacher-interpretation">'
        '<div><div class="kicker">Wat mag je concluderen?</div><h2>Lees de uitkomst niet groter dan hij is.</h2></div>'
        f'<div class="teacher-interpretation-grid">{interpretation_html}</div>'
        '</div>'
        '<div class="teacher-subject-examples">'
        '<div class="section-head"><div class="kicker">Drie vakken</div><div><h2>Dezelfde didactische logica, andere inhoud.</h2>'
        '<p>De kern blijft gelijk: eerst zelf, dan gericht vergelijken, voorbeelden weg en opnieuw zelf handelen.</p></div></div>'
        f'<div class="teacher-subject-grid">{examples_html}</div>'
        '</div>'
        '<div class="teacher-council">'
        '<div class="teacher-council-head"><div class="kicker">Onderwijsraad</div><h2>Waarom past deze keuze bij breder advies over technologie en toetsing?</h2>'
        f'<p>{esc(council.get("intro", ""))}</p></div>'
        f'<div class="teacher-council-grid">{council_html}</div>'
        '<p class="teacher-council-note"><strong>Belangrijk:</strong> de Onderwijsraad beschrijft deze EAI-werkvorm niet. De bronblokken hierboven geven eerst het uitgangspunt van de raad weer en daarna expliciet onze vertaling naar deze werkvorm.</p>'
        '</div>'
        '</div></section>'
    )


def render_catalog_workform(item: dict, all_items: list[dict]) -> str:
    steps = "".join(f"<li>{esc(step)}</li>" for step in item.get("steps", []))
    audience = " · ".join(WORKFORM_AUDIENCE_LABELS.get(value, value) for value in item.get("audience", []))
    public_title = item.get("public_title", item["title"])
    technical = item["title"] if public_title != item["title"] else ""
    rich = bool(item.get("lesson_card"))

    if technical and rich:
        technical_html = (
            '<details class="workform-tech-label"><summary>Technische EAI-term</summary>'
            f'<p>{esc(technical)}</p></details>'
        )
    else:
        technical_html = f'<p class="workform-technical-name detail">EAI-term: {esc(technical)}</p>' if technical else ""

    visual_html = render_workform_visual(item.get("visual"))
    visual_section = f'<section class="section"><div class="wrap">{visual_html}</div></section>' if visual_html else ""
    quickstart_html = render_workform_quickstart(item)
    foundation_html = render_workform_underpinning(item)
    related_html = render_related_workforms(item, all_items)
    teacher_html = render_teacher_explanation(item)

    if rich:
        position_html = (
            '<section class="section workform-position"><div class="wrap"><details>'
            '<summary>Waar past deze werkvorm in EAI?</summary>'
            f'{render_route(item.get("route", []))}'
            '<p>Deze plaatsbepaling is bedoeld als achtergrond. Voor gebruik in de les kun je direct met de werkvormkaart hierboven werken.</p>'
            '</details></div></section>'
        )
        return f'''<main>
<section class="page-hero workform-hero--practical"><div class="wrap"><div class="eyebrow">Werkvorm voor de les</div><h1>{esc(public_title)}</h1><p class="lede">{esc(item["summary"])}</p>{technical_html}</div></section>
{quickstart_html}
{teacher_html}
{visual_section}
{position_html}
{foundation_html}
{related_html}
</main>'''

    example_html = render_workform_example(item)
    return f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm · {esc(audience)}</div><h1>{esc(public_title)}</h1>{technical_html}<p class="lede">{esc(item["summary"])}</p>{render_route(item.get("route", []))}</div></section>
{quickstart_html}
{visual_section}
{example_html}
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Zo doe je het</div><div><h2>Werk stap voor stap.</h2><p>Pas de formulering aan je vak en klas aan. De volgorde bewaakt dat de leerstap niet ongemerkt uit beeld verdwijnt.</p></div></div><div class="panel workform-steps"><ol>{steps}</ol></div></div></section>
<section class="section"><div class="wrap"><div class="split"><article class="panel"><div class="kicker">Daarna</div><h3>Waar kijk je naar?</h3><p>{esc(item["result"])}</p></article><article class="panel"><div class="kicker">Let op</div><h3>Wat kun je nog niet concluderen?</h3><p>{esc(item["caution"])}</p></article></div><p><a href="/werkvormen/">← Terug naar de werkvormen</a></p></div></section>
{foundation_html}
{related_html}
</main>'''

TOOLS = [
    ("EAI Toolanalyse", "Analyseer een AI-toepassing op leerwaarde en didactische invloed.", "https://subtle-churros-4d44d5.netlify.app", "Open EAI Toolanalyse"),
    ("EAI Prompt Builder — Sturen met taal", "Zie hoe taal, meegegeven informatie en grenzen samen bepalen wat AI in een taak doet.", "https://eai-prompt.lovable.app/", "Open Prompt Builder"),
    ("EAI Toolkit: Beyond Explainability", "Werk met de begrippen uit Beyond Explainability in een praktische toolkit.", "/tools/beyond-explainability/", "Open Beyond Explainability"),
    ("Act of Learning Game", "Interactieve toepassing rond de vraag wie het denkwerk uitvoert.", "https://rainbow-tarsier-a88e9b.netlify.app/", "Open Act of Learning Game"),
    ("EAI What-If Machine", "Verken alternatieven in lesontwerp en AI-inzet.", "https://what-if-lesson-designer.lovable.app/", "Open EAI What-If Machine"),
    ("Toolkit The Act of Learning", "Engelstalige toolkit bij The Act of Learning.", "https://effortless-fenglisu-71cd58.netlify.app/", "Open The Act of Learning toolkit"),
    ("EAA Model Tool", "Verken eigenaarschap, autonomie en agency in leren.", "https://sunny-blancmange-dec4a1.netlify.app", "Open EAA Model Tool"),
]

SITE_CSS = r'''
:root{--paper:#f4f0e8;--paper2:#fffdf8;--ink:#12161d;--muted:#5f6570;--line:#d7d0c4;--blue:#143a63;--accent:#efb83f;--max:1180px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}a{color:inherit}.site-header{position:sticky;top:0;z-index:20;background:rgba(244,240,232,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}.nav{max-width:var(--max);margin:0 auto;min-height:68px;padding:0 24px;display:flex;align-items:center;gap:28px}.brand{display:inline-flex;align-items:center;text-decoration:none;flex:0 0 auto}.brand img{display:block;width:38px;height:38px;transition:transform .18s ease}.brand:hover img{transform:translateY(-1px)}.nav-links{margin-left:auto;display:flex;align-items:center;gap:22px;flex-wrap:wrap}.nav-links a{text-decoration:none;font-size:.93rem;color:#303641}.nav-links a:hover{text-decoration:underline;text-underline-offset:5px}.nav-cta{border:1px solid var(--ink);padding:8px 12px}.nav-group{position:relative}.nav-group>summary{cursor:pointer;list-style:none;font-size:.93rem;color:#303641;padding:8px 0}.nav-group>summary::-webkit-details-marker{display:none}.nav-group>summary::after{content:"⌄";display:inline-block;margin-left:6px;font-size:.82em;transition:transform .15s ease}.nav-group[open]>summary::after{transform:rotate(180deg)}.nav-group.is-current>summary{font-weight:800}.nav-group-panel{position:absolute;right:0;top:calc(100% + 10px);min-width:230px;background:#fff;border:1px solid var(--line);box-shadow:0 14px 34px rgba(32,41,54,.14);padding:8px;display:grid;z-index:40}.nav-group-panel a{padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}.nav-group-panel a:last-child{border-bottom:0}.nav-group-panel a:hover{background:var(--soft);text-decoration:none}.mobile-nav-group>summary{cursor:pointer;list-style:none;padding:10px 8px;border-bottom:1px solid var(--line);font-weight:800}.mobile-nav-group>summary::-webkit-details-marker{display:none}.mobile-nav-group>summary::after{content:"+";float:right}.mobile-nav-group[open]>summary::after{content:"−"}.mobile-nav-group.is-current>summary{background:var(--soft)}.mobile-nav-sub{display:grid;padding:4px 0 8px 14px;border-bottom:1px solid var(--line)}.mobile-nav-sub a{font-size:.88rem}.hub-hero{padding-bottom:44px}.hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.hub-card{display:flex;flex-direction:column;text-decoration:none;border:1px solid var(--line);background:#fff;padding:26px;min-height:250px}.hub-card>span{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:var(--blue)}.hub-card h2,.hub-card h3{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.025em;margin:16px 0 12px}.hub-card h2{font-size:2rem}.hub-card h3{font-size:1.5rem}.hub-card p{color:var(--muted);margin:0 0 22px}.hub-card b{margin-top:auto;font-size:.9rem}.hub-card:hover{border-color:#979083;transform:translateY(-2px)}.hub-card--wide{grid-column:span 2}.hub-disclosure{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff}.hub-disclosure>summary{cursor:pointer;list-style:none;padding:22px 0;font-weight:800;font-size:1rem}.hub-disclosure>summary::-webkit-details-marker{display:none}.hub-disclosure>summary::after{content:"+";float:right;font-size:1.3rem}.hub-disclosure[open]>summary::after{content:"−"}.hub-disclosure-body{padding:0 0 28px}.home-entry-grid{grid-template-columns:repeat(5,minmax(0,1fr))}@media(max-width:980px){.hub-grid{grid-template-columns:1fr 1fr}.hub-card--wide{grid-column:span 2}.home-entry-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.hub-grid{grid-template-columns:1fr}.hub-card--wide{grid-column:auto}.home-entry-grid{grid-template-columns:1fr}}.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}.hero{min-height:72vh;display:grid;align-items:center;border-bottom:1px solid var(--line)}.hero-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.55fr);gap:70px;padding:96px 0 86px}.eyebrow,.kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.12em;font-size:.76rem;font-weight:700;color:var(--blue)}h1,h2,h3{line-height:1.05}h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(3.8rem,8vw,7.6rem);font-weight:500;letter-spacing:-.055em;margin:.14em 0 .28em;max-width:11ch}.lede{font-size:clamp(1.12rem,2vw,1.38rem);max-width:65ch;color:#333943;margin:0 0 30px}.hero-note{border-left:4px solid var(--accent);padding:4px 0 4px 22px;align-self:end}.hero-note strong{font-size:1.1rem;display:block;margin-bottom:8px}.hero-note p{color:var(--muted);margin:0}.button-row{display:flex;gap:12px;flex-wrap:wrap}.button{display:inline-block;text-decoration:none;border:1px solid var(--ink);padding:11px 16px;font-weight:650;background:var(--ink);color:var(--paper2)}.button.secondary{background:transparent;color:var(--ink)}.button:hover{transform:translateY(-1px)}.section{padding:86px 0;border-bottom:1px solid var(--line)}.section-head{display:grid;grid-template-columns:220px 1fr;gap:32px;margin-bottom:44px}.section-head h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.3rem,4vw,4.2rem);font-weight:500;letter-spacing:-.035em;margin:0}.section-head p{max-width:60ch;color:var(--muted);margin:.4em 0 0}.split{display:grid;grid-template-columns:1fr 1fr;gap:22px}.panel{background:var(--paper2);border:1px solid var(--line);padding:30px;min-height:270px}.panel h3{font-family:Georgia,"Times New Roman",serif;font-size:2rem;font-weight:500;margin:14px 0 12px}.panel p{color:#414751}.panel ul{padding-left:20px}.badge{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--ink);padding:4px 8px}.card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:var(--paper2);border:1px solid var(--line);padding:26px;min-height:260px;display:flex;flex-direction:column;text-decoration:none;transition:.18s ease}.card:hover{border-color:#979083;transform:translateY(-2px)}.card .meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--blue)}.card h3{font-family:Georgia,"Times New Roman",serif;font-size:1.75rem;font-weight:500;letter-spacing:-.025em;margin:18px 0 12px}.card p{color:var(--muted);margin:0 0 22px}.card .arrow{margin-top:auto;font-weight:750}.list-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--line)}.list-item{padding:24px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:120px 1fr;gap:16px}.list-item:nth-child(odd){padding-right:28px}.list-item:nth-child(even){padding-left:28px;border-left:1px solid var(--line)}.list-item strong{font-size:1rem}.list-item p{color:var(--muted);margin:4px 0 0}.project{background:var(--blue);color:white}.project .section-head p{color:#d6e0eb}.project .kicker{color:#f4cf70}.project .button.secondary{border-color:white;color:white}.site-footer{padding:38px 0 52px}.footer-grid{display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.footer-grid p{margin:0;color:var(--muted);font-size:.9rem}.footer-grid a{text-underline-offset:4px}.page-hero{padding:96px 0 54px;border-bottom:1px solid var(--line)}.page-hero h1{font-size:clamp(3.2rem,6vw,6.2rem);max-width:14ch}.page-hero .lede{max-width:68ch}.tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.tool-card{background:var(--paper2);border:1px solid var(--line);padding:28px;display:flex;flex-direction:column;min-height:235px}.tool-card h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;font-size:2rem;margin:8px 0 12px}.tool-card p{color:var(--muted);margin:0 0 24px}.tool-card a{margin-top:auto;font-weight:750;text-underline-offset:5px}.notice{padding:18px 20px;background:#fff7dc;border:1px solid #e8ce79;color:#4e431d;margin:30px 0}.pillars{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--ink);background:var(--paper2)}.pillar{padding:38px;min-height:330px}.pillar+.pillar{border-left:1px solid var(--ink)}.pillar .num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}.pillar h3{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.2rem,4vw,3.4rem);font-weight:500;letter-spacing:-.035em;margin:20px 0 16px}.pillar p{max-width:42ch;color:#414751}.bridge{padding:24px 0 0;font-size:1.16rem;max-width:72ch}.workform{background:var(--paper2);border-top:1px solid var(--line);padding:24px 0;display:grid;grid-template-columns:180px 1fr 130px;gap:22px;align-items:start}.workform:last-child{border-bottom:1px solid var(--line)}.workform p{margin:0;color:var(--muted)}.workform a{font-weight:700;text-underline-offset:5px}.reading-strip{display:grid;grid-template-columns:1fr 1fr;gap:18px}.reading{border-top:3px solid var(--ink);padding-top:18px}.reading h3{font-family:Georgia,"Times New Roman",serif;font-size:1.8rem;font-weight:500;margin:0 0 10px}.reading p{color:var(--muted)}.article-shell{padding:0 24px}.article-body{max-width:820px;margin:0 auto;padding:86px 0 110px;font-family:Georgia,"Times New Roman",serif;font-size:1.15rem;line-height:1.78}.article-header{padding-bottom:42px;margin-bottom:44px;border-bottom:1px solid var(--line)}.article-header h1{max-width:12ch;font-size:clamp(3.4rem,7vw,6.7rem);margin:.16em 0 .22em}.article-subtitle{font-size:1.35rem;color:#343a43;margin:0 0 12px}.article-meta{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.86rem;color:var(--muted)}.article-body>p,.article-body>ul,.article-body>ol,.article-body>blockquote{max-width:720px;margin-left:auto;margin-right:auto}.article-body h2{max-width:720px;margin:70px auto 22px;font-size:clamp(2rem,4vw,3.1rem);font-weight:500;letter-spacing:-.03em}.article-intro{font-size:1.27rem}.article-body blockquote{font-size:1.5rem;line-height:1.42;border-left:4px solid var(--accent);padding:10px 0 10px 24px;margin-top:34px;margin-bottom:34px}.article-body blockquote.question{font-style:italic}.article-steps{padding-left:26px}.article-steps li{padding:5px 0}.article-pillars{max-width:820px;margin:34px auto;display:grid;grid-template-columns:1fr 1fr;background:var(--paper2);border:1px solid var(--ink)}.article-pillars>div{padding:28px}.article-pillars>div+div{border-left:1px solid var(--ink)}.article-pillars strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:1.55rem;margin:18px 0 8px}.article-pillars p{margin:0;color:#424852}.article-action{max-width:820px;margin:58px auto;padding:30px;border:1px solid var(--line);background:var(--paper2);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.article-action h3{font-family:Georgia,"Times New Roman",serif;font-size:2rem;font-weight:500;margin:12px 0}.article-action p{max-width:65ch;color:#464c56}.article-action a{font-weight:750;text-underline-offset:5px}.article-action.final{border-color:var(--ink)}.article-signoff{font-style:italic;margin-top:36px}.feature-publication{display:grid;grid-template-columns:1.2fr .8fr;gap:40px;padding:38px;border:1px solid var(--ink);background:var(--paper2);margin-bottom:36px}.feature-publication h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.4rem,4vw,4rem);font-weight:500;letter-spacing:-.035em;margin:14px 0}.feature-publication p{color:#404650}.feature-publication .question-mark{font-family:Georgia,"Times New Roman",serif;font-size:10rem;line-height:.8;text-align:center;align-self:center;color:var(--blue)}.mini-note{font-size:.88rem;color:var(--muted)}.citation-box{max-width:720px;margin:26px auto 46px;padding:18px 20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.9rem}.citation-box p{margin:6px 0;color:#444a54}.citation-box code{font-size:.82rem;word-break:break-all}.media-feature{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:34px;align-items:center}.media-copy h2,.app-copy h2{font-family:Georgia,"Times New Roman",serif;font-size:clamp(2.35rem,4vw,4rem);font-weight:500;letter-spacing:-.035em;margin:10px 0 16px}.media-copy p,.app-copy p{color:var(--muted);max-width:58ch}.embed-card{background:var(--paper2);border:1px solid var(--line);padding:12px}.embed-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 4px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.embed-dots{display:inline-flex;gap:5px}.embed-dots i{width:7px;height:7px;border-radius:50%;background:#a8a29a}.embed-window{position:relative;width:100%;aspect-ratio:16/9;background:#0b1020;overflow:hidden}.embed-window.app{aspect-ratio:16/10;background:#fff}.embed-window iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.app-showcase{display:grid;grid-template-columns:minmax(250px,.42fr) minmax(0,1fr);gap:28px;align-items:center;padding:30px 0;border-top:1px solid var(--line)}.app-showcase:last-child{border-bottom:1px solid var(--line)}.app-copy .button-row{margin-top:22px}.app-tag{display:inline-block;margin-bottom:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--blue)}.source-note{font-size:.82rem;color:var(--muted);margin-top:12px}.source-note a{text-underline-offset:4px}

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
.toolbox-result-actions p{display:block;margin:0;font-size:.79rem;line-height:1.45;color:#3f4a57}.toolbox-result-actions b{font-weight:750}
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




.home-first-example{background:#fff}
.first-example-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.first-example-grid article{border:1px solid var(--line);border-top:4px solid var(--ink);background:#fff;padding:24px;min-height:300px}
.first-example-grid article:nth-child(2){border-top-color:var(--accent)}
.first-example-grid article:nth-child(3){border-top-color:var(--blue)}
.first-example-grid span{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#718096}
.first-example-grid h3{font-size:1.35rem;margin:16px 0 10px}
.first-example-grid p{margin:0;color:var(--muted)}
.home-guide-strip{padding-top:28px!important;padding-bottom:28px!important;background:var(--soft)}
.home-guide-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.home-guide-grid a{display:grid;grid-template-columns:1fr auto;gap:6px 12px;background:#fff;padding:18px;text-decoration:none}
.home-guide-grid span{grid-column:1/-1;font:800 .66rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#718096}
.home-guide-grid strong{font:800 .9rem/1.35 Inter,ui-sans-serif,sans-serif}
.home-guide-grid b{align-self:center;font-family:Inter,ui-sans-serif,sans-serif}
.home-guide-grid a:hover{background:#fbfaf7}
@media(max-width:980px){.first-example-grid{grid-template-columns:1fr}.first-example-grid article{min-height:0}.home-guide-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.home-guide-grid{grid-template-columns:1fr}}

/* Domain-overstijgende homepage */
.home-values{background:#fbfaf7}
.home-value-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.home-value-grid article{background:#fff;padding:24px;min-height:250px}
.home-value-grid span,.domain-case>span{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:var(--accent)}
.home-value-grid h3{font-size:1.28rem;margin:18px 0 10px}
.home-value-grid p{margin:0;color:var(--muted)}
.domain-case-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.domain-case{display:flex;flex-direction:column;border:1px solid var(--line);border-top:4px solid var(--ink);background:#fff;padding:24px;min-height:340px}
.domain-case:nth-child(2){border-top-color:var(--accent)}
.domain-case:nth-child(3){border-top-color:var(--blue)}
.domain-case h3{font-size:1.45rem;margin:16px 0 12px}
.domain-case p{margin:0 0 20px;color:var(--muted)}
.domain-case a{margin-top:auto;font:800 .84rem/1.3 Inter,ui-sans-serif,sans-serif;text-underline-offset:4px}
.domain-proof-note{max-width:78ch;margin:22px 0 0;color:var(--muted);font-size:.9rem}
@media(max-width:980px){.home-value-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.domain-case-grid{grid-template-columns:1fr}.domain-case{min-height:0}}
@media(max-width:700px){.home-value-grid{grid-template-columns:1fr}.home-value-grid article{min-height:0}}

/* Content-growth navigation and hub UX */
.home-entry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.home-entry-grid a{display:flex;flex-direction:column;min-height:240px;padding:24px;border:1px solid var(--line);background:#fff;text-decoration:none}
.home-entry-grid a:hover{border-color:var(--ink);transform:translateY(-1px)}
.home-entry-grid span,.workform-collection-card>span{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#718096}
.home-entry-grid h3{font-size:1.55rem;margin:16px 0 10px;max-width:22ch}
.home-entry-grid p{margin:0 0 18px;color:var(--muted);max-width:56ch}
.home-entry-grid b{margin-top:auto;font-family:Inter,ui-sans-serif,sans-serif}
.home-practice-links{display:flex;gap:20px;flex-wrap:wrap;margin-top:28px;font-family:Inter,ui-sans-serif,sans-serif;font-weight:800}
.workform-collections{padding-top:34px;padding-bottom:34px}
.workform-collection-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.workform-collection-card{display:flex;flex-direction:column;min-height:220px;padding:24px;border:1px solid var(--line);background:#fff;text-decoration:none}
.workform-collection-card.is-eai{border-top:4px solid var(--ink)}
.workform-collection-card.is-taal{border-top:4px solid var(--accent)}
.workform-collection-card>strong{font:800 1.5rem/1.2 Inter,ui-sans-serif,sans-serif;margin:16px 0 10px}
.workform-collection-card>p{margin:0 0 18px;color:var(--muted)}
.workform-collection-card>b{margin-top:auto;font-family:Inter,ui-sans-serif,sans-serif}
.workform-collection-card:hover{border-color:var(--ink)}
.source-register-cta{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;border-left:5px solid var(--accent);background:var(--soft);padding:28px}
.source-register-cta h2{margin:7px 0 8px}.source-register-cta p{margin:0;max-width:70ch}
@media(max-width:980px){.welcome-shortcuts{grid-template-columns:repeat(2,minmax(0,1fr))}.welcome-shortcuts a:nth-child(2){border-right:0;padding-right:0}.welcome-shortcuts a:nth-child(3){padding-left:0;border-top:1px solid var(--line)}.welcome-shortcuts a:nth-child(4){border-right:0;border-top:1px solid var(--line);padding-right:0}}
@media(max-width:760px){.home-entry-grid,.workform-collection-grid{grid-template-columns:1fr}.home-entry-grid a,.workform-collection-card{min-height:0}.source-register-cta{grid-template-columns:1fr}.welcome-shortcuts{grid-template-columns:1fr}.welcome-shortcuts a,.welcome-shortcuts a:first-child,.welcome-shortcuts a:nth-child(2),.welcome-shortcuts a:nth-child(3),.welcome-shortcuts a:nth-child(4){padding:15px 0;border-right:0;border-top:0;border-bottom:1px solid var(--line)}.welcome-shortcuts a:last-child{border-bottom:0}}


/* Source-preserving didactic model adapters */
.toolbox-mode-tabs{display:inline-flex;gap:0;border:1px solid var(--line);margin:0 0 34px;background:#fff}
.toolbox-mode-tab{appearance:none;border:0;border-right:1px solid var(--line);background:#fff;color:var(--ink);padding:12px 16px;cursor:pointer;font:800 .84rem/1.2 Inter,ui-sans-serif,sans-serif}
.toolbox-mode-tab:last-child{border-right:0}
.toolbox-mode-tab[aria-pressed="true"]{background:var(--ink);color:#fff}
.didactic-model-mode{scroll-margin-top:90px}
.didactic-model-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:22px}
.didactic-model-button{appearance:none;border:1px solid var(--line);background:#fff;color:var(--ink);text-align:left;padding:18px;cursor:pointer;display:flex;flex-direction:column;min-height:145px}
.didactic-model-button>span{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#718096}
.didactic-model-button>strong{font:800 1.05rem/1.25 Inter,ui-sans-serif,sans-serif;margin:10px 0}
.didactic-model-button>small{margin-top:auto;color:var(--muted);font:400 .78rem/1.4 Inter,ui-sans-serif,sans-serif}
.didactic-model-button:hover,.didactic-model-button[aria-pressed="true"]{border-color:var(--ink);background:var(--soft)}
.didactic-model-button[aria-pressed="true"]>span{color:var(--accent)}
.didactic-model-detail{border-top:1px solid var(--line);padding-top:26px;margin-top:12px}
.didactic-model-detail-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.55fr);gap:28px;align-items:start;margin-bottom:20px}
.didactic-model-detail-head h3{font-size:clamp(1.7rem,3vw,2.5rem);margin:8px 0 10px}
.didactic-model-detail-head p{margin:0;color:var(--muted);max-width:70ch}
.didactic-model-source{display:grid;gap:7px;border-left:3px solid var(--accent);padding-left:14px;font:400 .76rem/1.4 Inter,ui-sans-serif,sans-serif;color:#687487}
.didactic-model-source a{font-weight:750;text-underline-offset:3px}
.didactic-phase-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.didactic-phase{appearance:none;border:1px solid var(--line);background:#fff;color:var(--ink);text-align:left;padding:16px;cursor:pointer;display:grid;grid-template-columns:34px 1fr;grid-template-areas:"num title" "num copy";gap:7px 9px;min-height:140px}
.didactic-phase>span{grid-area:num;font:800 .68rem/1.3 Inter,ui-sans-serif,sans-serif;color:#98a2af}
.didactic-phase>strong{grid-area:title;font:800 .95rem/1.25 Inter,ui-sans-serif,sans-serif}
.didactic-phase>small{grid-area:copy;color:var(--muted);font:400 .78rem/1.4 Inter,ui-sans-serif,sans-serif}
.didactic-phase:hover,.didactic-phase[aria-pressed="true"]{border-color:var(--ink);background:#fbfaf7}
.didactic-phase[aria-pressed="true"]{box-shadow:inset 3px 0 0 var(--accent)}
.didactic-cross-cutting{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--line);font-family:Inter,ui-sans-serif,sans-serif}
.didactic-cross-cutting strong{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#718096;margin-right:4px}
.didactic-cross-cutting span{background:var(--soft);padding:5px 8px;font-size:.76rem;font-weight:700}
.didactic-model-boundary{margin:22px 0 0;padding:14px 16px;border-left:4px solid var(--accent);background:var(--soft);color:#556171;font-size:.9rem}
@media(max-width:900px){
  .didactic-model-grid,.didactic-phase-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .didactic-model-detail-head{grid-template-columns:1fr}
}
@media(max-width:700px){
  .toolbox-mode-tabs{display:grid;width:100%}
  .toolbox-mode-tab{border-right:0;border-bottom:1px solid var(--line);text-align:left}
  .toolbox-mode-tab:last-child{border-bottom:0}
  .didactic-model-grid,.didactic-phase-grid{grid-template-columns:1fr}
  .didactic-model-button,.didactic-phase{min-height:0}
}

.didactic-model-catalog-note{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;margin:14px 0 22px;padding:16px 18px;border-left:4px solid var(--accent);background:#fbfaf7}
.didactic-model-catalog-note strong{font-family:Inter,ui-sans-serif,sans-serif;font-size:.9rem}
.didactic-model-catalog-note p{margin:5px 0 0;color:var(--muted);max-width:70ch}
.didactic-model-catalog-note button{appearance:none;border:1px solid var(--line);background:#fff;padding:10px 12px;cursor:pointer;font:750 .78rem/1.2 Inter,ui-sans-serif,sans-serif;white-space:nowrap}
.didactic-model-catalog-note button:hover{border-color:var(--ink)}
@media(max-width:760px){.didactic-model-catalog-note{grid-template-columns:1fr}.didactic-model-catalog-note button{white-space:normal;width:100%}}


/* TAALwerkvormen + bronnen */
.taal-hero .lede,.sources-hero .lede{max-width:800px}
.taal-cycle{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:24px;font:800 .72rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.05em}
.taal-cycle span{border:1px solid var(--line);background:#fff;padding:8px 10px}.taal-cycle b{color:var(--accent)}
.taal-guide-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin-bottom:30px}.taal-guide-facts>div{background:var(--soft);padding:18px}.taal-guide-facts strong{display:block;font:850 1.55rem/1 Inter,ui-sans-serif,sans-serif;color:var(--ink);margin-bottom:6px}.taal-guide-facts span{font:700 .72rem/1.3 Inter,ui-sans-serif,sans-serif;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.taal-longcopy{border-top:1px solid var(--line)}.taal-longcopy>section{display:grid;grid-template-columns:54px minmax(0,1fr);gap:20px;padding:28px 0;border-bottom:1px solid var(--line)}.taal-longcopy>section>span{font:800 .7rem/1 Inter,ui-sans-serif,sans-serif;color:var(--accent);padding-top:7px}.taal-longcopy h3{font-size:1.35rem;margin:0 0 12px}.taal-longcopy p{max-width:78ch;margin:0 0 12px}.taal-longcopy p:last-child{margin-bottom:0}
.taal-principles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.taal-principles article{background:#fff;padding:22px;min-height:220px}.taal-principles span,.sources-legend span{font:800 .7rem/1 Inter,ui-sans-serif,sans-serif;color:var(--accent)}
.taal-principles h3,.sources-legend h3{font-size:1.2rem;margin:24px 0 10px}.taal-principles p,.sources-legend p{margin:0;color:var(--muted)}
.taal-how{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);margin-top:24px}.taal-how>div{background:var(--soft);padding:24px}.taal-how h3{margin-top:0}.taal-how ol{margin-bottom:0;padding-left:20px}.taal-how p{margin:8px 0}
.taal-three-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.taal-three-grid article{border-top:3px solid var(--ink);padding:18px 0}.taal-three-grid span{font:800 .68rem/1 Inter,ui-sans-serif,sans-serif;color:var(--accent)}.taal-three-grid h3{font-size:1.25rem;margin:10px 0 7px}.taal-three-grid p{margin:0;color:var(--muted)}
.taal-table-wrap{overflow-x:auto;border:1px solid var(--line)}.taal-table{width:100%;border-collapse:collapse;min-width:850px;background:#fff}.taal-table th{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.06em;text-align:left;background:var(--soft);padding:12px;border-bottom:1px solid var(--line)}.taal-table td{padding:12px;border-bottom:1px solid var(--line);vertical-align:top}.taal-table tr:last-child td{border-bottom:0}.taal-table a{font-family:Inter,ui-sans-serif,sans-serif;font-weight:800;text-decoration-thickness:1px;text-underline-offset:3px}
.taal-card-list{display:grid;gap:12px}.taal-card{border:1px solid var(--line);background:#fff;scroll-margin-top:90px}.taal-card>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:52px minmax(0,1fr) minmax(260px,.65fr);gap:16px;align-items:center;padding:18px 20px}.taal-card>summary::-webkit-details-marker{display:none}.taal-card[open]>summary{border-bottom:1px solid var(--line);background:#fbfaf7}.taal-card-num{font:800 .7rem/1 Inter,ui-sans-serif,sans-serif;color:var(--accent)}.taal-card-summary-copy{display:grid;gap:5px}.taal-card-summary-copy strong{font:800 1.08rem/1.2 Inter,ui-sans-serif,sans-serif}.taal-card-summary-copy span{color:var(--muted)}.taal-card-meta{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.taal-card-meta b{font:750 .66rem/1.2 Inter,ui-sans-serif,sans-serif;background:var(--soft);padding:6px 8px;color:#5c6775}
.taal-card-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:0}.taal-card-main{padding:28px}.taal-prompt-panel{border-left:1px solid var(--line);background:#f7f8fa;padding:28px;min-width:0}.taal-card-lead{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}.taal-card-lead p{margin:0;border-top:2px solid var(--ink);padding-top:10px}.taal-card-lead strong{display:block;font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.taal-subsection{padding:18px 0;border-top:1px solid var(--line)}.taal-subsection h3,.taal-evidence h3,.taal-variant h3{font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px}.taal-subsection ul,.taal-subsection ol{margin:0;padding-left:22px}.taal-subsection li+li{margin-top:6px}.taal-evidence,.taal-variant{margin-top:18px;padding:18px;background:var(--soft)}.taal-evidence p,.taal-variant p{margin:0}
.taal-prompt-head>span{display:inline-block;font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin-bottom:10px}.taal-prompt-head p{margin:0 0 20px;color:var(--muted)}.taal-prompt-details{border-top:1px solid var(--line);padding-top:14px}.taal-prompt-details>summary{cursor:pointer;font:800 .84rem/1.2 Inter,ui-sans-serif,sans-serif}.taal-prompt-tools{display:flex;justify-content:flex-end;margin:14px 0 8px}.taal-prompt-tools button{appearance:none;border:1px solid var(--ink);background:var(--ink);color:#fff;padding:8px 11px;cursor:pointer;font:800 .72rem/1 Inter,ui-sans-serif,sans-serif}.taal-prompt-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;border:1px solid var(--line);padding:16px;max-height:560px;overflow:auto;font:400 .76rem/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.taal-source-cta{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;border-left:5px solid var(--accent);background:var(--soft);padding:28px}.taal-source-cta h2{margin:7px 0 8px}.taal-source-cta p{margin:0;max-width:70ch}
.toolbox-companion{padding-top:0}.toolbox-companion-card{display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:22px;align-items:center;border:1px solid var(--line);background:var(--soft);padding:22px;color:inherit;text-decoration:none}.toolbox-companion-card:hover{border-color:var(--ink)}.toolbox-companion-mark{font:900 1.4rem/1 Inter,ui-sans-serif,sans-serif;color:var(--accent);letter-spacing:-.04em}.toolbox-companion-card h2{font-size:1.45rem;margin:5px 0}.toolbox-companion-card p{margin:0;color:var(--muted)}.toolbox-companion-card>strong{font-family:Inter,ui-sans-serif,sans-serif}
.sources-legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}.sources-legend article{background:#fff;padding:22px;min-height:210px}
.sources-register-note{margin:28px 0 44px;padding:18px 20px;border-left:4px solid var(--accent);background:var(--soft)}.sources-register-note strong{font-family:Inter,ui-sans-serif,sans-serif}.sources-register-note p{margin:5px 0 0;color:var(--muted)}
.sources-group{padding:34px 0;border-top:1px solid var(--line)}.sources-group>h2{font-size:1.6rem;margin:0 0 20px}.sources-list{display:grid}.sources-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:center;padding:18px 0;border-top:1px solid var(--line)}.sources-row:first-child{border-top:0}.sources-row span:first-child{font:800 .68rem/1.2 Inter,ui-sans-serif,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#768292}.sources-row h3{font-size:1.08rem;margin:5px 0}.sources-row p{margin:0;color:var(--muted)}.sources-row>a,.sources-no-link{font:800 .76rem/1.2 Inter,ui-sans-serif,sans-serif;white-space:nowrap}.sources-no-link{color:#8a94a2}
@media(max-width:980px){.taal-principles{grid-template-columns:repeat(2,minmax(0,1fr))}.taal-card>summary{grid-template-columns:42px 1fr}.taal-card-meta{grid-column:2;justify-content:flex-start}.taal-card-body{grid-template-columns:1fr}.taal-prompt-panel{border-left:0;border-top:1px solid var(--line)}}
@media(max-width:700px){.taal-guide-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.taal-longcopy>section{grid-template-columns:36px minmax(0,1fr);gap:12px}.taal-principles,.sources-legend,.taal-how,.taal-three-grid{grid-template-columns:1fr}.taal-principles article,.sources-legend article{min-height:0}.taal-card>summary{padding:15px;gap:10px}.taal-card-main,.taal-prompt-panel{padding:20px}.taal-card-lead{grid-template-columns:1fr}.taal-source-cta,.sources-row,.toolbox-companion-card{grid-template-columns:1fr;align-items:start}.toolbox-companion-mark{font-size:1rem}.sources-row>a,.sources-no-link{white-space:normal}}

.quiet-contact{margin-top:14px;color:var(--muted);font-size:.86rem}
.quiet-contact summary{cursor:pointer;display:inline-block;font-family:Inter,ui-sans-serif,sans-serif;font-weight:700;text-decoration:underline;text-underline-offset:3px}
.quiet-contact p{margin:7px 0 0}
.quiet-contact a{color:var(--muted)}

/* Long-page navigation and compact TAAL overview */
.page-local-nav{position:sticky;top:68px;z-index:12;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.page-local-nav .wrap{display:flex;gap:6px;overflow-x:auto;padding-top:9px;padding-bottom:9px;scrollbar-width:thin}
.page-local-nav a{flex:0 0 auto;text-decoration:none;border:1px solid var(--line);background:#fff;padding:7px 10px;font:750 .72rem/1.2 Inter,ui-sans-serif,sans-serif}
.page-local-nav a:hover{border-color:var(--ink)}
@media(max-width:900px){.page-local-nav{top:58px}}
@media(max-width:700px){.taal-table{min-width:0}.taal-table th:nth-child(3),.taal-table td:nth-child(3),.taal-table th:nth-child(5),.taal-table td:nth-child(5),.taal-table th:nth-child(6),.taal-table td:nth-child(6){display:none}.taal-table th,.taal-table td{padding:9px 7px;font-size:.78rem}}


/* Guided site journeys: hubs have distinct jobs and visuals carry information */
.case-hub-hero{padding:78px 0 52px;border-bottom:1px solid var(--line)}
.case-hub-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.8fr);gap:56px;align-items:end}
.case-map{display:grid;gap:8px;background:#fff;border:1px solid var(--line);padding:18px}
.case-map>div{display:grid;gap:4px;padding:12px 14px;background:var(--paper2);border-left:3px solid var(--line)}
.case-map>div.is-accent{border-left-color:var(--accent);background:#fff7df}
.case-map span,.case-signal span,.case-card>span,.knowledge-route span,.journey-next span{font:800 .67rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--blue)}
.case-map strong{font-size:.92rem}.case-map>b{justify-self:center;color:#7b8087}
.case-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.case-card{display:flex;flex-direction:column;min-height:365px;padding:26px;border:1px solid var(--line);background:#fff;text-decoration:none;transition:transform .16s ease,border-color .16s ease}
.case-card:hover{transform:translateY(-3px);border-color:var(--ink)}
.case-card h2{font-size:2rem;margin:18px 0 12px}.case-card p{color:var(--muted);margin:0 0 24px}
.case-card>strong{margin-top:auto}.case-card--education{border-top:5px solid #143a63}.case-card--region{border-top:5px solid #efb83f}.case-card--legal{border-top:5px solid #586477}
.case-card-route{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 24px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.case-card-route i{font-style:normal;font-size:.76rem;font-weight:750}.case-card-route b{font-size:.74rem;color:#8b8f96}
.journey-next{background:#13263d;color:#fff}.journey-next-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:36px;align-items:end;padding-top:42px;padding-bottom:42px}
.journey-next h2{max-width:24ch;margin:8px 0 0;font-size:2rem}.journey-next span{color:#9ed9ee}.journey-next .button{background:#fff;color:#12161d;border-color:#fff}.journey-next .button.secondary{background:transparent;color:#fff;border-color:#fff}
.case-detail-hero{padding:78px 0 58px;border-bottom:1px solid var(--line)}
.case-detail-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.55fr);gap:54px;align-items:end}
.case-signal{background:#fff;border:1px solid var(--line);border-top:5px solid var(--accent);padding:24px}
.case-signal strong{display:block;font:500 1.5rem/1.18 Georgia,"Times New Roman",serif;margin-top:12px}
.case-story-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.8fr);gap:64px;align-items:start}
.case-story h2{font-size:2.5rem;max-width:18ch;margin:12px 0 22px}.case-story p{font-size:1.06rem;color:#3e444d}
.case-process{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);background:#fff}
.case-process>div{display:grid;align-content:start;gap:8px;padding:24px}.case-process>div+div{border-left:1px solid var(--line)}
.case-process span{font:800 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);margin-bottom:9px}
.case-process strong{padding:10px 0;border-top:1px solid var(--line);font-size:.9rem}.case-process .human{background:#fff8e7}
.case-question-band{background:#e8eef3}.case-question-band h2{max-width:28ch}
.case-question-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#cbd4dd;border:1px solid #cbd4dd;margin-top:30px}
.case-question-row>div{background:#fff;padding:20px}.case-question-row span{font:800 .72rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--blue)}.case-question-row p{margin:14px 0 0}
.density-visual{background:#fff;border:1px solid var(--line);padding:12px}
.density-visual>div{display:grid;grid-template-columns:minmax(150px,1.4fr) .5fr .5fr;gap:8px;align-items:center;padding:11px 8px;border-top:1px solid var(--line)}.density-visual>div:first-child{border-top:0}
.density-head{font:800 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;color:#6b7179}
.density-visual i{display:block;height:10px;border-radius:20px;background:#d9dce0}.density-visual i.low{width:28%;background:#d9dce0}.density-visual i.mid{width:62%;background:#8aa1b9}.density-visual i.high{width:100%;background:#143a63}
.case-next-nav{display:flex;justify-content:space-between;gap:20px;padding-top:28px;padding-bottom:28px}.case-next-nav a{font-weight:750}

/* Onderwijs is task-first rather than another card catalogue */
.education-hub-hero{padding:78px 0 56px;border-bottom:1px solid var(--line)}
.education-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.55fr);gap:64px;align-items:end}
.education-route-visual{display:grid;justify-items:stretch;gap:7px}
.education-route-visual>div{display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:center;border:1px solid var(--line);background:#fff;padding:14px}
.education-route-visual>div.active{background:#fff4d6;border-color:#d9ad41}.education-route-visual span{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#13263d;color:#fff;font:800 .72rem/1 Inter}.education-route-visual>b{justify-self:center;color:#7f848b}
.education-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.education-choice-grid>a{display:grid;grid-template-columns:1fr auto;column-gap:26px;text-decoration:none;background:#fff;border:1px solid var(--line);padding:24px;min-height:200px}
.education-choice-grid>a>span{grid-column:1/-1;font:800 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--blue)}
.education-choice-grid h3{font-size:1.55rem;margin:14px 0 9px}.education-choice-grid p{grid-column:1;margin:0;color:var(--muted)}.education-choice-grid b{grid-column:2;grid-row:2/4;align-self:end;white-space:nowrap;font-size:.82rem}.education-choice-grid>a:hover{border-color:var(--ink)}
.education-guide-strip{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.education-guide-strip .wrap{display:grid;grid-template-columns:minmax(240px,.55fr) minmax(0,1.45fr);gap:54px;align-items:start}
.education-guide-strip h2{font-size:2rem;margin:7px 0}.education-guide-strip span{font:800 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--blue)}
.guide-strip-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border:1px solid var(--line)}
.guide-strip-steps p{margin:0;padding:17px;border-left:1px solid var(--line)}.guide-strip-steps p:first-child{border-left:0}.guide-strip-steps b{display:block;margin-bottom:4px}

/* Kennis is a depth selector and linked evidence map */
.knowledge-hub-hero{padding:78px 0 56px;background:#eef1f3;border-bottom:1px solid #cfd5da}
.knowledge-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.7fr);gap:60px;align-items:end}
.knowledge-depth{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #c6ccd2;background:#fff}
.knowledge-depth>div{padding:18px;border-left:1px solid #d7dce0}.knowledge-depth>div:first-child{border-left:0}.knowledge-depth span{font:800 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;color:var(--blue)}.knowledge-depth strong{display:block;margin:18px 0 6px}.knowledge-depth small{display:block;color:var(--muted);line-height:1.35}
.knowledge-routes .wrap{display:grid;gap:12px}.knowledge-route{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,.45fr);gap:40px;align-items:center;border:1px solid var(--line);background:#fff;padding:26px}.knowledge-route--primary{border-left:6px solid var(--accent)}
.knowledge-route h2{font-size:2rem;margin:9px 0 10px}.knowledge-route p{margin:0;color:var(--muted)}.knowledge-route>div:last-child{display:grid;gap:9px}.knowledge-route a{font-weight:800;text-decoration:none;border-bottom:1px solid var(--line);padding:8px 0}.knowledge-route a:hover{border-color:var(--ink)}
.knowledge-map-section{background:#fff}.knowledge-map{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap}.knowledge-map>a{flex:1 1 190px;display:grid;align-content:center;text-decoration:none;border:1px solid var(--line);padding:20px;min-height:130px}.knowledge-map>a:hover{border-color:var(--ink)}.knowledge-map span{font-weight:800}.knowledge-map small{margin-top:8px;color:var(--muted)}.knowledge-map>b{align-self:center;color:#9aa0a6}
@media(max-width:980px){
  .case-hub-hero-grid,.case-detail-grid,.case-story-grid,.education-hero-grid,.knowledge-hero-grid{grid-template-columns:1fr}
  .case-card-grid{grid-template-columns:1fr 1fr}.case-card:last-child{grid-column:1/-1}
  .case-question-row{grid-template-columns:1fr 1fr}
  .guide-strip-steps{grid-template-columns:1fr 1fr}.guide-strip-steps p:nth-child(3){border-left:0;border-top:1px solid var(--line)}.guide-strip-steps p:nth-child(4){border-top:1px solid var(--line)}
  .knowledge-depth{max-width:720px}
}
@media(max-width:700px){
  .case-card-grid,.education-choice-grid,.case-question-row,.knowledge-route,.education-guide-strip .wrap{grid-template-columns:1fr}
  .case-card:last-child{grid-column:auto}.journey-next-grid{grid-template-columns:1fr;align-items:start}.journey-next .button{justify-self:start}
  .case-process{grid-template-columns:1fr}.case-process>div+div{border-left:0;border-top:1px solid var(--line)}
  .case-next-nav{flex-direction:column}.case-question-row>div{min-height:0}
  .education-choice-grid>a{grid-template-columns:1fr}.education-choice-grid b{grid-column:1;grid-row:auto;margin-top:18px}.guide-strip-steps{grid-template-columns:1fr}.guide-strip-steps p{border-left:0;border-top:1px solid var(--line)}.guide-strip-steps p:first-child{border-top:0}
  .knowledge-depth{grid-template-columns:1fr}.knowledge-depth>div{border-left:0;border-top:1px solid #d7dce0}.knowledge-depth>div:first-child{border-top:0}
  .knowledge-map{display:grid}.knowledge-map>b{justify-self:center;transform:rotate(90deg)}
}


/* Rich workform cards: teacher-first, TAAL-inspired practical structure */
.workform-hero--practical{padding-bottom:46px}
.workform-hero--practical .lede{max-width:70ch}
.workform-tech-label{display:inline-block;margin-top:10px;font-size:.82rem;color:var(--muted)}
.workform-tech-label summary{cursor:pointer;font-weight:750;text-decoration:underline;text-underline-offset:3px}
.workform-tech-label p{margin:6px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.workform-quickstart--rich{padding-top:34px}
.workform-lesson-card--rich{padding:0;overflow:hidden;border-color:#b9b3a8}
.workform-lesson-card--rich .workform-toolbar{padding:18px 22px;margin:0;background:#f8f6f1}
.lesson-facts{display:grid;grid-template-columns:1.35fr 1.65fr .55fr .8fr;border-bottom:1px solid var(--line);background:#fff}
.lesson-facts article{padding:17px 18px;border-left:1px solid var(--line)}
.lesson-facts article:first-child{border-left:0}
.lesson-facts span,.lesson-purpose span,.lesson-block>div>span,.lesson-card-side span,.lesson-decisions-head span,.lesson-card-bottom span{display:block;font:800 .67rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.07em;color:var(--blue)}
.lesson-facts p{margin:7px 0 0;font-size:.9rem;line-height:1.45;color:#37414d}
.lesson-card-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.65fr)}
.lesson-card-main{padding:28px 30px 32px}
.lesson-card-side{border-left:1px solid var(--line);background:#faf8f3;padding:28px 24px;display:grid;align-content:start;gap:22px}
.lesson-purpose{border-left:5px solid var(--accent);padding:4px 0 4px 18px;margin-bottom:30px}
.lesson-purpose p{font-size:1.1rem;line-height:1.62;margin:8px 0 11px;color:#323b46}
.lesson-purpose strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:1.25rem;font-weight:500;line-height:1.35}
.lesson-block{padding-top:26px;border-top:1px solid var(--line);margin-top:26px}
.lesson-block:first-of-type{margin-top:0}
.lesson-block>div h2,.lesson-block>div h3{margin:7px 0 16px;font-family:Georgia,"Times New Roman",serif;font-weight:500}
.lesson-block>div h2{font-size:2rem}.lesson-block>div h3{font-size:1.35rem}
.lesson-script ul{list-style:none;padding:0;margin:0;display:grid;gap:9px}
.lesson-script li{background:#f5f2eb;border-left:3px solid #143a63;padding:12px 14px;font-size:.96rem;line-height:1.55}
.lesson-steps{list-style:none;padding:0;margin:0;display:grid}
.lesson-steps li{display:grid;grid-template-columns:42px 1fr;gap:15px;padding:14px 0;border-top:1px solid var(--line);align-items:start}
.lesson-steps li:first-child{border-top:0}
.lesson-steps li>span{font:800 .72rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#718096;padding-top:5px}
.lesson-steps p{margin:0;font-size:.96rem;line-height:1.55}
.lesson-two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.lesson-block.compact{margin-top:28px}
.lesson-checklist,.lesson-question-list{margin:0;padding-left:1.15rem}
.lesson-checklist li,.lesson-question-list li{padding-left:3px;line-height:1.5}
.lesson-checklist li+li,.lesson-question-list li+li{margin-top:9px}
.lesson-example,.lesson-evidence,.lesson-ai-role{padding-bottom:20px;border-bottom:1px solid var(--line)}
.lesson-ai-role{border-bottom:0}
.lesson-card-side p{margin:9px 0 0;font-size:.92rem;line-height:1.6;color:#46515d}
.lesson-decisions{border-top:1px solid var(--line);padding:26px 30px 30px;background:#eef2f4}
.lesson-decisions-head{display:grid;grid-template-columns:220px 1fr;gap:24px;align-items:end;margin-bottom:18px}
.lesson-decisions-head h2{font-size:1.9rem;margin:0;font-family:Georgia,"Times New Roman",serif;font-weight:500}
.lesson-decision-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.lesson-decision-grid article{background:#fff;border:1px solid #d4dbe0;padding:16px}
.lesson-decision-grid p{margin:0;font-size:.86rem;line-height:1.5}
.lesson-decision-grid p+p{margin-top:12px;padding-top:12px;border-top:1px solid #e1e5e8}
.lesson-card-bottom{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line)}
.lesson-card-bottom article{padding:22px 26px}
.lesson-card-bottom article+article{border-left:1px solid var(--line)}
.lesson-card-bottom p{margin:8px 0 0;line-height:1.55;color:#46515d}
.lesson-caution{background:#fff8e6}
.workform-position{padding-top:26px;padding-bottom:26px;background:#fbfaf7}
.workform-position details{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:0 4px}
.workform-position summary{cursor:pointer;padding:14px 0;font-weight:800}
.workform-position .eai-route{margin:0 0 12px}
.workform-position p{max-width:72ch;color:var(--muted);font-size:.9rem}
@media(max-width:980px){
  .lesson-facts{grid-template-columns:1fr 1fr}
  .lesson-facts article:nth-child(3){border-top:1px solid var(--line);border-left:0}
  .lesson-facts article:nth-child(4){border-top:1px solid var(--line)}
  .lesson-card-grid{grid-template-columns:1fr}
  .lesson-card-side{border-left:0;border-top:1px solid var(--line);grid-template-columns:repeat(3,minmax(0,1fr))}
  .lesson-decision-grid{grid-template-columns:1fr}
}
@media(max-width:700px){
  .lesson-facts,.lesson-two-col,.lesson-card-side,.lesson-card-bottom{grid-template-columns:1fr}
  .lesson-facts article{border-left:0;border-top:1px solid var(--line)}
  .lesson-facts article:first-child{border-top:0}
  .lesson-card-main{padding:22px 18px}
  .lesson-card-side{padding:22px 18px}
  .lesson-card-side>section{border-bottom:1px solid var(--line);padding-bottom:18px}
  .lesson-card-side>section:last-child{border-bottom:0}
  .lesson-decisions{padding:22px 18px}
  .lesson-decisions-head{grid-template-columns:1fr;gap:6px}
  .lesson-card-bottom article+article{border-left:0;border-top:1px solid var(--line)}
}


/* Teacher explanation layer: explain the didactic decision before the technical EAI layer */
.teacher-explanation{background:#fff}
.teacher-explanation-intro{display:grid;grid-template-columns:minmax(280px,.7fr) minmax(0,1.3fr);gap:54px;align-items:start;margin-bottom:34px}
.teacher-explanation-intro h2{font-size:clamp(2.3rem,4vw,4rem);margin:8px 0 0;max-width:12ch}
.teacher-explanation-intro>p{font-size:1.12rem;line-height:1.7;margin:0;color:#39434f;max-width:65ch}
.teacher-why-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.teacher-why-grid article{background:#fbfaf7;padding:24px;min-height:220px}
.teacher-why-grid h3{font-size:1.45rem;margin:0 0 12px}
.teacher-why-grid p{margin:0;color:#46515d}
.teacher-watch-section{margin-top:70px}
.teacher-watch-grid{display:grid;gap:12px}
.teacher-watch-grid>article{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid var(--line);background:#fff}
.teacher-watch-grid>article>div{padding:18px;border-left:1px solid var(--line)}
.teacher-watch-grid>article>div:first-child{border-left:0}
.teacher-watch-grid span,.teacher-interpretation span,.teacher-subject-grid>article>span,.teacher-council-source span{display:block;font:800 .67rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.07em;color:var(--blue);margin-bottom:8px}
.teacher-watch-grid p{margin:0;line-height:1.5;color:#424c58}
.teacher-watch-move{background:#fff7df}
.teacher-interpretation{display:grid;grid-template-columns:minmax(280px,.7fr) minmax(0,1.3fr);gap:50px;margin-top:70px;padding:30px;border:1px solid var(--line);background:#eef2f4}
.teacher-interpretation h2{font-size:2rem;margin:8px 0 0}
.teacher-interpretation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.teacher-interpretation-grid article{background:#fff;padding:18px}
.teacher-interpretation-grid p{margin:0;color:#46515d}
.teacher-subject-examples{margin-top:70px}
.teacher-subject-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.teacher-subject-grid>article{border-top:5px solid var(--blue);background:#fbfaf7;padding:22px}
.teacher-subject-grid p{margin:11px 0 0;font-size:.9rem;line-height:1.52;color:#47515c}
.teacher-subject-grid strong{color:var(--ink)}
.teacher-council{margin-top:72px;border:1px solid #cbd4dd;background:#f1f4f6;padding:30px}
.teacher-council-head{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr);gap:42px;align-items:end;margin-bottom:26px}
.teacher-council-head h2{font-size:2.2rem;margin:8px 0 0;max-width:18ch}
.teacher-council-head p{margin:0;color:#47515d;line-height:1.65}
.teacher-council-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.teacher-council-grid article{background:#fff;border:1px solid #d4dbe0;padding:20px}
.teacher-council-grid h3{font-size:1.35rem;margin:8px 0 14px}
.teacher-council-grid p{font-size:.9rem;line-height:1.55;color:#47515d}
.teacher-council-grid a{display:inline-block;margin-top:8px;font-weight:800;font-size:.82rem}
.teacher-council-note{margin:20px 0 0;padding-top:18px;border-top:1px solid #cbd4dd;font-size:.86rem;color:#55616e}
@media(max-width:980px){
  .teacher-explanation-intro,.teacher-interpretation,.teacher-council-head{grid-template-columns:1fr}
  .teacher-watch-grid>article{grid-template-columns:1fr}
  .teacher-watch-grid>article>div{border-left:0;border-top:1px solid var(--line)}
  .teacher-watch-grid>article>div:first-child{border-top:0}
  .teacher-interpretation-grid,.teacher-council-grid{grid-template-columns:1fr}
  .teacher-subject-grid{grid-template-columns:1fr 1fr}.teacher-subject-grid>article:last-child{grid-column:1/-1}
}
@media(max-width:700px){
  .teacher-why-grid,.teacher-subject-grid{grid-template-columns:1fr}
  .teacher-subject-grid>article:last-child{grid-column:auto}
  .teacher-council{padding:22px 18px}
  .teacher-interpretation{padding:22px 18px}
}


/* Site-wide section rhythm: every major content block has a visible start and end */
main:has(> .section){background:#f3f5f7}
main:has(> .section)>:where(.page-hero,.hero){background:#fff}
main:has(> .section)>.section{
  position:relative;
  box-shadow:inset 0 1px 0 var(--line),inset 0 -1px 0 var(--line);
}
main:has(> .section)>.section+.section,
main:has(> .page-hero)>.page-hero+.section,
main:has(> .hero)>.hero+.section{
  margin-top:12px;
}
main:has(> .section)>.section:not(.journey-next):not(.project):not(.case-question-band):not(.home-guide-strip):not(.education-guide-strip)::before{
  content:"";
  position:absolute;
  z-index:1;
  top:0;
  left:max(24px,calc((100% - var(--max))/2 + 24px));
  width:52px;
  height:4px;
  background:var(--accent);
}
main:has(> .section)>.section:not(.journey-next):not(.project) .section-head{
  padding-bottom:24px;
  border-bottom:1px solid var(--line);
}

/* The Toolbox contains several decisions inside one page section, so each decision gets its own surface. */
.toolbox-start{background:#f5f7f9}
.toolbox-situation{
  padding:28px;
  margin-bottom:18px;
  border:1px solid var(--line);
  border-top:4px solid var(--accent);
  background:#fff;
}
.toolbox-mode-tabs{margin:0 0 14px}
.toolbox-mode-panel{
  padding:28px;
  margin:0 0 18px;
  border:1px solid var(--line);
  background:#fff;
}
.toolbox-route-grid{margin-bottom:0}
.toolbox-results{
  margin-top:18px;
  padding:28px;
  border:1px solid var(--line);
  background:#fff;
  scroll-margin-top:90px;
}
.toolbox-results-footer{margin:20px 0 0}
.toolbox-library{
  margin-top:18px;
  padding:0 20px;
  border:1px solid var(--line);
  background:#fff;
}
.toolbox-library>summary{padding:18px 0}
.toolbox-library-tools{padding:20px 0}
.toolbox-library-grid{padding:0 0 20px}
.toolbox-standard-note{
  margin-top:18px;
  border:1px solid #e4d8bd;
  border-left:4px solid var(--accent);
  background:#fff9eb;
}

/* Make section boundaries survive on small screens without turning every section into a card wall. */
@media(max-width:760px){
  main:has(> .section)>.section+.section,
  main:has(> .page-hero)>.page-hero+.section,
  main:has(> .hero)>.hero+.section{margin-top:9px}
  main:has(> .section)>.section:not(.journey-next):not(.project):not(.case-question-band):not(.home-guide-strip):not(.education-guide-strip)::before{
    left:24px;
    width:42px;
  }
  main:has(> .section)>.section:not(.journey-next):not(.project) .section-head{
    padding-bottom:18px;
  }
  .toolbox-situation,.toolbox-mode-panel,.toolbox-results{padding:20px 18px}
  .toolbox-library{padding:0 18px}
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

NAV_GROUPS = [
    ("toepassingen", "Toepassingen", [
        ("/toepassingen/", "Overzicht toepassingen"),
        ("/praktijk/", "Praktijk & demonstrators"),
    ]),
    ("onderwijs", "Onderwijs", [
        ("/onderwijs/", "Overzicht onderwijs"),
        ("/werkvormen/", "EAI-werkvormen"),
        ("/taalwerkvormen/", "TAALwerkvormen"),
        ("/werkvormen/#didactisch-model", "Didactische modellen"),
    ]),
    ("kennis", "Kennis", [
        ("/kennis/", "Overzicht kennis"),
        ("/onderbouwing/", "Onderbouwing"),
        ("/bronnen/", "Bronnen"),
        ("/publicaties/", "Publicaties & media"),
        ("/tools/", "Tools"),
        ("/twee-pijlers/", "Twee pijlers"),
    ]),
]

def nav(active: str = "") -> str:
    active_key = active
    if active in {"praktijk"}:
        active_key = "toepassingen"
    elif active in {"werkvormen", "taal", "workshop"}:
        active_key = "onderwijs"
    elif active in {"verdieping", "onderbouwing", "bronnen", "publicaties", "tools", "pijlers"}:
        active_key = "kennis"

    desktop_groups = []
    mobile_groups = []
    for key, label, links in NAV_GROUPS:
        panel = "".join(f'<a href="{href}">{item}</a>' for href, item in links)
        current = " is-current" if key == active_key else ""
        desktop_groups.append(
            f'<details class="nav-group{current}"><summary>{label}</summary>'
            f'<div class="nav-group-panel">{panel}</div></details>'
        )
        mobile_groups.append(
            f'<details class="mobile-nav-group{current}"><summary>{label}</summary>'
            f'<div class="mobile-nav-sub">{panel}</div></details>'
        )

    home_current = ' aria-current="page"' if active_key == "model" else ""
    over_current = ' aria-current="page"' if active_key == "over" else ""
    return (
        f'<header class="site-header"><nav class="nav" aria-label="Hoofdnavigatie">'
        f'<a class="brand" href="/" aria-label="EAI home"><img src="/assets/eai-logo.svg" alt="EAI"></a>'
        f'<div class="nav-links"><a href="/"{home_current}>EAI</a>{"".join(desktop_groups)}'
        f'<a href="/over/"{over_current}>Over</a>'
        f'<a class="nav-cta" href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn ↗</a></div>'
        f'<details class="mobile-nav"><summary>Menu</summary><div class="mobile-nav-panel">'
        f'<a href="/"{home_current}>EAI</a>{"".join(mobile_groups)}'
        f'<a href="/over/"{over_current}>Over</a>'
        f'<a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn ↗</a></div></details>'
        f'</nav></header>'
    )

def footer() -> str:
    return (
        f'<footer class="site-footer"><div class="wrap footer-grid">'
        f'<p style="display:flex;gap:12px;align-items:center"><img src="/assets/eai-logo.svg" alt="" width="42" height="42">'
        f'<span><strong>EAI</strong> · Hans Visser<br>Menselijk handelen en AI in samenhang.</span></p>'
        f'<p><a href="/">EAI</a> · <a href="/toepassingen/">Toepassingen</a> · '
        f'<a href="/onderwijs/">Onderwijs</a> · <a href="/kennis/">Kennis</a> · '
        f'<a href="/over/">Over</a> · <a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a> · '
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
    chrome = f'<header class="eai-site-nav"><div class="eai-site-nav__inner"><a class="eai-site-nav__brand" href="/" aria-label="EAI home"><img src="/assets/eai-logo.svg" alt="EAI" width="34" height="34"></a><div class="eai-site-nav__links"><a href="/">EAI</a><a href="/toepassingen/">Toepassingen</a><a href="/onderwijs/">Onderwijs</a><a href="/kennis/">Kennis</a><a href="/over/">Over</a><a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn ↗</a></div></div></header>'
    foot = f'<footer class="eai-site-footer"><a href="{footer_back}">← Terug</a> · <a href="/bronnen/">Bronnen</a> · <a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn ↗</a></footer>'
    canonical = f"{BASE_URL}{canonical_path}"
    return f'<!doctype html><html lang="{esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · EAI</title><link rel="canonical" href="{esc(canonical)}"><link rel="icon" href="/assets/eai-logo.svg" type="image/svg+xml">{"".join(head_parts)}<link rel="stylesheet" href="/assets/article-chrome.css"></head><body>{chrome}{body_inner}{foot}</body></html>'

def redirect(target: str) -> str:
    canonical = target if target.startswith("http") else f"{BASE_URL}{target}"
    return f'<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url={esc(target)}"><link rel="canonical" href="{esc(canonical)}"><title>Doorsturen…</title></head><body><p><a href="{esc(target)}">Ga verder</a></p></body></html>'

def require_sources(sources: Path) -> None:
    required = [file for _, _, file, _ in PUBLICATIONS] + ["onderwijsin-embed1.html", "eai-tools-modules-eai-toolkit-beyond-explainability-embed1.html"]
    missing = [name for name in required if not (sources / name).exists()]
    if missing:
        raise SystemExit("Missing vendored legacy sources: " + ", ".join(missing))

def build(sources: Path, out: Path) -> None:
    require_sources(sources)
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
<div class="eyebrow">EAI-model</div>
<h1>Welkom op de website van het EAI-model.</h1>
<p class="lede">EAI helpt om bewuste keuzes te maken over wat mensen en AI in een proces doen.</p>
<p>AI kan werk sneller, makkelijker en soms ook beter maken. Maar een efficiënter proces is niet automatisch een effectiever proces. Een sterke output zegt ook niet vanzelf dat de kwaliteit van het menselijke handelen is verbeterd.</p>
<p>Met EAI kijk je daarom eerst naar wat je werkelijk wilt bereiken, welke menselijke handelingen daarin belangrijk zijn en welke rol AI daar precies bij krijgt. Zo kun je beter bepalen wat AI kan ondersteunen of overnemen, wat betekenisvol bij de mens blijft en hoe je beoordeelt of het totaal werkelijk beter wordt.</p>
<p class="welcome-audience">EAI is ontstaan in het onderwijs en wordt inmiddels ook toegepast op organisatievraagstukken en professioneel werk. Op deze website vind je het model, toepassingen, praktische werkvormen, hulpmiddelen, publicaties en de onderbouwing.</p>
<div class="button-row"><a class="button" href="#eenvoudig-voorbeeld">Zie EAI in een concreet voorbeeld</a><a class="button secondary" href="#beginnen">Wat kun je hier doen?</a></div>
</div>
<div class="hero-eai-visual" aria-label="EAI in één oogopslag">
<div class="hero-eai-visual-head"><span>EAI in één oogopslag</span><strong>Niet beginnen bij de tool</strong></div>
<div class="hero-eai-step"><span>01</span><div><b>Wat wil je bereiken?</b><small>Begin bij het doel van het proces.</small></div></div>
<div class="hero-eai-step"><span>02</span><div><b>Wat vraagt dat van de mens?</b><small>Kijk naar kennis, afweging, leren, verantwoordelijkheid en uitvoering.</small></div></div>
<div class="hero-eai-step is-core"><span>03</span><div><b>Wat laat je AI doen?</b><small>Bepaal bewust wat AI ondersteunt, versnelt of overneemt.</small></div></div>
<div class="hero-eai-check"><span>?</span><div><b>Wordt het totaal werkelijk beter?</b><small>Kijk verder dan alleen tijdwinst of een nette output.</small></div></div>
</div>
</div>
</section>

<section class="section home-first-example" id="eenvoudig-voorbeeld"><div class="wrap">
<div class="section-head"><div class="kicker">Een eenvoudig voorbeeld</div><div><h2>Dezelfde AI-uitkomst kan in de ene situatie uitstekend zijn en in de andere juist iets belangrijks wegnemen.</h2><p>Stel dat AI in een paar seconden een sterke analyse schrijft. Of dat wenselijk is, hangt af van wat je met die taak probeert te bereiken.</p></div></div>
<div class="first-example-grid">
<article><span>Als snelheid het doel is</span><h3>Dan kan vergaande automatisering precies de bedoeling zijn.</h3><p>Als iemand vooral snel een bruikbare analyse nodig heeft, kan AI veel werk uit handen nemen en direct waarde toevoegen.</p></article>
<article><span>Als leren het doel is</span><h3>Dan kan dezelfde automatisering juist te veel overnemen.</h3><p>Als iemand moet leren informatie te selecteren, vergelijken en wegen, zijn juist die stappen leerstappen die de leerling zelf moet zetten.</p></article>
<article><span>Als professioneel oordeel het doel is</span><h3>Dan moet zichtbaar blijven waar de menselijke afweging zit.</h3><p>AI kan voorbereiden en adviseren, maar het moet duidelijk blijven wie de conclusie heeft beoordeeld en er verantwoordelijkheid voor draagt.</p></article>
</div>
<p class="bridge"><strong>Daar helpt EAI bij.</strong> Het model helpt bepalen welk werk je aan AI geeft, welk menselijk handelen betekenis moet houden en welk bewijs je nodig hebt om te beoordelen of de gekozen taakverdeling werkelijk beter werkt.</p>
</div></section>

<section class="section home-values"><div class="wrap">
<div class="section-head"><div class="kicker">Waarom EAI?</div><div><h2>Een betere uitkomst is niet altijd een beter proces.</h2><p>AI maakt veel mogelijk. EAI helpt om naast de zichtbare winst ook te kijken naar wat er onder de oppervlakte verandert voor de mens die in het proces handelt.</p></div></div>
<div class="home-value-grid">
<article><span>01</span><h3>Efficiëntie én effectiviteit</h3><p>Sneller of goedkoper werken kan waardevol zijn. De vervolgvraag is of je daarmee ook beter bereikt wat het proces eigenlijk moet opleveren.</p></article>
<article><span>02</span><h3>Output én kwaliteit van handelen</h3><p>Een sterke tekst, analyse of aanbeveling zegt nog niet vanzelf iets over de kwaliteit van de afwegingen en handelingen die eraan voorafgingen.</p></article>
<article><span>03</span><h3>Ondersteuning én zelfstandigheid</h3><p>Soms wil je dat AI zoveel mogelijk uit handen neemt. In andere situaties is juist het zelf uitvoeren, oefenen, beoordelen of beslissen essentieel.</p></article>
<article><span>04</span><h3>Automatisering én verantwoordelijkheid</h3><p>Als systemen opties selecteren, adviezen formuleren of keuzes voorbereiden, moet duidelijk blijven waar menselijke beoordeling en verantwoordelijkheid liggen.</p></article>
</div>
</div></section>

<section class="section model-intro" id="model"><div class="wrap hero-grid">
<div><div class="eyebrow">Het EAI-model</div><h2>Leg eerst het menselijke proces op tafel.</h2>
<p class="lede">EAI begint niet met de vraag welke AI-tool je wilt gebruiken. Eerst maak je zichtbaar wat het proces moet opleveren, waar de mens zich daarin bevindt en welke handelingen op dat moment werkelijk betekenis dragen.</p>
<p>Pas daarna kijk je naar AI. Wat ondersteunt het? Wat versnelt het? Wat neemt het over? En wat betekent die verschuiving voor effectiviteit, kwaliteit, leren, autonomie of professioneel oordeel?</p>
<div class="button-row"><a class="button" href="#toepassingen">Zie EAI in verschillende domeinen</a><a class="button secondary" href="/over/">Over EAI</a></div></div>
<div class="model-stack" aria-label="De EAI-kijkroute">
<div><span>01</span><strong>Doel en proces</strong><p>Wat moet hier uiteindelijk tot stand komen en welke stappen zijn daarvoor nodig?</p></div>
<div><span>02</span><strong>Fase en context</strong><p>Waar bevindt de mens zich nu, en wat vraagt juist deze situatie?</p></div>
<div><span>03</span><strong>Leerstap</strong><p>Welke stap moet de mens hier zelf zetten om betekenis te geven, af te wegen of verantwoordelijkheid te nemen?</p></div>
<div><span>04</span><strong>Rol van AI</strong><p>Wat doet het systeem precies rond die handeling?</p></div>
<div class="model-stack-check"><span>?</span><strong>Effect en bewijs</strong><p>Wat is er werkelijk verbeterd en wat weten we nog over het menselijke handelen?</p></div>
</div></div></section>

<section class="section home-domains" id="toepassingen"><div class="wrap">
<div class="section-head"><div class="kicker">Eén model, verschillende contexten</div><div><h2>De woorden veranderen per domein. De onderliggende vraag niet.</h2><p>EAI is ontstaan in het onderwijs, maar de kijkroute is niet aan één sector gebonden. Overal waar AI onderdeel wordt van menselijk handelen, kun je dezelfde vragen stellen over doel, taakverdeling, effectiviteit en verantwoordelijkheid.</p></div></div>
<div class="domain-case-grid">
<article class="domain-case">
<span>Onderwijs</span><h3>Leren en zelfstandigheid zichtbaar houden.</h3>
<p>In onderwijs gaat het bijvoorbeeld om de vraag welke leerstap een leerling zelf moet zetten, wanneer AI passende ondersteuning biedt en wat je daarna wilt kunnen zien over zelfstandigheid.</p>
<a href="/werkvormen/">Bekijk EAI in onderwijs →</a>
</article>
<article class="domain-case">
<span>Onderwijsregio Rotterdam</span><h3>Begeleiden zonder de keuze over te nemen.</h3>
<p>Bij het digitale Onderwijsloket en de ontwikkeling van een AI-coach draait de ontwerpvraag om mensen beter begeleiden, informeren en matchen in duizenden mogelijke routes, terwijl de uiteindelijke keuze bij de mens blijft.</p>
<a href="https://nl.linkedin.com/posts/onderwijsregio-rotterdam-vo-mbo_presentatie-or-activity-7474731045964165120-0Amk" target="_blank" rel="noopener">Bekijk Onderwijsregio in de praktijk ↗</a>
</article>
<article class="domain-case">
<span>Legal AI · Saga</span><h3>Efficiënt juridisch werk zonder professioneel oordeel onzichtbaar te maken.</h3>
<p>Saga nam concepten als Task Density en Didactic Controllability over in een eigen publicatie. Daarmee wordt zichtbaar welk cognitief werk naar het systeem verschuift en waar menselijke afweging, begrip en verantwoordelijkheid belangrijk blijven.</p>
<a href="https://www.sagalegal.io/article/beyond-explainability-didactic-controllability-and-task-density-as-foundations-for-responsible-learning-with-ai" target="_blank" rel="noopener">Lees de publicatie van Saga ↗</a>
</article>
</div>
<p class="domain-proof-note">Deze voorbeelden zijn geen claim dat ieder domein hetzelfde werkt. Ze laten juist zien dat dezelfde EAI-vragen in verschillende processen opnieuw kunnen worden gesteld.</p>
</div></section>

<section class="section home-entry-section" id="beginnen"><div class="wrap">
<div class="section-head"><div class="kicker">Wat kun je hier doen?</div><div><h2>Kies wat je wilt begrijpen, toepassen of onderzoeken.</h2><p>De site is nu in vijf delen georganiseerd. Begin bij wat voor jou relevant is; de onderliggende pagina's blijven altijd via het menu bereikbaar.</p></div></div>
<div class="home-entry-grid">
<a href="#model"><span>EAI</span><h3>Ik wil het model begrijpen.</h3><p>Bekijk de kernvragen waarmee EAI menselijk handelen en AI in samenhang analyseert.</p><b>Begrijp EAI ↑</b></a>
<a href="/toepassingen/"><span>Toepassingen</span><h3>Ik wil zien hoe EAI in de praktijk wordt gebruikt.</h3><p>Bekijk voorbeelden uit onderwijs, regionale begeleiding en legal AI.</p><b>Bekijk toepassingen →</b></a>
<a href="/onderwijs/"><span>Onderwijs</span><h3>Ik wil EAI gebruiken in onderwijs.</h3><p>Ga naar EAI-werkvormen, TAALwerkvormen en bestaande didactische modellen.</p><b>Naar onderwijs →</b></a>
<a href="/kennis/"><span>Kennis</span><h3>Ik wil de achtergrond en onderbouwing bekijken.</h3><p>Bronnen, publicaties, tools, onderzoek en de kennisbasis onder het model.</p><b>Naar kennis →</b></a>
<a href="/over/"><span>Over</span><h3>Ik wil weten wie EAI ontwikkelt.</h3><p>Lees over Hans Visser, de ontwikkeling van EAI en manieren om contact te leggen.</p><b>Over EAI en Hans →</b></a>
</div></div></section>

</main>'''
    write(out, "index.html", doc("EAI-model voor menselijk handelen met AI", home_body, "/", "model", description="Het EAI-model helpt analyseren wat AI doet met menselijke processen, effectiviteit, kwaliteit, leren, oordeel en verantwoordelijkheid."))

    toepassingen_body = '''<main>
<section class="page-hero case-hub-hero"><div class="wrap case-hub-hero-grid"><div><div class="eyebrow">Toepassingen</div><h1>Zie eerst wat er in een echte situatie verandert.</h1><p class="lede">EAI krijgt pas betekenis in een concrete taak. Kies een context en kijk niet alleen naar de AI-oplossing, maar vooral naar de menselijke handeling die verandert.</p><div class="button-row"><a class="button" href="#cases">Bekijk de cases</a><a class="button secondary" href="/praktijk/">Open werkende demonstrators</a></div></div><div class="case-map" aria-label="Van situatie naar EAI-vraag"><div><span>situatie</span><strong>Wat probeert iemand te bereiken?</strong></div><b>→</b><div><span>menselijk werk</span><strong>Welke afweging of handeling telt?</strong></div><b>→</b><div class="is-accent"><span>AI</span><strong>Wat verandert er als AI meedoet?</strong></div><b>→</b><div><span>bewijs</span><strong>Wat weten we daarna werkelijk?</strong></div></div></div></section>
<section class="section case-chooser" id="cases"><div class="wrap"><div class="section-head"><div class="kicker">Kies een context</div><div><h2>Drie situaties, drie verschillende vragen.</h2><p>De cases hebben bewust niet dezelfde uitkomst. Het model blijft herkenbaar, maar wat bij de mens moet blijven hangt af van de situatie.</p></div></div>
<div class="case-card-grid">
<a class="case-card case-card--education" href="/onderwijs/"><span>Onderwijs</span><h2>Een leerling werkt met AI.</h2><p>Welke leerstap moet de leerling zelf zetten? En wat wil je daarna kunnen zien over zijn zelfstandigheid?</p><div class="case-card-route"><i>leren</i><b>→</b><i>hulp</i><b>→</b><i>zelf doen</i></div><strong>Ga naar onderwijs →</strong></a>
<a class="case-card case-card--region" href="/toepassingen/onderwijsregio-rotterdam/"><span>Onderwijsregio Rotterdam</span><h2>Iemand zoekt een route naar het onderwijs.</h2><p>Hoe kan AI helpen zoeken, ordenen en begeleiden zonder de uiteindelijke keuze voor iemand te maken?</p><div class="case-card-route"><i>oriënteren</i><b>→</b><i>begeleiden</i><b>→</b><i>kiezen</i></div><strong>Bekijk deze case →</strong></a>
<a class="case-card case-card--legal" href="/toepassingen/saga-legal-ai/"><span>Legal AI · Saga</span><h2>AI versnelt professioneel kenniswerk.</h2><p>Welke cognitieve stappen verschuiven naar het systeem, en waar blijven begrip, afweging en verantwoordelijkheid menselijk?</p><div class="case-card-route"><i>analyseren</i><b>→</b><i>voorstel</i><b>→</b><i>oordeel</i></div><strong>Bekijk deze case →</strong></a>
</div></div></section>
<section class="section journey-next"><div class="wrap journey-next-grid"><div><span>Wil je het niet alleen lezen?</span><h2>Bekijk hoe dezelfde ontwerpvragen in werkende prototypes zijn vertaald.</h2></div><a class="button" href="/praktijk/">Naar praktijk &amp; demonstrators →</a></div></section>
</main>'''
    write(out, "toepassingen/index.html", doc("Toepassingen", toepassingen_body, "/toepassingen/", "toepassingen", "Concrete EAI-cases in onderwijs, regionale begeleiding en professioneel kenniswerk."))

    regio_case_body = '''<main>
<section class="page-hero case-detail-hero region-case"><div class="wrap case-detail-grid"><div><div class="eyebrow">Case · Onderwijsregio Rotterdam</div><h1>Begeleiden zonder de keuze over te nemen.</h1><p class="lede">Een regionale onderwijsroute bevat veel informatie, opties en persoonlijke afwegingen. AI kan helpen ordenen en zoeken. De keuze zelf blijft van de persoon die de route moet lopen.</p></div><div class="case-signal"><span>De ontwerpvraag</span><strong>Hoe maak je hulp rijker zonder de beslissende handeling onzichtbaar te maken?</strong></div></div></section>
<section class="section"><div class="wrap case-story-grid"><div class="case-story"><div class="kicker">De situatie</div><h2>Veel routes, veel informatie, één persoonlijke keuze.</h2><p>Wie zich oriënteert op werken of opleiden in het onderwijs kan met veel verschillende routes, loketten en voorwaarden te maken krijgen. Een AI-coach kan informatie combineren, opties ordenen en vervolgvragen stellen.</p><p>Het risico zit niet in het geven van informatie. Het wordt interessant zodra het systeem ook gaat invullen wat iemand zou moeten kiezen.</p></div><div class="case-process" aria-label="Verdeling tussen mens en AI"><div><span>AI kan</span><strong>zoeken</strong><strong>ordenen</strong><strong>vergelijken</strong><strong>vragen stellen</strong></div><div class="human"><span>Mens blijft</span><strong>wegen</strong><strong>voorkeur bepalen</strong><strong>kiezen</strong><strong>verantwoordelijkheid dragen</strong></div></div></div></section>
<section class="section case-question-band"><div class="wrap"><div class="kicker">EAI in deze case</div><h2>Niet: kan AI een advies geven? Wel: welke stap mag een advies voorbereiden en welke stap moet persoonlijk blijven?</h2><div class="case-question-row"><div><span>01</span><p>Wat probeert de bezoeker werkelijk te bereiken?</p></div><div><span>02</span><p>Welke informatie kan AI zinvol verzamelen en structureren?</p></div><div><span>03</span><p>Welke voorkeuren en afwegingen kan het systeem niet namens iemand bepalen?</p></div><div><span>04</span><p>Hoe ziet de bezoeker waarop een suggestie is gebaseerd?</p></div></div></div></section>
<section class="section journey-next"><div class="wrap journey-next-grid"><div><span>Bekijk de publieke praktijk</span><h2>De ontwikkeling van de regionale toepassing is ook buiten deze site beschreven.</h2></div><a class="button" href="https://nl.linkedin.com/posts/onderwijsregio-rotterdam-vo-mbo_presentatie-or-activity-7474731045964165120-0Amk" target="_blank" rel="noopener">Bekijk de praktijkbijdrage ↗</a></div></section>
<nav class="case-next-nav wrap" aria-label="Verder op de site"><a href="/toepassingen/">← Alle toepassingen</a><a href="/toepassingen/saga-legal-ai/">Volgende case: Legal AI →</a></nav>
</main>'''
    write(out, "toepassingen/onderwijsregio-rotterdam/index.html", doc("Onderwijsregio Rotterdam", regio_case_body, "/toepassingen/onderwijsregio-rotterdam/", "toepassingen", "EAI-case over regionale begeleiding met AI: ondersteunen, ordenen en informeren zonder de menselijke keuze over te nemen."))

    saga_case_body = '''<main>
<section class="page-hero case-detail-hero legal-case"><div class="wrap case-detail-grid"><div><div class="eyebrow">Case · Legal AI · Saga</div><h1>Efficiëntie is zichtbaar. De verschuiving van denkwerk veel minder.</h1><p class="lede">AI kan juridisch kenniswerk versnellen. De relevante vraag is niet alleen hoeveel tijd dat scheelt, maar ook welk analyseren, wegen en formuleren naar het systeem verschuift.</p></div><div class="case-signal"><span>De ontwerpvraag</span><strong>Welke cognitieve stappen wil je versnellen, en welke moeten aantoonbaar onderdeel blijven van professioneel oordeel?</strong></div></div></section>
<section class="section"><div class="wrap case-story-grid"><div class="case-story"><div class="kicker">De situatie</div><h2>Een goed voorstel kan nog steeds een zwakke basis voor oordeel zijn.</h2><p>Professionals kunnen AI gebruiken om informatie te ordenen, patronen te vinden, eerste analyses te maken of tekstvoorstellen te genereren. Dat kan productiviteit verhogen.</p><p>Maar een professionele uitkomst wordt niet alleen bepaald door de kwaliteit van de tekst. Begrip van de zaak, het wegen van argumenten, onzekerheid herkennen en verantwoordelijkheid nemen blijven afzonderlijke handelingen.</p></div><div class="density-visual" aria-label="Task Density voorbeeld"><div class="density-head"><span>Werkstap</span><span>Mens</span><span>AI</span></div><div><strong>Bronnen verzamelen</strong><i class="mid"></i><i class="high"></i></div><div><strong>Relevantie beoordelen</strong><i class="high"></i><i class="mid"></i></div><div><strong>Argumenten wegen</strong><i class="high"></i><i class="low"></i></div><div><strong>Tekstvoorstel</strong><i class="mid"></i><i class="high"></i></div><div><strong>Eindoordeel</strong><i class="high"></i><i class="low"></i></div></div></div></section>
<section class="section case-question-band"><div class="wrap"><div class="kicker">Wat deze case zichtbaar maakt</div><h2>Meet niet alleen output en tijdwinst. Leg ook vast welk werk verdwijnt, verschuift of opnieuw gecontroleerd moet worden.</h2><p>Saga gebruikte de EAI-begrippen Task Density en Didactic Controllability in een eigen publicatie over verantwoord werken en leren met AI.</p></div></section>
<section class="section journey-next"><div class="wrap journey-next-grid"><div><span>Externe publicatie</span><h2>Lees hoe Saga deze begrippen naar de juridische context heeft vertaald.</h2></div><a class="button" href="https://www.sagalegal.io/article/beyond-explainability-didactic-controllability-and-task-density-as-foundations-for-responsible-learning-with-ai" target="_blank" rel="noopener">Lees bij Saga ↗</a></div></section>
<nav class="case-next-nav wrap" aria-label="Verder op de site"><a href="/toepassingen/onderwijsregio-rotterdam/">← Vorige case</a><a href="/kennis/">Verdiep de begrippen →</a></nav>
</main>'''
    write(out, "toepassingen/saga-legal-ai/index.html", doc("Saga Legal AI", saga_case_body, "/toepassingen/saga-legal-ai/", "toepassingen", "EAI-case over professioneel kenniswerk, Task Density en menselijk oordeel in een legal-AI-context."))

    onderwijs_hub_body = '''<main>
<section class="page-hero education-hub-hero"><div class="wrap education-hero-grid"><div><div class="eyebrow">Onderwijs</div><h1>Begin niet bij een werkvorm. Begin bij wat je in je les probeert op te lossen.</h1><p class="lede">Kies hieronder de situatie die het meest lijkt op jouw vraag. Je komt daarna bij de werkvorm, taalsteun of didactische route die daarbij past.</p></div><div class="education-route-visual" aria-label="Van lesvraag naar volgende stap"><div><span>1</span><strong>Wat zie je gebeuren?</strong></div><b>↓</b><div><span>2</span><strong>Welke leerstap telt hier?</strong></div><b>↓</b><div class="active"><span>3</span><strong>Kies passende hulp of werkvorm</strong></div></div></div></section>
<section class="section education-start"><div class="wrap"><div class="section-head"><div class="kicker">Waar wil je mee beginnen?</div><div><h2>Kies je ingang.</h2><p>Je hoeft het EAI-model niet eerst te bestuderen. Begin bij het probleem of de werkwijze die je al hebt.</p></div></div>
<div class="education-choice-grid">
<a href="/werkvormen/?route=diagnose"><span>Ik zie dat leerlingen vastlopen</span><h3>Waar gaat het voor het eerst mis?</h3><p>Maak denkstappen en misconcepties zichtbaar voordat je meer uitleg geeft.</p><b>Zoek diagnostische werkvormen →</b></a>
<a href="/werkvormen/?route=support"><span>Ik wil helpen zonder het over te nemen</span><h3>Hoe klein kan de hulp zijn?</h3><p>Geef richting, maar laat de relevante volgende stap weer door de leerling uitvoeren.</p><b>Zoek ondersteunende werkvormen →</b></a>
<a href="/werkvormen/?route=independent"><span>Ik wil weten wat een leerling zelf kan</span><h3>Haal de ondersteuning even weg.</h3><p>Gebruik een nieuwe poging, handback of transfer om zelfstandigheid beter te zien.</p><b>Zoek werkvormen voor zelfstandigheid →</b></a>
<a href="/taalwerkvormen/"><span>Ik wil taal en vakinhoud samen oefenen</span><h3>Gebruik TAALwerkvormen.</h3><p>Vijftien complete werkvormkaarten voor vaktaal, formatief handelen, feedback en redo.</p><b>Open TAALwerkvormen →</b></a>
<a href="/werkvormen/#didactisch-model"><span>Ik werk al met een didactisch model</span><h3>Blijf bij je eigen lesstructuur.</h3><p>Bekijk waar EAI-vragen aansluiten op EDI 2.0, Explicit Instruction en formatief handelen.</p><b>Kies je didactische model →</b></a>
<a href="/werkvormen/?route=redesign"><span>Ik wil een opdracht of toets aanpassen</span><h3>Wie zet welke stap?</h3><p>Ontwerp opnieuw vanuit leerdoel, leerstap, AI-rol en wat je bij de leerling wilt kunnen zien.</p><b>Start bij taakontwerp →</b></a>
</div></div></section>
<section class="section education-guide-strip"><div class="wrap"><div><span>Niet zeker waar je moet beginnen?</span><h2>Gebruik deze simpele volgorde.</h2></div><div class="guide-strip-steps"><p><b>Zie</b> wat de leerling nu doet.</p><p><b>Kies</b> welke leerstap hier centraal staat.</p><p><b>Begrens</b> de hulp van AI rond die leerstap.</p><p><b>Check</b> daarna wat de leerling zelf laat zien.</p></div></div></section>
<section class="section journey-next"><div class="wrap journey-next-grid"><div><span>Wil je eerst begrijpen waarom?</span><h2>Lees de onderwijsbasis zonder de praktische route kwijt te raken.</h2></div><div class="button-row"><a class="button" href="/twee-pijlers/">Twee pijlers</a><a class="button secondary" href="/onderbouwing/">Onderbouwing</a></div></div></section>
</main>'''
    write(out, "onderwijs/index.html", doc("Onderwijs", onderwijs_hub_body, "/onderwijs/", "onderwijs", "Begin bij een concrete onderwijsvraag en kies passende EAI-werkvormen, TAALwerkvormen of een didactisch model."))

    kennis_body = '''<main>
<section class="page-hero knowledge-hub-hero"><div class="wrap knowledge-hero-grid"><div><div class="eyebrow">Kennis</div><h1>Hoe diep wil je gaan?</h1><p class="lede">Niet iedereen komt hier met dezelfde vraag. Kies of je snel wilt begrijpen waar EAI op rust, een claim wilt controleren of het ontwikkelwerk verder wilt volgen.</p></div><div class="knowledge-depth" aria-label="Drie niveaus van verdieping"><div><span>5 min</span><strong>Begrijpen</strong><small>Waar komt de redenering vandaan?</small></div><div><span>20 min</span><strong>Controleren</strong><small>Welke bronnen en grenzen horen erbij?</small></div><div><span>verder</span><strong>Onderzoeken</strong><small>Publicaties, tools en ontwikkeling.</small></div></div></div></section>
<section class="section knowledge-routes"><div class="wrap">
<div class="knowledge-route knowledge-route--primary"><div><span>Route 01 · begrijpen</span><h2>Ik wil weten waarop EAI inhoudelijk rust.</h2><p>Begin bij de twee kennisgebieden onder het model en ga daarna naar de onderbouwing van de belangrijkste ontwerpkeuzes.</p></div><div><a href="/twee-pijlers/">Start met de twee pijlers →</a><a href="/onderbouwing/">Daarna: onderbouwing →</a></div></div>
<div class="knowledge-route"><div><span>Route 02 · controleren</span><h2>Ik wil bronnen, claims en herkomst kunnen nalopen.</h2><p>Ga rechtstreeks naar het bronregister. Daar houden we bronmodellen, onderzoek en eigen EAI-vertalingen uit elkaar.</p></div><div><a href="/bronnen/">Open het bronregister →</a></div></div>
<div class="knowledge-route"><div><span>Route 03 · verder onderzoeken</span><h2>Ik wil lezen, kijken of zelf verder bouwen.</h2><p>Publicaties laten de ontwikkellijn zien. Tools en demonstrators tonen hoe begrippen in ontwerpen terechtkomen.</p></div><div><a href="/publicaties/">Publicaties &amp; media →</a><a href="/tools/">Tools →</a><a href="/praktijk/">Demonstrators →</a></div></div>
</div></section>
<section class="section knowledge-map-section"><div class="wrap"><div class="section-head"><div class="kicker">Hoe de onderdelen samenhangen</div><div><h2>Geen losse bibliotheek.</h2><p>Een praktijkvraag kan naar onderbouwing leiden. Een bron kan een ontwerpkeuze aanscherpen. Een demonstrator kan weer nieuwe vragen opleveren.</p></div></div><div class="knowledge-map"><a href="/onderbouwing/"><span>Onderbouwing</span><small>waarom deze ontwerpkeuze?</small></a><b>↔</b><a href="/bronnen/"><span>Bronnen</span><small>waar is dat op gebaseerd?</small></a><b>↔</b><a href="/publicaties/"><span>Publicaties</span><small>hoe ontwikkelt de gedachte?</small></a><b>↔</b><a href="/praktijk/"><span>Praktijk</span><small>wat gebeurt er als je het bouwt?</small></a></div></div></section>
</main>'''
    write(out, "kennis/index.html", doc("Kennis", kennis_body, "/kennis/", "kennis", "Kies een route door de onderbouwing, bronnen, publicaties en praktijk achter het EAI-model."))


    verdieping_body = '''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Verdieping</div><h1>Meer weten over waarom EAI zo werkt?</h1><p class="lede">Hier vind je de onderbouwing, bronnen, publicaties, praktijkvoorbeelden en tools achter EAI. Je kunt rechtstreeks verder naar het onderwerp dat voor jouw vraag relevant is.</p></div></section>
<section class="section"><div class="wrap"><div class="depth-grid">
<a class="depth-card depth-card--wide" href="/onderbouwing/"><span>Onderbouwing</span><h2>Waar rust EAI op?</h2><p>Didactiek, leerpsychologie, pedagogiek, professioneel oordeel en recent AI-onderzoek. Met expliciete grenzen aan wat EAI wel en niet claimt.</p><b>Bekijk de onderbouwing →</b></a>
<a class="depth-card" href="/bronnen/"><span>Bronnen</span><h2>Waar komt het concreet vandaan?</h2><p>Bronmodellen, onderzoek achter ontwerpprincipes, TAALwerkvormen en eigen EAI-evidencebestanden.</p><b>Bekijk de bronnen →</b></a>
<a class="depth-card" href="/publicaties/"><span>Publicaties & media</span><h2>Lees, kijk en luister verder.</h2><p>Eigen EAI-publicaties, externe bijdragen, podcast en video.</p><b>Lees publicaties &amp; media →</b></a>
<a class="depth-card" href="/praktijk/"><span>Praktijk</span><h2>Wat gebeurt er als je het bouwt?</h2><p>Live demonstrators en toepassingen waarin dezelfde ontwerpvragen terugkomen.</p><b>Bekijk de praktijk →</b></a>
<a class="depth-card" href="/tools/"><span>Tools</span><h2>Van vraag naar ontwerp.</h2><p>Toepassingen die helpen bij analyse, prompts, eigenaarschap en lesontwerp.</p><b>Bekijk de tools →</b></a>
<a class="depth-card" href="/twee-pijlers/"><span>Achter het model</span><h2>Waarom leren én AI?</h2><p>De twee kennisgebieden die je nodig hebt om niet alleen over technologie te praten.</p><b>Lees de twee pijlers →</b></a>
<a class="depth-card" href="/werkvormen/#didactisch-model"><span>Didactische modellen</span><h2>EAI binnen een model dat je al gebruikt.</h2><p>Bekijk EDI 2.0, Explicit Instruction en formatief handelen zonder de bronmodellen te herschrijven.</p><b>Bekijk de modeladapters →</b></a>
</div></div></section>
</main>'''
    write(out, "verdieping/index.html", redirect("/kennis/"))

    pillars_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Twee pijlers</div><h1>Je hebt beide nodig om goede keuzes te maken.</h1><p class="lede">De ene pijler gaat over leren. De andere over de technologie die steeds meer stappen kan uitvoeren. Het onderwijskundige ontwerp ontstaat waar die twee kennisgebieden elkaar raken.</p></div></section>
<section class="section"><div class="wrap"><figure class="pdf-figure pillar-visual" aria-label="Twee pijlers die samenkomen in de ontwerpvraag"><svg viewBox="0 0 560 220" role="img"><g class="stroke"><rect x="105" y="58" width="82" height="112"/><path d="M126 93c14-10 25 10 39 0M126 113c14-10 25 10 39 0M126 133c14-10 25 10 39 0"/><rect x="373" y="58" width="82" height="112"/><rect x="396" y="92" width="36" height="36"/><path d="M396 100h-12M396 110h-12M396 120h-12M396 130h-12M432 100h12M432 110h12M432 120h12M432 130h12"/></g><path class="dash" d="M187 91c42 0 57 37 83 62M373 91c-42 0-57 37-83 62"/><circle class="accent-fill" cx="280" cy="164" r="8"/></svg><figcaption>De ontwerpvraag ontstaat niet in één pijler, maar precies waar leren en AI elkaar raken.</figcaption></figure></div></section>
<section class="section" id="leren"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 01</div><div><h2>Hoe leren werkt</h2><p>Leren is meer dan een correct eindproduct. De leerling haalt voorkennis op, geeft betekenis, legt relaties, oefent, maakt fouten, kiest, controleert en probeert kennis later opnieuw toe te passen.</p></div></div><div class="panel"><h3>De vraag</h3><p>Welke stap in dit proces moet door de leerling of professional zelf inhoudelijke betekenis krijgen?</p><p>Dat antwoord hangt af van het doel én van waar iemand zich in het proces bevindt. Een uitgewerkte redenering kan tijdens instructie passende steun zijn en tijdens zelfstandig oefenen precies het werk overnemen dat geleerd moest worden.</p></div></div></section>
<section class="section" id="taalmodellen"><div class="wrap"><div class="section-head"><div class="kicker">Pijler 02</div><div><h2>Hoe taalmodellen werken</h2><p>Taalmodellen genereren vanuit patronen en context. Ze kunnen niet alleen formuleren, maar ook structureren, vergelijken, samenvatten, vragen formuleren, feedback geven en vervolgstappen voorstellen.</p></div></div><div class="panel"><h3>De vraag</h3><p>Wat doet het systeem in deze concrete taak feitelijk?</p><p>Niet de hoeveelheid tekst die AI produceert is bepalend. De relevante vraag is welke leerstap door AI wordt ondersteund, veranderd of overgenomen.</p></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Eén taak, twee blikken</div><div><h2>Twee historische bronnen vergelijken.</h2><p>AI kan verschillen aanwijzen, belangen benoemen en een keurige vergelijking schrijven. Voor een docent kan dat efficiënt zijn. Voor een leerling die juist moet leren bronnen te vergelijken en wegen, kan hetzelfde systeem een belangrijk deel van die leerstap overnemen.</p></div></div><div class="pillars"><article class="pillar"><div class="num">Vanuit leren</div><h3>Wat moet de leerling doen?</h3><p>Bronnen wegen, verschillen betekenis geven en tot een eigen onderbouwde vergelijking komen.</p></article><article class="pillar"><div class="num">Vanuit AI</div><h3>Wat kan het systeem doen?</h3><p>Precies die verschillen selecteren, ordenen, interpreteren en formuleren. De technische mogelijkheid krijgt dus pas betekenis door het leerdoel en de fase.</p></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">De verbinding</div><div><h2>Hier begint EAI.</h2><p>Niet bij de tool. Leg eerst het leren op tafel en kijk daarna wat AI op precies die plek doet.</p></div></div><div class="workform"><div><span class="badge">1</span></div><div><strong>Proces</strong><p>Wat moet de leerling uiteindelijk kennen of kunnen, en hoe komt hij daar?</p></div><span></span></div><div class="workform"><div><span class="badge">2</span></div><div><strong>Fase</strong><p>Waar in dat leren bevindt de leerling zich nu?</p></div><span></span></div><div class="workform"><div><span class="badge">3</span></div><div><strong>Leerstap</strong><p>Aan welke stap moet de leerling in deze fase zelf inhoudelijke betekenis geven?</p></div><a href="/werkvormen/kernhandeling-check/">Probeer →</a></div><div class="workform"><div><span class="badge">4</span></div><div><strong>Wat doet AI daar?</strong><p>Voert AI die stap uit, ondersteunt het de leerling eromheen, of doet het iets anders?</p></div><span></span></div><div class="workform"><div><span class="badge">?</span></div><div><strong>Wat kun je daarna zeggen?</strong><p>Wat laat de uitvoering zien over wat de leerling met hulp, zelfstandig, later of in een andere situatie kan?</p></div><a href="/werkvormen/bewijs-van-leren/">Probeer →</a></div><p style="margin-top:30px"><a href="/publicaties/de-vraag-die-we-vergeten/">Lees de redenering achter deze volgorde →</a></p></div></section></main>'''
    write(out, "twee-pijlers/index.html", doc("Twee pijlers", pillars_body, "/twee-pijlers/", "pijlers", "Hoe leren werkt en hoe taalmodellen werken: de twee pijlers onder EAI."))

    evidence_body = '''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Onderbouwing</div><h1>Waar rust EAI op?</h1><p class="lede">Niet op één theorie. EAI brengt drie lagen bij elkaar: wat we al weten over leren en onderwijs, wat recent onderzoek laat zien over AI in onderwijs, en de ontwerpkeuzes die EAI daar zelf bovenop legt.</p></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Drie lagen</div><div><h2>Die lagen moeten uit elkaar blijven.</h2><p>Een bestaand didactisch mechanisme is iets anders dan een recente AI-studie. En geen van beide maakt een nieuw EAI-begrip vanzelf gevalideerd. Op deze site proberen we dat onderscheid zichtbaar te houden.</p></div></div>
<div class="evidence-layer-grid">
<article><span>01</span><h3>Didactiek & leerpsychologie</h3><p>Ophalen uit geheugen, feedback verwerken, zelfregulatie, scaffolding, afbouw van hulp, transfer en actieve verwerking zijn geen EAI-uitvindingen. EAI gebruikt zulke mechanismen wanneer AI een deel van de taak kan uitvoeren.</p></article>
<article><span>02</span><h3>Pedagogiek & professioneel oordeel</h3><p>Onderwijs gaat niet alleen over taakprestatie. Ook autonomie, leerlingstem, relatie, proportionaliteit, professionele verantwoordelijkheid en de vraag waartoe je onderwijst spelen mee.</p></article>
<article><span>03</span><h3>AI-specifiek onderzoek</h3><p>Recente studies laten zien dat effecten van generatieve AI sterk afhangen van taak, ondersteuning en wat AI precies overneemt. Daarom kijkt EAI naar welke werkstappen bij de leerling blijven en welke door AI worden uitgevoerd, in plaats van alleen naar ‘AI-gebruik’.</p></article>
</div></div></section>

<section class="section" id="zelfstandigheid"><span id="proces-en-bewijs"></span><span id="bewijs"></span><div class="wrap"><div class="section-head"><div class="kicker">Zelfstandigheid</div><div><h2>Met hulp iets goed doen is niet hetzelfde als het zelf kunnen.</h2><p>Dat klinkt bijna te vanzelfsprekend. Toch wordt een sterk AI-ondersteund product gemakkelijk gelezen alsof het iets zegt over zelfstandige beheersing. EAI houdt ondersteunde prestatie, zelfstandig uitvoeren, later opnieuw uitvoeren en transfer daarom uit elkaar.</p></div></div>
<div class="evidence-pair"><article><h3>Onderwijswetenschappelijk</h3><p>Onderzoek naar retrieval en opnieuw uitvoeren laat zien waarom een nieuwe poging iets anders kan laten zien dan opnieuw bestuderen of herkennen.</p><p><a href="https://doi.org/10.1111/j.1467-9280.2006.01693.x" target="_blank" rel="noopener">Roediger &amp; Karpicke (2006) →</a></p></article>
<article><h3>AI-specifiek</h3><p>Recente studies onderscheiden eveneens sterke prestatie mét AI van wat later zonder dezelfde ondersteuning beschikbaar blijft.</p><p><a href="https://doi.org/10.1073/pnas.2422633122" target="_blank" rel="noopener">Bastani et al. (2025) →</a></p></article></div>
</div></section>

<section class="section" id="scaffolding"><div class="wrap"><div class="section-head"><div class="kicker">Hulp & scaffolding</div><div><h2>Goede hulp geeft de leerstap uiteindelijk weer terug aan de leerling.</h2><p>Scaffolding gaat niet om zo min mogelijk helpen. Het gaat om passende hulp, contingentie, afbouw en overdracht van verantwoordelijkheid. Dat wordt extra relevant wanneer AI onbeperkt hints, uitleg en modellen kan geven.</p></div></div>
<div class="evidence-pair"><article><h3>Onderwijswetenschappelijk</h3><p>In de scaffoldingliteratuur keren juist contingentie, fading en transfer of responsibility steeds terug.</p><p><a href="https://doi.org/10.1007/s10648-010-9127-6" target="_blank" rel="noopener">Van de Pol, Volman &amp; Beishuizen (2010) →</a></p></article>
<article><h3>AI-specifiek</h3><p>AI-tutoring kan leren ondersteunen wanneer de hulp zo is ontworpen dat leerlingen actief blijven; onbeperkte antwoordvoorziening kan in sommige situaties juist latere prestaties schaden.</p><p><a href="https://doi.org/10.1038/s41598-025-97652-6" target="_blank" rel="noopener">Kestin et al. (2025) →</a></p></article></div>
</div></section>

<section class="section" id="feedback"><div class="wrap"><div class="section-head"><div class="kicker">Feedback</div><div><h2>Feedback krijgt betekenis in de volgende poging.</h2><p>Een verbeterde tekst is niet automatisch bewijs dat de leerling de verbetering zelf kon uitvoeren. Daarom eindigen EAI-werkvormen rond feedback vaak met revisie of een nieuwe poging door de leerling.</p></div></div>
<p><a href="https://doi.org/10.3102/003465430298487" target="_blank" rel="noopener">Hattie &amp; Timperley (2007), The Power of Feedback →</a></p>
</div></section>

<section class="section" id="zelfregulatie"><div class="wrap"><div class="section-head"><div class="kicker">Zelfregulatie</div><div><h2>Ook plannen, controleren en hulp kiezen kunnen leerstappen zijn.</h2><p>Wanneer AI automatisch doelen herformuleert, een route kiest, voortgang beoordeelt of hulp opschaalt, kan niet alleen inhoudelijk werk maar ook regulatie verschuiven. Daarom behandelt EAI die stappen afzonderlijk.</p></div></div>
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

<section class="section" id="eai-standard"><div class="wrap"><div class="section-head"><div class="kicker">Wat EAI zelf toevoegt</div><div><h2>Een ontwerp- en analysetaal. Geen bewezen universele meettest.</h2><p>De EAI Standard koppelt context, doel, actor en fase technisch aan een centrale leerstap, kleinere microstructuren, concrete AI-acties en passend bewijs. De precieze EAI-taxonomie blijft kandidaat en vraagt verdere construct- en interbeoordelaarsvalidatie.</p></div></div>
<div class="split"><article class="panel"><h3>Wel claimen</h3><ul><li>Werkstappen van leerling en AI moeten apart beschreven kunnen worden.</li><li>Een ondersteund product is niet vanzelf bewijs van zelfstandige beheersing.</li><li>Bewijs moet passen bij de uitspraak die je wilt doen.</li><li>AI-effecten zijn afhankelijk van context, taak en rol.</li></ul></article>
<article class="panel"><h3>Niet claimen</h3><ul><li>Dat iedere EAI-werkvorm experimenteel gevalideerd is.</li><li>Dat één lijst leerstappen voor alle vakken en fasen geldt.</li><li>Dat AI per definitie goed of slecht is voor leren.</li><li>Dat de EAI-microstructuren al een gevalideerd meetinstrument vormen.</li></ul></article></div>
<p style="margin-top:28px"><a href="https://github.com/E-AI-MODEL/EAI-standard/blob/main/evidence/claims.yaml" target="_blank" rel="noopener">Bekijk de evidence claims in de EAI Standard →</a><br><a href="https://github.com/E-AI-MODEL/EAI-standard/blob/main/evidence/construct-map.yaml" target="_blank" rel="noopener">Bekijk de construct map en validatiestatus →</a></p>
</div></section>
<section class="section"><div class="wrap"><div class="source-register-cta"><div><div class="kicker">Bronregister</div><h2>Alle bronnen bij elkaar.</h2><p>Van bronmodellen en leerpsychologie tot TAALwerkvormen en AI-onderzoek. Met onderscheid tussen bron, onderbouwing en eigen ontwerpvertaling.</p></div><a class="button" href="/bronnen/">Open de bronnenlijst</a></div></div></section>
</main>'''
    write(out, "onderbouwing/index.html", doc("Onderbouwing", evidence_body, "/onderbouwing/", "onderbouwing", "Didactische, leerpsychologische, pedagogische en AI-specifieke onderbouwing van EAI, met expliciete grenzen aan wat het model claimt."))

    workshop_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Workshop AI</div><h1>Van twee pijlers naar ontwerp.</h1><p class="lede">De drie workshops volgen steeds dezelfde beweging: kennisbasis, verdieping, een uitgewerkt voorbeeld, reflectie, een werkvorm en een concrete afsluiting. De werkvormen hieronder kun je ook los gebruiken.</p></div></section>
<section class="section"><div class="wrap"><figure class="pdf-figure" aria-label="Drie stappen van Workshop AI"><svg viewBox="0 0 760 210" role="img"><g class="stroke"><path d="M95 112h570"/><circle cx="160" cy="112" r="13"/><circle cx="380" cy="112" r="13"/><circle cx="600" cy="112" r="13"/><rect x="130" y="35" width="60" height="48" rx="4"/><rect x="350" y="35" width="60" height="48" rx="4"/><rect x="570" y="35" width="60" height="48" rx="4"/></g><path class="dash" d="M160 83v16M380 83v16M600 83v16"/><circle class="accent-fill" cx="160" cy="112" r="8"/><circle class="accent-fill" cx="380" cy="112" r="8"/><circle class="accent-fill" cx="600" cy="112" r="8"/><text x="160" y="154" text-anchor="middle" font-size="14" fill="#687487">twee pijlers</text><text x="380" y="154" text-anchor="middle" font-size="14" fill="#687487">wie doet welk werk?</text><text x="600" y="154" text-anchor="middle" font-size="14" fill="#687487">herontwerp</text></svg><figcaption>De workshop beweegt van begrijpen naar analyseren en daarna pas naar ontwerpen.</figcaption></figure></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 1</div><div><h2>Twee pijlers voor AI in onderwijs</h2><p>Eerst scherp krijgen hoe leren werkt én hoe taalmodellen werken. Daarna pas beoordelen wat een AI-toepassing in een onderwijsproces betekent.</p></div></div><div class="workform"><div><span class="badge">Basis</span></div><div><strong>Leg de twee pijlers naast elkaar</strong><p>Bekijk één concrete taak vanuit leren en vanuit de technische mogelijkheden van AI.</p></div><a href="/twee-pijlers/">Lees de twee pijlers →</a></div><div class="workform"><div><span class="badge">Toollab</span></div><div><strong>Dezelfde vraag, twee omgevingen</strong><p>Vergelijk een algemene AI met een brongebonden omgeving. Wat verandert er door context en bronnen?</p></div><a href="/werkvormen/toollab/">Gebruik Toollab →</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 2</div><div><h2>Welke leerstap moet de leerling hier zelf zetten?</h2><p>We pakken één taak, leggen het leerproces en de fase op tafel en bepalen welke leerstap hier centraal staat. Pas daarna kijken we welk deel AI uitvoert.</p></div></div><div class="workform"><div><span class="badge">Analyse</span></div><div><strong>Wie doet welk werk?</strong><p>Maak per stap zichtbaar wat de leerling doet en wat AI al voor hem uitvoert.</p></div><a href="/werkvormen/task-density-scan/">Gebruik Wie doet welk werk? →</a></div><div class="workform"><div><span class="badge">Kern</span></div><div><strong>Welke leerstap staat centraal?</strong><p>Bepaal welke stap de leerling hier zelf moet zetten om tot leren te komen.</p></div><a href="/werkvormen/kernhandeling-check/">Bekijk de leerstap →</a></div><div class="workform"><div><span class="badge">Diagnose</span></div><div><strong>Foutanalyse</strong><p>Laat de leerling de eerste ontsporing aanwijzen, verklaren en herstellen.</p></div><a href="/werkvormen/foutanalyse/">Gebruik Foutanalyse →</a></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Workshop 3</div><div><h2>Van inzicht naar ontwerp</h2><p>Het leerproces, de fase, de leerstap en de rol van AI komen samen in het herontwerp van een taak.</p></div></div><div class="workform"><div><span class="badge">Keuzes</span></div><div><strong>Keuzes verantwoorden</strong><p>Maak zichtbaar wat uit AI-suggesties is overgenomen, verworpen of veranderd, en vooral waarom.</p></div><a href="/werkvormen/justification-mapping/">Gebruik Keuzes verantwoorden →</a></div><div class="workform"><div><span class="badge">Bewijs</span></div><div><strong>Bewijs van leren</strong><p>Kies bewijs dat past bij wat je werkelijk over de leerling wilt kunnen zeggen.</p></div><a href="/werkvormen/bewijs-van-leren/">Gebruik Bewijs van leren →</a></div><div class="workform"><div><span class="badge">Voorbeeld</span></div><div><strong>Prompt Builder</strong><p>Bekijk hoe je met taal, meegegeven informatie en duidelijke grenzen bepaalt wat AI in deze taak wel en niet doet.</p></div><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder ↗</a></div></div></section></main>'''
    write(out, "workshop-ai/index.html", doc("Workshop AI", workshop_body, "/workshop-ai/", "workshop", "Workshopreeks over leren, taalmodellen, denkwerk en herontwerp."))

    workforms = load_workforms()
    validate_public_workform_language(workforms)
    didactic_models = load_didactic_models()
    workforms_by_slug = {item["slug"]: item for item in workforms}
    workforms_body = render_workforms_index(workforms, didactic_models)
    write(out, "werkvormen/index.html", doc("EAI Toolbox", workforms_body, "/werkvormen/", "werkvormen", "EAI-werkvormen om menselijk handelen, taakverdeling, bewijs en zelfstandigheid zichtbaar te maken."))

    write(
        out,
        "taalwerkvormen/index.html",
        doc(
            "TAALwerkvormen",
            load_content_fragment("taalwerkvormen-page.html"),
            "/taalwerkvormen/",
            "taal",
            "De complete TAALwerkvormen-gids van het Emmauscollege: 15 vakgerichte, formatieve werkvormen met docentstappen, bewijs van leren, redo en volledige LLM-prompts.",
        ),
    )
    write(
        out,
        "bronnen/index.html",
        doc(
            "Bronnen",
            load_content_fragment("bronnen-page.html"),
            "/bronnen/",
            "bronnen",
            "Bronnen en onderbouwing achter EAI, TAALwerkvormen, didactische adapters en ontwerpkeuzes.",
        ),
    )

    jm_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm · Workshop AI</div><h1>Keuzes verantwoorden</h1><p class="workform-technical-name detail">EAI-term: Justification Mapping</p><p class="lede">AI kan een formulering, argument of route voorstellen. De vraag is vervolgens niet alleen wat de leerling overneemt, maar waarom hij dat doet.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Waarvoor?</div><div><h2>Niet alleen laten zien dát er een keuze is gemaakt.</h2><p>De werkvorm richt zich op de grens tussen AI-assistentie en menselijk begrip. Een leerling kan een AI-suggestie aanpassen zonder de inhoudelijke afweging zelf te hebben gemaakt. Daarom wordt juist de rationale zichtbaar.</p></div></div><figure class="pdf-figure" aria-label="Justification Mapping van AI-suggestie naar menselijke verantwoording"><svg viewBox="0 0 760 220" role="img"><g class="stroke"><rect x="70" y="74" width="130" height="70" rx="4"/><rect x="315" y="50" width="130" height="70" rx="4"/><rect x="315" y="130" width="130" height="70" rx="4"/><rect x="560" y="74" width="130" height="70" rx="4"/></g><path class="dash" d="M200 109h115M445 85h115M445 165c58 0 72-26 115-45"/><circle class="accent-fill" cx="258" cy="109" r="8"/><text x="135" y="114" text-anchor="middle" font-size="14" fill="#687487">AI-suggestie</text><text x="380" y="92" text-anchor="middle" font-size="14" fill="#687487">accepteren</text><text x="380" y="172" text-anchor="middle" font-size="14" fill="#687487">verwerpen / wijzigen</text><text x="625" y="114" text-anchor="middle" font-size="14" fill="#687487">waarom?</text></svg><figcaption>Niet alleen vastleggen wat veranderde, maar zichtbaar maken waarom de leerling iets overnam, verwierp of herschreef.</figcaption></figure><div class="panel"><h3>Breng één AI-ondersteunde keuze in kaart</h3><ol><li><strong>Suggestie:</strong> wat stelde AI voor?</li><li><strong>Accepteren:</strong> wat heb je overgenomen?</li><li><strong>Verwerpen:</strong> wat heb je bewust niet gebruikt?</li><li><strong>Waarom:</strong> welke inhoudelijke reden lag achter beide keuzes?</li><li><strong>Eigen wijziging:</strong> wat heb je zelf toegevoegd, veranderd of opnieuw opgebouwd?</li><li><strong>Verdedigen:</strong> kun je de uiteindelijke keuze zonder het systeem uitleggen en onderbouwen?</li></ol></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Belangrijk onderscheid</div><div><h2>Dit is procesverantwoording rond AI-assistentie.</h2><p>Binnen deze workshop is Justification Mapping geen algemene methodekeuzekaart. Het doel is zichtbaar maken waar een AI-bijdrage ophoudt en de inhoudelijke afweging van de leerling begint.</p></div></div><p><a class="button" href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Bekijk in Prompt Builder hoe de AI-rol wordt gestuurd</a></p></div></section></main>'''
    write(out, "werkvormen/justification-mapping/index.html", doc("Keuzes verantwoorden", enrich_manual_workform(jm_body, workforms_by_slug["justification-mapping"], workforms), "/werkvormen/justification-mapping/", "werkvormen", "Justification Mapping als EAI-werkvorm voor zichtbare keuzes en procesverantwoording."))
    core_action_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Welke leerstap staat centraal?</h1><p class="lede">Aan welke stap moet de leerling in deze fase zelf inhoudelijke betekenis geven om tot leren te komen? Die leerstap staat in deze werkvorm centraal.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Werk van buiten naar binnen</h3><ol><li><strong>Proces:</strong> wat moet uiteindelijk geleerd, beheerst of professioneel beoordeeld worden?</li><li><strong>Fase:</strong> waar bevindt de leerling zich nu in dat leren?</li><li><strong>Werkstappen:</strong> welke stappen worden hier uitgevoerd?</li><li><strong>Leerstap:</strong> aan welke stap moet de leerling hier zelf inhoudelijke betekenis geven?</li><li><strong>AI-check:</strong> voert AI precies die leerstap uit, ondersteunt het eromheen, of doet het iets anders?</li><li><strong>Evidence:</strong> wat moet zichtbaar zijn als je later iets over menselijke beheersing of professioneel oordeel wilt zeggen?</li></ol></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Test</div><div><h2>Haal de AI-bijdrage denkbeeldig weg.</h2><p>Verdwijnt daarmee alleen routinewerk, of verdwijnt de stap waaraan de leerling juist zelf betekenis moest geven? Dat onderscheid bepaalt de volgende ontwerpkeuze.</p></div></div><p><a href="/publicaties/de-vraag-die-we-vergeten/">Lees de redenering achter deze vraag →</a></p></div></section></main>'''
    write(out, "werkvormen/kernhandeling-check/index.html", doc("Welke leerstap staat centraal?", enrich_manual_workform(core_action_body, workforms_by_slug["kernhandeling-check"], workforms), "/werkvormen/kernhandeling-check/", "werkvormen", "Bepaal welke leerstap de leerling in deze fase zelf moet zetten."))
    td_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Wie doet welk werk?</h1><p class="workform-technical-name detail">EAI-term: Task Density Map</p><p class="lede">Niet hoeveel AI er wordt gebruikt is de kern. Kijk per stap wie het werk uitvoert en of AI juist de leerstap overneemt die de leerling zelf moet zetten.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Stap 1</div><div><h2>Neem één concrete opdracht.</h2><p>Schrijf niet “AI bij Nederlands” op. Kies één taak waarin een leerling iets moet leren of laten zien.</p></div></div><figure class="pdf-figure" aria-label="Task Density verdeelt werkstappen tussen leerling en AI"><svg viewBox="0 0 720 230" role="img"><g class="stroke"><circle cx="145" cy="70" r="24"/><path d="M105 155c7-34 23-50 40-50s33 16 40 50"/><rect x="535" y="52" width="72" height="58" rx="4"/><path d="M553 52v-10M571 52v-10M589 52v-10M553 110v10M571 110v10M589 110v10"/></g><path class="dash" d="M200 95h310"/><circle class="accent-fill" cx="285" cy="95" r="7"/><circle class="accent-fill" cx="430" cy="95" r="7"/><text x="145" y="195" text-anchor="middle" font-size="14" fill="#687487">mens</text><text x="570" y="195" text-anchor="middle" font-size="14" fill="#687487">AI</text><text x="360" y="135" text-anchor="middle" font-size="14" fill="#687487">welke werkstappen verschuiven?</text></svg><figcaption>Task Density gaat niet om “hoeveel AI”, maar om welke werkstappen van leerling naar AI verschuiven en waar de leerstap blijft.</figcaption></figure><div class="panel"><h3>Maak een kaart van de werkstappen</h3><ol><li>Knip de fase op in concrete werkstappen.</li><li>Noteer per stap: leerling, AI, samen of nog onbekend.</li><li>Beschrijf wanneer AI in beeld komt: vóór, tijdens of na de centrale leerstap.</li><li>Noteer welke opties, criteria of routes AI al heeft geselecteerd voordat de mens reageert.</li><li>Bekijk daarna welke werkstappen verdwijnen, naar AI verschuiven of een andere betekenis krijgen.</li></ol><p>Gebruik werkwoorden die passen bij de concrete taak. Structureren, formuleren, controleren, kiezen, herzien en verantwoorden zijn voorbeelden, geen vaste checklist.</p></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Stap 2</div><div><h2>Zoek de leerstap die ertoe doet.</h2><p>Welke van deze werkstappen moet de leerling in deze fase zelf zetten om tot leren te komen? Dat is de leerstap. Die is belangrijker dan een totaalpercentage.</p></div></div><div class="panel"><h3>De beslisvraag</h3><p>Als AI deze leerstap uitvoert, wat kan ik daarna nog betrouwbaar zeggen over het leren van de leerling?</p></div></div></section></main>'''
    write(out, "werkvormen/task-density-scan/index.html", doc("Wie doet welk werk?", enrich_manual_workform(td_body, workforms_by_slug["task-density-scan"], workforms), "/werkvormen/task-density-scan/", "werkvormen", "Analyseer wie welk denkwerk uitvoert in een AI-ondersteunde taak."))

    evidence_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Bewijs van leren</h1><p class="lede">Een goed eindproduct is bewijs van een goed eindproduct. Het laat niet automatisch zien dat de leerling de leerstap zelfstandig kan zetten.</p></div></section><section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Kies bewust</div><div><h2>Wat wil je eigenlijk kunnen beweren?</h2><p>Lukt het mét hulp? Kan de leerling dezelfde leerstap daarna zelfstandig zetten? Kan hij dat later nog? En in een andere situatie?</p></div></div><figure class="pdf-figure" aria-label="Een goed product is niet automatisch bewijs van leren"><svg viewBox="0 0 720 220" role="img"><g class="stroke"><rect x="90" y="65" width="120" height="92"/><path d="M112 92h75M112 112h62M112 132h69"/><circle cx="580" cy="76" r="23"/><path d="M540 162c7-34 23-50 40-50s33 16 40 50"/></g><path class="dash" d="M210 111h116M394 111h146"/><circle class="accent-fill" cx="360" cy="111" r="8"/><text x="150" y="192" text-anchor="middle" font-size="14" fill="#687487">product</text><text x="360" y="192" text-anchor="middle" font-size="14" fill="#687487">≠ automatisch</text><text x="580" y="192" text-anchor="middle" font-size="14" fill="#687487">menselijke beheersing</text></svg><figcaption>Output kan goed zijn terwijl nog onduidelijk is wat de leerling zelfstandig kan uitvoeren.</figcaption></figure><div class="panel"><h3>Drie soorten bewijs</h3><ul><li><strong>Outputbewijs:</strong> laat zien wat is geproduceerd, maar niet vanzelf wie het relevante werk uitvoerde.</li><li><strong>Procesbewijs:</strong> laat keuzes, eerste pogingen, wijzigingen, controles en uitleg zien.</li><li><strong>Zelfstandig bewijs:</strong> laat een nieuwe of vergelijkbare uitvoering zien zonder de relevante AI-bijdrage.</li></ul><p>Wil je weten of de leerling het later nog kan, of ook in een andere situatie? Dan heb je opnieuw passend bewijs nodig. Begin dus steeds bij de vraag wat je werkelijk over het leren wilt kunnen zeggen.</p></div></div></section></main>'''
    write(out, "werkvormen/bewijs-van-leren/index.html", doc("Bewijs van leren", enrich_manual_workform(evidence_body, workforms_by_slug["bewijs-van-leren"], workforms), "/werkvormen/bewijs-van-leren/", "werkvormen", "Kies bewijs dat past bij wat je over het leren van de leerling wilt kunnen zeggen."))

    first_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Eerste poging en versie vergelijken</h1><p class="workform-technical-name detail">EAI-term: First Attempt &amp; Version Comparison</p><p class="lede">Laat eerst iets van de leerling zelf ontstaan. Vergelijk daarna wat met hulp veranderde en vraag waar de leerling zelf betekenis gaf.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Zo werkt het</h3><ol><li>Laat de leerling een korte eerste poging maken zonder AI.</li><li>Gebruik daarna AI voor een vooraf afgesproken vorm van ondersteuning.</li><li>Bewaar beide versies.</li><li>Laat de leerling drie veranderingen aanwijzen.</li><li>Vraag per verandering: wie stelde dit voor, waarom heb je het overgenomen of verworpen, en wat begrijp je nu anders?</li></ol><p>Het doel is niet bewijzen dat de leerling “zonder AI” werkte. Het doel is zichtbaar maken wat vóór en na ondersteuning door de leerling zelf is gedaan.</p></div></div></section></main>'''
    write(out, "werkvormen/first-attempt/index.html", doc("Eerste poging en versie vergelijken", enrich_manual_workform(first_body, workforms_by_slug["first-attempt"], workforms), "/werkvormen/first-attempt/", "werkvormen", "Vergelijk een eerste eigen poging met een latere AI-ondersteunde versie."))

    error_body = '''<main><section class="page-hero"><div class="wrap"><div class="eyebrow">Werkvorm</div><h1>Foutanalyse</h1><p class="lede">Een fout verbeteren is iets anders dan een fout herkennen, lokaliseren en verklaren.</p></div></section><section class="section"><div class="wrap"><div class="panel"><h3>Geef niet meteen de oplossing</h3><ol><li>Geef een foutieve redenering, eventueel door AI gegenereerd.</li><li>Laat de leerling aanwijzen waar het voor het eerst misgaat.</li><li>Laat uitleggen waarom die stap niet klopt.</li><li>Vraag wat er vanaf dat punt moet veranderen.</li><li>Laat pas daarna een volledige verbeterde versie maken.</li></ol><p>De leerstap is hier: de fout zelf herkennen, verklaren en herstellen. AI kan materiaal leveren, maar hoeft dat denkwerk niet alvast over te nemen.</p></div></div></section></main>'''
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
<section class="page-hero"><div class="wrap"><div class="eyebrow">Praktijk</div><h1>Wat gebeurt er wanneer je deze vragen echt in een systeem bouwt?</h1><p class="lede">De voorbeelden hieronder zijn experimenten. Ze laten zien hoe je in een concrete omgeving het leerproces, de leerstap en de rol van AI zichtbaar kunt houden.</p></div></section>
<section class="section"><div class="wrap">
<article class="app-showcase" id="classroom"><div class="app-copy"><span class="app-tag">Lespraktijk · live demo</span><h2>EAI Classroom</h2><p>Van leerdoel en succescriteria naar verwachte misconcepties, interventies en zichtbaar leerlingwerk. De omgeving laat vooral zien hoe didactische keuzes vóór de AI-interactie kunnen worden vastgelegd.</p><div class="button-row"><a class="button" href="https://eaiclassroom.lovable.app" target="_blank" rel="noopener">Open EAI Classroom ↗</a><a class="button secondary" href="/twee-pijlers/">Lees waarom leren en AI beide tellen</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>eaiclassroom.lovable.app</span></div><div class="embed-window app"><iframe src="https://eaiclassroom.lovable.app" title="EAI Classroom live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
<article class="app-showcase" id="hub"><div class="app-copy"><span class="app-tag">Leeromgeving · live demo</span><h2>EAIHUB</h2><p>Een leeromgeving waarin de positie in het leerproces en de rol van ondersteuning centraal staan. Niet alleen het antwoord telt, maar ook wat de leerling zelf nog moet doen en laten zien.</p><div class="button-row"><a class="button" href="https://eaihub.lovable.app" target="_blank" rel="noopener">Open EAIHUB ↗</a><a class="button secondary" href="/werkvormen/">Bekijk EAI-werkvormen</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>eaihub.lovable.app</span></div><div class="embed-window app"><iframe src="https://eaihub.lovable.app" title="EAIHUB live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
<article class="app-showcase" id="regio"><div class="app-copy"><span class="app-tag">Andere context · live demo</span><h2>Demo Regio</h2><p>EAI hoeft niet te stoppen bij een les of leerlingtaak. Deze demonstrator laat zien hoe dezelfde ontwerpvragen ook in een andere context kunnen worden uitgewerkt: wat is het menselijke proces, welke rol krijgt AI en waar moeten keuzes herleidbaar blijven?</p><div class="button-row"><a class="button" href="https://demo-regio.lovable.app" target="_blank" rel="noopener">Open Demo Regio ↗</a></div></div><div class="embed-card"><div class="embed-top"><span><span class="embed-dots"><i></i><i></i><i></i></span></span><span>demo-regio.lovable.app</span></div><div class="embed-window app"><iframe src="https://demo-regio.lovable.app" title="Demo Regio live demo" loading="lazy" allow="clipboard-read; clipboard-write; fullscreen"></iframe></div></div></article>
</div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Ontwerpen</div><div><h2>Ook de taal waarmee je AI aanstuurt, maakt een onderwijskeuze.</h2><p>Een prompt bepaalt niet alleen de toon van een antwoord. Hij kan ook bepalen of AI een vraag stelt, een aanpak kiest, informatie selecteert of al een oordeel geeft. In de Prompt Builder kun je dat stap voor stap zichtbaar maken.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Taal & systeem</div><h2>Prompt Builder</h2><p>Beschrijf eerst wat AI in deze fase wel en niet moet doen. Daarna zie je hoe prompt, context, grenzen en volgorde dat gedrag sturen.</p><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder →</a></article><article class="tool-card"><div class="kicker">Werkvorm</div><h2>Justification Mapping</h2><p>Maak zichtbaar wat uit AI-suggesties is overgenomen, verworpen of veranderd en waarom.</p><a href="/werkvormen/justification-mapping/">Bekijk Justification Mapping →</a></article></div></div></section>
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
<div class="button-row"><a class="button" href="{LINKEDIN}" target="_blank" rel="noopener">Volg of neem contact op via LinkedIn ↗</a><a class="button secondary" href="https://onderwijs-ai.nl/over-ons/team/hans-visser" target="_blank" rel="noopener">Onderwijs AI-profiel</a></div><details class="quiet-contact"><summary>Andere contactmogelijkheid</summary><p><a href="mailto:{EMAIL}">Stuur een e-mail</a></p></details>
<p class="source-note">Portret wordt rechtstreeks geladen vanaf het openbare Onderwijs AI-profiel.</p>
</div></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Wat EAI probeert te voorkomen</div><div><h2>Een nette output verwarren met menselijk leren of oordeel.</h2><p>AI kan een sterke tekst, uitleg, diagnose of aanbeveling produceren. EAI vraagt daarom steeds wat die output nog bewijst over de mens die ermee werkte.</p></div></div>
<div class="model-principles"><article><span>01</span><h3>Leg het proces op tafel</h3><p>Wat moet de leerling uiteindelijk kennen of kunnen, en hoe komt hij daar?</p></article><article><span>02</span><h3>Zoek de fase</h3><p>Waar bevindt de leerling zich nu in dat leren?</p></article><article><span>03</span><h3>Bepaal de leerstap</h3><p>Aan welke stap moet de leerling hier zelf inhoudelijke betekenis geven?</p></article><article><span>04</span><h3>Leg AI ernaast</h3><p>Wat doet AI precies op die plek? Helpt het, of voert het die leerstap al uit?</p></article><article><span>?</span><h3>Kijk wat je werkelijk weet</h3><p>Wat kun je nu zeggen over wat de leerling zelf kan, en welk extra bewijs heb je eventueel nodig?</p></article></div>
</div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Publiek werk</div><div><h2>Van schoolpraktijk naar publicaties en gesprekken.</h2><p>Publicaties en gesprekken waarin de EAI-vraag naar menselijk handelen naast AI terugkomt.</p></div></div>
<div class="publication-grid">
<a class="publication-card" href="https://www.kennisnet.nl/artificial-intelligence/nadenken-over-ai-op-je-school-ai-als-ongewenste-collega/" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Kennisnet · 2025</span><h3>AI als (on)gewenste collega</h3><p>Praktijkverhaal over AI op school, regie en de vraag welke taken je technologie wel en niet geeft.</p><span class="arrow">Lees bij Kennisnet →</span></div></a>
<a class="publication-card" href="https://onderwijs-ai.nl/blog/de-gevolgen-van-ai-toetsing" target="_blank" rel="noopener"><div class="publication-card__body"><span class="meta">Onderwijs AI · 2026</span><h3>De gevolgen van AI op toetsing</h3><p>Over leerdoelen, leeractiviteiten, bewijs van leren en toetsing in een wereld met generatieve AI.</p><span class="arrow">Lees bij Onderwijs AI →</span></div></a>
<a class="publication-card publication-card--image" href="https://researched.eu/2026/04/09/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel/" target="_blank" rel="noopener"><img src="{RESEARCHED_THUMB_URL}" alt="researchED Nederland Podcast #71" loading="lazy" decoding="async" referrerpolicy="no-referrer"><div class="publication-card__body"><span class="meta">researchED · 2026</span><h3>AI in ons onderwijs</h3><p>Podcastgesprek over AI en onderwijspraktijk.</p><span class="arrow">Bekijk researchED-podcast →</span></div></a>
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
        "Over AI, leren en professioneel handelen: begin bij het leerproces en de leerstap, pas daarna bij de technologie.",
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
        source = sources / filename
        excerpt = PUBLICATION_INTROS.get(slug, first_excerpt(source))
        pub_cards.append(f'<a class="card" href="/publicaties/{slug}/"><span class="meta">{esc(kind)}</span><h3>{esc(title)}</h3><p>{esc(excerpt)}</p><span class="arrow">Lees publicatie →</span></a>')
        write(out, f"publicaties/{slug}/index.html", inject_embed(source, f"/publicaties/{slug}/", title))
        write(out, f"eai-blog/{legacy[slug]}/index.html", redirect(f"/publicaties/{slug}/"))

    pubs_body = f'''<main>
<section class="page-hero"><div class="wrap"><div class="eyebrow">Publicaties & media</div><h1>Lees, kijk en luister verder.</h1><p class="lede">Eigen EAI-publicaties staan hier naast openbare artikelen en gesprekken waarin dezelfde vragen over leren, menselijk handelen en AI terugkomen.</p></div></section>
<section class="section"><div class="wrap"><article class="feature-publication"><div><div class="kicker">Lees eerst de kern van EAI</div><h2>De vraag die we vergeten in het AI-debat</h2><p>De kern van EAI in gewone taal: begin bij het proces, de fase en de leerstap. Bepaal daarna pas wat AI mag doen.</p><p><a class="button" href="/publicaties/de-vraag-die-we-vergeten/">Lees het artikel</a></p></div><div class="question-mark">?</div></article></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Eigen publicaties</div><div><h2>Hoe de vragen achter EAI zich hebben ontwikkeld.</h2><p>In de oudere stukken staan soms andere of technischere termen. De lijn eronder is dezelfde: wie doet welk werk, waaraan geeft de mens zelf betekenis en wat kun je daarna werkelijk concluderen?</p></div></div><div class="card-grid">{"".join(pub_cards)}</div></div></section>

<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Openbare publicaties</div><div><h2>EAI buiten deze site.</h2><p>Artikelen en praktijkverhalen waarin Hans Visser als auteur, mede-auteur of geïnterviewde voorkomt.</p></div></div>
<div class="publication-grid">
<a class="publication-card publication-card--image" href="https://onderwijs-ai.nl/over-ons/team/hans-visser" target="_blank" rel="noopener"><img src="{PORTRAIT_URL}" alt="Hans Visser" loading="lazy" decoding="async" referrerpolicy="no-referrer"><div class="publication-card__body"><span class="meta">Onderwijs AI</span><h3>Profiel en publicaties</h3><p>Publiek profiel met achtergrond en artikelen.</p><span class="arrow">Bekijk profiel &amp; publicaties →</span></div></a>
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
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Begrijpen & analyseren</div><div><h2>Wat gebeurt er met het denkwerk?</h2><p>Gebruik deze toepassingen om een bestaande taak of AI-interactie vanuit het leerproces te bekijken.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Analyse</div><h2>EAI Toolanalyse</h2><p>Bekijk een AI-toepassing op leerwaarde en didactische invloed. Gebruik de uitkomst als start van een professionele afweging, niet als automatisch oordeel.</p><a href="https://subtle-churros-4d44d5.netlify.app" target="_blank" rel="noopener">Open EAI Toolanalyse ↗</a></article><article class="tool-card"><div class="kicker">Interactief</div><h2>Act of Learning Game</h2><p>Verken de vraag wie in een concrete situatie het relevante denkwerk uitvoert.</p><a href="https://rainbow-tarsier-a88e9b.netlify.app/" target="_blank" rel="noopener">Open Act of Learning Game ↗</a></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Ontwerpen</div><div><h2>Wat wil je dat AI hier doet?</h2><p>Zodra leerdoel, fase en leerstap helder zijn, kun je de technische interactie veel preciezer ontwerpen.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Taal & systeem</div><h2>Prompt Builder · Sturen met taal</h2><p>Bekijk hoe de woorden in een prompt, de meegegeven informatie en de grenzen rond het systeem samen bepalen wat AI uiteindelijk doet. De technische termen staan in de tool zelf als je die laag nodig hebt.</p><a href="https://eai-prompt.lovable.app/" target="_blank" rel="noopener">Open Prompt Builder →</a></article><article class="tool-card"><div class="kicker">Lesontwerp</div><h2>EAI What-If Machine</h2><p>Verken hoe een andere keuze in taak of AI-inzet het ontwerp verandert.</p><a href="https://what-if-lesson-designer.lovable.app/" target="_blank" rel="noopener">Open EAI What-If Machine ↗</a></article></div></div></section>
<section class="section"><div class="wrap"><div class="section-head"><div class="kicker">Verdiepen</div><div><h2>Werk verder vanuit de publicaties.</h2><p>Deze toolkits horen bij eerdere EAI-publicaties en blijven bruikbaar als verdieping.</p></div></div><div class="tool-grid"><article class="tool-card"><div class="kicker">Toolkit</div><h2>Beyond Explainability</h2><p>Werk praktisch met de ideeën achter Didactic Controllability en Task Density.</p><a href="/tools/beyond-explainability/">Open Beyond Explainability →</a></article><article class="tool-card"><div class="kicker">Toolkit · English</div><h2>The Act of Learning</h2><p>Engelstalige toolkit bij de publicatie over Reverse Scaffolding en zichtbaar leren.</p><a href="https://effortless-fenglisu-71cd58.netlify.app/" target="_blank" rel="noopener">Open The Act of Learning toolkit ↗</a></article></div><p class="mini-note" style="margin-top:30px">Het EAA Model staat als afzonderlijk, ouder project nog beschikbaar via <a href="/eaa-model/">EAA Model</a>, maar vormt niet de actuele Core-laag van deze site.</p></div></section></main>'''
    write(out, "tools/index.html", doc("Tools", tools_body, "/tools/", "tools", "EAI-tools en werkvormen voor analyse, ontwerp en verdieping rond AI en leren."))
    write(out, "eai-tools-modules/index.html", redirect("/tools/"))

    toolkit = sources / "eai-tools-modules-eai-toolkit-beyond-explainability-embed1.html"
    write(out, "tools/beyond-explainability/index.html", inject_embed(toolkit, "/tools/beyond-explainability/", "EAI Toolkit: Beyond Explainability", "/tools/"))

    eaa_body = '<main><section class="page-hero"><div class="wrap"><div class="eyebrow">EAA Model</div><h1>Eigenaarschap. Autonomie. Agency.</h1><p class="lede">Het EAA-model richt zich op menselijk leren, motivatie en regie. Het staat naast EAI en kan ook zonder AI worden gebruikt.</p><p><a class="button" href="https://sunny-blancmange-dec4a1.netlify.app" target="_blank" rel="noopener">Open de EAA Model Tool</a></p></div></section></main>'
    write(out, "eaa-model/index.html", doc("EAA Model", eaa_body, "/eaa-model/", description="EAA — eigenaarschap, autonomie en agency in leren."))

    onderwijs = sources / "onderwijsin-embed1.html"
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
    urls = ["/", "/toepassingen/", "/onderwijs/", "/kennis/", "/twee-pijlers/", "/workshop-ai/", "/werkvormen/", "/taalwerkvormen/", "/verdieping/", "/onderbouwing/", "/bronnen/", "/praktijk/", "/publicaties/", "/publicaties/de-vraag-die-we-vergeten/", "/tools/", "/over/", "/eaa-model/", "/onderwijsin/"] + [f"/werkvormen/{item['slug']}/" for item in workforms] + [f"/publicaties/{slug}/" for slug, _, _, _ in PUBLICATIONS] + ["/tools/beyond-explainability/"]
    items = "".join(f"<url><loc>{BASE_URL}{path}</loc></url>" for path in urls)
    write(out, "sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>')

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=Path, default=Path("content/legacy"))
    parser.add_argument("--out", type=Path, default=Path("site-build"))
    args = parser.parse_args()
    build(args.sources, args.out)
    count = sum(1 for path in args.out.rglob("*") if path.is_file())
    print(f"Built {count} files at {args.out}")

if __name__ == "__main__":
    main()
