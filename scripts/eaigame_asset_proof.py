#!/usr/bin/env python3
"""Download a small, inspectable EAIgame asset proof set.

No raw vendor ZIPs are committed or uploaded. A temporary folder is used for
source archives; only selected models, their required sidecars and provenance
are included in the GitHub Actions artifact.
"""
from __future__ import annotations

import hashlib
import io
import json
import posixpath
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DEST = Path("build/eaigame-asset-proof")
MAX_DOWNLOAD = 70 * 1024 * 1024
MAX_ARCHIVE_TOTAL = 200 * 1024 * 1024
SOURCES = [
    ("kenney-nature", "https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip",
     [["tree", 2], ["rock", 2], ["bush", 1]]),
    ("kenney-town", "https://kenney.nl/media/pages/assets/fantasy-town-kit/efe948d309-1754222374/kenney_fantasy-town-kit_2.0.zip",
     [["house", 2], ["tower", 1], ["wall", 1], ["market", 1]]),
]
MEDIEVAL_REPO = "KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0"
MEDIEVAL_SHA = "84fa4e91af6a88989be7c99e0891cede11f2ca38"
MEDIEVAL_BASE = "addons/kaykit_medieval_hexagon_pack/Assets/gltf/"
MEDIEVAL_MODELS = [
    "buildings/green/building_watermill_green.gltf",
    "buildings/neutral/building_bridge_A.gltf",
    "buildings/neutral/building_scaffolding.gltf",
    "decoration/props/barrel.gltf",
    "decoration/nature/rock_single_A.gltf",
]
CHAR_REPO = "KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0"
CHAR_SHA = "672074b73ba276876a19e8816ecdc5241817ab47"
CHAR_MODEL = "addons/kaykit_character_pack_adventures/Characters/gltf/Rogue_Hooded.glb"
records = []
warnings = []
archives = []

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def get(url: str, max_bytes: int = MAX_DOWNLOAD) -> bytes:
    request = urllib.request.Request(url, headers={
        "User-Agent": "EAIgame-asset-review/0.1 (source licensing and evaluation)",
        "Accept": "application/octet-stream,application/zip,*/*",
    })
    with urllib.request.urlopen(request, timeout=35) as response:
        length = response.headers.get("content-length")
        if length and int(length) > max_bytes:
            raise ValueError(f"Source exceeds download limit: {url}")
        chunks = []
        size = 0
        while True:
            part = response.read(256 * 1024)
            if not part:
                break
            size += len(part)
            if size > max_bytes:
                raise ValueError(f"Source exceeds download limit: {url}")
            chunks.append(part)
    return b"".join(chunks)

def save(model_id: str, label: str, data: bytes, source_url: str, notes: str = "") -> None:
    target = DEST / "models" / model_id / label
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    records.append({
        "modelId": model_id,
        "path": str(target.relative_to(DEST)),
        "sha256": sha256(data),
        "bytes": len(data),
        "source": source_url,
        "notes": notes,
    })

def gltf_sidecars(model_id: str, gltf_bytes: bytes, source: str, read_dep) -> None:
    gltf = json.loads(gltf_bytes)
    external = []
    for group in ("buffers", "images"):
        for item in gltf.get(group, []):
            uri = item.get("uri", "")
            if not uri or uri.startswith("data:"):
                continue
            if urllib.parse.urlparse(uri).scheme or uri.startswith("/"):
                raise ValueError(f"Unsafe external GLTF dependency: {uri}")
            name = posixpath.basename(urllib.parse.unquote(uri))
            if not name:
                raise ValueError("Missing sidecar filename")
            dependency = read_dep(uri)
            save(model_id, name, dependency, source, "GLTF sidecar")
            item["uri"] = name
            external.append(name)
    save(model_id, "model.gltf", json.dumps(gltf, separators=(",", ":")).encode(), source,
         f"GLTF with {len(external)} external dependencies: {', '.join(external)}")

def extract_kenney(source_id: str, download_url: str, groups: list) -> None:
    print("Downloading", source_id)
    raw = get(download_url)
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise ValueError("Publisher download is not a ZIP archive")
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        files = {x.filename: x for x in z.infolist() if not x.is_dir()}
        if sum(x.file_size for x in files.values()) > MAX_ARCHIVE_TOTAL:
            raise ValueError("Archive uncompressed contents too large")
        candidates = [name for name in files if name.lower().endswith((".glb", ".gltf"))]
        model_groups = {}
        for tag, needed in groups:
            found = [
                name for name in candidates
                if tag in posixpath.basename(name).lower()
            ]
            found.sort(key=lambda s: (
                0 if s.lower().endswith(".glb") else 1,
                len(s), s.lower()
            ))
            used_stems = {
                posixpath.splitext(posixpath.basename(x))[0].lower()
                for x in model_groups.values()
            }
            selected = []
            for name in found:
                stem = posixpath.splitext(posixpath.basename(name))[0].lower()
                if stem not in used_stems:
                    selected.append(name)
                    used_stems.add(stem)
                if len(selected) >= needed:
                    break
            if len(selected) < needed:
                warnings.append(f"{source_id}: selected {len(selected)}/{needed} for '{tag}'")
            for n, name in enumerate(selected):
                model_groups[f"{tag}-{n+1}"] = name

        for key, name in model_groups.items():
            model_id = f"{source_id}-{key}"
            raw_model = z.read(name)
            if name.lower().endswith(".glb"):
                if raw_model[:4] != b"glTF":
                    raise ValueError(f"Invalid GLB header: {name}")
                save(model_id, "model.glb", raw_model, download_url,
                     f"Selected from {name}")
            else:
                parent = posixpath.dirname(name)
                def get_zip_dep(uri: str) -> bytes:
                    path = posixpath.normpath(posixpath.join(parent, urllib.parse.unquote(uri)))
                    if path.startswith("../") or path not in files:
                        raise ValueError(f"GLTF dependency not in pack: {path}")
                    return z.read(path)
                gltf_sidecars(model_id, raw_model, download_url, get_zip_dep)

        licenses = [
            k for k in files
            if posixpath.basename(k).lower() in ("license.txt", "licence.txt")
        ]
        for license_name in licenses[:1]:
            save(f"{source_id}-license", "LICENSE.txt", z.read(license_name), download_url,
                 "Publisher license included in source ZIP")
        archives.append({
            "sourceId": source_id, "publisher": "Kenney", "licenseClaimed": "CC0",
            "publisherPage": f"https://kenney.nl/assets/{'nature-kit' if source_id == 'kenney-nature' else 'fantasy-town-kit'}",
            "downloadUrl": download_url, "sourceArchiveSha256": sha256(raw),
            "sourceArchiveBytes": len(raw), "selectedModels": len(model_groups),
            "availableModelFiles": len(candidates), "licenseFileIncluded": bool(licenses),
        })
        print(f"{source_id}: {len(model_groups)} models, {len(candidates)} candidate files, source {len(raw)} bytes")

def raw_github(repo: str, sha: str, path: str) -> str:
    return f"https://raw.githubusercontent.com/{repo}/{sha}/{path}"

def extract_kaykit() -> None:
    for rel in MEDIEVAL_MODELS:
        full_path = MEDIEVAL_BASE + rel
        url = raw_github(MEDIEVAL_REPO, MEDIEVAL_SHA, full_path)
        data = get(url)
        model_id = "kaykit-medieval-" + Path(rel).stem
        parent = posixpath.dirname(full_path)
        def read_dep(uri: str) -> bytes:
            path = posixpath.normpath(posixpath.join(parent, urllib.parse.unquote(uri)))
            if path.startswith("../") or not path.startswith("addons/"):
                raise ValueError(f"Unsafe asset path: {path}")
            return get(raw_github(MEDIEVAL_REPO, MEDIEVAL_SHA, path))
        gltf_sidecars(model_id, data, url, read_dep)
    license_url = raw_github(MEDIEVAL_REPO, MEDIEVAL_SHA, "LICENSE.txt")
    save("kaykit-medieval-license", "LICENSE.txt", get(license_url), license_url,
         "Exact repo revision used for model files")
    archives.append({
        "sourceId": "kaykit-medieval", "publisher": "Kay Lousberg",
        "licenseClaimed": "CC0", "repository": MEDIEVAL_REPO, "commit": MEDIEVAL_SHA,
        "selectedModels": len(MEDIEVAL_MODELS), "licenseFileIncluded": True,
        "note": "Older public GitHub 1.0 revision. Do not label as current itch.io 2.0.",
    })
    print("KayKit Medieval selected", len(MEDIEVAL_MODELS), "models")

def extract_character() -> None:
    url = raw_github(CHAR_REPO, CHAR_SHA, CHAR_MODEL)
    blob = get(url)
    if blob[:4] != b"glTF":
        raise ValueError("Character download is not a GLB")
    save("kaykit-player-hooded", "model.glb", blob, url,
         "Legacy 1.0 repository; not the newer 2.0 Itch release")
    license_url = raw_github(CHAR_REPO, CHAR_SHA, "LICENSE.txt")
    save("kaykit-character-license", "LICENSE.txt", get(license_url), license_url)
    archives.append({
        "sourceId": "kaykit-player", "publisher": "Kay Lousberg",
        "licenseClaimed": "CC0", "repository": CHAR_REPO,
        "commit": CHAR_SHA, "selectedModels": 1, "licenseFileIncluded": True,
    })
    print("KayKit Character GLB", len(blob), "bytes")

def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for source_id, download_url, groups in SOURCES:
        try:
            extract_kenney(source_id, download_url, groups)
        except Exception as exc:
            warnings.append(f"{source_id}: download/extraction unavailable: {type(exc).__name__}: {exc}")
            print(warnings[-1])
    try:
        extract_kaykit()
    except Exception as exc:
        warnings.append(f"kaykit-medieval: {type(exc).__name__}: {exc}")
        print(warnings[-1])
    try:
        extract_character()
    except Exception as exc:
        warnings.append(f"kaykit-player: {type(exc).__name__}: {exc}")
        print(warnings[-1])
    manifest = {
        "purpose": "EAIgame De Storm: inspectable asset proof; NOT production-ready",
        "createdUtc": datetime.now(timezone.utc).isoformat(),
        "downloadStrategy": "Transient publisher download -> curated model dependencies -> workflow artifact; no raw packs committed",
        "sources": archives,
        "files": records,
        "warnings": warnings,
        "evaluation": {
            "technicalLoadTest": "not run",
            "visualStyleReview": "not performed",
            "mobilePerformance": "not tested",
            "licensePerFile": "source license preserved; final deployment review outstanding",
        },
    }
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (DEST / "README.md").write_text(
        "# EAIgame modelproef\n\n"
        "Een proefselectie, geen af spel en geen bewezen stijlmatch.\n"
        "Open manifest.json voor bron, SHA256, bestandsgrootte en resterende controles.\n"
        "De oorspronkelijke vendor-ZIP's zijn niet inbegrepen.\n"
    )
    print(json.dumps({
        "selectedSources": [x["sourceId"] for x in archives],
        "storedFiles": len(records),
        "totalSelectedBytes": sum(x["bytes"] for x in records),
        "warnings": warnings,
    }, indent=2))
    if not any(x["path"].endswith((".gltf", ".glb")) for x in records):
        raise SystemExit("No usable 3D model was downloaded; check source access")

if __name__ == "__main__":
    main()
