"""Render the homepage and model explanation during the existing release build.
Only /, /nl/, /en/, /nl/model/ and /en/model/ are replaced. Other content,
archive corrections, applications and standalone handoffs remain untouched.
"""
from __future__ import annotations
from html import escape
from pathlib import Path
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

VERSION = '20261021-home-model-v1'
BASE = 'https://eaimodel.nl'


def pick(en, nl, english):
    return english if en else nl


def link(url, label, cls='hm-link'):
    return f'<a class="{cls}" href="{escape(url, quote=True)}">{escape(label)} <span aria-hidden="true">→</span></a>'


def steps(en, detailed=False):
    names = pick(en, ['Proces', 'Fase', 'Kernhandeling', 'AI'], ['Process', 'Stage', 'Meaningful action', 'AI'])
    questions = pick(en, [
        'Wat moet de leerling leren?',
        'Waar staat de leerling nu?',
        'Waaraan moet de leerling zelf betekenis geven?',
        'Wat doet AI op die plek?'
    ], [
        'What should the student learn?',
        'Where is the student now?',
        'Which action must the student make sense of?',
        'What does AI do at this point?'
    ])
    anchors = ['proces', 'fase', 'kernhandeling', 'ai']
    items = []
    for i, (name, question, anchor) in enumerate(zip(names, questions, anchors), 1):
        inside = f'<span class="hm-step-number" aria-hidden="true">0{i}</span><strong>{name}</strong><span>{question}</span>'
        if detailed:
            inside = f'<a href="#{anchor}">{inside}</a>'
        items.append(f'<li>{inside}</li>')
    return '<ol class="hm-steps" aria-label="' + pick(en, 'Volgorde van het EAI-model', 'The EAI model in order') + '">' + ''.join(items) + '</ol>'


def illustration(en):
    """A readable HTML diagram; no image, external font or JS is required."""
    return f'''<aside class="hm-example-figure" aria-labelledby="hm-figure-title">
<span class="hm-eyebrow">{pick(en, 'Lesvoorbeeld', 'Teaching example')}</span>
<h2 id="hm-figure-title">{pick(en, 'Twee bronnen vergelijken', 'Comparing two sources')}</h2>
<div class="hm-source-pair"><div><span>A</span>{pick(en, 'Een historische bron', 'A historical source')}</div><div><span>B</span>{pick(en, 'Een ander perspectief', 'Another perspective')}</div></div>
<div class="hm-figure-line" aria-hidden="true"></div>
<p class="hm-ai-action">{pick(en, 'AI wijst verschillen aan en schrijft een vergelijking.', 'AI identifies differences and writes a comparison.')}</p>
<div class="hm-figure-line" aria-hidden="true"></div>
<div class="hm-result-sheet"><span>{pick(en, 'De uitwerking is klaar.', 'The comparison is ready.')}</span><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></div>
<p class="hm-figure-question">{pick(en, 'Welke afweging heeft de leerling zelf gemaakt?', 'Which judgements did the student make?')}</p>
</aside>'''


def example(en):
    scenarios = pick(en, [
        'De leerling krijgt uitleg over bronvergelijking. Een uitgewerkt voorbeeld kan helpen om te zien hoe je het perspectief van een auteur meeweegt. De leerling hoeft niet eerst zelf een vergelijking te schrijven om betekenis te kunnen geven aan de uitleg.',
        'De leerling oefent juist met het herkennen en wegen van verschillen. Een volledige AI-vergelijking kan die afweging al invullen. Bepaal welke hulp nog ruimte laat om zelf de bronnen te onderzoeken.',
        'De docent bereidt een les voor en wil twee bronnen naast elkaar leggen. AI kan een eerste vergelijking maken. De docent controleert de bronnen, kiest wat in de les past en bepaalt wat leerlingen zelf gaan onderzoeken.'
    ], [
        'The student is learning how source comparison works. A worked example may help them see how an author’s perspective affects the account. They do not need to write their own comparison first to make sense of the explanation.',
        'The student is practising how to identify and weigh differences. A complete AI comparison may already make those judgements for them. Decide which support still leaves room for the student to examine the sources.',
        'The teacher is preparing a lesson and wants to compare two sources. AI can draft a comparison. The teacher checks the sources, chooses what fits the lesson and decides what the students will investigate themselves.'
    ])
    labels = pick(en, ['Instructie', 'Zelf oefenen', 'Les voorbereiden'], ['Instruction', 'Independent practice', 'Lesson preparation'])
    buttons = ''.join(f'<button class="hm-choice" type="button" data-eai-demo="{i}" aria-pressed="{str(i == 0).lower()}">{label}</button>' for i, label in enumerate(labels))
    nojs = ''.join(f'<details><summary>{label}</summary><p>{text}</p></details>' for label, text in zip(labels, scenarios))
    return f'''<section class="hm-section hm-example" id="voorbeeld"><div class="hm-wrap hm-split">
<div><span class="hm-eyebrow">{pick(en, 'Dezelfde uitwerking, een andere afweging', 'Same output, different judgement')}</span>
<h2>{pick(en, 'Wat verandert er met het doel?', 'What changes with the goal?')}</h2>
<p>{pick(en, 'Stel dat AI de twee bronnen al heeft vergeleken. Of die hulp past, hangt af van wat de leerling of docent op dat moment probeert te bereiken.', 'Suppose AI has already compared the two sources. Whether that help fits depends on what the student or teacher is trying to achieve at that point.')}</p>
<div class="hm-choices" role="group" aria-label="{pick(en, 'Kies de situatie', 'Choose the situation')}">{buttons}</div>
<noscript><div class="hm-nojs-examples">{nojs}</div></noscript></div>
<div class="hm-example-answer"><span class="hm-eyebrow">{pick(en, 'De afweging in deze situatie', 'The judgement in this situation')}</span><p id="eai-demo-output" data-scenarios="{escape('|'.join(scenarios), quote=True)}" aria-live="polite" aria-atomic="true">{scenarios[0]}</p>
{link('/en/model/#kernhandeling' if en else '/nl/model/#kernhandeling', pick(en, 'Wat is hier de kernhandeling?', 'What is the meaningful action here?'))}</div>
</div></section>'''


def home(en):
    model = '/en/model/' if en else '/nl/model/'
    routes = pick(en, [
        ('Een les ontwerpen', 'Werkvormen voor instructie, hulp en zelfstandig oefenen.', '/nl/onderwijs/'),
        ('Onderzoek en bronnen', 'Lees de redenering en controleer de onderbouwing.', '/nl/onderzoek/'),
        ('Een tool gebruiken', 'Werk je keuzes uit in een les, prompt of analyse.', '/nl/tools/')
    ], [
        ('Design a lesson', 'Teaching approaches for instruction, support and independent practice.', '/en/education/'),
        ('Research and sources', 'Read the reasoning and examine the evidence.', '/en/research/'),
        ('Use a tool', 'Turn your decisions into a lesson, prompt or analysis.', '/en/tools/')
    ])
    route_html = ''.join(f'<a class="hm-route" href="{url}"><h3>{title}</h3><p>{desc}</p><span aria-hidden="true">↗</span></a>' for title, desc, url in routes)
    articles = pick(en, [
        ('De vraag die we vergeten in het AI-debat', 'Waarom een afspraak als ‘AI mag ondersteunen’ nog geen keuze voor de les oplevert.', '/publicaties/de-vraag-die-we-vergeten/'),
        ('The Act of Learning', 'De eerdere essays over wat een uitwerking wel en niet over leren laat zien.', '/publicaties/the-act-of-learning/'),
        ('Onderbouwing en bronnen', 'De theoretische achtergrond, de gebruikte bronnen en hun beperkingen.', '/onderbouwing/')
    ], [
        ('The question we forget in the AI debate', 'Why saying “AI may support learning” does not yet tell a teacher what to do. Dutch essay.', '/publicaties/de-vraag-die-we-vergeten/'),
        ('The Act of Learning', 'Earlier essays on what an output can and cannot tell us about learning.', '/publicaties/the-act-of-learning/'),
        ('Research and evidence', 'The reasoning, sources and limits behind the model.', '/en/research/')
    ])
    article_html = ''.join(f'<a href="{url}"><span><strong>{title}</strong><small>{desc}</small></span><span aria-hidden="true">↗</span></a>' for title, desc, url in articles)
    return f'''<main id="main-content">
<section class="hm-hero"><div class="hm-wrap hm-hero-grid"><div class="hm-hero-copy">
<span class="hm-eyebrow">{pick(en, 'Het EAI-model', 'The EAI model')}</span>
<h1>{pick(en, 'Wat neemt AI eigenlijk over?', 'What is AI taking over?')}</h1>
<p class="hm-lead">{pick(en, 'EAI helpt je keuzes maken over AI in leren en werk. Je begint bij wat iemand moet leren of beoordelen. Daarna kijk je welke handelingen AI ondersteunt, voordoet of overneemt.', 'EAI helps you decide how to use AI in learning and work. Start with what someone needs to learn or judge. Then examine which actions AI supports, demonstrates or takes over.')}</p>
<p>{pick(en, 'Een goede uitwerking laat niet vanzelf zien wat iemand begrijpt. Dat vraagt om een blik op het proces.', 'A good output does not, by itself, show what someone understands. That requires examining the process.')}</p>
<div class="hm-actions">{link(model, pick(en, 'Zo werkt het model', 'How the model works'), 'hm-button')}{link('#voorbeeld', pick(en, 'Bekijk het lesvoorbeeld', 'Try the teaching example'))}</div>
</div>{illustration(en)}</div></section>
<section class="hm-section hm-model-intro" id="model"><div class="hm-wrap">
<div class="hm-section-intro"><span class="hm-eyebrow">{pick(en, 'Vier vragen, in deze volgorde', 'Four questions, in this order')}</span><h2>{pick(en, 'Begin bij het leren.', 'Start with the learning.')}</h2>
<p>{pick(en, 'Leg eerst het leerproces op tafel. Bepaal per fase aan welke handeling de leerling zelf inhoudelijke betekenis moet geven. Bekijk daarna wat AI op die plek doet.', 'Set out the learning process first. At each stage, identify the action the student needs to make sense of. Then examine what AI does at that point.')}</p></div>
{steps(en)}{link(model, pick(en, 'De vier vragen uitgewerkt', 'Explore the four questions'))}
</div></section>
{example(en)}
<section class="hm-section hm-origin" id="verhaal"><div class="hm-wrap hm-split"><div><span class="hm-eyebrow">{pick(en, 'Achtergrond', 'Background')}</span><h2>{pick(en, 'Hoe EAI ontstond', 'How EAI developed')}</h2>
<p>{pick(en, 'AI kan veel tijd besparen. Maar tijd winnen en iets leren zijn niet hetzelfde. Een docent die snel een bronvergelijking nodig heeft, maakt een andere afweging dan een leerling die nog leert bronnen te wegen.', 'AI can save time. Saving time and learning are not the same thing. A teacher who needs a source comparison makes a different judgement from a student who is still learning how to weigh sources.')}</p>
<p>{pick(en, 'Vanuit die vraag verschoof de aandacht naar wat er tijdens het leren gebeurt. Daarvoor heb je kennis van leren én van AI nodig. EAI brengt die twee samen in de volgorde Proces → Fase → Kernhandeling → AI.', 'That question shifts attention to what happens during learning. Understanding it requires knowledge of learning and of AI. EAI brings them together in the sequence Process → Stage → Meaningful action → AI.')}</p>
{link(model + '#achtergrond', pick(en, 'Lees de redenering achter het model', 'Read the reasoning behind the model'))}</div>
<div class="hm-reading" id="verder-lezen"><span class="hm-eyebrow">{pick(en, 'Verder lezen', 'Further reading')}</span>{article_html}</div></div></section>
<section class="hm-section hm-next" id="beginnen"><div class="hm-wrap"><div class="hm-section-intro"><h2>{pick(en, 'Verder met je eigen vraag', 'Continue with your own question')}</h2></div><div class="hm-routes">{route_html}</div></div></section>
</main>'''


def model(en):
    if en:
        content = '''
<section class="hm-model-step" id="proces"><div class="hm-step-label"><span>01</span><h2>Process</h2></div><div>
<h3>What should the student know or be able to do, and how will they get there?</h3>
<p>Look at the whole learning process. Where is prior knowledge needed? Where do you explain or demonstrate something? When does the student practise, and how does their independence grow?</p>
<div class="hm-in-practice"><span>In the source-comparison example</span><p>The student is learning to compare two historical sources and justify how useful they are for a historical question. Producing a neat text is not the whole goal.</p></div></div></section>
<section class="hm-model-step" id="fase"><div class="hm-step-label"><span>02</span><h2>Stage</h2></div><div>
<h3>Where is the student in that learning process?</h3><p>Following an explanation involves different work from independently weighing two sources. The same AI-generated comparison may serve a different purpose at each stage.</p>
<div class="hm-phase-line" aria-label="One possible lesson sequence"><span>Instruction</span><span>Guided practice</span><span>Independent comparison</span></div>
<div class="hm-in-practice"><span>In the source-comparison example</span><p>First, you demonstrate how an author’s perspective affects an account. Later, the student needs to recognise and weigh that perspective themselves.</p></div></div></section>
<section class="hm-model-step" id="kernhandeling"><div class="hm-step-label"><span>03</span><h2>Meaningful action</h2></div><div>
<h3>Which action must the student make sense of at this stage for learning to occur?</h3><p>This is the <em>kernhandeling</em>, or meaningful action, of the stage. It is not automatically the hardest, longest or most visible part of the task.</p>
<div class="hm-in-practice"><span>In the source-comparison example</span><p>The student needs to recognise a difference in perspective and explain what it means for the usefulness of each source. Rewording an AI-generated comparison does not establish that they made that judgement.</p></div>
<details class="hm-detail"><summary>Making a visible change is not the same as making sense of something.</summary><p>A student can revise an AI answer without understanding why the revision matters. Conversely, a student may recognise a connection while following an explanation without producing anything new. Visible activity alone does not settle the question.</p></details></div></section>
<section class="hm-model-step" id="ai"><div class="hm-step-label"><span>04</span><h2>AI</h2></div><div>
<h3>What does AI do at this point?</h3><p>Be specific. Does it select sources, point out a difference, propose an approach, make a judgement or write the entire comparison? “Support” is too broad until you know which action is being affected.</p>
<div class="hm-in-practice"><span>In the source-comparison example</span><p>A worked comparison may help during instruction. During independent practice, the same comparison may fill in the judgement the student is meant to develop. Choose support that fits the stage, then check what the student can do.</p></div>
<details class="hm-detail"><summary>Even a question can give away a step.</summary><p>An AI tutor that says “These sources contradict each other” has already identified a problem. That may be useful. But when noticing the contradiction is part of what the student must learn, leave room for that observation to arise.</p></details></div></section>'''
        proof = [
            ('With help', 'Can the student complete the task with the available support?'),
            ('Independently', 'Can the student perform the meaningful action without the same help?'),
            ('Later', 'Can the student still do it after some time has passed?'),
            ('In a different situation', 'Can the student use it with other sources or a changed question?')
        ]
    else:
        content = '''
<section class="hm-model-step" id="proces"><div class="hm-step-label"><span>01</span><h2>Proces</h2></div><div>
<h3>Wat moet de leerling uiteindelijk kennen of kunnen, en hoe komt hij daar?</h3>
<p>Bekijk het leerproces als geheel. Waar is voorkennis nodig? Waar leg je iets uit of doe je iets voor? Wanneer oefent de leerling en hoe neemt zijn zelfstandigheid toe?</p>
<div class="hm-in-practice"><span>Bij het vergelijken van bronnen</span><p>De leerling leert twee historische bronnen vergelijken en een oordeel over hun bruikbaarheid voor een historische vraag onderbouwen. Een verzorgde tekst opleveren is niet het hele doel.</p></div></div></section>
<section class="hm-model-step" id="fase"><div class="hm-step-label"><span>02</span><h2>Fase</h2></div><div>
<h3>Waar bevindt de leerling zich nu in dat leren?</h3><p>Een uitleg volgen vraagt ander werk dan zelfstandig twee bronnen wegen. Dezelfde AI-vergelijking kan in die fases een andere betekenis hebben.</p>
<div class="hm-phase-line" aria-label="Een mogelijk lesverloop"><span>Instructie</span><span>Begeleid oefenen</span><span>Zelfstandig vergelijken</span></div>
<div class="hm-in-practice"><span>Bij het vergelijken van bronnen</span><p>Eerst doe je voor hoe het perspectief van een auteur doorwerkt in een verslag. Later moet de leerling dat perspectief zelf herkennen en meewegen.</p></div></div></section>
<section class="hm-model-step" id="kernhandeling"><div class="hm-step-label"><span>03</span><h2>Kernhandeling</h2></div><div>
<h3>Aan welke stap moet de leerling in deze fase zelf inhoudelijke betekenis geven om tot leren te komen?</h3><p>Dat is de kernhandeling van die fase. Het is niet automatisch de moeilijkste, langste of meest zichtbare stap van een opdracht.</p>
<div class="hm-in-practice"><span>Bij het vergelijken van bronnen</span><p>De leerling moet een verschil in perspectief herkennen en uitleggen wat dat betekent voor de bruikbaarheid van beide bronnen. Een AI-vergelijking in andere woorden zetten laat nog niet zien of hij die afweging heeft gemaakt.</p></div>
<details class="hm-detail"><summary>Iets toevoegen is niet hetzelfde als betekenis geven.</summary><p>Een leerling kan een AI-antwoord aanpassen zonder te begrijpen waarom de aanpassing nodig is. Andersom kan hij tijdens een uitleg een verband herkennen zonder zelf iets te produceren. Alleen naar zichtbare activiteit kijken geeft geen uitsluitsel.</p></details></div></section>
<section class="hm-model-step" id="ai"><div class="hm-step-label"><span>04</span><h2>AI</h2></div><div>
<h3>Wat doet AI precies op die plek?</h3><p>Maak het concreet. Selecteert AI bronnen, wijst het een verschil aan, stelt het een aanpak voor, geeft het een oordeel of schrijft het de hele vergelijking? ‘Ondersteunen’ zegt nog te weinig zolang je niet weet om welke handeling het gaat.</p>
<div class="hm-in-practice"><span>Bij het vergelijken van bronnen</span><p>Een uitgewerkte vergelijking kan helpen tijdens instructie. Tijdens zelfstandig oefenen kan dezelfde vergelijking de afweging al invullen die de leerling moet leren maken. Kies hulp die past bij de fase en kijk daarna wat de leerling zelf kan.</p></div>
<details class="hm-detail"><summary>Ook een vraag kan al iets overnemen.</summary><p>Een AI-tutor die zegt ‘Deze bronnen spreken elkaar tegen’ heeft het probleem al aangewezen. Dat kan helpen. Maar moet de leerling juist leren die tegenspraak zelf op te merken, laat daar eerst ruimte voor.</p></details></div></section>'''
        proof = [
            ('Met hulp', 'Lukt de taak met de beschikbare ondersteuning?'),
            ('Zelfstandig', 'Kan de leerling de kernhandeling zonder dezelfde hulp uitvoeren?'),
            ('Later', 'Kan hij dat na verloop van tijd nog steeds?'),
            ('In een andere situatie', 'Lukt het ook met andere bronnen of een gewijzigde vraag?')
        ]
    proof_html = ''.join(f'<div><h3>{title}</h3><p>{text}</p></div>' for title, text in proof)
    home_url = '/en/' if en else '/nl/'
    return f'''<main id="main-content">
<section class="hm-model-hero"><div class="hm-wrap"><a class="hm-back" href="{home_url}">← {pick(en, 'EAI', 'EAI')}</a><span class="hm-eyebrow">{pick(en, 'Het model uitgewerkt', 'The model explained')}</span>
<h1>{pick(en, 'Eerst het leerproces. Dan de rol van AI.', 'The learning process first. Then AI’s role.')}</h1>
<p class="hm-lead">{pick(en, 'Dezelfde AI-hulp kan tijdens instructie iets verduidelijken en tijdens zelfstandig oefenen een afweging overnemen. EAI helpt je dat verschil per fase te onderzoeken.', 'The same AI support may clarify something during instruction and take over a judgement during independent practice. EAI helps you examine that difference at each stage.')}</p>
{steps(en, detailed=True)}</div></section>
<section class="hm-section hm-model-body"><div class="hm-wrap">{content}</div></section>
<section class="hm-section hm-proof" id="nagaan"><div class="hm-wrap"><div class="hm-section-intro"><span class="hm-eyebrow">{pick(en, 'Na de hulp', 'After support')}</span><h2>{pick(en, 'Wat kan de leerling daarna zelf?', 'What can the student do afterwards?')}</h2>
<p>{pick(en, 'Een beter product met AI geeft nog geen antwoord op alle vragen hieronder. Kijk afzonderlijk naar wat met hulp lukt, wat zelfstandig lukt en wat later of in een andere situatie beschikbaar blijft.', 'A better product made with AI does not answer all the questions below. Examine supported performance, independent performance, retention and use in a different situation separately.')}</p></div><div class="hm-proof-grid">{proof_html}</div></div></section>
<section class="hm-section" id="achtergrond"><div class="hm-wrap"><div class="hm-section-intro"><span class="hm-eyebrow">{pick(en, 'Twee soorten kennis', 'Two kinds of knowledge')}</span><h2>{pick(en, 'Je moet het leren én de techniek begrijpen.', 'Understand both the learning and the technology.')}</h2></div>
<div class="hm-two-ways"><div><h3>{pick(en, 'Met AI-ogen naar onderwijs kijken', 'Look at education with an understanding of AI')}</h3><p>{pick(en, 'Welk werk kan AI inmiddels uitvoeren? Ook het formuleren van een vraag, het selecteren van informatie en het voorstellen van een volgende stap kunnen verschuiven.', 'Which actions can AI perform? Formulating a question, selecting information and proposing the next step can all shift towards the system.')}</p></div><div><h3>{pick(en, 'Met didactische ogen naar AI kijken', 'Look at AI with an understanding of learning')}</h3><p>{pick(en, 'Wat betekent die verschuiving in deze fase? Wat moet de leerling zelf leren herkennen, afwegen of begrijpen, en welke hulp past daarbij?', 'What does that shift mean at this stage? What should the student learn to recognise, weigh or understand, and what support fits?')}</p></div></div>
<p class="hm-limits">{pick(en, 'EAI ordent die afweging. Het model is geen bewijs dat een bepaalde AI-toepassing tot leren leidt. Bij professioneel werk kan een bruikbare uitkomst het doel zijn, zonder dat iemand die handeling hoeft te leren. Beoordeel de taakverdeling steeds vanuit het werkelijke doel.', 'EAI organises that judgement. The model does not prove that a particular AI application produces learning. In professional work, a useful outcome may be the goal without anyone needing to learn the action. Assess task ownership against the actual goal.')}</p>
<div class="hm-source-links">{link('/twee-pijlers/', pick(en, 'De twee pijlers', 'The two pillars (Dutch)'))}{link('/publicaties/de-vraag-die-we-vergeten/', pick(en, 'Het essay achter deze uitleg', 'The essay behind this explanation (Dutch)'))}{link('/en/research/' if en else '/onderbouwing/', pick(en, 'Onderbouwing en bronnen', 'Research and evidence'))}</div>
</div></section>
<section class="hm-section hm-next" id="beginnen"><div class="hm-wrap hm-finish"><div><h2>{pick(en, 'Probeer het in één les.', 'Try it in one lesson.')}</h2><p>{pick(en, 'Kies een concrete opdracht. Bespreek per fase wat de leerling moet leren en welke rol AI krijgt. Leg ook vast hoe je nagaat wat daarna zelfstandig lukt.', 'Choose a specific task. At each stage, discuss what the student should learn and what AI will do. Decide how you will check independent performance afterwards.')}</p></div><div class="hm-actions">{link('/en/education/' if en else '/werkvormen/', pick(en, 'Kies een werkvorm', 'Explore teaching approaches'), 'hm-button')}{link('/tools/van-proces-naar-prompt/', pick(en, 'Van proces naar prompt', 'From process to prompt (Dutch)'))}</div></div></section>
</main>'''


def install(root: Path):
    """Run before preparing shared navigation and content-addressed assets."""
    templates = {en: (root / ('en' if en else 'nl') / 'index.html').read_text(encoding='utf-8') for en in (False, True)}
    routes = [('index.html', False, False), ('nl/index.html', False, False), ('en/index.html', True, False), ('nl/model/index.html', False, True), ('en/model/index.html', True, True)]
    for relative, en, is_model in routes:
        soup = BeautifulSoup(templates[en], 'html.parser')
        if not soup.main or not soup.body or not soup.head:
            raise ValueError(f'Missing page shell: {relative}')
        soup.main.replace_with(BeautifulSoup(model(en) if is_model else home(en), 'html.parser').main)
        soup.body['class'] = ['eai-refresh', 'eai-home-model', 'eai-model-page' if is_model else 'eai-start-page']
        soup.body['data-home-model'] = VERSION
        for attr in ('data-editorial-layout', 'data-ui-version'):
            soup.body.attrs.pop(attr, None)
        title = pick(en, 'Het EAI-model: proces, fase, kernhandeling en AI', 'The EAI model: process, stage, meaningful action and AI') if is_model else pick(en, 'EAI | Wat neemt AI eigenlijk over?', 'EAI | What is AI taking over?')
        soup.title.string = title
        desc = pick(en, 'Bepaal per fase wat de leerling moet leren en wat AI op die plek doet. Met een concreet voorbeeld en de vier vragen van EAI.', 'Identify what the student should learn at each stage and what AI does there. A concrete example and the four EAI questions.')
        meta = soup.find('meta', attrs={'name': 'description'})
        if meta:
            meta['content'] = desc
        for tag in list(soup.find_all('link', rel=lambda v: v and ('canonical' in v or 'alternate' in v))):
            tag.decompose()
        path = '/' if relative == 'index.html' else '/' + relative.removesuffix('index.html')
        soup.head.append(soup.new_tag('link', rel='canonical', href=BASE + path))
        for lang in ('nl', 'en'):
            target = '/' + lang + ('/model/' if is_model else '/')
            soup.head.append(soup.new_tag('link', rel='alternate', hreflang=lang, href=BASE + target))
        soup.head.append(soup.new_tag('link', rel='alternate', hreflang='x-default', href=BASE + ('/nl/model/' if is_model else '/')))
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(str(soup), encoding='utf-8')
    sitemap = root / 'sitemap.xml'
    if sitemap.exists():
        ns = 'http://www.sitemaps.org/schemas/sitemap/0.9'
        ET.register_namespace('', ns)
        tree = ET.parse(sitemap)
        known = {loc.text for loc in tree.getroot().iter('{' + ns + '}loc')}
        for path in ('/nl/model/', '/en/model/'):
            if BASE + path not in known:
                node = ET.SubElement(tree.getroot(), '{' + ns + '}url')
                ET.SubElement(node, '{' + ns + '}loc').text = BASE + path
        tree.write(sitemap, encoding='utf-8', xml_declaration=True)
    return [route[0] for route in routes]
