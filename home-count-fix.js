(function(){
"use strict";

const WRONG=/(1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504)/g;

function normalizeHomeComuneCount(){
  try{
    const k=document.getElementById("k-comuni");
    if(k){
      const t=String(k.textContent||"").trim();
      if(/^(1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504)$/.test(t)){
        k.textContent="1.501";
      }
    }

    document.querySelectorAll("#homeQuick .quick-item small").forEach(el=>{
      if(/\bCOMUNI\b/i.test(String(el.parentElement?.textContent||""))){
        el.textContent=String(el.textContent||"").replace(WRONG,"1.501");
      }
    });

    // Sostituisce solo i nodi testuali che contengono il conteggio:
    // non altera mai il contenuto HTML, le icone o i pulsanti del riquadro.
    const walker=document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node){
          const raw=String(node.nodeValue||"");
          if(!WRONG.test(raw)){
            WRONG.lastIndex=0;
            return NodeFilter.FILTER_REJECT;
          }
          WRONG.lastIndex=0;
          let p=node.parentElement;
          for(let i=0;p&&i<6;i++,p=p.parentElement){
            if(/\bCOMUNI\b/i.test(String(p.textContent||""))){
              return NodeFilter.FILTER_ACCEPT;
            }
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes=[];
    let node;
    while(node=walker.nextNode())nodes.push(node);
    nodes.forEach(n=>{
      WRONG.lastIndex=0;
      n.nodeValue=String(n.nodeValue||"").replace(WRONG,"1.501");
    });
  }catch(err){
    console.error("Home comune count fix",err);
  }
}

function scheduleHomeComuneFix(){
  normalizeHomeComuneCount();
  setTimeout(normalizeHomeComuneCount,80);
  setTimeout(normalizeHomeComuneCount,250);
  setTimeout(normalizeHomeComuneCount,600);
  setTimeout(normalizeHomeComuneCount,1200);
  setTimeout(normalizeHomeComuneCount,2200);
}

function boot(){
  scheduleHomeComuneFix();

  document.addEventListener("click",function(ev){
    if(ev.target?.closest?.(".macro-tab")) scheduleHomeComuneFix();
  },true);

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
