#!/usr/bin/env python3
from __future__ import annotations
import csv, io, json, re
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen

OUT=Path("trend-data-politiche.json")
SOURCES={
"2018":{
"camera":"https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/scrutiniCI_p.csv",
"senato":"https://raw.githubusercontent.com/ondata/elezionipolitiche2018/master/dati/scrutiniSI_p.csv"},
"2022":{
"camera":"https://raw.githubusercontent.com/ondata/elezioni-politiche-2022/main/affluenza-risultati/dati/risultati/camera-italia-plurinominale.csv",
"senato":"https://raw.githubusercontent.com/ondata/elezioni-politiche-2022/main/affluenza-risultati/dati/risultati/senato-italia-plurinominale.csv"}}
REGIONS={"01":"Piemonte","02":"Valle d'Aosta","03":"Lombardia","04":"Trentino-Alto Adige","05":"Veneto","06":"Friuli-Venezia Giulia","07":"Liguria","08":"Emilia-Romagna","09":"Toscana","10":"Umbria","11":"Marche","12":"Lazio","13":"Abruzzo","14":"Molise","15":"Campania","16":"Puglia","17":"Basilicata","18":"Calabria","19":"Sicilia","20":"Sardegna"}
ALIASES=[
(("fratelli d'italia","fratelli d italia"),"FDI","Fratelli d'Italia"),
(("partito democratico",),"PD","Partito Democratico"),
(("movimento 5 stelle",),"M5S","Movimento 5 Stelle"),
(("forza italia",),"FI","Forza Italia"),
(("lega per salvini premier","lega"),"LEGA","Lega"),
(("alleanza verdi e sinistra",),"AVS","Alleanza Verdi Sinistra"),
(("azione - italia viva - calenda","azione",),"AZIONE","Azione"),
(("italia viva",),"IV","Italia Viva"),
(("+europa","più europa"),"EUROPA","+Europa"),
(("noi moderati",),"NM","Noi Moderati"),
(("liberi e uguali",),"LEU","Liberi e Uguali")]

def clean(v): return " ".join(str(v or "").replace("\ufeff","").strip().split())
def num(v):
    s=clean(v)
    if not s:return 0
    s=re.sub(r"[^0-9-]","",s)
    try:return int(s)
    except ValueError:return 0
def keyname(s): return clean(s).lower()
def party(s):
    n=keyname(s)
    for aliases,k,label in ALIASES:
        if any(a in n for a in aliases): return k,label
    slug=re.sub(r"[^a-z0-9]+","_",n).strip("_")[:60]
    return "LIST_"+(slug.upper() or "UNKNOWN"),clean(s) or "Lista senza nome"

def download(url):
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 trend-builder"})
    with urlopen(req,timeout=120) as r: raw=r.read()
    for enc in ("utf-8-sig","cp1252","latin-1"):
        try:return raw.decode(enc)
        except UnicodeDecodeError: pass
    raise RuntimeError("encoding non supportato: "+url)

def rows(text):
    try:dialect=csv.Sniffer().sniff(text[:10000],delimiters=",;")
    except csv.Error:dialect=csv.excel
    return [{clean(k):clean(v) for k,v in r.items()} for r in csv.DictReader(io.StringIO(text),dialect=dialect)]

def get(r,*names):
    for n in names:
        if n in r:return clean(r[n])
    return ""

def parse(year,rs):
    out=[]
    for r in rs:
        college=get(r,"codice","CODICE") if year=="2018" else get(r,"CR_CP","cr_cp")
        p=get(r,"descr_lista","DESCR_LISTA","desc_lis","DESC_LIS")
        v=num(get(r,"voti","VOTI"))
        rc=college[:2]
        if college and p and rc in REGIONS: out.append((rc,college,p,v))
    return out

def aggregate(parsed):
    c=defaultdict(int); rg=defaultdict(int)
    for rc,col,p,v in parsed:
        pk,_=party(p); c[(rc,col,pk)]+=v; rg[(rc,pk)]+=v
    def make_group(items,with_college):
        by=defaultdict(lambda:defaultdict(int))
        for k,v in items:
            by[k[0:-1]][k[-1]]+=v
        out=[]
        for base,vals in by.items():
            rc=base[0]; total=sum(vals.values())
            d={"region":REGIONS[rc],"regionCode":rc}
            if with_college:
                d["collegeId"]=base[1]; d["collegeName"]=base[1]
            d["validListVotesProxy"]=total
            d["parties"]=[{"partyId":pk,"votes":int(v),"share":round(v/total*100,6) if total else 0} for pk,v in sorted(vals.items(),key=lambda x:(-x[1],x[0]))]
            out.append(d)
        return sorted(out,key=lambda x:(x["regionCode"],x.get("collegeId","")))
    return {"colleges":make_group([((rc,col,pk),v) for (rc,col,pk),v in c.items()],True),
            "regions":make_group([((rc,"",pk),v) for (rc,pk),v in rg.items()],False)}

def main():
    data={"version":"2026-10-12-politiche-v1","method":{"type":"observed_results","shareDefinition":"voti lista / somma voti delle liste presenti nel file sorgente","note":"Dati osservati; non sono previsioni."},"sources":[],"elections":{},"validation":{}}
    for year,chs in SOURCES.items():
        data["elections"][year]={}
        for ch,url in chs.items():
            rs=rows(download(url)); parsed=parse(year,rs)
            if not parsed: raise RuntimeError(f"nessun dato utile per {year} {ch}")
            agg=aggregate(parsed); data["elections"][year][ch]=agg
            data["sources"].append({"year":year,"chamber":ch,"url":url,"rowsRead":len(rs),"listRowsUsed":len(parsed)})
            data["validation"][f"{year}-{ch}"]={"regions":len(agg["regions"]),"colleges":len(agg["colleges"]),"parties":sorted({p["partyId"] for x in agg["colleges"] for p in x["parties"]})}
    data["coverageNote"]="Blocco 1: Politiche 2018/2022 sui collegi plurinominali storici. Non effettua ancora la proiezione sui collegi della legge 2026. La Valle d'Aosta puo non comparire nei plurinominali per la sua specificita uninominale."
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")

if __name__=="__main__": main()
