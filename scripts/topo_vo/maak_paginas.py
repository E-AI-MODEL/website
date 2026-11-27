"""Maakt de pagina's van Let's go TOPO! VO uit de PO-stijlen en de bronnen in pagina/.

Gebruik:  python3 scripts/topo_vo/maak_paginas.py          (schrijft topo/vo/index.html en topo/vo/spel/index.html)
          python3 scripts/topo_vo/maak_paginas.py --check  (faalt als de pagina's niet bij de bronnen passen)
De stijlen komen letterlijk uit topo/nederland/index.html en topo/instellingen/index.html,
zodat de VO-versie dezelfde vormgeving houdt als de PO-versie. Pas pagina/*.js of dit script aan,
nooit de gegenereerde HTML.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import topo_vast_scherm  # noqa: E402  gedeelde vaste-schermlaag (zelfde versie als PO)

REPO = Path(__file__).resolve().parents[2]
BRON = Path(__file__).resolve().parent / "pagina"

SPEL_CSS = """<style id="topo-vo">
.logo .vo{display:inline-block;margin-left:6px;padding:2px 8px;font-size:.55em;letter-spacing:0;vertical-align:middle;background:var(--lime);border:2px solid var(--ink);border-radius:9px;transform:rotate(4deg);color:var(--ink)}
.map-art .area-shape{stroke:#c6a975;stroke-width:1.3px;vector-effect:non-scaling-stroke;stroke-linejoin:round;fill-rule:evenodd}
.map-art .surrounding-land{stroke-width:1px;vector-effect:non-scaling-stroke}
.map-art .water-area{fill:#a9d8ea;stroke:#8cc6dc;stroke-width:1px;vector-effect:non-scaling-stroke;fill-rule:evenodd}
.map-art .river-line{fill:none;stroke:#5fa9c9;stroke-width:1.7px;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.map-art .plate-line{fill:none;stroke:#e0574a;stroke-width:1.6px;stroke-dasharray:6 4;vector-effect:non-scaling-stroke}
.map-art .target-area{fill:#31caa0;fill-opacity:.38;stroke:#008779;stroke-linejoin:round;fill-rule:evenodd;pointer-events:none}
.map-art .target-line{fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.map-art .target-line-core{fill:none;stroke:#008779;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.map-art .map-text.place{font-weight:900;fill:#30454d;stroke:#fff8e8;paint-order:stroke;stroke-linejoin:round}
.map-art .map-text.water{fill:#5f9cb5;stroke:#e4f4fa;letter-spacing:1px}
#map svg{cursor:crosshair}
.map-art .tap-line line{stroke:#d9483b;stroke-linecap:round;fill:none}
.map-art .tap-mark path{stroke:#d9483b;stroke-linecap:round;fill:none}
.map-art .map-text.tap-km{fill:#a2352b;font-weight:1000;stroke:#fff8e8;paint-order:stroke;stroke-linejoin:round}
body.playing #game .question-card .sure-row{display:grid;grid-template-columns:auto 1fr 1fr;gap:6px;align-items:center;flex:none}
body.playing #game .question-card .sure-row.hide{display:none!important}
body.playing #game .question-card .sure-row span{font-size:13px;font-weight:1000;color:#385b66;padding-right:2px}
body.playing #game .question-card .sure-row button{min-height:44px;border:2px solid var(--ink);border-radius:13px;font-weight:1000;font-size:16px;box-shadow:0 3px 0 var(--ink);background:var(--lime)}
body.playing #game .question-card .sure-row button[data-sure="0"]{background:#ffe3a4}
body.playing #game .question-card .sure-row:not(.hide)~.small-links{display:none!important}
body.playing #game #answerOptions .option.chosen{background:#fff1b8;outline:3px solid var(--ink);outline-offset:-1px}
.end-note{max-width:60ch;margin:8px auto 0;font-size:15px;line-height:1.35;font-weight:850;color:#3d5560}
.scores .sure-good{background:#c9e6ae!important}.scores .sure-wrong{background:#ffc8bc!important}
.question-card h2.long{font-size:clamp(19px,2.2vw,30px)!important;line-height:1.15!important}
.question-card h2.xlong{font-size:clamp(16px,1.8vw,24px)!important;line-height:1.2!important}
.glossary{margin:0;padding:14px 16px;line-height:1.35;background:#fff;border-radius:13px}.glossary dt{font-weight:1000;margin-top:10px}.glossary dd{margin:2px 0 0;font-weight:750;color:#3d5560}
.sheet-map:has(.glossary){background:#fff}
</style>"""

START_CSS = """<style id="topo-vo-start">
.logo .vo{display:inline-block;margin-left:6px;padding:2px 8px;font-size:.55em;letter-spacing:0;vertical-align:middle;background:var(--lime);border:2px solid var(--ink);border-radius:9px;transform:rotate(4deg);color:var(--ink)}
.toplinks{display:flex;gap:8px;align-items:center}.plain{background:none;border:0;font-weight:1000;text-decoration:underline;text-underline-offset:3px;padding:8px 4px;color:var(--ink)}
.zone small{display:block;font-size:12px;font-weight:850;color:var(--muted)}
.sheet-grid.sets{grid-template-columns:repeat(3,minmax(0,1fr))}
.province.set{flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;gap:5px;min-height:92px;padding:12px 13px}
.set-title{font-size:clamp(14px,1.4vw,18px);line-height:1.12}.set-meta{font-size:12px;font-weight:850;color:var(--muted)}
.doel{display:inline-block;margin:4px 4px 0 0;padding:3px 8px;border:2px solid var(--ink);border-radius:9px;background:#fff;font-size:12px;font-weight:900}
#setNote small{display:block;margin-top:6px;color:var(--muted)}
.copy{border:2px solid var(--ink);border-radius:14px;background:#fff;padding:10px 13px;font-weight:1000;box-shadow:0 3px 0 var(--ink)}
.overlay{position:fixed;inset:0;z-index:12;background:#0d2538ae;display:flex;align-items:center;justify-content:center;padding:15px}.overlay.hide{display:none}
.mini-label{display:inline-block;background:var(--pink);border:2px solid var(--ink);border-radius:9px;padding:5px 10px;font-size:12px;font-weight:1000;transform:rotate(-3deg)}
.overlay .modal{position:relative;width:min(100%,520px)}.overlay .modal h2{font-size:clamp(30px,6vw,42px);margin:10px 0}
.big{font-weight:1000;border:var(--stroke);background:var(--orange);border-radius:20px;padding:14px 22px;box-shadow:0 5px 0 var(--ink);font-size:21px;transform:rotate(-2deg);color:var(--ink)}
.overlay .modal details{margin:10px 0 16px;font-size:14px;line-height:1.4}.overlay .modal summary{font-weight:1000;cursor:pointer}
@media(max-width:850px){.sheet-grid.sets{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.province.set{min-height:78px;padding:9px 10px}.set-title{font-size:13px}.set-meta{font-size:10.5px}.zone small{font-size:10px}.copy{font-size:12px;padding:8px 9px}.toplinks .plain{font-size:12px}}
</style>"""

SPEL_HTML = """<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#fcf6df">
<meta name="robots" content="noindex,follow">
<title>Spelen | Let’s go TOPO! VO</title><meta name="description" content="Oefen topografie en aardrijkskunde voor havo en vwo, klas 1 tot en met 6. Geen account nodig.">
@@STYLES@@
@@VO_CSS@@@@VAST@@</head><body>
<header class="top"><a href="/topo/vo/" class="logo">Let’s go <span>TOPO!</span><b class="vo">VO</b></a><a href="/topo/vo/" class="other">Instellingen</a></header>
<main>
<section id="loading" class="result"><span class="sticker">TOPO! VO</span><h2>Kaart laden…</h2><p>Je oefenset komt eraan.</p></section>
<section id="game" class="hide">
 <div class="game-top"><a class="back" id="back" href="/topo/vo/">← Terug</a><div class="progress-box"><div class="progress-label"><span id="missionName">MISSIE 1</span><span id="progressText">1/10</span></div><div class="bar"><div id="progressFill"></div></div></div><div class="level" id="score">★ 0</div></div>
 <div class="game-grid"><div class="game-board"><div class="map-frame" id="map"></div><div class="hint-chip" id="mapHint">KIJK OP DE KAART!</div></div>
 <section class="question-card"><span class="q-label" id="kind">TOPO!</span><h2 id="prompt"></h2><p id="sub"></p><div id="answerOptions"></div><div class="feedback hide" id="feedback" aria-live="polite"></div><button class="next hide" id="next">VERDER! →</button><div class="sure-row hide" id="sure" role="group" aria-label="Hoe zeker ben je?"><span>Hoe zeker?</span><button type="button" data-sure="1">Zeker!</button><button type="button" data-sure="0">Ik gok</button></div><div class="small-links"><button id="help">Help me!</button><button id="showAnswer">Spiekkaart</button><button id="skip">Even overslaan →</button></div></section></div>
</section>
<section id="end" class="hide result"><span class="sticker">RONDE KLAAR!</span><h2 id="endTitle">Lekker bezig!</h2><p id="endText"></p><div id="helpSummary" class="scores"></div><p id="endNote" class="end-note hide"></p><div id="review" class="review"></div><div class="actions"><button id="retry" class="big hide">FOUTEN OEFENEN!</button><button id="again" class="big secondary">NOG EEN KEER!</button><button id="later" class="quiet hide" type="button">Herhaallink</button><a id="change" href="/topo/vo/" class="quiet">Andere set</a></div></section>
</main>
<div class="overlay hide" id="sheetLayer" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"><div class="modal"><button class="close" id="closeSheet" aria-label="Sluiten">×</button><span class="sticker">SPIEKKAART</span><h2 id="sheetTitle">Even spieken!</h2><div class="sheet-tools" id="sheetTools"><button id="zoomOut" type="button" aria-label="Uitzoomen">−</button><strong id="zoomText">100%</strong><button id="zoomIn" type="button" aria-label="Inzoomen">+</button><button id="zoomFit" type="button">Passend</button></div><div class="sheet-map" id="sheetMap"><div class="sheet-canvas" id="sheetCanvas"></div></div><p id="sheetNote">Kijk goed. Probeer het daarna zelf!</p></div></div>
<div class="credits" id="credits">Kaartdata: Natural Earth (publiek domein) · Oefenkaart, geen navigatiekaart</div>
<script>
@@JS@@</script></body></html>
"""

START_HTML = """<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#fcf6df">
<title>Let’s go TOPO! voor VO | Topografie havo en vwo</title>
<meta name="description" content="Topografie en aardrijkskunde oefenen voor havo en vwo, klas 1 tot en met 6. Kerndoelen, examenstof en de SLO-basislijst. Geen account nodig.">
<link rel="canonical" href="https://eaimodel.nl/topo/vo/">
@@STYLES@@
@@VO_CSS@@@@VAST@@</head>
<body>
<header><a class="logo" href="/topo/vo/">Let’s go <span>TOPO!</span><b class="vo">VO</b></a><div class="toplinks"><button class="plain" id="openPrivacy" type="button">Privacy</button><a class="back" href="/topo/">Basisschool</a></div></header>
<main class="wrap">
<div class="intro"><div><span class="sticker">HAVO EN VWO · KLAS 1–6</span><h1>Topo voor VO!</h1><p>Kies je niveau, je set en hoe je wilt oefenen.</p></div></div>
<div class="board">
<div class="layout">
<nav class="tabs" aria-label="Keuzes">
<button class="tab" role="tab" aria-selected="true" aria-controls="panel-niveau" id="tab-niveau" data-tab="niveau"><span class="n">01</span> Niveau</button>
<button class="tab" role="tab" aria-selected="false" aria-controls="panel-oefenen" id="tab-oefenen" data-tab="oefenen"><span class="n">02</span> Oefenen</button>
<button class="tab" role="tab" aria-selected="false" aria-controls="panel-spel" id="tab-spel" data-tab="spel"><span class="n">03</span> Spel</button>
</nav>
<div>
<section class="panel" id="panel-niveau" role="tabpanel" aria-labelledby="tab-niveau">
<h2>Welk niveau?</h2><p class="hint">Kies je schooltype en eventueel je leerjaar.</p>
<div class="zonepick" id="niveaus"></div>
<div class="group"><h3>Leerjaar</h3><div class="controls" id="leerjaren"></div></div>
<div class="area-note">Onderbouw volgt de kerndoelen mens en maatschappij en de SLO-basislijst. Havo en vwo volgen de examenprogramma’s aardrijkskunde. De indeling per leerjaar is een voorstel.</div>
</section>
<section class="panel" id="panel-oefenen" role="tabpanel" aria-labelledby="tab-oefenen" hidden>
<h2>Wat ga je oefenen?</h2><p class="hint">Kies een set. Elke set hoort bij een doel.</p>
<div class="sheet-grid sets" id="sets" aria-label="Oefensets"></div>
<div class="area-note" id="setNote">Kies een set.</div>
</section>
<section class="panel" id="panel-spel" role="tabpanel" aria-labelledby="tab-spel" hidden>
<h2>Hoe wil je spelen?</h2>
<div class="group"><h3>Vraagvorm</h3><div class="controls" id="vormen"></div><p id="vormNote"></p></div>
<div class="group"><h3>Aantal vragen</h3><div class="controls" id="aantal"></div></div>
<div class="group"><h3>Hulp</h3><div class="controls" id="hulp"></div><p>Zonder hulp: geen hints en geen spiekkaart. Foute plekken komen later in de ronde terug.</p></div>
<div class="group"><h3>Manier van oefenen</h3><div class="controls" id="manier"></div><p>Meebewegend: gaat het goed, dan wordt het moeilijker; loop je vast, dan krijg je meer hulp. Extra uitdaging: ook moeilijkere plekken en minder inzoomen.</p></div>
<div class="group"><h3>Slim leren</h3><div class="controls" id="slim"></div><p>Eerst kijken: je ziet de plekken eerst, daarna haal je ze zelf op. Zeker of gok: je geeft aan hoe zeker je bent; aan het eind zie je waar je je vergiste.</p></div>
</section>
</div>
</div>
<div class="bottom">
<div class="summary" id="summary" aria-live="polite">Even laden…</div>
<div class="actions"><button type="button" class="copy" id="copy">Link voor de klas</button><a class="go" id="go" href="#">SPELEN! ↗</a></div>
</div>
</div>
</main>
<div class="modalback" id="notReady" hidden role="dialog" aria-modal="true" aria-labelledby="notReadyTitle"><div class="modal"><span class="sticker">KOMT NOG!</span><h2 id="notReadyTitle">Nog even niet!</h2><p>Kies eerst een niveau en een set.</p><button type="button" id="closeModal">OKÉ!</button></div></div>
@@PRIVACY@@
<script>
@@JS@@</script>
</body>
</html>
"""


def po_styles(rel):
    po = (REPO / rel).read_text(encoding="utf-8")
    return "\n".join(re.findall(r"<style[^>]*>.*?</style>", po[:po.index("</head>")], re.S))


def fill(template, **parts):
    for key, value in parts.items():
        template = template.replace("@@" + key.upper() + "@@", value)
    assert "@@" not in template
    return template


def spel_pagina():
    html = fill(SPEL_HTML, styles=po_styles("topo/nederland/index.html"), vo_css=SPEL_CSS, vast=topo_vast_scherm.tags(),
                js=(BRON / "spel.js").read_text(encoding="utf-8"))
    return REPO / "topo/vo/spel/index.html", html


def start_pagina():
    home = (REPO / "topo/index.html").read_text(encoding="utf-8")
    privacy = re.search(r'<div class="overlay" id="privacyLayer".*?</div></div>', home, re.S).group(0)
    privacy = privacy.replace("Let’s go, TOPO!", "Let’s go, TOPO! VO").replace("<summary>Voor ouders</summary>", "<summary>Voor ouders en docenten</summary>")
    assert "Voor ouders en docenten" in privacy
    html = fill(START_HTML, styles=po_styles("topo/instellingen/index.html"), vo_css=START_CSS, vast=topo_vast_scherm.tags(), privacy=privacy,
                js=(BRON / "start.js").read_text(encoding="utf-8"))
    return REPO / "topo/vo/index.html", html


def main():
    check = "--check" in sys.argv
    stale = []
    for path, html in (start_pagina(), spel_pagina()):
        if check:
            if not path.exists() or path.read_text(encoding="utf-8") != html:
                stale.append(str(path.relative_to(REPO)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(html, encoding="utf-8")
            print("geschreven:", path.relative_to(REPO), len(html))
    if stale:
        raise SystemExit("Niet bijgewerkt (draai scripts/topo_vo/maak_paginas.py): " + ", ".join(stale))
    if check:
        print("TOPO VO-pagina's passen bij de bronnen")


if __name__ == "__main__":
    main()
