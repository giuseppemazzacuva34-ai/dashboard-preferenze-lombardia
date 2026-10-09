#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INDEX=ROOT/"index.html"
BASELINE="1be3e4dcbec1b6f503921fad218b544572637a3f"

CORE_FILES=(
    "index.html",
    "supabase-sync.js",
    "home-election-fix.js",
    "home-count-fix.js",
    "estero-eletti.js",
    "supabase_schema.sql",
)

EXPECTED_PROVINCES={
    "BG":243, "BS":205, "CO":147, "CR":113, "LC":84, "LO":60,
    "MN":64, "MI":133, "MB":55, "PV":184, "SO":77, "VA":136,
}

ALIASES={
    "RONAGO":"Uggiate con Ronago",
    "UGGIATE-TREVANO":"Uggiate con Ronago",
    "UGGIATE TREVANO":"Uggiate con Ronago",
    "ALBAREDO ARNABOLDI":"Campospinoso Albaredo",
    "CAMPOSPINOSO":"Campospinoso Albaredo",
    "LIRIO":"Montalto Pavese",
    "BARDELLO":"Bardello con Malgesso e Bregano",
    "BREGANO":"Bardello con Malgesso e Bregano",
    "MALGESSO":"Bardello con Malgesso e Bregano",
}

PROV={
    "BG":"BG","BERGAMO":"BG",
    "BS":"BS","BRESCIA":"BS",
    "CO":"CO","COMO":"CO",
    "CR":"CR","CREMONA":"CR",
    "LC":"LC","LECCO":"LC",
    "LO":"LO","LODI":"LO",
    "MN":"MN","MANTOVA":"MN",
    "MI":"MI","MILANO":"MI",
    "MB":"MB","MONZA E DELLA BRIANZA":"MB","MONZA E BRIANZA":"MB",
    "PV":"PV","PAVIA":"PV",
    "SO":"SO","SONDRIO":"SO",
    "VA":"VA","VARESE":"VA",
}

def norm(v):
    import unicodedata
    return " ".join(
        str(v or "").strip().upper().split()
    ).replace("\u2019","'")

def province(v):
    return PROV.get(norm(v), norm(v))

def comune(v):
    x=norm(v)
    return norm(ALIASES.get(x, str(v or "").strip()))

def fail(msg):
    print(f"[FAIL] {msg}")
    sys.exit(1)

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def assert_core_frozen():
    print("== CORE FREEZE ==")
    for rel in CORE_FILES:
        path=ROOT/rel
        if not path.exists():
            fail(f"file core mancante: {rel}")
        expected=git("rev-parse",f"{BASELINE}:{rel}")
        actual=git("hash-object",rel)
        print(f"{rel}: {'OK' if expected==actual else 'MODIFICATO'}")
        if expected!=actual:
            fail(f"core modificato: {rel}")

def inflate_index():
    raw=INDEX.read_text(encoding="utf-8")
    match=re.search(r'const\s+b64\s*=\s*"([A-Za-z0-9+/=]+)"',raw)
    if not match:
        fail("index.html: blocco b64 non trovato")
    try:
        compressed=base64.b64decode(match.group(1),validate=True)
        return gzip.decompress(compressed).decode("utf-8")
    except Exception as exc:
        fail(f"index.html: impossibile decomprimere il dataset/app: {exc}")

def extract_assignment(source,name):
    patterns=[
        rf'\b(?:const|let|var)\s+{re.escape(name)}\s*=\s*',
        rf'(?<![\w$]){re.escape(name)}\s*=\s*',
    ]
    m=None
    for p in patterns:
        m=re.search(p,source)
        if m:
            break
    if not m:
        return None,None
    start=m.end()
    while start<len(source) and source[start].isspace():
        start+=1
    if start>=len(source) or source[start] not in "[{":
        return None,source[max(0,start-100):start+300]
    opener=source[start]
    closer="]" if opener=="[" else "}"
    depth=0
    quote=None
    escape=False
    line_comment=False
    block_comment=False
    i=start
    while i<len(source):
        ch=source[i]
        nxt=source[i+1] if i+1<len(source) else ""
        if line_comment:
            if ch=="\n": line_comment=False
            i+=1; continue
        if block_comment:
            if ch=="*" and nxt=="/":
                block_comment=False; i+=2; continue
            i+=1; continue
        if quote:
            if escape:
                escape=False
            elif ch=="\\":
                escape=True
            elif ch==quote:
                quote=None
            i+=1; continue
        if ch in "\"'":
            quote=ch; i+=1; continue
        if ch=="/" and nxt=="/":
            line_comment=True; i+=2; continue
        if ch=="/" and nxt=="*":
            block_comment=True; i+=2; continue
        if ch==opener:
            depth+=1
        elif ch==closer:
            depth-=1
            if depth==0:
                return source[start:i+1],None
        i+=1
    return None,"unterminated literal"

def parse_literal(source,name):
    literal,diagnostic=extract_assignment(source,name)
    if literal is None:
        if diagnostic:
            print(f"[INFO] {name}: {diagnostic[:500]}")
        return None
    try:
        return json.loads(literal)
    except Exception as exc:
        print(f"[INFO] {name}: trovato literal ma JSON parse non riuscito: {exc}")
        print(literal[:500])
        return None

def records(data):
    if isinstance(data,list): return data
    if isinstance(data,dict):
        for key in ("rows","data","records","items"):
            if isinstance(data.get(key),list):
                return data[key]
    return []

def getfield(row,*names):
    if not isinstance(row,dict): return None
    lower={str(k).lower():v for k,v in row.items()}
    for name in names:
        if name.lower() in lower: return lower[name.lower()]
    return None

def audit_geo(geo):
    rows=records(geo)
    if not rows:
        fail("GEO: dataset non estratto")
    pairs=set()
    byprov={p:0 for p in EXPECTED_PROVINCES}
    dup=[]
    for r in rows:
        p=province(getfield(r,"prov","provincia","province","provinci"))
        c=comune(getfield(r,"comune","municipality","city"))
        if not p or not c:
            fail("GEO contiene una riga senza provincia/comune")
        key=(p,c)
        if key in pairs: dup.append(key)
        pairs.add(key)
        if p not in EXPECTED_PROVINCES:
            fail(f"GEO: provincia inattesa {p} per {c}")
        byprov[p]+=1
    print("GEO righe:",len(rows))
    print("GEO comuni unici:",len(pairs))
    print("GEO province:",byprov)
    if dup: fail(f"GEO duplicati: {len(dup)}")
    if len(pairs)!=1501: fail(f"GEO totale != 1501: {len(pairs)}")
    if byprov!=EXPECTED_PROVINCES: fail(f"GEO province non conformi: {byprov}")
    return {(p,c) for p,c in pairs}

def audit_election(name,data,geo_pairs):
    rows=records(data)
    if not rows:
        fail(f"{name}: dataset non estratto")
    missing_geo=set()
    invalid_pref=0
    negatives=0
    unique=set()
    duplicates=0
    prov_counts={p:0 for p in EXPECTED_PROVINCES}
    pref_total=0

    for r in rows:
        p=province(getfield(r,"prov","provincia","province"))
        c=comune(getfield(r,"comune","municipality","city"))
        cand=getfield(r,"candidato","candidate","nome_candidato","nome","cognome")
        pref=getfield(r,"preferenze","preferences","preference","votes","voti")
        if not p or not c:
            fail(f"{name}: riga senza provincia/comune")
        pair=(p,c)
        if pair not in geo_pairs:
            missing_geo.add(pair)
        prov_counts[p]=prov_counts.get(p,0)+1

        try:
            num=float(pref or 0)
            if not num.is_integer(): invalid_pref+=1
            if num<0: negatives+=1
            pref_total+=num
        except Exception:
            invalid_pref+=1

        if cand is not None:
            k=(p,c,str(cand))
            if k in unique: duplicates+=1
            unique.add(k)

    print(f"{name} righe:",len(rows))
    print(f"{name} preferenze totali:",int(pref_total) if float(pref_total).is_integer() else pref_total)
    print(f"{name} righe per provincia:",prov_counts)
    print(f"{name} combinazioni comune/provincia non in GEO:",len(missing_geo))
    print(f"{name} preferenze non intere:",invalid_pref)
    print(f"{name} preferenze negative:",negatives)
    print(f"{name} duplicati candidato/comune/provincia:",duplicates)

    if missing_geo: fail(f"{name}: {len(missing_geo)} combinazioni non presenti in GEO")
    if invalid_pref: fail(f"{name}: valori preferenze non validi")
    if negatives: fail(f"{name}: preferenze negative")
    if duplicates: fail(f"{name}: righe duplicate candidato/comune/provincia")
    return pref_total,prov_counts

def audit_source_structure(source):
    # Deve esistere un blocco runtime dedicato agli audit già presenti nella
    # dashboard e non devono esserci mutazioni dei dataset nel core.
    required=(
        "CURRENT_PROVINCE_COUNTS",
        "auditCurrentGeo",
        "rebuildCanonicalRuntimeData",
        "specialDomesticWinnerSeats",
    )
    for marker in required:
        if marker not in source:
            fail(f"source: marker strutturale assente {marker}")
    print("Struttura runtime principale: OK")

def main():
    if not INDEX.exists(): fail("index.html mancante")
    assert_core_frozen()

    source=inflate_index()
    print("App compressa/decompressa: OK")
    audit_source_structure(source)

    geo=parse_literal(source,"GEO")
    raw=parse_literal(source,"RAW")
    euro=parse_literal(source,"EURO_RAW")

    if geo is None or raw is None or euro is None:
        fail("Impossibile estrarre tutti i dataset GEO/RAW/EURO_RAW dal build corrente")

    geo_pairs=audit_geo(geo)
    raw_total,_=audit_election("REGIONALI",raw,geo_pairs)
    euro_total,_=audit_election("EUROPEE",euro,geo_pairs)

    print("REGIONALI vs EUROPEE totali preferenze:",raw_total,euro_total)

    # Sanity check sui moduli di previsione: devono essere presenti gli elementi
    # necessari per premio, Camera, Senato e seggi speciali.
    for marker in (
        "winnerOrdinaryCap",
        "ordinarySeats",
        "prizeSeatsTotal",
        "senateSeatPlan",
        "allocateNationalToCircs",
        "specialDomesticWinnerSeats",
    ):
        if marker not in source:
            fail(f"motore Sondaggi: marker mancante {marker}")
    print("Motore seggi/scenari: struttura presente")

    print("")
    print("========================================")
    print("TEST MASTER SUPERATO")
    print("========================================")
    print("Core storico invariato.")
    print("Geografia: 1.501 comuni / 12 province.")
    print("Europee e Regionali: dataset leggibili e agganciati alla geografia.")
    print("Preferenze: valori numerici non negativi e senza duplicati esatti.")
    print("Motore scenari/seggi: componenti strutturali presenti.")

if __name__=="__main__":
    main()
