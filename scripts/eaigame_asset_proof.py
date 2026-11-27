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
KENNEY_MIRROR_REPO = "shorepine/kenney"
KENNEY_MIRROR_SHA = "3694c6879e487c108f55677be7dd2ca75b07cc3b"
KENNEY_SELECTED = {
    "nature-kit": [
        "tree_oak.glb", "tree_detailed.glb", "rock_largeA.glb",
        "rock_smallA.glb", "grass_large.glb", "bridge_wood.glb",
        "cliff_stone.glb", "ground_pathStraight.glb",
    ],
    "fantasy-town": [
        "wall-broken.glb", "wall-door.glb", "roof-gable.glb",
        "planks.glb", "lantern.glb",
    ],
}
KENNEY_PUBLISHER_PAGES = {
    "nature-kit": "https://kenney.nl/assets/nature-kit",
    "fantasy-town": "https://kenney.nl/assets/fantasy-town-kit",
}

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

def glb_external_resources(blob: bytes) -> list[str]:
    if len(blob) < 20 or blob[:4] != b"glTF":
        raise ValueError("Invalid GLB header")
    import struct
    version, total_size = struct.unpack_from("<II", blob, 4)
    if version != 2 or total_size != len(blob):
        raise ValueError("Unsupported or truncated GLB")
    json_size, chunk_type = struct.unpack_from("<II", blob, 12)
    if chunk_type != 0x4E4F534A or 20 + json_size > len(blob):
        raise ValueError("Invalid GLB JSON chunk")
    metadata = json.loads(blob[20:20+json_size])
    required = []
    for key in ("buffers", "images"):
        for entry in metadata.get(key, []):
            uri = entry.get("uri", "")
            if not uri or uri.startswith("data:"):
                continue
            if (urllib.parse.urlparse(uri).scheme or uri.startswith("/") or
                    ".." in posixpath.normpath(uri).split("/")):
                raise ValueError(f"Invalid external resource URI: {uri}")
            required.append(uri)
    return sorted(set(required))


def extract_kenney_mirror() -> None:
    for pack, models in KENNEY_SELECTED.items():
        count = 0
        for name in models:
            model_id = f"kenney-{pack}-{Path(name).stem}"
            rel = f"3d/{'nature' if pack == 'nature-kit' else 'fantasy-town'}/{name}"
            url = raw_github(KENNEY_MIRROR_REPO, KENNEY_MIRROR_SHA, rel)
            try:
                blob = get(url)
                dependencies = glb_external_resources(blob)
                for uri in dependencies:
                    parent = posixpath.dirname(rel)
                    dependency_path = posixpath.normpath(posixpath.join(parent, uri))
                    if not dependency_path.startswith("3d/"):
                        raise ValueError("External GLB resource outside asset directory")
                    dep_url = raw_github(KENNEY_MIRROR_REPO, KENNEY_MIRROR_SHA,
                                         dependency_path)
                    dep = get(dep_url)
                    save(model_id, uri, dep, dep_url, "Required external GLB texture")
                save(model_id, "model.glb", blob, url,
                     f"Re-export mirror of publisher pack {pack}. Asset: {name}")
                count += 1
            except Exception as exc:
                warnings.append(f"{pack}/{name}: {type(exc).__name__}: {exc}")
        archives.append({
            "sourceId": f"kenney-{pack}", "publisher": "Kenney",
            "publisherPage": KENNEY_PUBLISHER_PAGES[pack],
            "repositoryMirror": KENNEY_MIRROR_REPO,
            "mirrorCommit": KENNEY_MIRROR_SHA,
            "licenseClaimed": "CC0", "selectedModels": count,
            "plannedModels": len(models),
            "note": "GitHub mirror supplies re-exported GLBs. Publisher ZIP inaccessible; "
                    "not source-identical to upstream ZIP. Must inspect final models visually.",
        })
        print(f"Kenney {pack}: {count}/{len(models)} verified GLB downloads")

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
    try:
        extract_kenney_mirror()
    except Exception as exc:
        warnings.append(f"kenney-mirror: {type(exc).__name__}: {exc}")
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
