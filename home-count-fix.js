(function(){
"use strict";

/*
 * Correzione SOLA visualizzazione del contatore comuni.
 * Non modifica render, dati, eventi dei pulsanti o calcoli.
 */
function normalizeHomeComuneCount(){
  try{
    const wrong=/^(1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504)$/;

    const setNumeric=(el)=>{
      if(!el)return;
      const t=String(el.textContent||"").trim();
      if(wrong.test(t)) el.textContent="1.501";
    };

    setNumeric(document.getElementById("k-comuni"));

    document.querySelectorAll("#homeQuick .quick-item").forEach((item,i)=>{
      const text=String(item.textContent||"");
      if(/\bCOMUNI\b/i.test(text)){
        const small=item.querySelector("small");
        if(small){
          small.textContent=small.textContent
            .replace(/1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504/g,"1.501");
        }
      }
    });

    document.querySelectorAll(".home-kpi,.top-kpis .kpi,.home-status").forEach(el=>{
      if(/\bCOMUNI\b/i.test(String(el.textContent||""))){
        el.textContent=String(el.textContent||"")
          .replace(/1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504/g,"1.501");
      }
    });
  }catch(err){
    console.error("Home comune count fix",err);
  }
}

function scheduleHomeComuneFix(){
  normalizeHomeComuneCount();
  setTimeout(normalizeHomeComuneCount,0);
  setTimeout(normalizeHomeComuneCount,80);
  setTimeout(normalizeHomeComuneCount,250);
  setTimeout(normalizeHomeComuneCount,600);
  setTimeout(normalizeHomeComuneCount,1200);
  setTimeout(normalizeHomeComuneCount,2200);
}

function boot(){
  scheduleHomeComuneFix();

  // Intercetta SOLO il cambio macro della Home.
  document.addEventListener("click",function(ev){
    const macro=ev.target?.closest?.(".macro-tab");
    if(macro) scheduleHomeComuneFix();
  },true);

  // Intercetta anche eventuali cambi macro effettuati dal codice.
  const prev=window.dashboardSetMacro;
  if(typeof prev==="function"){
    window.dashboardSetMacro=function(v){
      const result=prev.apply(this,arguments);
      scheduleHomeComuneFix();
      return result;
    };
    window.switchElection=window.dashboardSetMacro;
  }

  window.addEventListener("load",scheduleHomeComuneFix);
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",boot,{once:true});
}else{
  boot();
}

window.forceHomeGeoCount=normalizeHomeComuneCount;
})();
