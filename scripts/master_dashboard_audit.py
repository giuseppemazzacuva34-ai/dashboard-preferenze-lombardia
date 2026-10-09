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
    s=str(v or "").strip().upper().replace("\u2019","'")
    s=unicodedata.normalize("NFD",s)
    s="".join(ch for ch in s if unicodedata.category(ch)!="Mn")
    return " ".join(s.split())

def geo_name_key(v):
    # Normalizzazione solo per confrontare denominazioni storiche/ortografiche:
    # Almè/ALME', Salò/SALO', Muggiò/MUGGIO', ecc.
    s=norm(v)
    return "".join(ch for ch in s if ch.isalnum())

def province(v):
    return PROV.get(norm(v), norm(v))

ALIASED_CURRENT_COMUNI={
    "LIRIO":"MONTALTO PAVESE",
}

def current_comune(v):
    k=norm(v)
    return ALIASED_CURRENT_COMUNI.get(k,k)


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
        key=(p,geo_name_key(c))
        geo_lookup.setdefault(key,[]).append(str(getfield(r,"comune","municipality","city") or ""))
        if key in pairs: dup.append(key)
        pairs.add(key)
        if p not in EXPECTED_PROVINCES:
            fail(f"GEO: provincia inattesa {p} per {c}")
        byprov[p]+=1
    print("GEO righe:",len(rows))
    print("GEO comuni unici:",len(pairs))
    ambiguous=[(k,v) for k,v in geo_lookup.items() if len(set(v))>1]
    print("GEO chiavi ortografiche ambigue:",len(ambiguous))
    if ambiguous:
        for k,v in ambiguous[:20]: print("  GEO-AMBIG",k,sorted(set(v)))
    print("GEO province:",byprov)
    if dup: fail(f"GEO duplicati: {len(dup)}")
    if len(pairs)!=1501: fail(f"GEO totale != 1501: {len(pairs)}")
    if byprov!=EXPECTED_PROVINCES: fail(f"GEO province non conformi: {byprov}")
    return pairs

def audit_election(name,data,geo_pairs):
    rows=records(data)
    if not rows:
        fail(f"{name}: dataset non estratto")

    missing_geo={}
    invalid_pref=0
    negatives=0
    candidate_seen={}
    exact_duplicates=[]
    allowed_merges={}
    unexpected_collisions=[]
    prov_counts={p:0 for p in EXPECTED_PROVINCES}
    pref_total=0

    for r in rows:
        p=province(getfield(r,"prov","provincia","province"))
        raw_c=getfield(r,"comune","municipality","city")
        c=current_comune(raw_c)
        cand=getfield(r,"candidato","candidate","nome_candidato","nome","cognome")
        pref=getfield(r,"preferenze","preferences","preference","votes","voti")

        if not p or not c:
            fail(f"{name}: riga senza provincia/comune")

        pair=(p,geo_name_key(c))
        if pair not in geo_pairs:
            missing_geo.setdefault(pair,[]).append(r)
        prov_counts[p]=prov_counts.get(p,0)+1

        try:
            num=float(pref or 0)
            if not num.is_integer(): invalid_pref+=1
            if num<0: negatives+=1
            pref_total+=num
        except Exception:
            invalid_pref+=1

        if cand is not None:
            k=(p,geo_name_key(c),str(cand))
            raw_name=norm(raw_c)
            entry=candidate_seen.setdefault(k,[])
            entry.append((raw_name,r))

    for k,entries in candidate_seen.items():
        if len(entries)<=1:
            continue
        raw_names={x[0] for x in entries}
        # Unica collisione storica ammessa: Lirio incorporato in Montalto Pavese.
        if raw_names.issubset({"LIRIO","MONTALTO PAVESE"}) and "LIRIO" in raw_names:
            allowed_merges[k]=sorted(raw_names)
        else:
            exact_duplicates.append((k,entries))

    print(f"{name} righe:",len(rows))
    print(f"{name} preferenze totali:",int(pref_total) if float(pref_total).is_integer() else pref_total)
    print(f"{name} righe per provincia:",prov_counts)
    print(f"{name} comune/provincia irrisolti:",len(missing_geo))
    for (p,c),sample in sorted(missing_geo.items()):
        print("  GEO-MISSING",p,c,"n=",len(sample))
        for r in sample[:2]:
            print("    ",{k:r.get(k) for k in ("prov","provincia","comune","candidato","preferenze") if k in r})
    print(f"{name} collisioni ammesse Lirio→Montalto:",len(allowed_merges))
    print(f"{name} collisioni non ammesse:",len(exact_duplicates))
    for k,entries in exact_duplicates[:20]:
        print("  COLLISION",k,"raw_names=",sorted({x[0] for x in entries}))
    print(f"{name} preferenze non intere:",invalid_pref)
    print(f"{name} preferenze negative:",negatives)

    if missing_geo:
        fail(f"{name}: comuni non riconciliati con la geografia corrente")
    if invalid_pref:
        fail(f"{name}: valori preferenze non validi")
    if negatives:
        fail(f"{name}: preferenze negative")
    if exact_duplicates:
        fail(f"{name}: collisioni candidate/comune non ammesse")

    return pref_total,prov_counts,allowed_merges

def audit_source_structure(source):
    # Il build reale deve contenere riferimenti ai tre dataset sorgente.
    # I dettagli del runtime sono verificati nei file esterni congelati.
    for marker in ("GEO", "RAW", "EURO_RAW"):
        if not re.search(r"(?<![A-Z0-9_])"+re.escape(marker)+r"(?![A-Z0-9_])",source):
            fail(f"build: riferimento dataset assente {marker}")
    print("Riferimenti ai dataset nel build: OK")

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
    raw_total,raw_prov,raw_merges=audit_election("REGIONALI",raw,geo_pairs)
    euro_total,euro_prov,euro_merges=audit_election("EUROPEE",euro,geo_pairs)

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
