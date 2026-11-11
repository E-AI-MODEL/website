#!/usr/bin/env python3
"""Controleer alle modelonderdelen en Nederlandse naamdekking.
Gebruik: python scripts/audit_anatomie_content.py --out audit-anatomie
Bevindingen zijn aanwijzingen voor controle, nooit automatische correcties.
"""
from __future__ import annotations
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SIDE = re.compile(r"\.[lr]$")
PLACEHOLDERS = {"?", "?x", "????????"}
UNCLEAR_SOURCE_KEYS = {
    "????????", "?x", "central canal'", "lat_fis-ant-horizont",
    "lat_fis-ant-vertical", "lat_fis-post", "sulcus interm_prim-jensen",
}
TYPO_TOKENS = ("metarcapi", "quatum", "articulareae", "articulariae",
               "metacarpophalnageae", "interphalangelorum", "glenohumerae", "latérales")


def canonical(part: str) -> str:
    return SIDE.sub("", part).strip()


def load_sources(root: Path):
    source = root / "tools/anatomie/data"
    systems = json.loads((source / "systems.json").read_text(encoding="utf-8"))
    lexicon = json.loads((source / "lexicon.json").read_text(encoding="utf-8"))
    definitions = json.loads((source / "definitions.json").read_text(encoding="utf-8"))
    names = json.loads((root / "content/anatomie/synonyms.nl.json").read_text(encoding="utf-8"))
    guide = (root / "content/anatomie/guide.js").read_text(encoding="utf-8")
    return systems, lexicon, definitions, names, guide


def audit(root: Path = ROOT):
    systems, lexicon, definitions, names, guide_source = load_sources(root)
    guide_keys = set(re.findall(r"""^\s{2}['"]([^'"]+)['"]:\s*\{""", guide_source, re.M))
    if not isinstance(systems, dict) or not all(isinstance(v, list) for v in systems.values()):
        raise ValueError("Ongeldig systems.json")
    if not isinstance(names, dict) or not all(
        isinstance(v, list) and v and all(isinstance(n, str) and n.strip() for n in v)
        for v in names.values()
    ):
        raise ValueError("Ongeldige Nederlandse naamkoppeling")
    rows = []
    models = Counter()
    unique = set()
    for system, parts in systems.items():
        for part in parts:
            if not isinstance(part, str) or not part.strip():
                raise ValueError("Leeg of ongeldig model-ID")
            base = canonical(part)
            data = lexicon.get(base, {})
            latin = data.get("la", "") if isinstance(data, dict) else ""
            dutch = names.get(base.lower(), [])
            flags = []
            if base.lower() in PLACEHOLDERS or latin.strip().lower() in PLACEHOLDERS:
                flags.append("placeholder")
            if base.lower() in UNCLEAR_SOURCE_KEYS:
                flags.append("bron_naam_onduidelijk")
            if any(t in latin.lower() for t in TYPO_TOKENS):
                flags.append("latijn_nakijken")
            if base == "Articular capsules of metatarsophalangeal joints" and "glenohum" in latin.lower():
                flags.append("verkeerde_koppeling")
            if part != part.strip():
                flags.append("spaties")
            if dutch and "bronlabel nazien" in dutch[0].lower():
                flags.append("vertaling_bronlabel_nakijken")
            level = ("specifieke_uitleg" if base.lower() in guide_keys else
                     "algemene_type_uitleg" if dutch else "bron_onduidelijk")
            rows.append({
                "stelsel": system, "model_id": part, "structuur": base,
                "nederlandse_naam": dutch[0] if dutch else "", "latijn": latin,
                "bronbeschrijving": "ja" if base in definitions else "nee",
                "nederlandse_uitleg": "ja" if base.lower() in guide_keys else "nee",
                "uitlegniveau": level,
                "controle": "|".join(flags),
            })
            models[system] += 1
            unique.add(base)
    flagged = [r for r in rows if r["controle"]]
    keys = {n.lower() for n in unique}
    all_by_system = {
        system: {canonical(part).lower() for part in parts}
        for system, parts in systems.items()
    }
    names_by_system = {
        system: {
            "structuren": len(keys),
            "nederlandse_namen": len(keys & names.keys()),
            "zonder_nederlandse_naam": len(keys - names.keys()),
        }
        for system, keys in all_by_system.items()
    }
    # Gelijktijdige namen kunnen bewust naar verschillende onderdelen verwijzen.
    dutch_lookup = {}
    for key, aliases in names.items():
        dutch_lookup.setdefault(aliases[0].strip().casefold(), []).append(key)
    duplicate_labels = {
        label: sorted(keys)
        for label, keys in dutch_lookup.items() if len(keys) > 1
    }
    summary = {
        "modelonderdelen": len(rows),
        "unieke_structuren": len(unique),
        "stelsels": dict(models),
        "naamdekking_per_stelsel": names_by_system,
        "onduidelijke_bronnamen": sorted(UNCLEAR_SOURCE_KEYS),
        "gelijke_nederlandse_labels": duplicate_labels,
        "nederlandse_namen_uniek": sum(k in names for k in keys),
        "nederlandse_uitleg_uniek": sum(k in guide_keys for k in keys),
        "bronbeschrijving_uniek": sum(k in definitions for k in unique),
        "latijn_uniek": sum(bool(lexicon.get(k, {}).get("la")) for k in unique),
        "uitlegniveau_uniek": {
            "specifieke_uitleg": sum(k.lower() in guide_keys for k in unique),
            "algemene_type_uitleg": sum(
                k.lower() in names and k.lower() not in guide_keys for k in unique
            ),
            "bron_onduidelijk": sum(k.lower() not in names for k in unique),
        },
        "meldingen_modelonderdelen": len(flagged),
        "meldingen_per_soort": dict(Counter(t for r in flagged for t in r["controle"].split("|"))),
        "niet_gekoppelde_nederlandse_sleutels": sorted(k for k in names if k not in keys),
        "niet_gekoppelde_gids_sleutels": sorted(k for k in guide_keys if k not in keys),
    }
    return rows, summary


def write_report(rows, summary, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    with (out / "anatomie-audit.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
    (out / "anatomie-audit.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    lines = [
        "# Anatomie: inhoud en modelkoppelingen", "",
        f"- Modelonderdelen: **{summary['modelonderdelen']}**",
        f"- Unieke structuren: **{summary['unieke_structuren']}**",
        f"- Directe Nederlandse namen: **{summary['nederlandse_namen_uniek']}**",
        f"- Nederlandse uitleg: **{summary['nederlandse_uitleg_uniek']}**",
        f"- Engelse bronbeschrijving: **{summary['bronbeschrijving_uniek']}**",
        f"- Afzonderlijke Nederlandse uitleg: **{summary['uitlegniveau_uniek']['specifieke_uitleg']}**",
        f"- Algemene uitleg naar type: **{summary['uitlegniveau_uniek']['algemene_type_uitleg']}**",
        f"- Bronnaam onduidelijk: **{summary['uitlegniveau_uniek']['bron_onduidelijk']}**", "",
        "| Stelsel | Modelonderdelen |", "|---|---:|",
    ]
    lines.extend(f"| {k} | {v} |" for k, v in summary["stelsels"].items())
    lines.extend(["", "## Nederlandse namen per stelsel", "",
                  "| Stelsel | Unieke structuren | Nederlandse namen | Ontbrekend |",
                  "|---|---:|---:|---:|"])
    lines.extend(
        f"| {system} | {stats['structuren']} | {stats['nederlandse_namen']} | {stats['zonder_nederlandse_naam']} |"
        for system, stats in summary["naamdekking_per_stelsel"].items()
    )
    lines.extend(["", f"Identieke Nederlandse labels bij verschillende sleutels: {len(summary['gelijke_nederlandse_labels'])}.",
                  "Bekijk deze in JSON. Dat is een controlemelding, geen bewijs van een fout."])
    lines.extend(["", "## Meldingen", ""])
    lines.extend(f"- {k}: {v}" for k, v in summary["meldingen_per_soort"].items())
    lines.extend([
        "", "De telling gebruikt uitsluitend exacte naamkoppelingen.",
        "De audit bewijst niet dat een vertaling of uitleg anatomisch juist is.",
        "Zie CSV voor de betrokken model-ID's.", "",
    ])
    (out / "anatomie-audit.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=Path("audit-anatomie"))
    args = parser.parse_args()
    rows, summary = audit()
    write_report(rows, summary, args.out)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
