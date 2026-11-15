#!/usr/bin/env python3
"""Gebruik bij niet-anatomische PR's de echte, op main gepubliceerde 3D-atlas.

Dit is geen mock of verkleind model. De versie en volledige bestanden zijn al
door de productiebuild vastgesteld. Op main en bij relevante bronwijzigingen
moet de atlas altijd opnieuw uit de gepinde bron worden gebouwd.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from build_anatomie import SOURCE_COMMIT, SYSTEMS


def reuse(source: Path, destination: Path) -> None:
    if not source.is_dir() or source.resolve() == destination.resolve():
        raise ValueError("Ongeldige bron of bestemming voor anatomie")
    required = (
        "index.html", "LICENSE.txt", "NOTICE.txt", "UPSTREAM_COMMIT.txt",
        "labs/hartslag/atlas-heart-rich.json", "labs/hartslag/atlas-heart-rich.bin",
        "labs/hartslag/atlas-heart.json", "labs/hartslag/atlas-heart.bin",
        "labs/hartslag/heart.js", "labs/hartslag/index.html",
    )
    for relative in required:
        if not (source / relative).is_file():
            raise FileNotFoundError(f"Gepubliceerde 3D-atlas onvolledig: {relative}")
    version = (source / "UPSTREAM_COMMIT.txt").read_text(encoding="utf-8")
    if f"Commit: {SOURCE_COMMIT}" not in version:
        raise RuntimeError("De opgeslagen atlas is niet van de gepinde broncommit")
    models = source / "models"
    for system in SYSTEMS:
        file = models / f"{system}.glb"
        if not file.is_file() or file.stat().st_size < 10000:
            raise RuntimeError(f"3D-model ontbreekt of is onvolledig: {system}")
        with file.open("rb") as stream:
            if stream.read(4) != b"glTF":
                raise RuntimeError(f"3D-model heeft ongeldige glTF-kop: {system}")
    rich = source / "labs/hartslag/atlas-heart-rich.bin"
    data = json.loads((source / "labs/hartslag/atlas-heart-rich.json").read_text(encoding="utf-8"))
    if rich.stat().st_size < 100000 or len(data.get("parts", [])) != 34 or data.get("bytes") != rich.stat().st_size:
        raise RuntimeError("De volledige 34-delige hartatlas is niet aanwezig")
    if any(f.is_symlink() for f in source.rglob("*")):
        raise RuntimeError("De anatomiebouw mag geen symbolische links overnemen")
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination)
    print(f"Gecontroleerde 3D-atlas hergebruikt: {len(SYSTEMS)} stelsels, 34 hartonderdelen")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("tools/anatomie"))
    parser.add_argument("--out", type=Path, default=Path("site-build/tools/anatomie"))
    args = parser.parse_args()
    reuse(args.source, args.out)
