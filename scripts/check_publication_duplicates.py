#!/usr/bin/env python3
"""Controleer de werkelijke HTML-release op dubbele pagina's.

Dit script leest de gebouwde site. Het verwijdert, verplaatst of herschrijft
geen pagina's. Een niet-herkende dubbeling blokkeert de publicatie; bestaande
open punten blijven afzonderlijk zichtbaar, zonder ze als opgelost te melden.
"""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

from bs4 import BeautifulSoup

SITE = "https://eaimodel.nl"
# TOPO wordt via een eigen release gebouwd en staat bewust niet in site-build.
INDEPENDENT_ROUTES = {"/topo/"}
# Alleen de snelle PR-proef mag deze routes overslaan. De productiebuild
# moet ze allebei wél bevatten voordat de FTP-upload begint.
PREVIEW_DEFERABLE = {"/tools/anatomie/", "/tools/anatomie/labs/hartslag/"}
IGNORED_TAGS = ("script", "style", "template", "svg", "canvas", "noscript",
                "header", "footer", "nav", "h1")


def route(value: str) -> str | None:
    parsed = urlsplit(value.strip())
    if parsed.netloc and parsed.netloc.lower() not in ("eaimodel.nl", "www.eaimodel.nl"):
        return None
    path = parsed.path or "/"
    if not path.startswith("/"):
        return None
    if path != "/" and not path.endswith("/") and not Path(path).suffix:
        path += "/"
    return path


def sitemap_urls(root: Path) -> list[str]:
    xml = ElementTree.parse(root / "sitemap.xml")
    urls = []
    for item in xml.findall(".//{*}loc"):
        path = route(item.text or "")
        if path is None:
            raise ValueError(f"Sitemap bevat ongeldige externe URL: {item.text}")
        urls.append(path)
    if not urls:
        raise ValueError("Sitemap bevat geen URLs")
    return urls


def words_for(text: str) -> list[str]:
    return re.findall(r"[\w]+", text.casefold(), flags=re.UNICODE)


def text_grams(words: list[str], size: int = 4) -> frozenset[str]:
    return frozenset(" ".join(words[i:i + size]) for i in range(len(words) - size + 1))


@dataclass(frozen=True)
class Page:
    url: str
    file: str
    title: str
    canonical: str | None
    redirect: bool
    noindex: bool
    content_hash: str | None
    grams: frozenset[str]
    word_count: int
    script_hash: str | None


def parse_page(root: Path, path: Path) -> Page:
    rel = path.relative_to(root).as_posix()
    url = "/" if rel == "index.html" else "/" + (rel.removesuffix("index.html") if path.name == "index.html" else rel)
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    title = re.sub(r"\s*(?:[|·]\s*EAI)\s*$", "", title, flags=re.I).casefold().strip()
    link = soup.find("link", rel=lambda x: x and "canonical" in x)
    canonical = route(link.get("href", "")) if link else None
    redirect = bool(soup.find("meta", attrs={"http-equiv": re.compile("^refresh$", re.I)}))
    robots = " ".join(meta.get("content", "") for meta in soup.find_all(
        "meta", attrs={"name": re.compile("^robots$", re.I)})).casefold()
    scripts = "\n".join((str(tag.get("src", "")) + tag.get_text())
                        for tag in soup.find_all("script"))
    node = soup.main or soup.body
    text = ""
    if node:
        # Kopieer alleen het fragment; de HTML in het bronbestand blijft ongemoeid.
        fragment = BeautifulSoup(str(node), "html.parser")
        for tag in fragment.find_all(IGNORED_TAGS):
            tag.decompose()
        text = " ".join(fragment.stripped_strings)
    normal = " ".join(words_for(text))
    tokens = normal.split()
    meaningful = len(tokens) >= 45 and len(normal) >= 230
    return Page(
        url=url, file=rel, title=title, canonical=canonical,
        redirect=redirect, noindex="noindex" in robots,
        content_hash=hashlib.sha256(normal.encode()).hexdigest() if meaningful else None,
        grams=text_grams(tokens) if meaningful else frozenset(),
        word_count=len(tokens),
        script_hash=hashlib.sha256(scripts.encode()).hexdigest() if scripts.strip() else None,
    )


def pair_key(a: str, b: str) -> tuple[str, str]:
    return tuple(sorted((a, b)))


def known_pairs(path: Path) -> dict[tuple[str, str], str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema") != "eai-publication-duplicates-v1":
        raise ValueError("Onbekende versie van het register voor open dubbele pagina's")
    known: dict[tuple[str, str], str] = {}
    for entry in payload.get("open", []):
        urls = entry.get("urls")
        explanation = entry.get("reason", "").strip()
        if not isinstance(urls, list) or len(urls) != 2 or any(route(x) != x for x in urls):
            raise ValueError(f"Onjuiste dubbele-paginaregistratie: {urls!r}")
        if len(explanation) < 25:
            raise ValueError(f"Toelichting ontbreekt voor {urls!r}")
        key = pair_key(*urls)
        if key in known:
            raise ValueError(f"Dubbele uitzondering in register: {key}")
        known[key] = explanation
    return known


def variant_pairs(register: Path) -> dict[tuple[str, str], str]:
    """Alleen bestaande, in het inhoudsregister benoemde aparte toepassingen."""
    if not register.is_file():
        raise ValueError(f"Publicatieregister ontbreekt: {register}")
    payload = json.loads(register.read_text(encoding="utf-8"))
    documented = {}
    for collection in payload.get("collections", []):
        members = [m.removeprefix("page:") for m in collection.get("members", [])]
        # Only the explicitly checked A/B mathematics variants are known
        # to share their text while performing separate model calculations.
        # A general collection or a changed script is not approval by itself.
        if (collection.get("id") != "wiskunde" or
                collection.get("review") != "volledigheid_broncatalogi_gecontroleerd" or
                set(members) != {"/tools/science-observatory/labs/wiskunde-a/",
                                 "/tools/science-observatory/labs/wiskunde-b/"}):
            continue
        # Toevallige inhoudsgelijkheid mag niet worden weggewimpeld: alleen
        # een als eigen uitvoering geregistreerde verzameling geeft context.
        for a, b in itertools.combinations(members, 2):
            documented[pair_key(a, b)] = (
                f"{collection.get('title_nl', collection.get('id', 'Toepassing'))}: "
                "afzonderlijke functies met gedeelde zichtbare bediening"
            )
    return documented


def entry(kind: str, urls: list[str], explanation: str) -> dict[str, object]:
    return {"type": kind, "urls": urls, "explanation": explanation}


def audit(root: Path, reviewed: dict[tuple[str, str], str],
          deferred: frozenset[str] = frozenset(),
          variants: dict[tuple[str, str], str] | None = None) -> dict:
    variants = variants or {}
    if not deferred.issubset(PREVIEW_DEFERABLE):
        raise ValueError("Onbekende uitgestelde pagina in publicatiecontrole")
    locations = sitemap_urls(root)
    counts = Counter(locations)
    blocking = []
    review = []
    notes = []
    for url, count in sorted(counts.items()):
        if count > 1:
            blocking.append(entry("dubbele_sitemap_url", [url],
                                  f"{count} keer vermeld in sitemap.xml"))
    pages = {}
    for path in sorted(root.rglob("*.html")):
        page = parse_page(root, path)
        if page.url in pages:
            blocking.append(entry("dubbele_url", [page.url],
                                  "Meerdere HTML-bestanden publiceren dezelfde route"))
        pages[page.url] = page

    for url in sorted(counts):
        if url in INDEPENDENT_ROUTES:
            continue
        if url not in pages:
            if url in deferred:
                notes.append(entry("alleen_bij_volledige_release", [url],
                                   "Niet gebouwd in snelle PR-proef. Productiecontrole slaat deze pagina niet over."))
            else:
                blocking.append(entry("ontbrekende_pagina", [url],
                                      "Staat in sitemap.xml, maar ontbreekt in de gebouwde release"))
    indexed = [p for p in pages.values() if p.url in counts and not p.redirect and not p.noindex]
    active = {p.url for p in indexed}
    canonical_owners = defaultdict(list)
    for p in indexed:
        if p.canonical:
            canonical_owners[p.canonical].append(p.url)
            if p.canonical != p.url:
                blocking.append(entry("canoniek_wijst_naar_andere_pagina", [p.url, p.canonical],
                                      "De pagina staat in de sitemap zonder redirect maar verwijst canoniek elders naartoe"))
    for target, owners in sorted(canonical_owners.items()):
        if len(owners) > 1:
            blocking.append(entry("dubbele_canonieke_eigenaar", sorted(owners),
                                  f"Meerdere pagina's wijzen naar dezelfde canonieke URL: {target}"))

    # Exacte inhoud is ook met een andere titel een dubbeling. Alleen de
    # werkelijke, gebouwde HTML-pagina's tellen mee, geen content/ bronkopieën.
    exact_groups = defaultdict(list)
    for p in pages.values():
        if p.content_hash and not p.redirect:
            exact_groups[p.content_hash].append(p)
    reported_pairs = set()
    for group in exact_groups.values():
        if len(group) < 2:
            continue
        direct_copies = set()
        for a, b in itertools.combinations(sorted(group, key=lambda p: p.url), 2):
            key = pair_key(a.url, b.url)
            reported_pairs.add(key)
            if a.url in active and b.url in active:
                if key in variants and a.script_hash and b.script_hash and a.script_hash != b.script_hash:
                    notes.append(entry("afzonderlijke_toepassingsvarianten", list(key),
                                       variants[key] + "; de functionele scripts verschillen aantoonbaar"))
                elif key in reviewed:
                    review.append(entry("bekende_dubbeling_nog_open", list(key),
                                        "Dezelfde zichtbare pagina-inhoud. " + reviewed[key]))
                else:
                    blocking.append(entry("exact_dezelfde_pagina", list(key),
                                          "De inhoud van beide gepubliceerde pagina's is gelijk"))
            else:
                direct_copies.update(key)
        if direct_copies:
            review.append(entry("dubbele_directe_route", sorted(direct_copies),
                                "Dezelfde inhoud staat op meerdere direct bereikbare URLs, minstens één buiten de sitemap"))

    # Bijna gelijke pagina's, zoals de twee bestaande EAI-homepages, moeten
    # zichtbaar zijn. Alleen werkelijk nieuwe, onbeoordeelde dubbelen blokkeren.
    by_title = defaultdict(list)
    for p in indexed:
        if p.title and len(p.grams) >= 35:
            by_title[p.title].append(p)
    for group in by_title.values():
        for a, b in itertools.combinations(sorted(group, key=lambda p: p.url), 2):
            key = pair_key(a.url, b.url)
            if key in reported_pairs:
                continue
            shorter, longer = sorted((len(a.grams), len(b.grams)))
            if shorter < 35 or shorter / longer < .72:
                continue
            overlap = len(a.grams & b.grams)
            similarity = overlap / len(a.grams | b.grams)
            if similarity < .94:
                continue
            explanation = f"Dezelfde paginatitel, zeer vergelijkbare inhoud ({similarity:.0%})"
            if key in reviewed:
                review.append(entry("bekende_dubbeling_nog_open", list(key),
                                    explanation + ". " + reviewed[key]))
            else:
                blocking.append(entry("nieuwe_vermoedelijke_dubbeling", list(key), explanation))

    missing_review = sorted(set(reviewed) - {
        pair_key(*item["urls"]) for item in review if item["type"] == "bekende_dubbeling_nog_open"
    })
    for old in missing_review:
        notes.append(entry("registratie_opnieuw_bekijken", list(old),
                           "Deze bekende dubbeling werd niet meer gevonden; controleer of de registratie kan vervallen"))

    redirects = [p.url for p in pages.values() if p.redirect]
    return {
        "status": "blokkeren" if blocking else (
            "aandacht" if review or any(x["type"] != "afzonderlijke_toepassingsvarianten" for x in notes)
            else "geen_afwijkingen"),
        "counts": {
            "html_routes": len(pages),
            "sitemap_routes": len(counts),
            "redirects": len(redirects),
            "apart_gepubliceerd": len(set(counts) & INDEPENDENT_ROUTES),
            "pas_in_volledige_release": len(deferred & (set(counts) - set(pages))),
            "blokkades": len(blocking),
            "nader_beoordelen": len(review),
        },
        "blocking": sorted(blocking, key=lambda d: (d["type"], d["urls"])),
        "review": sorted(review, key=lambda d: (d["type"], d["urls"])),
        "notes": notes,
        "not_checked": [
            "Dit is de inhoud van de nieuwe site-build, niet een volledige inventaris van oude bestanden op de FTP-server.",
            "TOPO wordt afzonderlijk gepubliceerd en valt buiten deze releasecontrole.",
            *([f"De snelle PR-proef heeft {len(deferred)} uitgestelde anatomiepagina's; de productierelease controleert ook deze routes."] if deferred else []),
        ],
    }


def summary_md(result: dict) -> str:
    c = result["counts"]
    lines = [
        "## Controle dubbele pagina's bij publicatie",
        "",
        f"**Uitkomst: {result['status'].replace('_', ' ')}.**",
        "",
        f"Gebouwde HTML-routes: **{c['html_routes']}**. Sitemap: **{c['sitemap_routes']}**. "
        f"Doorverwijzingen: **{c['redirects']}**. "
        f"Blokkades: **{c['blokkades']}**. Nog te beoordelen: **{c['nader_beoordelen']}**.",
        "",
        "| Beoordeling | URL's | Toelichting |",
        "|---|---|---|",
    ]
    items = ([("Blokkade", i) for i in result["blocking"]]
             + [("Nog te beoordelen", i) for i in result["review"]]
             + [("Bewuste varianten" if i["type"] == "afzonderlijke_toepassingsvarianten"
                  else "Niet volledig gecontroleerd" if i["type"] == "alleen_bij_volledige_release"
                  else "Register controleren", i) for i in result["notes"]])
    if not items:
        lines.append("| Geen verdubbeling aangetroffen | - | Binnen de onderzochte release |")
    for label, i in items[:45]:
        paths = ", ".join(str(x) for x in i["urls"])
        explanation = str(i["explanation"]).replace("|", r"\|").replace("\n", " ")
        lines.append(f"| {label} | {paths} | {explanation} |")
    if len(items) > 45:
        lines.append(f"\nVerder nog {len(items) - 45} vermeldingen in het JSON-rapport.")
    lines.extend(["", "Niet gecontroleerd: reeds achtergebleven bestanden op de hostingserver "
                  "en afzonderlijke publicaties zoals TOPO.", ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("site-build"))
    parser.add_argument("--known", type=Path,
                        default=Path("catalog/publication-page-overlaps.json"))
    parser.add_argument("--register", type=Path,
                        default=Path("catalog/website-register.json"))
    parser.add_argument("--deferred", action="append", default=[],
                        help="Alleen in snelle PR-proef voor uitgestelde anatomiepagina's")
    parser.add_argument("--json", type=Path)
    parser.add_argument("--summary", type=Path)
    args = parser.parse_args()
    try:
        result = audit(args.root, known_pairs(args.known), frozenset(args.deferred),
                       variant_pairs(args.register))
    except (OSError, ValueError, ElementTree.ParseError) as e:
        print("Controle dubbele pagina's kon niet worden afgerond:", e, file=sys.stderr)
        return 1
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
    summary = summary_md(result)
    print(summary)
    if args.summary:
        with args.summary.open("a", encoding="utf-8") as stream:
            stream.write(summary + "\n")
    return 1 if result["blocking"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
