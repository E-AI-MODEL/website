"""Editorial layout for the public website. Standalone handoffs are excluded.
Prose and layout are changed only on the explicitly named entry pages.
The original longer reading sections remain available in a disclosure.
"""
from bs4 import BeautifulSoup


def fragment(markup):
    return BeautifulSoup(markup, 'html.parser')


def text(soup, selector, value):
    node = soup.select_one(selector)
    if node:
        node.clear()
        node.append(value)


def bridge(soup, section, message, label):
    if not section:
        return
    node = fragment('<div class="eai-editorial-bridge"><span></span><p></p></div>').div
    node.span.string = label
    node.p.string = message
    wrap = section.select_one('.wrap')
    if wrap:
        wrap.insert(0, node)


def apply_editorial(soup, path, en):
    body = soup.body
    if not body or not soup.main:
        return
    # Prepared HTML can be input again. Never duplicate bridges or disclosures.
    if body.get('data-editorial-layout') == '20261021a':
        return
    if path == '/onderwijsin/':
        prepare_onderwijsin(soup)
        body['data-editorial-layout'] = '20261021a'
        return
    if path not in ('/nl/', '/en/', '/nl/onderwijs/', '/nl/toepassingen/', '/nl/onderzoek/', '/nl/tools/'):
        return
    body['data-editorial-layout'] = '20261021a'
    if path in ('/nl/', '/en/'):
        body['class'] = list(dict.fromkeys(body.get('class', []) + ['eai-editorial-home']))
        if not en:
            text(soup, '.eai-intro .eai-overline', 'Leren, werken en AI')
            text(soup, '.eai-intro .eai-lead', 'Een goed antwoord laat nog niet zien wat iemand heeft geleerd. Wie stelde de vraag, vergeleek de bronnen en woog de argumenten? Ook dat werk kan AI overnemen.')
            text(soup, '.eai-intro-copy > p:not(.eai-lead)', 'EAI begint bij wat je wilt bereiken en wat iemand daarvoor zelf moet leren of beoordelen. Pas daarna kies je de rol van AI.')
            text(soup, '.eai-intro-aside .eai-date', 'Begin bij deze vraag')
            text(soup, '.eai-intro-aside h2', 'Welke stap wil je dat de leerling zelf leert zetten?')
            ps = soup.select('.eai-intro-aside p')
            if ps:
                ps[0].string = 'Een leerling kan een AI-antwoord aanpassen zonder te begrijpen waarom. Wat kan hij daarna zonder dezelfde hulp?'
            if len(ps) > 1:
                ps[1].string = 'Bij EAI onderzoek je die vraag per fase van het leren. Ook uitleg volgen kan daarbij betekenisvol zijn; zelf iets toevoegen is geen bewijs van leren.'
            actions = soup.select('.eai-intro .eai-actions a')
            if len(actions) == 2:
                actions[0]['href'] = '#voorbeeld'
                actions[0].string = 'Probeer het voorbeeld'
                actions[1]['href'] = '#model'
                actions[1].string = 'Bekijk de vier stappen'
        # Let the reader experience the difference before introducing the model.
        example, model = soup.select_one('#voorbeeld'), soup.select_one('#model')
        if example and model:
            example.extract()
            model.insert_before(example)
            bridge(soup, example,
                   'Preparing an analysis and learning to analyse are different tasks. Change the goal below and see what that means for AI\'s role.' if en else
                   'Een analyse voorbereiden is iets anders dan leren analyseren. Verander hieronder het doel en bekijk wat dat betekent voor de rol van AI.',
                   'Try the difference' if en else 'Van antwoord naar handeling')
            bridge(soup, model,
                   'The example changes with the goal. These four questions help you make that choice for your own task.' if en else
                   'In het voorbeeld verandert de afweging zodra het doel verandert. Met deze vier vragen maak je die afweging voor je eigen les of taak.',
                   'From example to approach' if en else 'Van voorbeeld naar aanpak')
        # A real reading path, not another set of generic intro cards.
        story = soup.select_one('#verhaal')
        reading = soup.select_one('#verder-lezen')
        if story and reading:
            story.extract()
            fold = fragment('<details class="eai-story-fold"><summary></summary></details>').details
            fold.summary.string = 'Read how EAI developed' if en else 'Lees hoe EAI ontstond'
            fold.append(story)
            reading.append(fold)
            bridge(soup, reading,
                   'The four questions organise an analysis; they do not prove that an intervention works. The articles develop the reasoning and its limits.' if en else
                   'De vier vragen helpen je een afweging te maken. Ze bewijzen niet dat een aanpak werkt. In de artikelen lees je hoe de redenering is opgebouwd en waar de grenzen liggen.',
                   'Follow the reasoning' if en else 'Waar komt deze aanpak vandaan?')
        beginning = soup.select_one('#beginnen')
        if beginning:
            bridge(soup, beginning,
                   'Use the education pages for a lesson, the research pages to examine a claim, or the tools to turn your choices into an instruction.' if en else
                   'Wil je dit toepassen op een les? Bij Onderwijs vind je werkvormen. Voor een bron of claim ga je naar Onderzoek. De tools helpen je een gemaakte keuze uit te werken.',
                   'Choose your next step' if en else 'Verder met je eigen vraag')
        news = soup.select_one('.eai-news')
        if news and not en:
            text(news, '.eai-section-heading > p', 'Vanuit dezelfde vragen bekijken we ook bestaande AI-producten en nieuwe ontwikkelingen. Dit zijn de meest recente bijdragen op de site.')
        return
    if path == '/nl/onderwijs/':
        text(soup, '.page-hero h1', 'Wat moet de leerling hier leren?')
        text(soup, '.page-hero .lede', 'Wat moet de leerling leren, en waar staat hij nu? Zoek hieronder een werkvorm die past bij die fase. De vraag blijft aan welke stap de leerling zelf inhoudelijke betekenis moet geven.')
        text(soup, '.education-start .section-head h2', 'Wat vraagt deze les?')
        text(soup, '.education-start .section-head p', 'Loopt de leerling vast, wil je hulp geven of wil je nagaan wat hij zelfstandig kan? Die vragen leiden naar verschillende werkvormen.')
        bridge(soup, soup.select_one('.education-guide-strip'),
               'Een werkvorm kiezen is het begin. Loop ook na welke hulp je toelaat en wat je daarna zonder die hulp wilt vaststellen.', 'Na de keuze')
    elif path == '/nl/onderzoek/':
        text(soup, '.page-hero h1', 'Waarop is EAI gebaseerd?')
        text(soup, '.page-hero .lede', 'Lees de redenering achter het model, controleer de gebruikte bronnen of volg een afzonderlijk onderzoek. Een ontwerpkeuze is niet hetzelfde als een aangetoond effect.')
        # Unsubstantiated reading times did not help visitors choose a destination.
        for node, label in zip(soup.select('.knowledge-depth > div > span'), ('Redenering', 'Bronnen', 'Artikelen')):
            node.string = label
        for node, label in zip(soup.select('.knowledge-route h2'), ('De redenering achter het model', 'Bronnen en onderbouwing', 'Publicaties en verkenningen')):
            node.string = label
        bridge(soup, soup.select_one('main > .eai-section'),
               'Naast de onderbouwing van EAI vind je hier analyses van bestaande producten. Daar toetsen we wat een aanbieder beweert aan de bronnen die daarvoor worden gegeven.', 'Van model naar onderzoek')
    elif path == '/nl/tools/':
        text(soup, '.page-hero h1', 'Welk hulpmiddel past bij je vraag?')
        text(soup, '.page-hero .lede', 'Een AI-product beoordelen, een les ontwerpen of een instructie schrijven vraagt ander werk. Kies hieronder wat je wilt doen. Bij elke tool staat waarvoor je die gebruikt.')
        sections = soup.select('main > section.section')
        if len(sections) >= 5:
            bridge(soup, sections[3],
                   'Weet je welke stap bij de leerling of professional moet blijven? Leg die keuze nu vast in het ontwerp en in de instructie aan AI.', 'Van analyse naar ontwerp')
            bridge(soup, sections[4],
                   'Sommige hulpmiddelen horen bij een publicatie. Lees het bijbehorende artikel om te begrijpen welke redenering je met de tool onderzoekt.', 'Bij de publicaties')
    elif path == '/nl/toepassingen/':
        text(soup, '.page-hero h1', 'EAI in de praktijk')
        text(soup, '.page-hero .lede', 'Een leerling leert, een adviseur helpt iemand kiezen en een jurist weegt argumenten. Wat AI kan overnemen, hangt af van dat doel. Bekijk hoe de afweging in deze drie situaties verschilt.')
        text(soup, '.case-chooser .section-head h2', 'Kies de situatie die je herkent')
        text(soup, '.case-chooser .section-head p', 'Elke uitwerking begint bij het doel en de menselijke handeling. Daarna volgt de vraag wat AI op die plek verandert.')
        bridge(soup, soup.select_one('.journey-next'),
               'De voorbeelden laten de afweging zien. In de demonstrators kun je een aantal van die keuzes zelf verkennen.', 'Van lezen naar proberen')


def prepare_onderwijsin(soup):
    """Keep the standalone application, data and interactions; repair its public shell."""
    text(soup, '.oi-hero h1', 'Onderwijs in: code en toepassingen')
    text(soup, '.oi-eyebrow', 'Technische verkenning')
    text(soup, '.oi-hero > .oi-shell > p', 'Deze pagina gaat over Stichting Onderwijs in. Doorzoek de openbare repositories of bekijk hoe de beschreven gegevensstromen lopen.')
    text(soup, '#producten > h2', 'Toepassingen en projecten')
    lead = soup.select_one('#producten > .oi-lead')
    if lead:
        lead.string = 'Kies een toepassing om de code of documentatie te bekijken. Met Tekst doorzoek je alle repositories; Pijplijn toont twee gedocumenteerde gegevensstromen.'
    explainer, overview = soup.select_one('#wat'), soup.select_one('#oi-panel-overzicht')
    if explainer and overview:
        explainer.extract()
        fold = fragment('<details class="eai-source-fold"><summary>Over deze bronnen</summary></details>').details
        fold.append(explainer)
        overview.append(fold)
    classes = list(dict.fromkeys(soup.body.get('class', []) + ['eai-refresh', 'eai-onderwijsin']))
    soup.body['class'] = classes
