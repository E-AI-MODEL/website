#!/usr/bin/env python3
"""Check the EAI website register against the actual website repository.

This is deliberately an inventory check, not a UI generator. It never changes
public URLs, labels, navigation or published HTML. No third-party packages.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

IGNORE = {".git", ".github", "site-build", "node_modules", ".venv", "__pycache__"}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load(path: Path):
    return json.loads(read(path))


def route(path: str) -> str:
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and not path.endswith("/"):
        path += "/"
    return path


def visible_pages(root: Path) -> set[str]:
    return {
        p.relative_to(root).as_posix()
        for p in root.rglob("index.html")
        if not (set(p.relative_to(root).parts) & (IGNORE | {"content"}))
    }


def all_html(root: Path) -> set[str]:
    return {
        p.relative_to(root).as_posix()
        for p in root.rglob("*.html")
        if not (set(p.relative_to(root).parts) & IGNORE)
    }


def extract_physics(root: Path) -> set[str]:
    content = read(root / "content/science-observatory/labs/natuurkunde.html")
    head, separator, _ = content.partition("const labSpecs = [")
    if not separator:
        raise ValueError("Natuurkunde: labSpecs ontbreekt")
    spec = content.split("const labSpecs = [", 1)[1].split("\n];", 1)[0]
    ids = re.findall(r"^\['([a-z][a-z0-9]*)',", spec, re.MULTILINE)
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("Natuurkunde: ontbrekende of dubbele identificaties")
    return {f"anchor:/tools/science-observatory/labs/natuurkunde/#{i}" for i in ids}


def extract_math(root: Path, variant: str) -> set[str]:
    source = read(root / f"content/science-observatory/labs/wiskunde-{variant}.html")
    m = re.search(r'<script\b[^>]*\bid="config"[^>]*>(.*?)</script>', source, re.DOTALL)
    if not m:
        raise ValueError(f"Wiskunde {variant}: configuratie ontbreekt")
    modules = json.loads(m.group(1))["modules"]
    ids = [m["id"] for m in modules]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError(f"Wiskunde {variant}: dubbele of ontbrekende identificaties")
    return {f"anchor:/tools/science-observatory/labs/wiskunde-{variant}/#{i}" for i in ids}


def extract_modes(root: Path, source: str, url: str) -> set[str]:
    html = read(root / source)
    tags = re.findall(r"<button\b[^>]*>", html, re.IGNORECASE)
    ids = []
    for tag in tags:
        if not re.search(r'\bnav-btn\b', tag):
            continue
        m = re.search(r'\bdata-mode=["\x27]([^"\x27]+)["\x27]', tag)
        if m:
            ids.append(m.group(1))
    if not ids or len(ids) != len(set(ids)):
        raise ValueError(f"{source}: onderdelen ontbreken of hebben dubbele IDs")
    return {f"anchor:{url}#{i}" for i in ids}


def extract_llm(root: Path) -> set[str]:
    source = read(root / "content/llm-observatorium/index.html")
    m = re.search(r"const MODES=\[(.*?)\n\];", source, re.DOTALL)
    if not m:
        raise ValueError("Taalmodel: onderdelen ontbreken")
    names = re.findall(r"name:'([^']+)'", m.group(1))
    ids = [re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") for name in names]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("Taalmodel: onderdelen hebben geen unieke IDs")
    return {f"anchor:/tools/llm-observatorium/#{i}" for i in ids}


def extract_abyss(root: Path) -> set[str]:
    """Six ocean topics are in one HTML file, not six HTML routes."""
    content = read(root / "content/abyss/ABYSS.html")
    match = re.search(r"const MODES=\[(.*?)\];", content, re.DOTALL)
    if not match:
        raise ValueError("Oceaan: MODES ontbreekt")
    names = re.findall(r"\['([^']+)','([^']+)'\]", match.group(1))
    if len(names) != 6:
        raise ValueError(f"Oceaan: verwacht zes inhoudelijke delen, gevonden {len(names)}")
    return {f"abyss:{i}" for i in range(len(names))}


def extract_gravity(root: Path) -> set[str]:
    """Six orbital investigations are stored in one JavaScript array."""
    content = read(root / "content/science-observatory/labs/gravitatie-banen.html")
    match = re.search(r"const M=\[(.*?)\];", content, re.DOTALL)
    if not match:
        raise ValueError("Gravitatie: M ontbreekt")
    names = re.findall(r"\{short:'([^']+)',desc:'([^']+)',title:'([^']+)'", match.group(1))
    if len(names) != 6:
        raise ValueError(f"Gravitatie: verwacht zes inhoudelijke delen, gevonden {len(names)}")
    return {f"gravitation:{i}" for i in range(len(names))}


def extract_sport_modes(root: Path) -> set[str]:
    """Three modes and online play are entry points, not separate websites."""
    content = read(root / "tools/lo-aanvalslab/index.html")
    modes = re.findall(r'<button\b[^>]*class="choice"[^>]*data-mode="([^"]+)"', content)
    if len(modes) != 3 or len(set(modes)) != 3 or 'id="onlineChoice"' not in content:
        raise ValueError("Sport: verwachte drie keuzes en samenspel ontbreken")
    return {f"sport-mode:{mode}" for mode in modes} | {"sport-mode:online"}


def extract_process_modes(root: Path) -> set[str]:
    """The existing process wizard serves two different user goals."""
    content = read(root / "tools/van-proces-naar-prompt/index.html")
    modes = re.findall(r'<button\b[^>]*data-mode="(ontwerpen|onderzoeken)"', content)
    if len(modes) != 2 or len(set(modes)) != 2:
        raise ValueError("Proceswizard: twee functies ontbreken")
    return {f"process-mode:{mode}" for mode in modes}


def extract_game(root: Path) -> tuple[set[str], int, list[str]]:
    """EAIgame stores 100 source questions which yield three level versions."""
    content = read(root / "assets/eaigame-questions.js")
    groups = re.findall(
        r"\{id:'([^']+)',title:'[^']+',subject:'[^']+',slo:'[^']+',color:'[^']+',intro:'[^']+',items:\[(.*?)\]\s*\}",
        content, re.DOTALL
    )
    levels_match = re.search(r"const levels=\[([^\]]+)\]", content)
    levels = re.findall(r"'([^']+)'", levels_match.group(1)) if levels_match else []
    identifiers = [entry[0] for entry in groups]
    seeds = sum(len(re.findall(r"\b[CTO]\(", entry[1])) for entry in groups)
    if len(identifiers) != 6 or len(set(identifiers)) != 6 or seeds != 100 or levels != ["vmbo", "havo", "vwo"]:
        raise ValueError("EAIgame: gebieden, vraagbronnen of niveaus veranderd")
    return {f"game-area:{i}" for i in identifiers}, seeds * len(levels), levels


def extract_studio(root: Path) -> dict[str, set[str]]:
    """Count only the fixed starter, recipe and reusable-component catalogues."""
    content = read(root / "content/eaistudio/studio.html")
    source = re.search(r"const CORE_LIBRARY_COMPONENTS=\[(.*?)\];", content, re.DOTALL)
    starters = re.search(r"const STARTER_TEMPLATES=\[(.*?)\];", content, re.DOTALL)
    recipes = re.search(r"const RECIPES=\[(.*?)\];", content, re.DOTALL)
    if not source or not starters or not recipes:
        raise ValueError("EAIstudio: een vaste bibliotheek ontbreekt")
    components = re.findall(r"defineLibraryComponent\('([^']+)','[^']+','[^']+'", source.group(1))
    starts = re.findall(r"\{id:'([^']+)',name:'[^']+'", starters.group(1))
    scenes = re.findall(r"\{id:'([^']+)',name:'[^']+'", recipes.group(1))
    if len(components) != 40 or len(starts) != 3 or len(scenes) != 8:
        raise ValueError("EAIstudio: omvang van vaste bibliotheken veranderd")
    for entries in (components, starts, scenes):
        if len(set(entries)) != len(entries):
            raise ValueError("EAIstudio: dubbele vaste IDs")
    return {
        "eaistudio-component:": {f"eaistudio-component:{i}" for i in components},
        "eaistudio-starter:": {f"eaistudio-starter:{i}" for i in starts},
        "eaistudio-scene:": {f"eaistudio-scene:{i}" for i in scenes},
    }


def extract_wihtml_slide_types(root: Path) -> set[str]:
    content = read(root / "content/wihtml/studio.html")
    types = re.search(r"const TYPES=(\{[^}]+\});", content)
    if not types:
        raise ValueError("WiHTML: lesonderdeeltypen ontbreken")
    identifiers = re.findall(r"(\w+):\"[^\"]+\"", types.group(1))
    if len(identifiers) != 10 or len(set(identifiers)) != 10:
        raise ValueError("WiHTML: lesonderdeeltypen veranderd")
    return {f"wihtml-slide:{i}" for i in identifiers}


def extract_eaiwork_views(root: Path) -> set[str]:
    content = read(root / "content/eaiwork-dashboard.html")
    source = re.search(r"const nav=\[(.*?)\];", content, re.DOTALL)
    if not source:
        raise ValueError("EAIwork: navigatie ontbreekt")
    identifiers = re.findall(r"\['([^']+)','[^']+','[^']+'\]", source.group(1))
    if len(identifiers) != 15 or len(set(identifiers)) != 15:
        raise ValueError("EAIwork: interne schermen veranderd")
    return {f"eaiwork-view:{i}" for i in identifiers}


def extract_eaimesh_focus(root: Path) -> set[str]:
    content = read(root / "content/eaimesh/start.html")
    source = re.search(r"(?:var|const)\s+INTENTS\s*=\s*\{(.*?)\};", content, re.DOTALL)
    if not source:
        raise ValueError("EAImesh: analysekeuzes ontbreken")
    identifiers = re.findall(r"(\w+):\{label:'[^']+'", source.group(1))
    if len(identifiers) != 7 or len(set(identifiers)) != 7:
        raise ValueError("EAImesh: analysekeuzes veranderd")
    return {f"eaimesh-focus:{i}" for i in identifiers}


def extract_taal(root: Path) -> set[str]:
    source = read(root / "content/taalwerkvormen-page.html")
    ids = re.findall(r'<a href="#(taal-\d+)">', source)
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("TAALwerkvormen: kaartlinks ontbreken of zijn dubbel")
    return {f"taal:{i}" for i in ids}


def extract_llmscan(root: Path) -> set[str]:
    source = read(root / "nl/llmscan/catalogue.js")
    mark = "window.__LLMSCAN_SEED="
    if mark not in source:
        raise ValueError("LLMscan: catalogus ontbreekt")
    data = json.loads(source.split(mark, 1)[1].strip().removesuffix(";"))
    ids = [p["id"] for p in data["products"]]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("LLMscan: producten hebben geen unieke IDs")
    return {f"llmscan:{i}" for i in ids}


def extract_glossary(root: Path, locale: str) -> set[str]:
    if locale not in ("nl", "en"):
        raise ValueError("Onbekende taal voor begrippenregister")
    path = "nl/begrippen/index.html" if locale == "nl" else "en/glossary/index.html"
    base = "/nl/begrippen/" if locale == "nl" else "/en/glossary/"
    content = read(root / path)
    ids = []
    for tag in re.findall(r"<details\b[^>]*>", content, re.IGNORECASE):
        if "eai-dictionary-term" not in tag:
            continue
        match = re.search(r'\bid=["\x27]([^"\x27]+)["\x27]', tag)
        if match:
            ids.append(match.group(1))
    if not ids or len(ids) != len(set(ids)):
        raise ValueError(f"Begrippenregister {locale}: IDs ontbreken of zijn dubbel")
    return {f"anchor:{base}#{i}" for i in ids}


def extract_wihtml(root: Path) -> set[str]:
    folder = root / "content/wihtml/bibliotheek"
    files = sorted(folder.glob("*.json"))
    if not files:
        raise ValueError("WiHTML: bibliotheek bevat geen bronlessen")
    for path in files:
        data = load(path)
        if not isinstance(data.get("title"), str) or not data.get("slides"):
            raise ValueError(f"WiHTML: ongeldige lesinhoud: {path.name}")
    return {f"wihtml:{path.stem}" for path in files}


def extract_workforms(root: Path) -> set[str]:
    data = load(root / "content/workforms.json")
    slugs = [w["slug"] for w in data["workforms"]]
    if not slugs or len(slugs) != len(set(slugs)):
        raise ValueError("Werkvormen: dubbele of ontbrekende slugs")
    return {f"/werkvormen/{slug}/" for slug in slugs}


def check(root: Path, register: dict, taxonomy: dict) -> list[str]:
    errors: list[str] = []
    pages = register.get("pages", [])
    items = register.get("embedded_items", [])
    sources = register.get("html_sources", [])
    families = {f["id"] for f in taxonomy.get("families", [])}
    if len(families) != len(taxonomy.get("families", [])):
        errors.append("Taxonomie: dubbele familie-ID")

    for f in taxonomy.get("families", []):
        if f.get("parent") and f["parent"] not in families:
            errors.append(f"Taxonomie: ouder ontbreekt voor {f['id']}")
        if f.get("parent") == f["id"]:
            errors.append(f"Taxonomie: familie verwijst naar zichzelf ({f['id']})")

    def unique(values, label):
        if len(values) != len(set(values)):
            errors.append(f"{label}: dubbele identificatie")

    unique([p["id"] for p in pages], "Pagina")
    unique([p["url"] for p in pages], "Pagina-URL")
    unique([i["id"] for i in items], "Onderdeel")

    page_ids = {p["id"] for p in pages}
    page_urls = {p["url"] for p in pages}
    if any(not p["id"].startswith("page:") for p in pages):
        errors.append("Pagina: ID moet met page: beginnen")
    for p in pages:
        if p["id"] != "page:" + p["url"]:
            errors.append(f"Pagina: ID en URL verschillen bij {p['id']}")
        if p.get("parent") and p["parent"] not in page_ids:
            errors.append(f"Pagina: ontbrekende bovenliggende pagina voor {p['id']}")
        if p.get("parent") == p["id"]:
            errors.append(f"Pagina: verwijst naar zichzelf ({p['id']})")
        if p.get("family") not in families:
            errors.append(f"Pagina: familie ontbreekt of onbekend bij {p['id']}")
        if not p.get("title"):
            errors.append(f"Pagina: titel ontbreekt bij {p['id']}")
        if p.get("file") and not (root / p["file"]).is_file():
            errors.append(f"Pagina: bronbestand bestaat niet: {p['file']}")

    collections = register.get("collections", [])
    unique([c["id"] for c in collections], "Verzameling")
    for collection in collections:
        if collection.get("family") not in families:
            errors.append(f"Verzameling heeft onbekende familie: {collection['id']}")
        members = collection.get("members", [])
        if not members or len(members) != len(set(members)):
            errors.append(f"Verzameling heeft geen unieke leden: {collection['id']}")
        for member in members:
            if member not in page_ids:
                errors.append(f"Verzameling verwijst naar ontbrekende pagina: {member}")
        for variant in collection.get("variants", []):
            if variant.get("page") not in members:
                errors.append(f"Verzameling: uitvoering ontbreekt bij leden: {collection['id']}")

    for i in items:
        if i.get("parent") not in page_ids:
            errors.append(f"Onderdeel zonder geldige bovenliggende pagina: {i['id']}")
        if i.get("family") not in families:
            errors.append(f"Onderdeel zonder geldige familie: {i['id']}")
        if not i.get("name"):
            errors.append(f"Onderdeel zonder titel: {i['id']}")
        if i.get("source_file") and not (root / i["source_file"]).is_file():
            errors.append(f"Onderdeel zonder aanwezig bronbestand: {i['id']}")
        if "url" in i:
            base = i["url"].split("#", 1)[0]
            if route(base) not in page_urls:
                errors.append(f"Onderdeel: niet-geregistreerde route {i['id']}")

    # Public sitemap is another data source, not a substitute for this register.
    # An omitted legacy route may be intentional; an unreported difference isn't.
    try:
        sitemap = read(root / "sitemap.xml")
        sitemap_paths = {
            route(urlsplit(value).path)
            for value in re.findall(r"<loc>([^<]+)</loc>", sitemap)
        }
        for page in pages:
            if page.get("in_committed_sitemap") is not (page["url"] in sitemap_paths):
                errors.append(f"Sitemap: vermelding verschilt voor {page['url']}")
        missing = sitemap_paths - page_urls
        if missing:
            errors.append("Sitemap: routes zonder registratie: " + repr(sorted(missing)))
    except OSError as exc:
        errors.append(f"Sitemap: bestand niet leesbaar: {exc}")

    actual_page_files = visible_pages(root)
    registered_page_files = {p["file"] for p in pages if p.get("file")}
    if actual_page_files != registered_page_files:
        errors.append("Pagina-inventaris wijkt af; niet opgenomen: "
                      + repr(sorted(actual_page_files - registered_page_files))
                      + "; niet meer gevonden: " + repr(sorted(registered_page_files - actual_page_files)))

    actual_html_files = all_html(root)
    tracked_html_files = registered_page_files | {s["path"] for s in sources}
    if actual_html_files != tracked_html_files:
        errors.append("HTML-inventaris wijkt af; niet opgenomen: "
                      + repr(sorted(actual_html_files - tracked_html_files))
                      + "; niet meer gevonden: " + repr(sorted(tracked_html_files - actual_html_files)))

    ids = {i["id"] for i in items}
    # These embedded screens have no independent pages or URL fragments. Still
    # count them, and reject additions/removals that bypass the register.
    for label, extract, prefix in [
        ("Oceaan", extract_abyss, "abyss:"),
        ("Gravitatie", extract_gravity, "gravitation:"),
        ("Sportkeuzes", extract_sport_modes, "sport-mode:"),
        ("Proceswizard", extract_process_modes, "process-mode:"),
    ]:
        try:
            expected = extract(root)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"{label}: bron niet leesbaar: {exc}")
            continue
        recorded = {i["id"] for i in items if i["id"].startswith(prefix)}
        if expected != recorded:
            errors.append(
                f"{label}: onderdelen wijken af; ontbreekt "
                + repr(sorted(expected - recorded))
                + ", overbodig " + repr(sorted(recorded - expected))
            )

    # These controls keep the larger JavaScript-driven applications visible
    # without inventing a separate public URL for each internal screen.
    fixed = [
        ("WiHTML lesonderdelen", extract_wihtml_slide_types, "wihtml-slide:"),
        ("EAIwork schermen", extract_eaiwork_views, "eaiwork-view:"),
        ("EAImesh keuzes", extract_eaimesh_focus, "eaimesh-focus:"),
    ]
    for label, extractor, prefix in fixed:
        try:
            expected = extractor(root)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"{label}: bron niet leesbaar: {exc}")
            continue
        actual = {item["id"] for item in items if item["id"].startswith(prefix)}
        if actual != expected:
            errors.append(f"{label}: onderdelen wijken af; ontbreekt "
                          + repr(sorted(expected - actual))
                          + ", overbodig " + repr(sorted(actual - expected)))

    try:
        expected_game, question_count, levels = extract_game(root)
        actual_game = {item["id"] for item in items if item["id"].startswith("game-area:")}
        if actual_game != expected_game:
            errors.append("EAIgame: gebieden wijken af")
        game_pages = [p for p in pages if p["url"] == "/tools/eaigame/"]
        bank = game_pages[0].get("question_bank", {}) if game_pages else {}
        if bank.get("count") != question_count or bank.get("levels") != levels:
            errors.append("EAIgame: vragenbank of niveaus komen niet overeen met het register")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"EAIgame: bron niet leesbaar: {exc}")

    try:
        studio = extract_studio(root)
        for prefix, expected in studio.items():
            actual = {item["id"] for item in items if item["id"].startswith(prefix)}
            if actual != expected:
                errors.append("EAIstudio: bibliotheek wijkt af: " + prefix)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"EAIstudio: bron niet leesbaar: {exc}")

    # Both Melkweg pages present the same six research topics. Names are
    # editorial proposals; the stable technical topic IDs must agree.
    melkweg = {}
    for url in ("/tools/melkweg-lab/", "/tools/science-observatory/labs/melkweg/"):
        group = [i for i in items if i.get("parent") == "page:" + url]
        melkweg[url] = {i.get("topic_id") for i in group}
        if len(group) != 6 or melkweg[url] != {
            "melkweg:atlas", "melkweg:dynamics", "melkweg:structure",
            "melkweg:stars", "melkweg:gaia", "melkweg:blackhole"
        }:
            errors.append(f"Melkweg: gekoppelde onderwerpen verschillen bij {url}")

    for label, extract in [
        ("Natuurkunde", lambda: extract_physics(root)),
        ("Wiskunde A", lambda: extract_math(root, "a")),
        ("Wiskunde B", lambda: extract_math(root, "b")),
        ("Melkweg", lambda: extract_modes(root, "content/science-observatory/labs/melkweg.html",
                                         "/tools/science-observatory/labs/melkweg/")),
        ("Melkweg 2", lambda: extract_modes(root, "content/melkweg-lab/index.html",
                                           "/tools/melkweg-lab/")),
        ("Taalmodel", lambda: extract_llm(root)),
        ("TAALwerkvormen", lambda: extract_taal(root)),
        ("LLMscan", lambda: extract_llmscan(root)),
        ("Begrippen NL", lambda: extract_glossary(root, "nl")),
        ("Begrippen EN", lambda: extract_glossary(root, "en")),
        ("WiHTML", lambda: extract_wihtml(root)),
    ]:
        try:
            expected = extract()
        except (OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"{label}: bron niet leesbaar: {exc}")
            continue
        namespace = next(iter(expected)).split(":", 1)[0] + ":"
        if label == "TAALwerkvormen":
            current = {i for i in ids if i.startswith("taal:")}
        elif label == "LLMscan":
            current = {i for i in ids if i.startswith("llmscan:")}
        elif label == "WiHTML":
            current = {i for i in ids if i.startswith("wihtml:")}
        else:
            target = next(iter(expected)).split("#", 1)[0]
            current = {i for i in ids if i.startswith(target + "#")}
        if expected != current:
            errors.append(f"{label}: register en bron komen niet overeen: ontbreekt "
                          + repr(sorted(expected - current))
                          + ", overbodig " + repr(sorted(current - expected)))

    try:
        expected_workforms = extract_workforms(root)
        missing_workforms = expected_workforms - page_urls
        extra_workforms = {u for u in page_urls if u.startswith("/werkvormen/") and u != "/werkvormen/"} - expected_workforms
        if missing_workforms or extra_workforms:
            errors.append("EAI-werkvormen: pagina's en bron wijken af; ontbreekt "
                          + repr(sorted(missing_workforms)) + ", overbodig " + repr(sorted(extra_workforms)))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"EAI-werkvormen: bron niet leesbaar: {exc}")

    if register.get("scope") != "E-AI-MODEL/website":
        errors.append("Register betreft niet uitsluitend de website-repository")
    if register.get("based_on", {}).get("git_ref") != "main":
        errors.append("Register mist de verwijzing naar de geinventariseerde main")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    root = args.root.resolve()
    register = load(root / "catalog/website-register.json")
    taxonomy = load(root / "catalog/taxonomie.json")
    problems = check(root, register, taxonomy)
    print("Register:", len(register["pages"]), "pagina's,",
          len(register["embedded_items"]), "onderdelen,",
          len(register["html_sources"]), "aanvullende HTML-bronbestanden")
    if problems:
        for problem in problems:
            print("FOUT:", problem, file=sys.stderr)
        return 1
    print("OK: de geregistreerde bestanden en broncatalogi komen overeen met de website-repository")
    return 0


if __name__ == "__main__":
    sys.exit(main())
