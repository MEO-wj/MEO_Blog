"""Pin game sources and runtime assets. Downloads are never needed at game launch."""
from pathlib import Path
from urllib.request import Request, urlopen
import concurrent.futures
import hashlib
import io
import json
import shutil
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MARIO_REV = "96a1e362dc9472f4a3d0bf7307bc9ffbc03c8bb4"
ZELDA_REV = "877f744fd939a1d25c093d8a926e92d0d4d5235e"
PUBLIC = ROOT / "web/public/game-assets"
SOURCES = ROOT / "third_party/games"
LOCK = {}


def fetch(url):
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={"User-Agent": "MEO-Blog-game-vendor"}), timeout=40) as response:
                return response.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1)


def download(entry):
    url, path = entry
    path.parent.mkdir(parents=True, exist_ok=True)
    pinned = LOCK.get(url)
    if pinned and path.exists():
        local = path.read_bytes()
        if path.name == 'zplayer.js':
            local = local.replace(b'let innerFunc=()=>globalThis.MEORuntime?globalThis.MEORuntime.sleep(ms):new Promise(resolve=>setTimeout(resolve,ms));return Asyncify.handleAsync(innerFunc)', b'let innerFunc=()=>new Promise(resolve=>setTimeout(resolve,ms));return Asyncify.handleAsync(innerFunc)')
        if hashlib.sha256(local).hexdigest() == pinned['sha256']:
            return pinned
    content = fetch(url)
    if pinned and hashlib.sha256(content).hexdigest() != pinned['sha256']:
        raise ValueError(f'Upstream changed for {url}; refusing to replace the locked runtime')
    path.write_bytes(content)
    return {"url": url, "path": path.relative_to(ROOT).as_posix(), "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}


def main():
    global LOCK
    lockfile = SOURCES / 'sources.json'
    if lockfile.exists():
        LOCK = {entry['url']: entry for entry in json.loads(lockfile.read_text(encoding='utf-8'))['downloads']}
    SOURCES.mkdir(parents=True, exist_ok=True)
    mario_root = SOURCES / "mario/upstream"
    mario_public = PUBLIC / "mario/v1"
    if not (mario_root / "FullScreenMario.js").exists():
        archive_url = f"https://codeload.github.com/dataquestio/FullScreenMario/zip/{MARIO_REV}"
        content = fetch(archive_url)
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            for item in archive.infolist():
                parts = Path(item.filename).parts[1:]
                if not parts or item.is_dir():
                    continue
                target = mario_root.joinpath(*parts).resolve()
                if not target.is_relative_to(mario_root.resolve()):
                    raise ValueError("Archive path outside source root")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(item))
    for file in mario_root.rglob("*"):
        if not file.is_file():
            continue
        rel = file.relative_to(mario_root)
        if file.suffix.lower() not in {".mp3", ".woff"}:
            continue
        if rel.as_posix() in {"tests.js", "Gruntfile.js", "index.js"}:
            continue
        target = mario_public / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
    zelda_public = PUBLIC / "zelda/v1"
    urls = [("https://web.zquestclassic.com/" + name, zelda_public / name) for name in ["main.js", "zplayer.js", "zplayer.wasm", "zplayer.data.js", "zplayer.data"]]
    urls += [
        ("https://web.zquestclassic.com/play/", SOURCES / "zelda/official-player.html"),
        ("https://data.zquestclassic.com/quests/purezc/591/r01/1stClassic.qst", zelda_public / "1stClassic.qst"),
        (f"https://raw.githubusercontent.com/ZQuestClassic/ZQuestClassic/{ZELDA_REV}/LICENSE", SOURCES / "zelda/LICENSE"),
        (f'https://codeload.github.com/ZQuestClassic/ZQuestClassic/tar.gz/{ZELDA_REV}', zelda_public / f'source-{ZELDA_REV[:8]}.tar.gz'),
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        entries = list(pool.map(download, urls))
    manifest = {"mario": {"repository": "https://github.com/dataquestio/FullScreenMario", "revision": MARIO_REV}, "zelda": {"repository": "https://github.com/ZQuestClassic/ZQuestClassic", "sourceRevision": ZELDA_REV, "runtimeVersion": "3.0.0-prerelease.212+2026-08-16", "sourceTag": "3.0.0-prerelease.212+2026-08-16", "runtimeSource": "https://web.zquestclassic.com/play/", "quest": "https://www.purezc.net/index.php?page=quests&id=591"}, "downloads": entries}
    (SOURCES / "sources.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"mario_source_files": sum(p.is_file() for p in mario_root.rglob("*")), "zelda_downloads": len(entries), "zelda_bytes": sum(x["bytes"] for x in entries)}))


if __name__ == "__main__":
    main()
