"""Build a reproducible, code-only Unity update; no Store assets or project settings."""
from pathlib import Path
import gzip
import hashlib
import io
import re
import tarfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "Updates" / "RelayZero-Fixes.unitypackage"


def main():
    paths = sorted((ROOT / "Assets" / "RelayZero").glob("Scripts/*.cs"))
    paths += sorted((ROOT / "Assets" / "RelayZero").glob("Editor/*.cs"))
    paths += sorted((ROOT / "Assets" / "RelayZero").glob("Resources/*.shader"))
    payload = io.BytesIO()
    guids = set()
    with tarfile.open(fileobj=payload, mode="w") as archive:
        for path in paths:
            meta = Path(str(path) + ".meta").read_bytes()
            guid = re.search(rb"^guid: ([0-9a-f]{32})$", meta, re.M).group(1).decode()
            assert guid not in guids, path
            guids.add(guid)
            name = path.relative_to(ROOT).as_posix()
            assert name.startswith("Assets/RelayZero/") and "RelayZeroLocal" not in name
            for leaf, data in (("asset", path.read_bytes()), ("asset.meta", meta), ("pathname", name.encode())):
                entry = tarfile.TarInfo(guid + "/" + leaf)
                entry.size = len(data)
                entry.mode = 0o644
                entry.mtime = 0
                archive.addfile(entry, io.BytesIO(data))
    DEST.parent.mkdir(exist_ok=True)
    with DEST.open("wb") as output:
        with gzip.GzipFile(filename="", fileobj=output, mode="wb", mtime=0) as compressed:
            compressed.write(payload.getvalue())
    with tarfile.open(DEST) as check:
        assert len(check.getmembers()) == len(paths) * 3
        for path in paths:
            name = path.relative_to(ROOT).as_posix()
            member = next(m for m in check.getmembers() if m.name.endswith("/pathname") and check.extractfile(m).read().decode() == name)
            assert check.extractfile(member.name.replace("/pathname", "/asset")).read() == path.read_bytes()
    print(f"Built {DEST.name}: {len(paths)} source assets, {DEST.stat().st_size} bytes")
    print("SHA256", hashlib.sha256(DEST.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
