"""Audit shipped geometry, font glyph coverage and PNG resources without Unity.

Run: python Tests/audit_presentation.py (requires fonttools).
This checks source assets, not Unity's shader compilation or rendered output.
"""
import json
import math
from pathlib import Path
import re
import struct

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1] / "Assets" / "RelayZero"


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def main():
    models = triangles = 0
    for path in sorted((ROOT / "Resources" / "Data").glob("*.json")):
        data = json.loads(path.read_text())
        if "parts" not in data:
            continue
        models += 1
        for part in data["parts"]:
            vertices, normals, indices = part["vertices"], part["normals"], part["triangles"]
            context = f"{path.stem}: {part['name']}"
            assert len(vertices) % 3 == 0 and len(indices) % 3 == 0, context
            assert len(normals) == len(vertices), context
            assert all(math.isfinite(x) for x in vertices + normals), context
            assert 0 <= part["material"] < len(data["materials"]), context
            v = [vertices[i:i+3] for i in range(0, len(vertices), 3)]
            n = [normals[i:i+3] for i in range(0, len(normals), 3)]
            assert all(abs(dot(normal, normal) - 1) < .002 for normal in n), context
            for i in range(0, len(indices), 3):
                a, b, c = indices[i:i+3]
                assert all(0 <= k < len(v) for k in (a, b, c)), context
                face = cross(sub(v[b], v[a]), sub(v[c], v[a]))
                assert dot(face, face) > 1e-16, f"degenerate triangle: {context}"
                assert dot(face, n[a]) >= -1e-7, f"reversed triangle: {context}"
                triangles += 1
    assert models == 18, models

    fonts = [TTFont(ROOT / "Resources" / "Fonts" / name).getBestCmap()
             for name in ("NotoSansCJKkr-Regular.otf", "BarlowCondensed-Bold.ttf")]
    strings = []
    for path in (ROOT / "Scripts").glob("*.cs"):
        for match in re.finditer(r'"((?:[^"\\]|\\.)*)"', path.read_text()):
            try:
                value = json.loads(match.group(0))
            except json.JSONDecodeError:
                continue
            strings.append((path.name, value))
    for path, value in strings:
        assert any(all(ord(c) in cmap or c.isspace() for c in value) for cmap in fonts), f"unsupported text: {path}: {value!r}"
    for text in ("전투 환경 설정", "RETRY / 다시 도전해.", "목표 완료 · 남은 적을 처치해", "∞", "×"):
        assert any(all(ord(c) in cmap or c.isspace() for c in text) for cmap in fonts), text

    icons = list((ROOT / "Resources" / "UI").glob("*.png"))
    assert len(icons) == 8
    for path in icons:
        raw = path.read_bytes()
        assert raw[:8] == b'\x89PNG\r\n\x1a\n', path
        w, h, depth, kind = struct.unpack('>IIBB', raw[16:26])
        assert w > 0 and h > 0 and depth == 8 and kind in (4, 6), path
    for shader in ("RelaySurface", "RelayUnlit", "RelayWorldText"):
        assert (ROOT / "Resources" / (shader + ".shader")).is_file(), shader
    guids = []
    for path in ROOT.rglob("*.meta"):
        found = re.search(r'^guid: ([0-9a-f]{32})$', path.read_text(), re.M)
        assert found, path
        guids.append(found.group(1))
    assert len(guids) == len(set(guids)), "Duplicate Unity asset GUIDs"
    print(f"PASS: {models} models, {triangles} triangles, {len(strings)} text literals, {len(icons)} alpha PNGs, shaders and {len(guids)} unique asset GUIDs")


if __name__ == "__main__":
    main()
