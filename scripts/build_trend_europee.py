#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, re
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen

OUT=Path("trend-data-europee.json")
SOURCES={
"2019":{"results":"https://raw.githubusercontent.com/ondata/guenter/master/dati/europee2019_scrutini_area_italia_utf8.csv"},
"2024":{
"results":"https://raw.githubusercontent.com/ondata/elezioni_europee_2024/main/data/liste.csv",
"geo":"https://raw.githubusercontent.com/ondata/elezioni_europee_2024/main/data/insieme.csv"}}
REGIONS={"01":"Piemonte","02":"Valle d'Aosta","03":"Lombardia","04":"Trentino-Alto Adige","05":"Veneto","06":"Friuli-Venezia Giulia","07":"Liguria","08":"Emilia-Romagna","09":"Toscana","10":"Umbria","11":"Marche","12":"Lazio","13":"Abruzzo","14":"Molise","15":"Campania","16":"Puglia","17":"Basilicata","18":"Calabria","19":"Sicilia","20":"Sardegna"}

ALIASES=[
(("fratelli d'italia",),"FDI","Fratelli d'Italia"),
(("partito democratico",),"PD","Partito Democratico"),
(("movimento 5 stelle",),"M5S","Movimento 5 Stelle"),
(("forza italia",),"FI","Forza Italia"),
(("lega salvini premier","lega per salvini premier","lega"),"LEGA","Lega"),
(("alleanza verdi e sinistra",),"AVS","Alleanza Verdi Sinistra"),
(("azione - siamo europei","azione - italia viva - calenda","azione"),"AZIONE","Azione"),
(("italia viva",),"IV","Italia Viva"),
(("+europa","più europa"),"EUROPA","+Europa"),
(("noi moderati",),"NM","Noi Moderati")]

def clean(v): return " ".join(str(v or "").replace("\ufeff","").strip().split())
def norm(v): return clean(v).lower().replace("’","'")
def num(v):
    s=clean(v)
    if not s:return 0
    s=re.sub(r"[^0-9-]","",s)
    try:return int(s)
    except ValueError:return 0
def party(v):
    n=norm(v)
    for aliases,k,label in ALIASES:
        if any(a in n for a in aliases): return k,label
    slug=re.sub(r"[^a-z0-9]+","_",n).strip("_")[:60]
    return "LIST_"+(slug.upper() or "UNKNOWN"),clean(v) or "Lista senza nome"
def rows(text):
    try:d=csv.Sniffer().sniff(text[:10000],delimiters=",;")
    except csv.Error:d=csv.excel
    return [{clean(k):clean(v) for k,v in r.items()} for r in csv.DictReader(io.StringIO(text),dialect=d)]
def download(url):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 trend-builder"})
    with urlopen(req,timeout=120) as r:return r.read().decode("utf-8-sig",errors="replace")

def build_2019():
    rs=rows(download(SOURCES["2019"]["results"]))
    agg=defaultdict(int)
    for r in rs:
        reg=clean(r.get("REGIONE"))
        p=clean(r.get("LISTA"))
        if not reg or not p:continue
        pk,_=party(p); agg[(reg,pk)]+=num(r.get("VOTI_LISTA"))
    return rs, materialize(agg)

def build_2024():
    geo=rows(download(SOURCES["2024"]["geo"]))
    region_by_istat={}
    for r in geo:
        ist=clean(r.get("CODICE ISTAT"))
        rc=clean(r.get("reg_sto")).zfill(2)
        if ist and rc in REGIONS: region_by_istat[ist]=rc
    rs=rows(download(SOURCES["2024"]["results"]))
    agg=defaultdict(int)
    for r in rs:
        ist=clean(r.get("CODICE ISTAT"))
        rc=region_by_istat.get(ist)
        p=clean(r.get("desc_lis"))
        if not rc or not p:continue
        pk,_=party(p); agg[(rc,pk)]+=num(r.get("voti"))
    return rs, materialize(agg),len(region_by_istat)

def materialize(agg):
    by=defaultdict(dict)
    for (region,pk),v in agg.items(): by[region][pk]=v
    out=[]
    # 2019 uses region names; 2024 uses ISTAT region codes.
    for region,vals in by.items():
        if region in REGIONS: rname=REGIONS[region]; rcode=region
        else:
            rname=region.title().replace("Emilia-romagna","Emilia-Romagna").replace("Friuli-venezia giulia","Friuli-Venezia Giulia")
            rcode=next((k for k,v in REGIONS.items() if norm(v)==norm(region)),"")
        total=sum(vals.values())
        out.append({"region":rname,"regionCode":rcode,"validListVotesProxy":total,
                    "parties":[{"partyId":pk,"votes":int(v),"share":round(v/total*100,6) if total else 0}
                               for pk,v in sorted(vals.items(),key=lambda x:(-x[1],x[0]))]})
    return sorted(out,key=lambda x:(x["regionCode"],x["region"]))

def main():
    r19,a19=build_2019()
    r24,a24,geo_count=build_2024()
    data={
      "version":"2026-10-12-europee-v1",
      "method":{"type":"observed_results","shareDefinition":"voti di lista / somma dei voti di lista presenti nella fonte","note":"Le percentuali sono risultati osservati; non sono previsioni."},
      "elections":{
        "2019":{"regions":a19,"sourceNote":"Dati scrutini comunali onData/Guenter, origine DAIT/Eligendo."},
        "2024":{"regions":a24,"sourceNote":"Dati liste comunali onData, con mapping tramite CODICE ISTAT da insieme.csv."}},
      "sources":[
        {"year":"2019","url":SOURCES["2019"]["results"],"rowsRead":len(r19)},
        {"year":"2024","url":SOURCES["2024"]["results"],"rowsRead":len(r24)},
        {"year":"2024","url":SOURCES["2024"]["geo"],"rowsRead":geo_count}],
      "validation":{
        "2019":{"regions":len(a19),"parties":sorted({p["partyId"] for r in a19 for p in r["parties"]})},
        "2024":{"regions":len(a24),"parties":sorted({p["partyId"] for r in a24 for p in r["parties"]})}},
      "qualityNote":"Per le Europee 2024 la fonte onData avverte che il dataset e' stato estratto circa alle 12:00 del 10 giugno 2024 e puo' contenere alcune sezioni mancanti. Non viene trattato come dato definitivo validato dal Ministero."
    }
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")

if __name__=="__main__": main()
