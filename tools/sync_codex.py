"""Download a pinned CodexGuide documentation snapshot; never execute upstream code."""
import argparse
import concurrent.futures
import hashlib
import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "freestylefly/CodexGuide"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Daxiang-docs-sync/1.0"})
    with urllib.request.urlopen(req, timeout=40) as response:
        return response.read()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        raise SystemExit("Supply an exact 40-character commit SHA")
    raw = f"https://raw.githubusercontent.com/{REPO}/{args.commit}/"
    tree = json.loads(fetch(f"https://api.github.com/repos/{REPO}/git/trees/{args.commit}?recursive=1"))
    paths = sorted(x["path"] for x in tree["tree"] if x["path"].endswith(".md") and x["path"].startswith(("docs/start/", "docs/advanced/", "docs/recipes/")))
    def download(path):
        body = fetch(raw + path).decode("utf-8")
        return {"path": path, "markdown": body, "sha256": hashlib.sha256(body.encode()).hexdigest()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        articles = list(pool.map(download, paths))
    license_text = fetch(raw + "LICENSE").decode()
    if "MIT License" not in license_text or "Copyright" not in license_text:
        raise SystemExit("Unexpected upstream license; review before importing")
    snapshot = {"repository": f"https://github.com/{REPO}", "commit": args.commit, "synced": date.today().isoformat(), "license": license_text, "articles": articles}
    (ROOT / "data/codex-source.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "CODEXGUIDE-LICENSE.txt").write_text(license_text)
    print(f"Saved {len(articles)} complete Markdown documents at {args.commit}", flush=True)

if __name__ == "__main__":
    main()
