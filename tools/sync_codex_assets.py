"""Mirror referenced documentation images to the existing site asset directory."""
import concurrent.futures
import hashlib
import json
import posixpath
import re
import struct
from pathlib import Path
from urllib.parse import urlsplit, unquote
from sync_codex import fetch, ROOT

source = json.loads((ROOT / "data/codex-source.json").read_text())

def dimensions(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return struct.unpack(">II", data[16:24])
    if data[:2] == b"\xff\xd8":
        offset = 2
        while offset < len(data) - 9:
            if data[offset] != 255:
                offset += 1
                continue
            while data[offset] == 255:
                offset += 1
            marker = data[offset]
            offset += 1
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                continue
            length = int.from_bytes(data[offset:offset + 2], "big")
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                height, width = struct.unpack(">HH", data[offset + 3:offset + 7])
                return width, height
            if length < 2:
                break
            offset += length
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        kind = data[12:16]
        if kind == b"VP8X":
            return int.from_bytes(data[24:27], "little") + 1, int.from_bytes(data[27:30], "little") + 1
        if kind == b"VP8 ":
            return int.from_bytes(data[26:28], "little") & 0x3FFF, int.from_bytes(data[28:30], "little") & 0x3FFF
        if kind == b"VP8L":
            bits = int.from_bytes(data[21:25], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    viewbox = re.search(rb'viewBox=["\']([0-9. -]+)["\']', data[:4096])
    if viewbox:
        values = [float(v) for v in viewbox[1].split()]
        return int(values[2]), int(values[3])
    return None, None
urls = set()
for article in source["articles"]:
    for value in re.findall(r"!\[[^\]]*\]\(([^\s)]+)", article["markdown"]):
        if value.startswith("https://"):
            urls.add(value)
        else:
            path = posixpath.normpath(posixpath.join(posixpath.dirname(article["path"]), value))
            urls.add(f'https://raw.githubusercontent.com/freestylefly/CodexGuide/{source["commit"]}/{path}')

def download(url):
    parsed = urlsplit(url)
    if parsed.hostname not in {"cdn.canghecode.com", "raw.githubusercontent.com"}:
        raise ValueError(f"Review unexpected image host: {parsed.hostname}")
    name = re.sub(r"[^a-zA-Z0-9_.-]", "-", unquote(parsed.path.rsplit("/", 1)[-1]))
    target = "assets/images/codex-" + hashlib.sha256(url.encode()).hexdigest()[:12] + "-" + name
    path = ROOT / target
    try:
        if not path.is_file():
            data = fetch(url)
            # Do not accept CDN error HTML as an image.
            if data.lstrip().startswith((b"<!DOCTYPE", b"<!doctype", b"<html")):
                raise ValueError("Image endpoint returned HTML")
            path.write_bytes(data)
        data = path.read_bytes()
        width, height = dimensions(data)
        return url, {"local": target, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "width": width, "height": height}
    except Exception as error:
        return url, {"error": str(error)}

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    assets = dict(pool.map(download, sorted(urls)))
(ROOT / "data/codex-assets.json").write_text(json.dumps(assets, ensure_ascii=False, indent=2) + "\n")
errors = {url: value for url, value in assets.items() if "error" in value}
print(f"Images: {len(assets) - len(errors)} local / {len(assets)} referenced", flush=True)
for url, value in errors.items():
    print(url, value["error"], flush=True)
