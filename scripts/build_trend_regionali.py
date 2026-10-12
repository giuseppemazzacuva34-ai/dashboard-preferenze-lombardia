#!/usr/bin/env python3
"""Build the regional-election layer used by the standalone Trend page.

The script downloads official Ministry/Eligendo open-data ZIP archives, extracts
list votes, normalises party families, and keeps the two most recent regional
elections available for each region. It is intentionally fail-soft: one
unavailable archive does not block publication of the dashboard.
"""
from __future__ import annotations
import csv, io, json, re, urllib.request, zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "trend-regionali-generated.json"
BASE = "https://elezionistorico.interno.gov.it/daithome/documenti/opendata/regionali/"

SOURCES = [
    ("2018-03-04", "regionali-20180304.zip"),
    ("2019-02-10", "regionali-20190210.zip"),
    ("2019-03-24", "regionali-20190324.zip"),
    ("2019-05-26", "regionali-20190526.zip"),
    ("2019-10-27", "regionali-20191027.zip"),
    ("2020-01-26", "regionali-20200126.zip"),
    ("2020-09-20", "regionali-20200920.zip"),
    ("2021-10-03", "regionali-20211003.zip"),
    ("2022-09-25", "regionali-20220925.zip"),
    ("2023-02-12", "regionali-20230212.zip"),
    ("2024-03-10", "regionali-20240310.zip"),
    ("2024-04-21", "regionali-20240421.zip"),
    ("2024-06-09", "regionali-20240609.zip"),
    ("2024-10-27", "regionali-20241027.zip"),
    ("2024-11-17", "regionali-20241117.zip"),
    ("2025-10-05", "regionali-20251005.zip"),
    ("2025-10-12", "regionali-20251012.zip"),
    ("2025-11-23", "regionali-20251123.zip"),
]

REGION_NAMES = {
    "PIEMONTE":"Piemonte","VALLEDAOSTA":"Valle d'Aosta",
    "LOMBARDIA":"Lombardia","TRENTINOALTOADIGE":"Trentino-Alto Adige/Südtirol",
    "TRENTINOALTOADIGESÜDTIROL":"Trentino-Alto Adige/Südtirol",
    "VENETO":"Veneto","FRIULIVENEZIAGIULIA":"Friuli-Venezia Giulia",
    "LIGURIA":"Liguria","EMILIAROMAGNA":"Emilia-Romagna","TOSCANA":"Toscana",
    "UMBRIA":"Umbria","MARCHE":"Marche","LAZIO":"Lazio","ABRUZZO":"Abruzzo",
    "MOLISE":"Molise","CAMPANIA":"Campania","PUGLIA":"Puglia",
    "BASILICATA":"Basilicata","CALABRIA":"Calabria","SICILIA":"Sicilia",
    "SARDEGNA":"Sardegna",
}

def norm(v: object) -> str:
    s = str(v or "")
    s = s.replace("\ufeff", "")
    s = re.sub(r"[^A-Z0-9ÀÈÉÌÒÙÜ]", "", s.upper())
    return s

def party(label: object) -> str:
    k = norm(label)
    if "FRATELLIDITALIA" in k: return "FdI"
    if "PARTITODEMOCRATICO" in k: return "PD"
    if "MOVIMENTO5STELLE" in k: return "M5S"
    if k.startswith("LEGA"): return "LEGA"
    if "FORZAITALIA" in k: return "FI"
    if "ALLEANZAVERDIESINISTRA" in k or "ALLEANZAVERDISINISTRA" in k: return "AVS"
    if "NOIMODERATI" in k: return "NM"
    if k == "AZIONE": return "AZ"
    if k == "ITALIAVIVA": return "IV"
    if k in {"EUROPA", "PIUEUROPA"}: return "PIU"
    return "ALTRI"

def region_name(raw: object) -> str:
    k = norm(raw)
    return REGION_NAMES.get(k, str(raw or "").strip().title())

def parse_votes(raw: str) -> float:
    s = str(raw or "").strip().replace(".", "").replace(",", ".")
    try: return float(s)
    except Exception: return 0.0

def sniff_dicts(text: str):
    sample = text[:10000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|,")
    except Exception:
        dialect = csv.excel
        dialect.delimiter = ";"
    for enc in ("utf-8-sig", "latin-1"):
        try:
            reader = csv.DictReader(io.StringIO(text), dialect=dialect)
            rows = list(reader)
            if rows and reader.fieldnames:
                yield reader.fieldnames, rows
                return
        except Exception:
            continue

def find_key(headers, *candidates):
    normed = {norm(h): h for h in headers if h is not None}
    for c in candidates:
        if norm(c) in normed:
            return normed[norm(c)]
    return None

def parse_zip(raw: bytes, election_date: str):
    results = []
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        for name in z.namelist():
            upper = name.upper()
            if not upper.endswith((".CSV", ".TXT")) or "PREFEREN" in upper:
                continue
            try:
                text = z.read(name).decode("utf-8-sig")
            except UnicodeDecodeError:
                text = z.read(name).decode("latin-1", errors="replace")
            for headers, rows in sniff_dicts(text):
                rkey = find_key(headers, "REGIONE", "DESCREGIONE", "REGIONE ")
                ckey = find_key(headers, "COMUNE", "DESCCOMUNE", "DES_COMUNE")
                lkey = find_key(headers, "LISTA", "DESCLISTA", "DESCRLISTA", "DESCRIZIONE LISTA")
                vkey = find_key(headers, "VOTI_LISTA", "VOTILISTA", "VOTI", "NUMVOTI")
                if not lkey or not vkey:
                    continue
                fallback_region = ""
                m = re.search(
                    r"(?:Regionali?|regionali)[_ -]*([A-Za-zÀ-ÿ-]+)",
                    name,
                )
                if m:
                    fallback_region = region_name(m.group(1))
                agg = {}
                for row in rows:
                    reg = region_name(row.get(rkey, "")) if rkey else fallback_region
                    if not reg or reg == "": continue
                    label = row.get(lkey, "")
                    votes = parse_votes(row.get(vkey, ""))
                    if votes <= 0: continue
                    p = party(label)
                    agg.setdefault(reg, {})
                    agg[reg][p] = agg[reg].get(p, 0.0) + votes
                if agg:
                    results.extend((reg, agg[reg]) for reg in agg)
                    break
                if results:
                    break
    return results

def build():
    by_region = {}
    log = []
    for dt, fn in SOURCES:
        url = BASE + fn
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 trend-territoriale-builder"}
            )
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read()
            rows = parse_zip(raw, dt)
            seen = 0
            for reg, votes in rows:
                total = sum(votes.values())
                if total <= 0: continue
                shares = {k: round(v / total * 100, 2) for k, v in votes.items()}
                by_region.setdefault(reg, {})[dt] = {
                    "date": dt,
                    "year": int(dt[:4]),
                    "shares": shares,
                    "totalVotes": round(total),
                    "source": url,
                }
                seen += 1
            log.append({"date": dt, "file": fn, "ok": True, "regions": seen})
        except Exception as exc:
            log.append({"date": dt, "file": fn, "ok": False, "error": str(exc)[:240]})

    out = {}
    for reg, elections in by_region.items():
        items = sorted(elections.values(), key=lambda x: x["date"], reverse=True)[:2]
        out[reg] = list(reversed(items))

    payload = {
        "version": "2026-10-12-regionali1",
        "methodology": (
            "Voti di lista comunali aggregati per regione dalle aperture "
            "open-data del Ministero/Eligendo. Sono conservate le due "
            "tornate regionali più recenti disponibili per regione. "
            "Trentino-Alto Adige/Südtirol non viene trattato come singola "
            "elezione regionale; le province autonome richiedono un modello separato."
        ),
        "sources": [BASE + fn for _, fn in SOURCES],
        "byRegion": out,
        "log": log,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    ok = sum(1 for x in log if x["ok"])
    print(json.dumps({
        "output": str(OUT),
        "regions": len(out),
        "successful_sources": ok,
        "sources": len(SOURCES),
        "version": payload["version"],
    }))
    return 0

if __name__ == "__main__":
    raise SystemExit(build())
