/* TREND compact-data bootstrap.
 * Carica i dataset generati da GitHub Actions e li innesta nella struttura
 * SG_TERRITORIAL_DATA già usata dal modulo territoriale. In caso di errore,
 * conserva il dataset storico inline come fallback.
 */
(function(){
"use strict";
window.SG_TERRITORIAL_COMPACT_READY=(async function(){
  const D=window.SG_TERRITORIAL_DATA||{};
  const clean=v=>String(v??"").trim();
  const partyNames={
    FDI:"Fratelli d'Italia",PD:"Partito Democratico",M5S:"Movimento 5 Stelle",
    FI:"Forza Italia",LEGA:"Lega",AVS:"Alleanza Verdi Sinistra",AZIONE:"Azione",
    IV:"Italia Viva",EUROPA:"+Europa",NM:"Noi Moderati",FN:"Futuro Nazionale"
  };
  function addRegionParty(target,year,region,partyId,share){
    const name=partyNames[partyId]||partyId;
    if(!target[year])target[year]={};
    if(!target[year][region])target[year][region]={};
    if(Number.isFinite(Number(share)))target[year][region][name]=Number(share);
  }
  function mergePolitical(bundle){
    D.politiche=D.politiche||{};
    D.politicheRegioni=D.politicheRegioni||{camera:{},senato:{}};
    for(const year of ["2018","2022"]){
      D.politiche[year]=D.politiche[year]||{camera:{},senato:{}};
      for(const chamber of ["camera","senato"]){
        const src=bundle.elections?.[year]?.[chamber];
        if(!src)continue;
        for(const row of src.colleges||[]){
          const cid=clean(row.collegeId);
          if(!cid)continue;
          const shares={};
          for(const p of row.parties||[]){ if(p.partyId) shares[partyNames[p.partyId]||p.partyId]=Number(p.share)||0; }
          if(Object.keys(shares).length){
            const key=year==="2022" ? cid : cid;
            D.politiche[year][chamber][key]=shares;
          }
        }
        const byRegion={};
        for(const row of src.regions||[])byRegion[row.region]={};
        for(const row of src.regions||[])for(const p of row.parties||[]){
          const name=partyNames[p.partyId]||p.partyId;
          byRegion[row.region][name]=Number(p.share)||0;
        }
        D.politicheRegioni[chamber][year]=byRegion;
      }
    }
  }
  function mergeEuropean(bundle){
    D.europee=D.europee||{};
    for(const year of ["2019","2024"]){
      const src=bundle.elections?.[year]?.regions||[];
      const out={};
      for(const row of src){
        const obj={};
        for(const p of row.parties||[]){
          const name=partyNames[p.partyId]||p.partyId;
          obj[name]=Number(p.share)||0;
        }
        out[row.region]=obj;
      }
      D.europee[year]=out;
    }
  }
  try{
    const [pRes,eRes]=await Promise.all([
      fetch("trend-data-politiche.json?v=20261012-politiche-v1",{cache:"no-store"}),
      fetch("trend-data-europee.json?v=20261012-europee-v1",{cache:"no-store"})
    ]);
    if(!pRes.ok||!eRes.ok)throw new Error("HTTP "+pRes.status+"/"+eRes.status);
    const [p,e]=await Promise.all([pRes.json(),eRes.json()]);
    if(p.version!=="2026-10-12-politiche-v1")throw new Error("dataset Politiche non riconosciuto");
    if(e.version!=="2026-10-12-europee-v1")throw new Error("dataset Europee non riconosciuto");
    mergePolitical(p);
    mergeEuropean(e);
    D.compactSourcesLoaded=true;
    D.compactVersions={politiche:p.version,europee:e.version};
    window.SG_TERRITORIAL_DATA=D;
    return {ok:true,politiche:p.version,europee:e.version};
  }catch(err){
    console.warn("Trend compact data: fallback al dataset inline",err);
    D.compactSourcesLoaded=false;
    D.compactLoadError=String(err?.message||err);
    window.SG_TERRITORIAL_DATA=D;
    return {ok:false,error:D.compactLoadError};
  }
})();
})();
