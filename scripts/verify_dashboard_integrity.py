#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Questo SHA identifica l'ultima versione conosciuta come perfetta.
# Il controllo usa il commit Git direttamente, non un manifest modificabile:
# una modifica accidentale al core viene quindi bloccata anche se qualcuno
# dimentica di aggiornare la documentazione.
BASELINE_COMMIT = "1be3e4dcbec1b6f503921fad218b544572637a3f"

PROTECTED_FILES = (
    "index.html",
    "supabase-sync.js",
    "home-election-fix.js",
    "home-count-fix.js",
    "estero-eletti.js",
    "supabase_schema.sql",
    "sondaggi-link.js",
    "dashboard-runtime-integrity.js",
    ".github/workflows/pages.yml",
    ".github/workflows/dashboard-integrity.yml",
    "scripts/verify_dashboard_integrity.py",
)


def run_git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args],
        cwd=ROOT,
        text=True,
    ).strip()


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)


def expected_blob_sha(path: str) -> str:
    return run_git("rev-parse", f"{BASELINE_COMMIT}:{path}")


def actual_blob_sha(path: str) -> str:
    return run_git("hash-object", path)


for rel in PROTECTED_FILES:
    path = ROOT / rel
    if not path.exists():
        fail(f"{rel}: FILE MANCANTE")

    expected = expected_blob_sha(rel)
    actual = actual_blob_sha(rel)
    if actual != expected:
        fail(
            f"{rel}: SHA ATTUALE {actual} != SHA BASELINE {expected}"
        )

# Il vecchio workflow duplicato deve restare assente: altrimenti potrebbe
# partire un secondo deploy senza il gate di integrità.
legacy_deploy = ROOT / ".github/workflows/deploy-pages.yml"
if legacy_deploy.exists():
    fail("deploy-pages.yml storico presente: rimuoverlo per evitare un secondo percorso di deploy")

index = (ROOT / "index.html").read_text(encoding="utf-8")
for script in (
    "supabase-sync.js",
    "home-election-fix.js",
    "sondaggi-link.js",
    "estero-eletti.js",
    "home-count-fix.js",
):
    if script not in index:
        fail(f"index.html non contiene piu' il loader {script}")

guard = (ROOT / "dashboard-runtime-integrity.js").read_text(encoding="utf-8")
for marker in (
    "EXPECTED_PROVINCE_COUNTS",
    "1501",
    "window.dashboardIntegrityStatus",
    "Dataset sorgente",
):
    if marker not in guard:
        fail(f"guard runtime incompleto: marker mancante {marker}")

link = (ROOT / "sondaggi-link.js").read_text(encoding="utf-8")
if "dashboard-runtime-integrity.js" not in link:
    fail("sondaggi-link.js non carica il guard runtime")

pages = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
if "scripts/verify_dashboard_integrity.py" not in pages:
    fail("il deploy GitHub Pages non esegue il controllo integrita")

print("OK - core protetto, doppio deploy escluso e gate di integrita attivo.")
print(f"Baseline commit: {BASELINE_COMMIT}")
print(f"File protetti: {len(PROTECTED_FILES)}")
