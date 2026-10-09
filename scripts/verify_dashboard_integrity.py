#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Snapshot del core conosciuto come corretto prima dell'introduzione
# delle protezioni. Questo commit NON viene mai aggiornato dalle nuove feature.
BASELINE_COMMIT = "1be3e4dcbec1b6f503921fad218b544572637a3f"

# Solo i file che appartengono al core elettorale già verificato.
# I file di protezione, il bridge Sondaggi e i moduli Sondaggi non fanno
# parte del core immutabile e possono evolvere senza alterare questi file.
CORE_FILES = (
    "index.html",
    "supabase-sync.js",
    "home-election-fix.js",
    "home-count-fix.js",
    "estero-eletti.js",
    "supabase_schema.sql",
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
    try:
        return run_git("rev-parse", f"{BASELINE_COMMIT}:{path}")
    except subprocess.CalledProcessError as exc:
        fail(
            f"baseline non disponibile per {path}. "
            f"Verificare checkout con fetch-depth: 0. Dettaglio: {exc}"
        )
        raise


for rel in CORE_FILES:
    path = ROOT / rel
    if not path.exists():
        fail(f"{rel}: FILE MANCANTE")

    expected = expected_blob_sha(rel)
    actual = run_git("hash-object", rel)

    if actual != expected:
        fail(
            f"{rel}: SHA ATTUALE {actual} != SHA BASELINE {expected}"
        )

# Il vecchio workflow duplicato deve restare assente: altrimenti potrebbe
# partire un secondo deploy senza il gate di integrità.
legacy_deploy = ROOT / ".github/workflows/deploy-pages.yml"
if legacy_deploy.exists():
    fail(
        "deploy-pages.yml storico presente: rimuoverlo per evitare "
        "un secondo percorso di deploy"
    )

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

guard_path = ROOT / "dashboard-runtime-integrity.js"
if not guard_path.exists():
    fail("dashboard-runtime-integrity.js mancante")

guard = guard_path.read_text(encoding="utf-8")
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

print("OK - core elettorale protetto, doppio deploy escluso e gate attivo.")
print(f"Baseline commit: {BASELINE_COMMIT}")
print(f"File core verificati: {len(CORE_FILES)}")
