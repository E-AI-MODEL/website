"""Lees gemeten tactische handbalbezitten uit Montoliu e.a. (2024).

Geen extrapolatie van professionele wedstrijden naar schoolsituaties.
Run: python tools/lo-aanvalslab/calibratie/tactics/analyze_open_tactics.py
Optioneel: --zip /pad/naar/HandballDataset.zip
"""
import argparse
import collections
import csv
import io
import json
import urllib.request
import zipfile
from pathlib import Path

SOURCE = "https://zenodo.org/records/12065335/files/HandballDataset.zip?download=1"
DOI = "https://doi.org/10.5281/zenodo.12065335"


def as_bool(value):
    return str(value).strip().lower() in ("true", "1", "yes")


def analyze_zip(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = [n for n in archive.namelist()
                 if n.lower().endswith("/possessions.csv") or n.lower() == "possessions.csv"]
        if len(names) != 1:
            raise ValueError(f"Verwacht een possessions.csv, gevonden: {names!r}")
        with archive.open(names[0]) as file:
            reader = csv.DictReader(io.TextIOWrapper(file, encoding="utf-8-sig", newline=""))
            columns = reader.fieldnames or []
            if "game_phases" not in columns or "tactical_situation" not in columns:
                raise ValueError(f"Ontbrekende fase-/situatiekolommen: {columns!r}")
            outcome = "possesion_result" if "possesion_result" in columns else "possession_result"
            if outcome not in columns:
                raise ValueError(f"Geen uitkomstkolom: {columns!r}")
            groups = collections.defaultdict(lambda: {"n": 0, "success": 0, "games": set()})
            attack_context = collections.defaultdict(lambda: {"n": 0, "success": 0})
            ignored = collections.Counter()
            total = 0
            for row in reader:
                total += 1
                phase = (row.get("game_phases") or "").strip().upper()
                situation = (row.get("tactical_situation") or "").strip().lower()
                if phase not in {"AT", "DEF"} or situation not in {
                    "equal", "superiority", "inferiority"
                }:
                    ignored[f"{phase}/{situation}"] += 1
                    continue
                item = groups[(phase, situation)]
                item["n"] += 1
                item["success"] += int(as_bool(row.get(outcome)))
                item["games"].add(row.get("game") or "unknown")
                if phase == "AT":
                    # Context van hetzelfde balbezit: een tegenaanval of een
                    # georganiseerde aanval is niet hetzelfde tactische probleem.
                    # Alleen de letterlijke bronlabels worden meegenomen.
                    context = (row.get("offense_type") or "onbekend").strip().lower()
                    organized = (row.get("organized_game") or "onbekend").strip().lower()
                    subs = attack_context[(situation, context, organized)]
                    subs["n"] += 1
                    subs["success"] += int(as_bool(row.get(outcome)))
        values = [
            {"fase": "aanval" if phase == "AT" else "verdediging",
             "situatie": situation,
             "bezitten": item["n"],
             "succes": item["success"],
             "succespercentage_bron": round(100 * item["success"] / item["n"], 1),
             "wedstrijden": len(item["games"])}
            for (phase, situation), item in sorted(groups.items())
        ]
        return {
            "source": DOI,
            "totaal_rijen": total,
            "gebruikt": sum(row["bezitten"] for row in values),
            "overgeslagen": dict(ignored),
            "groepen": values,
            "aanval_per_broncontext": [
                {"situatie": situation, "aanvalstype": context,
                 "georganiseerd_label": organized, "bezitten": item["n"],
                 "doelpunten": item["success"],
                 "percentage_alleen_bij_tien_of_meer": round(100*item["success"]/item["n"],1)
                    if item["n"]>=10 else None}
                for (situation, context, organized),item in sorted(attack_context.items())
            ],
            "bewijslimiet": "Beschrijvende wedstrijddata. Geen causale conclusie, geen kans voor een schoolsimulatie."
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, help="Geverifieerd lokaal bronarchief")
    args = parser.parse_args()
    if args.zip:
        data = args.zip.read_bytes()
    else:
        req = urllib.request.Request(SOURCE, headers={"User-Agent": "EAI-tactics-analysis/1.0"})
        with urllib.request.urlopen(req, timeout=60) as response:
            data = response.read(30 * 1024 * 1024 + 1)
        if len(data) > 30 * 1024 * 1024:
            raise ValueError("Bronarchief groter dan 30 MB")
    print(json.dumps(analyze_zip(data), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
