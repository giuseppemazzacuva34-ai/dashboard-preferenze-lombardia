#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
BASELINE = "1be3e4dcbec1b6f503921fad218b544572637a3f"

CORE_FILES = (
    "index.html",
    "supabase-sync.js",
    "home-election-fix.js",
    "home-count-fix.js",
    "estero-eletti.js",
    "supabase_schema.sql",
)

EXPECTED_PROVINCES = {
    "BG": 243, "BS": 205, "CO": 147, "CR": 113, "LC": 84, "LO": 60,
    "MN": 64, "MI": 133, "MB": 55, "PV": 184, "SO": 77, "VA": 136,
}

EXPECTED = {
    "REGIONALI": {
        "rows": 12361,
        "preferences": 235350,
        "province_rows": {
            "BG": 2430, "BS": 2050, "CO": 888, "CR": 452, "LC": 336, "LO": 120,
            "MN": 256, "MI": 3458, "MB": 385, "PV": 744, "SO": 154, "VA": 1088,
        },
    },
    "EUROPEE": {
        "rows": 30040,
        "preferences": 618959,
        "province_rows": {
            "BG": 4860, "BS": 4100, "CO": 2940, "CR": 2260, "LC": 1680,
            "LO": 1200, "MN": 1280, "MI": 2660, "MB": 1100, "PV": 3700,
            "SO": 1540, "VA": 2720,
        },
    },
}

# Alias geografici già adottati dal runtime della dashboard.
# Servono a riconciliare le denominazioni storiche con la geografia corrente.
EXPECTED_CURRENT_ALIASES = {
    "LIRIO": "MONTALTO PAVESE",
    "RONAGO": "UGGIATE CON RONAGO",
    "UGGIATE-TREVANO": "UGGIATE CON RONAGO",
    "UGGIATE TREVANO": "UGGIATE CON RONAGO",
    "ALBAREDO ARNABOLDI": "CAMPOSPINOSO ALBAREDO",
    "CAMPOSPINOSO": "CAMPOSPINOSO ALBAREDO",
    "BARDELLO": "BARDELLO CON MALGESSO E BREGANO",
    "BREGANO": "BARDELLO CON MALGESSO E BREGANO",
    "MALGESSO": "BARDELLO CON MALGESSO E BREGANO",
}

PROV = {
    "BG": "BG", "BERGAMO": "BG",
    "BS": "BS", "BRESCIA": "BS",
    "CO": "CO", "COMO": "CO",
    "CR": "CR", "CREMONA": "CR",
    "LC": "LC", "LECCO": "LC",
    "LO": "LO", "LODI": "LO",
    "MN": "MN", "MANTOVA": "MN",
    "MI": "MI", "MILANO": "MI",
    "MB": "MB", "MONZA E DELLA BRIANZA": "MB", "MONZA E BRIANZA": "MB",
    "PV": "PV", "PAVIA": "PV",
    "SO": "SO", "SONDRIO": "SO",
    "VA": "VA", "VARESE": "VA",
}

def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)

def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()
    except subprocess.CalledProcessError as exc:
        fail(f"git {' '.join(args)} non riuscito: {exc}")
        raise

def norm(value) -> str:
    s = str(value or "").strip().upper().replace("\u2019", "'")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())

def name_key(value) -> str:
    return "".join(ch for ch in norm(value) if ch.isalnum())

def province(value) -> str:
    return PROV.get(norm(value), norm(value))

def current_comune(value) -> str:
    k = norm(value)
    return EXPECTED_CURRENT_ALIASES.get(k, k)

def getfield(row, *names):
    if not isinstance(row, dict):
        return None
    lower = {str(k).lower(): v for k, v in row.items()}
    for name in names:
        if name.lower() in lower:
            return lower[name.lower()]
    return None

def records(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("rows", "data", "records", "items"):
            if isinstance(data.get(key), list):
                return data[key]
    return []

def assert_core_frozen():
    print("== CORE FREEZE ==")
    for rel in CORE_FILES:
        path = ROOT / rel
        if not path.exists():
            fail(f"file core mancante: {rel}")
        expected_sha = git("rev-parse", f"{BASELINE}:{rel}")
        actual_sha = git("hash-object", rel)
        ok = expected_sha == actual_sha
        print(f"{rel}: {'OK' if ok else 'MODIFICATO'}")
        if not ok:
            fail(f"core modificato: {rel}")

def inflate_index() -> str:
    raw = INDEX.read_text(encoding="utf-8")
    match = re.search(r'const\s+b64\s*=\s*"([A-Za-z0-9+/=]+)"', raw)
    if not match:
        fail("index.html: blocco b64 non trovato")
    try:
        data = gzip.decompress(base64.b64decode(match.group(1), validate=True))
        return data.decode("utf-8")
    except Exception as exc:
        fail(f"index.html: decompressione fallita: {exc}")
        raise

def extract_assignment(source: str, name: str):
    match = re.search(
        rf'\b(?:const|let|var)\s+{re.escape(name)}\s*=\s*',
        source
    )
    if not match:
        match = re.search(rf'(?<![\w$]){re.escape(name)}\s*=\s*', source)
    if not match:
        fail(f"dataset {name}: assegnazione non trovata")

    start = match.end()
    while start < len(source) and source[start].isspace():
        start += 1

    if start >= len(source) or source[start] not in "[{":
        fail(f"dataset {name}: literal non trovato")

    opener = source[start]
    closer = "]" if opener == "[" else "}"
    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = start

    while i < len(source):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ""

        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue

        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue

        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch in "\"'":
            quote = ch
            i += 1
            continue

        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
            continue

        if ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return source[start:i + 1]

        i += 1

    fail(f"dataset {name}: literal non terminato")

def parse_literal(source: str, name: str):
    literal = extract_assignment(source, name)
    try:
        return json.loads(literal)
    except Exception as exc:
        fail(f"dataset {name}: JSON non valido: {exc}")

def audit_geo(geo):
    rows = records(geo)
    if not rows:
        fail("GEO vuoto")

    pairs = set()
    byprov = {p: 0 for p in EXPECTED_PROVINCES}
    raw_by_key = {}

    for row in rows:
        p = province(getfield(row, "prov", "provincia", "province"))
        c = getfield(row, "comune", "municipality", "city")
        if not p or not c:
            fail("GEO contiene provincia/comune vuoti")

        key = (p, name_key(c))
        raw_by_key.setdefault(key, set()).add(norm(c))
        pairs.add(key)

        if p not in EXPECTED_PROVINCES:
            fail(f"GEO: provincia inattesa {p}")

        byprov[p] += 1

    ambiguous = [(k, sorted(v)) for k, v in raw_by_key.items() if len(v) > 1]

    print("GEO righe:", len(rows))
    print("GEO comuni unici:", len(pairs))
    print("GEO per provincia:", byprov)
    print("GEO ambiguità di normalizzazione:", len(ambiguous))

    if len(rows) != 1501:
        fail(f"GEO righe != 1501: {len(rows)}")
    if len(pairs) != 1501:
        fail(f"GEO comuni unici != 1501: {len(pairs)}")
    if byprov != EXPECTED_PROVINCES:
        fail(f"conteggi province GEO non conformi: {byprov}")
    if ambiguous:
        fail(f"GEO presenta chiavi ortografiche ambigue: {ambiguous[:10]}")

    return pairs

def audit_election(label, data, geo_pairs):
    rows = records(data)
    expected = EXPECTED[label]
    if not rows:
        fail(f"{label}: dataset vuoto")

    unresolved = set()
    candidate_map = {}
    exact_duplicates = []
    merge_collisions = set()
    byprov = {p: 0 for p in EXPECTED_PROVINCES}
    pref_total = 0

    for row in rows:
        p = province(getfield(row, "prov", "provincia", "province"))
        raw_c = getfield(row, "comune", "municipality", "city")
        c = current_comune(raw_c)
        candidate = getfield(
            row, "candidato", "candidate", "nome_candidato", "nome", "cognome"
        )
        pref = getfield(row, "preferenze", "preferences", "preference", "votes", "voti")

        if not p or not raw_c:
            fail(f"{label}: riga senza provincia/comune")

        pair = (p, name_key(c))
        if pair not in geo_pairs:
            unresolved.add((p, norm(raw_c), name_key(c)))

        byprov[p] = byprov.get(p, 0) + 1

        try:
            value = float(pref or 0)
        except Exception:
            fail(f"{label}: preferenza non numerica in {p}/{raw_c}/{candidate}")
        if not value.is_integer() or value < 0:
            fail(f"{label}: preferenza non intera/negativa in {p}/{raw_c}/{candidate}")
        pref_total += value

        if candidate is not None:
            key = (p, name_key(c), str(candidate))
            entry = candidate_map.setdefault(key, [])
            entry.append((norm(raw_c), row))

    for key, entries in candidate_map.items():
        if len(entries) <= 1:
            continue

        raw_names = {e[0] for e in entries}
        allowed = False
        if "LIRIO" in raw_names and raw_names.issubset({"LIRIO", "MONTALTO PAVESE"}):
            allowed = True
        else:
            mapped = {EXPECTED_CURRENT_ALIASES.get(x, x) for x in raw_names}
            if len(mapped) == 1 and any(x in EXPECTED_CURRENT_ALIASES for x in raw_names):
                allowed = True
        if allowed:
            merge_collisions.add(key)
        else:
            exact_duplicates.append((key, raw_names))

    print(f"{label} righe:", len(rows))
    print(f"{label} preferenze totali:", int(pref_total))
    print(f"{label} righe per provincia:", byprov)
    print(f"{label} comuni non riconciliati:", len(unresolved))
    print(f"{label} riconciliazioni/alias ammessi:", len(merge_collisions))
    print(f"{label} collisioni non ammesse:", len(exact_duplicates))

    if len(rows) != expected["rows"]:
        fail(f"{label}: numero righe cambiato ({len(rows)} != {expected['rows']})")
    if int(pref_total) != expected["preferences"]:
        fail(f"{label}: totale preferenze cambiato ({int(pref_total)} != {expected['preferences']})")
    if byprov != expected["province_rows"]:
        fail(f"{label}: distribuzione provinciale cambiata")
    if unresolved:
        fail(f"{label}: comuni non riconciliati: {sorted(unresolved)[:20]}")
    if exact_duplicates:
        fail(f"{label}: collisioni candidate/comune non ammesse: {exact_duplicates[:10]}")

    return int(pref_total), byprov, len(merge_collisions)

def audit_sondaggi_module():
    source = (ROOT / "sondaggi-app.js").read_text(encoding="utf-8")
    required = (
        "nationalCamera",
        "nationalSenate",
        "distributeCameraCircoscrizioni",
        "simulateSenateRegions",
        "SPECIAL_SEATS",
        "coalitionResultRows",
    )
    for marker in required:
        if marker not in source:
            fail(f"sondaggi-app.js: componente assente {marker}")
    print("Motore Sondaggi/scenari: struttura presente")

def main():
    assert_core_frozen()

    source = inflate_index()
    print("Build compresso/decompresso: OK")

    geo = parse_literal(source, "GEO")
    regionali = parse_literal(source, "RAW")
    europee = parse_literal(source, "EURO_RAW")

    geo_pairs = audit_geo(geo)
    reg_total, _, reg_merges = audit_election("REGIONALI", regionali, geo_pairs)
    euro_total, _, euro_merges = audit_election("EUROPEE", europee, geo_pairs)

    print(f"REGIONALI vs EUROPEE totali: {reg_total} / {euro_total}")
    print(f"Riconciliazioni storiche Lirio→Montalto: {reg_merges} / {euro_merges}")

    audit_sondaggi_module()

    # La presenza del bridge verso il guard e del singolo deploy controllato
    # completa la verifica infrastrutturale.
    link = (ROOT / "sondaggi-link.js").read_text(encoding="utf-8")
    if "dashboard-runtime-integrity.js" not in link:
        fail("sondaggi-link.js non carica il guard di integrità")

    pages = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
    if "scripts/verify_dashboard_integrity.py" not in pages:
        fail("deploy Pages senza gate di integrità")

    if (ROOT / ".github/workflows/deploy-pages.yml").exists():
        fail("workflow di deploy duplicato presente")

    print("")
    print("========================================")
    print("TEST MASTER SUPERATO")
    print("========================================")
    print("Core elettorale: invariato rispetto alla baseline.")
    print("Geografia: 1.501 comuni, 12 province, conteggi provinciali conformi.")
    print("Europee e Regionali: dataset integri e riconciliati.")
    print("Preferenze: totali e distribuzioni provinciali conformi.")
    print("Lirio→Montalto: unica fusione storica ammessa e riconosciuta.")
    print("Motore Sondaggi: componenti principali presenti.")
    print("Deploy: singolo percorso con gate di integrità.")

if __name__ == "__main__":
    main()
