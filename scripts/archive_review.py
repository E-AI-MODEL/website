"""Dated corrections to rendered archive pages; original source snapshots stay intact."""
from __future__ import annotations
from bs4 import BeautifulSoup

REVIEW = '2026-10-21'
RETRACTION = 'https://www.nature.com/articles/s41599-026-07310-z'
OLD_PODCAST = 'https://researched.eu/2026/04/09/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel/'
NEW_PODCAST = 'https://researched.eu/nieuws/de-researched-nederland-podcast-aflevering-71-ai-in-ons-onderwijs-en-uitwerking-van-het-inspectie-oordeel'
NOTES = {
 '/publicaties/wang-fan-2025/': ('nl', 'Bron ingetrokken',
  '<p>Het tijdschrift heeft de studie van Jin Wang en Wenxiang Fan op 22 april 2026 ingetrokken wegens problemen in de meta-analyse. De conclusies van deze eerdere EAI-rapportage kunnen niet meer als onderzoeksbewijs worden gebruikt.</p>'
  '<p>Ook de TD-schattingen hieronder zijn geen gevalideerde metingen. De uitspraak dat een score boven 0,7 een significant verhoogd risico aantoont, is niet onderbouwd en wordt hier teruggenomen.</p>'
  f'<p><a href="{RETRACTION}">Lees de intrekkingsverklaring bij het tijdschrift</a></p>', True),
 '/publicaties/task-density/': ('en', 'Historical proposal, not a validated learning measure',
  '<p>The scores, charts and 0.7 threshold in this 2025 draft are illustrative proposals, not validated measures or cut-offs for student learning. They must not be used to rank learners or establish that learning has occurred or been lost.</p>'
  '<p>Interpret AI task ownership against the learning goal and phase. Independent performance, retention and transfer require separate evidence. The Sweller (2023) reference titled <em>Cognitive load theory and generative artificial intelligence</em> could not be verified in this review and should not be used as supporting evidence.</p>', True),
 '/publicaties/the-act-of-learning/': ('en', 'Clarification of the learning claims',
  '<p>This earlier essay makes some claims too categorical. A learner who cannot explain an AI-assisted answer has not thereby been shown to have learned nothing. Meaningful learning can also occur while following instruction, without producing an original answer first.</p>'
  '<p>The proposed three-prompt limit is an example of a design choice, not a validated threshold. Whether to give, retain or withdraw support depends on the goal, phase and evidence of what the learner can do.</p>', False),
 '/publicaties/the-act-of-learning-act-2/': ('en', 'Scope of this earlier commentary',
  '<p>The comparison with AI reasoning research is an analogy, not evidence about student learning. Difficulty after removing support does not prove that no learning took place.</p>'
  '<p>The legal statement is also outdated. Following the 2026 amendment, Article 4 requires providers and deployers to support the development of AI literacy, taking account of roles and context; it does not require a particular individual level. <a href="https://digital-strategy.ec.europa.eu/en/policies/ai-talent-skills-and-literacy">Read the European Commission explanation</a>.</p>', False),
 '/publicaties/beyond-explainability/': ('en', 'Interpretive essay, not a validated assessment',
  '<p>This essay introduces ways to examine AI-supported work. It does not validate a test for cognitive ownership. Being unable to reconstruct an answer can justify further investigation; it does not by itself prove that AI displaced all learning.</p>'
  '<p>The historical use of <em>didactic controllability</em> in this essay should not be treated as an interchangeable definition of effective human oversight in later versions of EAI.</p>', False),
 '/publicaties/ai-balans/': ('nl', 'Aanvulling bij dit eerdere artikel',
  '<p>De algemene verboden en vaste volgorde in dit artikel zijn te stellig. AI mag bijvoorbeeld een aanpak voordoen tijdens instructie. Bij zelfstandig oefenen kan diezelfde hulp juist overnemen wat de leerling moet leren.</p>'
  '<p>Of een hint, eerste versie of volledige uitwerking past, hangt af van leerdoel, fase en kernhandeling. Een zichtbare bewerking of reflectie is op zichzelf geen bewijs van beheersing.</p>', False),
 '/publicaties/eai-stappenplan/': ('nl', 'Eerder prototype',
  '<p>Deze bouwer laat je een taakverdeling schetsen. De percentages zijn eigen inschattingen, geen metingen van leren of gevalideerde TD-scores. De bediening is hersteld; het oudere model is niet opnieuw gevalideerd.</p>'
  '<p>Voor een ontwerp vanuit proces, fase, kernhandeling en AI gebruik je <a href="/tools/van-proces-naar-prompt/">Van proces naar prompt</a>.</p>', False),
}

def fragment(markup: str):
    return BeautifulSoup(markup, 'html.parser')

def fix_workflow(soup):
    """Restore chosen settings when returning to a step; animations remain optional."""
    for text in list(soup.find_all(string=True)):
        if text.parent.name in ('script', 'style'):
            continue
        old = str(text)
        new = old.replace('EAI (Explainable AI)', 'EAI')
        new = new.replace('de meest cruciale stap waar het leerdoel aan gekoppeld is.',
                          'de stap waaraan de leerling in deze fase zelf inhoudelijke betekenis moet geven om te leren.')
        if new != old: text.replace_with(new)
    for script in soup.find_all('script', src=False):
        code = script.string or ''
        if 'generateConfigurationInterface' not in code or script.get('data-archive-fix') == REVIEW:
            continue
        code = code.replace('gsap.from(', 'window.gsap?.from(').replace('gsap.to(', 'window.gsap?.to(')
        code = code.replace('data-task-id="${task.id}"> Is dit', 'data-task-id="${task.id}" ${task.isCore ? "checked" : ""}> Is dit')
        code = code.replace('data-task-id="${task.id}" checked>', 'data-task-id="${task.id}" ${task.role === "mens" ? "checked" : ""}>')
        for role in ('ai', 'samen'):
            code = code.replace(f'value="{role}" data-task-id="${{task.id}}">',
                                f'value="{role}" data-task-id="${{task.id}}" ${{task.role === "{role}" ? "checked" : ""}}>')
        code = code.replace('value="0" data-task-id="${task.id}" disabled>',
                            'value="${task.density || 0}" data-task-id="${task.id}" ${task.role === "mens" ? "disabled" : ""}>')
        code = code.replace('<span class="slider-value">0%</span>', '<span class="slider-value">${task.density || 0}%</span>')
        code = code.replace('Taakdichtheid AI (0% = geen, 100% = vol)', 'Eigen inschatting AI-aandeel (geen leermeting)')
        code = code.replace('AI Taakdichtheid:', 'Geschat AI-aandeel (geen leermeting):')
        code = code.replace('Let op! AI neemt hier het denkwerk over.', 'Dit is jouw inschatting, geen vastgestelde mate van leren.')
        code = code.replace('if (target.value > 80)', 'if (false)')
        code = code.replace('if (currentStep < totalSteps) {', "if (currentStep === 2 && workflow.length === 0) { alert('Kies eerst minimaal een taak.'); return; }\n            if (currentStep < totalSteps) {")
        code = code.replace("document.getElementById('export-png-btn').addEventListener('click', () => {",
                            "document.getElementById('export-png-btn').addEventListener('click', () => {\n            if (typeof html2canvas !== 'function') { alert('Exportbibliotheek niet geladen. Gebruik Afdrukken in je browser of probeer later opnieuw.'); return; }")
        code = code.replace("document.getElementById('export-pdf-btn').addEventListener('click', () => {",
                            "document.getElementById('export-pdf-btn').addEventListener('click', () => {\n            if (typeof html2canvas !== 'function' || !window.jspdf?.jsPDF) { alert('Exportbibliotheek niet geladen. Gebruik Afdrukken in je browser of probeer later opnieuw.'); return; }")
        script.string = code
        script['data-archive-fix'] = REVIEW

def review(soup: BeautifulSoup, path: str) -> bool:
    """Return whether this normal site page can use the shared site navigation."""
    if not soup.body or soup.find('meta', attrs={'http-equiv':'refresh'}):
        return False
    if path.startswith(('/houseoftalents/', '/handoff/', '/onderwijsin/3d/', '/onderwijsin/houseoftalents/')):
        return False
    for a in soup.find_all('a', href=True):
        if a['href'].rstrip('/') == OLD_PODCAST.rstrip('/'):
            a['href'] = NEW_PODCAST
        if a['href'].split('#')[0].rstrip('/').endswith('/publicaties/wang-fan-2025') and path != '/publicaties/wang-fan-2025/':
            heading = a.find(['h2','h3','strong'])
            if heading:
                heading.string = 'Wang & Fan (2025): bron ingetrokken'
                paragraph = a.find('p')
                if paragraph: paragraph.string = 'De onderliggende studie is ingetrokken. Lees de correctie bij deze historische rapportage.'
    if path == '/publicaties/ai-balans/':
        for a in soup.find_all('a', href='#eaa-mini'):
            a['href'] = '/eaa-model/'
            a.string = 'Over het EAA-model'
    site_header = soup.select_one('header.eai-masthead, header.site-header, header.eai-site-nav')
    if not site_header or not soup.find('h1'):
        return False
    if path.startswith('/publicaties/') and path in NOTES:
        classes = soup.body.get('class', [])
        soup.body['class'] = list(dict.fromkeys(classes + ['eai-archive-page']))
        if path in ('/publicaties/the-act-of-learning/', '/publicaties/the-act-of-learning-act-2/'):
            soup.html['lang'] = 'en'
        if path == '/publicaties/the-act-of-learning-act-2/' and soup.title:
            soup.title.string = 'The Act of Learning, Part 2: Presence or Performance? | EAI'
        if not soup.main:
            main = soup.new_tag('main', id='main-content')
            site_header.insert_after(main)
            for node in list(soup.body.children):
                if node is main or node is site_header or getattr(node,'name',None) in ('script','footer'):
                    continue
                main.append(node.extract())
        main = soup.main
        if not main.find('h1'):
            heading = soup.find('h1')
            if heading: main.insert(0, heading.extract())
        if not soup.find(id='archive-review-note'):
            lang, title, copy, fold = NOTES[path]
            stamp = 'Editorial correction: 21 October 2026' if lang == 'en' else 'Redactionele correctie: 21 oktober 2026'
            note = fragment(f'<aside class="archive-review-note" id="archive-review-note" aria-labelledby="archive-note-title" lang="{lang}"><span>{stamp}</span><h2 id="archive-note-title">{title}</h2>{copy}</aside>').aside
            heading = main.find('h1')
            if fold:
                heading = heading.extract() if heading else None
                details = soup.new_tag('details', attrs={'class':'archive-original'})
                summary = soup.new_tag('summary')
                summary.string = 'Read the original 2025 text' if lang == 'en' else 'Lees de oorspronkelijke tekst uit 2025'
                details.append(summary)
                for node in list(main.contents): details.append(node.extract())
                if heading: main.append(heading)
                main.append(note); main.append(details)
            else:
                if heading and heading.parent is main: heading.insert_after(note)
                else: main.insert(0,note)
        if path == '/publicaties/eai-stappenplan/': fix_workflow(soup)
    if 'eai-archive-page' in soup.body.get('class', []):
        for svg in list(soup.select('main svg')):
            if svg.parent.get('class') == ['archive-wide']: continue
            wrap = soup.new_tag('div', attrs={'class':'archive-wide','tabindex':'0','role':'region','aria-label':'Diagram: scroll horizontally if needed'})
            svg.wrap(wrap)
    for table in list(soup.select('main table')):
        if 'archive-table-scroll' in table.parent.get('class',[]): continue
        wrap = soup.new_tag('div', attrs={'class':'archive-table-scroll','tabindex':'0','role':'region','aria-label':'Tabel: horizontaal scrollen indien nodig'})
        table.wrap(wrap)
    return True
