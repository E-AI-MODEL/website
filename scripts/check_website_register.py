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
