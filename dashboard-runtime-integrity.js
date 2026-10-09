/* DASHBOARD RUNTIME INTEGRITY GUARD
 * Protegge i dataset sorgente della dashboard da modifiche accidentali
 * introdotte da moduli futuri. Non corregge automaticamente i dati:
 * segnala una violazione senza alterare il risultato.
 */
(function(){
  "use strict";

  const EXPECTED_PROVINCE_COUNTS = Object.freeze({
    BG:243, BS:205, CO:147, CR:113, LC:84, LO:60,
    MN:64, MI:133, MB:55, PV:184, SO:77, VA:136
  });

  const state = window.__dashboardIntegrity = window.__dashboardIntegrity || {
    ready:false,
    ok:null,
    broken:false,
    reason:"",
    baseline:null,
    lastAudit:null
  };

  function normalize(value){
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toUpperCase()
      .replace(/\s+/g," ")
      .trim();
  }

  function provinceCode(value){
    const k=normalize(value);
    const map={
      BG:"BG",BERGAMO:"BG",
      BS:"BS",BRESCIA:"BS",
      CO:"CO",COMO:"CO",
      CR:"CR",CREMONA:"CR",
      LC:"LC",LECCO:"LC",
      LO:"LO",LODI:"LO",
      MN:"MN",MANTOVA:"MN",
      MI:"MI",MILANO:"MI",
      MB:"MB","MONZA E DELLA BRIANZA":"MB","MONZA E BRIANZA":"MB",
      PV:"PV",PAVIA:"PV",
      SO:"SO",SONDRIO:"SO",
      VA:"VA",VARESE:"VA"
    };
    return map[k]||k;
  }

  function stableSerialize(value){
    try{
      return JSON.stringify(value, function(key,val){
        if(val && typeof val==="object" && !Array.isArray(val)){
          const ordered={};
          Object.keys(val).sort().forEach(k=>{ordered[k]=val[k];});
          return ordered;
        }
        return val;
      });
    }catch(_){
      return String(value);
    }
  }

  async function sha256(value){
    const text=stableSerialize(value);
    if(window.crypto?.subtle && window.TextEncoder){
      const bytes=new TextEncoder().encode(text);
      const digest=await window.crypto.subtle.digest("SHA-256",bytes);
      return Array.from(new Uint8Array(digest))
        .map(b=>b.toString(16).padStart(2,"0"))
        .join("");
    }
    /* Fallback non-cryptographic fingerprint: used only when Web Crypto is
       unavailable. The Git integrity check remains authoritative. */
    let h1=0x811c9dc5,h2=0x01000193;
    for(let i=0;i<text.length;i++){
      const c=text.charCodeAt(i);
      h1^=c; h1=Math.imul(h1,0x01000193);
      h2^=c; h2=Math.imul(h2,0x85ebca6b);
    }
    return (h1>>>0).toString(16).padStart(8,"0")+"-"+
           (h2>>>0).toString(16).padStart(8,"0")+"-"+text.length;
  }

  function geoAudit(){
    const geo=window.GEO;
    if(!Array.isArray(geo)){
      return {ok:false,reason:"GEO non disponibile",total:0,byProvince:{}};
    }
    const seen=new Set();
    const byProvince=Object.create(null);
    for(const row of geo){
      const p=provinceCode(row?.prov);
      const c=normalize(row?.comune);
      if(!p||!c) continue;
      const key=p+"|"+c;
      seen.add(key);
      byProvince[p]=(byProvince[p]||0)+1;
    }
    const expected=EXPECTED_PROVINCE_COUNTS;
    const okTotal=seen.size===1501;
    const okProvince=Object.keys(expected).every(p=>byProvince[p]===expected[p]);
    const okSet=Object.keys(byProvince).every(p=>Object.prototype.hasOwnProperty.call(expected,p));
    return {
      ok:okTotal&&okProvince&&okSet,
      total:seen.size,
      byProvince,
      reason:okTotal&&okProvince&&okSet?"":"Geografia Lombardia non conforme"
    };
  }

  function showWarning(reason){
    state.broken=true;
    state.ok=false;
    state.reason=reason;
    try{
      let banner=document.getElementById("dashboard-integrity-warning");
      if(!banner){
        banner=document.createElement("div");
        banner.id="dashboard-integrity-warning";
        banner.style.cssText=[
          "position:fixed","top:10px","left:50%","transform:translateX(-50%)",
          "z-index:99999","max-width:min(92vw,900px)","padding:11px 15px",
          "border:2px solid #b91c1c","border-radius:10px",
          "background:#fff1f2","color:#7f1d1d",
          "font:600 13px/1.35 system-ui,sans-serif",
          "box-shadow:0 8px 24px rgba(0,0,0,.18)"
        ].join(";");
        document.body?.appendChild(banner);
      }
      banner.textContent="CONTROLLO INTEGRITÀ DATI: "+reason+
        ". Nessun dato è stato modificato automaticamente.";
    }catch(_){}
    console.error("[Dashboard Integrity]",reason);
  }

  async function capture(){
    const geo=window.GEO;
    const raw=window.RAW;
    const euro=window.EURO_RAW;
    if(!Array.isArray(geo) || !Array.isArray(raw) || !Array.isArray(euro)){
      return false;
    }

    const audit=geoAudit();
    state.lastAudit=audit;
    if(!audit.ok){
      showWarning(audit.reason+" (totale rilevato: "+audit.total+")");
      return true;
    }

    const baseline={
      GEO:await sha256(geo),
      RAW:await sha256(raw),
      EURO_RAW:await sha256(euro)
    };
    state.baseline=baseline;
    state.ready=true;
    state.ok=true;
    state.broken=false;
    state.reason="";
    return true;
  }

  async function check(){
    if(!state.ready || !state.baseline)return;
    try{
      const audit=geoAudit();
      state.lastAudit=audit;
      if(!audit.ok){
        showWarning(audit.reason+" (totale rilevato: "+audit.total+")");
        return;
      }

      const current={
        GEO:await sha256(window.GEO),
        RAW:await sha256(window.RAW),
        EURO_RAW:await sha256(window.EURO_RAW)
      };

      for(const key of ["GEO","RAW","EURO_RAW"]){
        if(current[key]!==state.baseline[key]){
          showWarning("Dataset sorgente "+key+" modificato durante l'esecuzione.");
          return;
        }
      }

      if(!state.broken){
        state.ok=true;
        state.reason="";
      }
    }catch(err){
      state.ok=false;
      state.reason="Controllo integrità non disponibile";
      console.error("[Dashboard Integrity] audit error",err);
    }
  }

  async function boot(){
    let attempts=0;
    const timer=setInterval(async()=>{
      attempts++;
      if(await capture()){
        clearInterval(timer);
        window.setTimeout(check,1500);
        window.setInterval(check,5000);
      }else if(attempts>=120){
        clearInterval(timer);
        state.ok=false;
        state.reason="Dataset sorgente non inizializzato";
        console.warn("[Dashboard Integrity] Dataset non inizializzato entro il tempo previsto.");
      }
    },100);
  }

  window.dashboardIntegrityCheck=check;
  window.dashboardIntegrityStatus=function(){
    return {
      ready:state.ready,
      ok:state.ok,
      broken:state.broken,
      reason:state.reason,
      geoAudit:state.lastAudit,
      baseline:state.baseline
    };
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }
})();
