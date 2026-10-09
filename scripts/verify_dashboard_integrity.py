#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "dashboard-integrity.json"


def git_blob_sha(path: Path) -> str:
    return subprocess.check_output(
        ["git", "hash-object", str(path.relative_to(ROOT))],
        cwd=ROOT,
        text=True,
    ).strip()


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)


if not MANIFEST.exists():
    fail("dashboard-integrity.json non trovato")

try:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
except Exception as exc:
    fail(f"manifest non valido: {exc}")

protected = manifest.get("protected_files") or {}
if not protected:
    fail("nessun file protetto nel manifest")

errors = []
for rel, expected in protected.items():
    path = ROOT / rel
    if not path.exists():
        errors.append(f"{rel}: FILE MANCANTE")
        continue
    actual = git_blob_sha(path)
    if actual != expected:
        errors.append(f"{rel}: SHA ATTUALE {actual} != BASELINE {expected}")

if errors:
    print("Protezione del core FALLITA.")
    for item in errors:
        print(" -", item)
    sys.exit(1)

# Controlli strutturali minimi: questi elementi devono restare presenti anche
# mentre i moduli Sondaggi evolvono separatamente.
index = (ROOT / "index.html").read_text(encoding="utf-8")
required_scripts = [
    "supabase-sync.js",
    "home-election-fix.js",
    "sondaggi-link.js",
    "estero-eletti.js",
    "home-count-fix.js",
]
for script in required_scripts:
    if script not in index:
        fail(f"index.html non contiene piu' il loader {script}")

guard = (ROOT / "dashboard-runtime-integrity.js").read_text(encoding="utf-8")
for marker in [
    "EXPECTED_PROVINCE_COUNTS",
    "1501",
    "window.dashboardIntegrityStatus",
    "Dataset sorgente",
]:
    if marker not in guard:
        fail(f"guard runtime incompleto: marker mancante {marker}")

link = (ROOT / "sondaggi-link.js").read_text(encoding="utf-8")
if "dashboard-runtime-integrity.js" not in link:
    fail("sondaggi-link.js non carica il guard runtime")

print("OK - core protetto e controlli strutturali superati.")
print(f"File protetti verificati: {len(protected)}")
print(f"Baseline commit: {manifest.get('baseline_commit')}")
