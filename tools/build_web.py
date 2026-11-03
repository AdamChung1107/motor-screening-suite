#!/usr/bin/env python3
"""
Build the static, publicly hostable copy of the dashboard.

    python tools/build_web.py        ->  web-build/

launcher_web/ is normally served by launcher.py, which also answers /api/*,
serves /assets/ and serves the local-only research doc at /analysis. A static
host does none of that, so this script assembles a build that:

  * copies launcher_web/ to the web root and assets/ to /assets/
  * injects tools/web_static/static-api.js, which bridges /api/* to the hub
    running on the visitor's own machine and falls back to a preview when
    there is none (see that file)
  * runs tools/build_release.py, which puts the downloadable setup bundle in
    web-build/download/
  * rewrites the footer, which links to /analysis -- a docs/ file that is
    deliberately never published

Nothing from results/ or docs/ is copied. Deploy with:

    firebase deploy --only hosting

Stdlib only, matching launcher.py and install.py.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_release  # noqa: E402 -- needs the path set above

REPO = Path(__file__).resolve().parents[1]
WEB_SRC = REPO / "launcher_web"
ASSETS_SRC = REPO / "assets"
# The participant's page (docs/platform/REMOTE_SESSION_PLAN.md). Served at /s/<token>;
# firebase.json rewrites every /s/** path onto its index.html, which reads the
# token out of location.pathname.
PARTICIPANT_SRC = REPO / "participant"
SHIM_SRC = REPO / "tools" / "web_static" / "static-api.js"
OUT = REPO / "web-build"

# The Firebase web config the participant page needs. It is published in the
# clear -- that is what a web API key is for, and firestore.rules is the access
# control -- but it is kept out of the repository so a tracked AIza... literal
# cannot be reported as a leaked credential. Source of truth: the helper's own
# git-ignored .remote_sessions.json, the same place relay.py reads it from.
RELAY_STORE = REPO / ".remote_sessions.json"
FIREBASE_CONFIG = "firebase-config.js"

# Injected ahead of every other script so the fetch wrapper is installed
# before app.js makes its first /api/status call.
SHIM_TAG = '<script src="/static-api.js"></script>\n'
SHIM_ANCHOR = '<script src="/i18n.zh.js"></script>'

# The footer is matched exactly: if index.html changes, fail loudly rather
# than silently shipping the /analysis link to a public host.
FOOTER_OLD = """    <div class="footer" data-i18n="home.footer">
      Local hub &#183; 127.0.0.1 &#183; no data leaves this machine &#183;
      <a href="/analysis" target="_blank">Full research analysis</a>
    </div>"""

# The published page keeps the element -- it carries the bottom spacing the
# home page is laid out with -- and loses the copy. With nothing to say there
# is no data-i18n key either: leaving one on an empty div would have pulled
# the *local-hub* Chinese string onto the public site.
FOOTER_NEW = """    <div class="footer"></div>"""


def fail(msg: str) -> None:
    print(f"build_web: {msg}", file=sys.stderr)
    raise SystemExit(1)


def clean(out: Path) -> None:
    """Empty the build directory, deepest entry first.

    Not shutil.rmtree: the repo lives under OneDrive, which keeps a handle on
    directories it is syncing and makes rmdir fail with WinError 5. Removing
    the *files* is what actually prevents a stale build; a directory that
    refuses to go is harmless, since the copy below writes straight into it.
    """
    if not out.exists():
        return
    for p in sorted(out.rglob("*"), key=lambda q: len(q.parts), reverse=True):
        try:
            p.unlink() if p.is_file() or p.is_symlink() else p.rmdir()
        except OSError:
            pass


def replace_once(text: str, old: str, new: str, what: str) -> str:
    n = text.count(old)
    if n != 1:
        fail(f"expected exactly one {what} in index.html, found {n}. "
             "The markup changed -- update tools/build_web.py.")
    return text.replace(old, new)


# A picture slot with no art yet is a note to whoever draws it: the target
# file path is printed inside it and the art brief rides in its hover title.
# Locally that is the point; on the public site a visitor would read file
# paths and "the character holds a finger to their lips". Only placeholders
# match -- a finished slot is class="art-slot is-art" and carries no title.
SLOT_FILE_RE = re.compile(r'<code class="slot-file">[^<]*</code>')
SLOT_TITLE_RE = re.compile(r'(<figure) title="[^"]*"( class="art-slot")')


def strip_slot_notes(html: str) -> tuple[str, int]:
    html, n = SLOT_TITLE_RE.subn(r"\1\2", html)
    html = SLOT_FILE_RE.sub("", html)
    return html, n


def write_firebase_config(dest: Path) -> None:
    """Emit web-build/s/firebase-config.js, or say why the page will be inert."""
    cfg = {}
    if RELAY_STORE.exists():
        try:
            data = json.loads(RELAY_STORE.read_text(encoding="utf-8"))
            cfg = data.get("relay") or {}
        except (ValueError, OSError) as exc:
            print(f"build_web: WARNING could not read {RELAY_STORE.name}: {exc}")
    key = str(cfg.get("api_key", "")).strip()
    project = str(cfg.get("project_id", "")).strip()
    if not key:
        print(f"build_web: WARNING no relay.api_key in {RELAY_STORE.name} -- "
              "/s/ will publish without a Firebase key and cannot upload. "
              "Set it on the Remote page, or add it to that file, and rebuild.")
        return
    body = {"apiKey": key}
    if project:
        body["projectId"] = project
    banner = [
        "/* Written by tools/build_web.py -- do not commit. A Firebase web API",
        "   key is a public project identifier; firestore.rules is the access",
        "   control. Restrict this key to this site's referrers in the Google",
        "   Cloud console. */",
        f"window.HS_FIREBASE = {json.dumps(body, indent=2)};",
        "",
    ]
    dest.write_text("\n".join(banner), encoding="utf-8")
    print(f"build_web: firebase config -> s/{FIREBASE_CONFIG}")


def main() -> None:
    for p in (WEB_SRC, ASSETS_SRC, SHIM_SRC, PARTICIPANT_SRC):
        if not p.exists():
            fail(f"missing {p.relative_to(REPO)}")

    clean(OUT)
    # img/<test>/README.md are the art briefs for the pictures still to be
    # drawn -- working notes, not pages -- so they stay off the public host.
    shutil.copytree(WEB_SRC, OUT, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("*.md"))
    # assets/fonts/ is the bundled CJK subset for the OpenCV overlays and
    # assets/screenshots/ is source material for the WebP copies the pages
    # actually use (launcher_web/img/); the site draws with neither, so both
    # stay out of the published build. videos/bug.mp4 is a local screen
    # recording of a bug, not a card clip, and is git-ignored for the same
    # reason.
    shutil.copytree(ASSETS_SRC, OUT / "assets", dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("fonts", "screenshots", "*.md",
                                                  "bug.mp4"))
    shutil.copy2(SHIM_SRC, OUT / "static-api.js")

    # Participant page -> /s/. Its tests/ and package.json are development
    # files and must not ship; vectors.json alone is 71 KB of fixtures.
    if PARTICIPANT_SRC.exists():
        shutil.copytree(
            PARTICIPANT_SRC, OUT / "s", dirs_exist_ok=True,
            ignore=shutil.ignore_patterns("tests", "package.json", "*.md",
                                          FIREBASE_CONFIG))
        write_firebase_config(OUT / "s" / FIREBASE_CONFIG)

    index = OUT / "index.html"
    html = index.read_text(encoding="utf-8")
    html = replace_once(html, SHIM_ANCHOR, SHIM_TAG + SHIM_ANCHOR, "i18n.zh.js script tag")
    html = replace_once(html, FOOTER_OLD, FOOTER_NEW, "local-hub footer")
    html, slots = strip_slot_notes(html)
    index.write_text(html, encoding="utf-8")
    print(f"build_web: {slots} unfinished picture slot(s) published as plain placeholders")

    build_release.main()   # after clean(), which would have removed download/

    files = sorted(p for p in OUT.rglob("*") if p.is_file())
    total = sum(p.stat().st_size for p in files)
    print(f"build_web: {len(files)} files, {total / 1_048_576:.1f} MB -> {OUT}")
    if not (OUT / "s" / "index.html").exists():
        fail("participant page did not reach web-build/s/")
    print("build_web: participant page -> /s/<token>")
    print("build_web: next step -> firebase deploy --only hosting,firestore:rules")


if __name__ == "__main__":
    main()
