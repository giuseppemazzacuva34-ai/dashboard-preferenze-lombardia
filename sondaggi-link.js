(function(){
"use strict";

/* ===== SONDAGGI DASHBOARD · NAVIGAZIONE UNICA + SCENARI POSSIBILI ===== */
const SG_DASH_VERSION="20261011-dashboard-scenari-v1";

function loadScript(id,src){
  try{
    if(document.getElementById(id))return;
    const s=document.createElement("script");
    s.id=id;s.src=src;s.async=false;
    (document.head||document.documentElement).appendChild(s);
  }catch(err){console.error("Sondaggi script load",id,err);}
}

function loadMobileStyles(){
  try{
    if(document.getElementById("dashboard-mobile-css"))return;
    const link=document.createElement("link");
    link.id="dashboard-mobile-css";
    link.rel="stylesheet";
    link.href="dashboard-mobile.css?v=20261011-1";
    (document.head||document.documentElement).appendChild(link);
  }catch(err){console.error("Dashboard mobile styles",err);}
}

function loadLawEngine(){
  loadScript("sondaggi-law-20261008","sondaggi-law-20261008.js?v=20261009-legal");
}

function loadIntegrityGuard(){
  loadScript("dashboard-runtime-integrity","dashboard-runtime-integrity.js?v=20261009-1");
}

const SCENARI_POSSIBILI=[
  {id:"A",name:"NESSUN PREMIO",desc:"Vincitore diverso nelle due Camere.",expected:"Premio 0 Camera · 0 Senato.",camera:{FdI:40,PD:41.5,M5S:6,AVS:3,FI:3.5,LEGA:2,FN:1,AZ:1,IV:.5,PIU:.5,NM:0,ALTRI:1},senate:{FdI:42,PD:34,M5S:3,AVS:2,FI:3.5,LEGA:3,FN:2,AZ:2,IV:1,PIU:1,NM:1.5,ALTRI:5}},
  {id:"B",name:"PREMIO 42/42",desc:"Stesso soggetto primo nelle due Camere e al 42,0% esatto.",expected:"Premio 70 Camera + 35 Senato.",camera:{FdI:27,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.5},senate:{FdI:27,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.5}},
  {id:"C",name:"41,9 / 42,0",desc:"Il soggetto arriva al 42,0% solo in una Camera.",expected:"Nessun premio in entrambe le Camere.",camera:{FdI:26.9,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.6},senate:{FdI:27,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.5}},
  {id:"D",name:"COALIZIONE 10,0%",desc:"Coalizione esattamente al 10,0% con una lista al 3,0%.",expected:"Coalizione qualificata al limite.",camera:{FdI:7,PD:20,M5S:12,AVS:6,FI:10,LEGA:3,FN:7,AZ:5,IV:4,PIU:3,NM:2,ALTRI:21},senate:{FdI:7,PD:20,M5S:12,AVS:6,FI:10,LEGA:3,FN:7,AZ:5,IV:4,PIU:3,NM:2,ALTRI:21}},
  {id:"E",name:"LISTA 3,0%",desc:"Una lista è al 3,0% e una a 2,9%, fuori da coalizioni.",expected:"Lista al 3,0% ammessa · lista al 2,9% esclusa.",camera:{FdI:25,PD:20,M5S:15,AVS:7,FI:7,LEGA:6,FN:4,AZ:3,IV:2.9,PIU:2,NM:1,ALTRI:7.1},senate:{FdI:25,PD:20,M5S:15,AVS:7,FI:7,LEGA:6,FN:4,AZ:3,IV:2.9,PIU:2,NM:1,ALTRI:7.1}},
  {id:"F",name:"SENATO 20% REGIONALE",desc:"Lista sotto il 3% nazionale ma al 20,0% in Lombardia.",expected:"Lista ammessa in Lombardia per la deroga regionale.",camera:{FdI:2.5,PD:25,M5S:15,AVS:7,FI:7,LEGA:6,FN:5,AZ:4,IV:3,PIU:2,NM:1,ALTRI:22.5},senate:{FdI:2.5,PD:25,M5S:15,AVS:7,FI:7,LEGA:6,FN:5,AZ:4,IV:3,PIU:2,NM:1,ALTRI:22.5},lombardia:{FdI:20,PD:25,M5S:15,AVS:7,FI:7,LEGA:6,FN:5,AZ:4,IV:3,PIU:2,NM:1,ALTRI:5}}
];

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
}

function scenarioRows(obj){
  return Object.entries(obj).map(([k,v])=>'<span><b>'+k+'</b> '+Number(v).toLocaleString("it-IT",{maximumFractionDigits:1})+'%</span>').join("");
}

function scenarioBankMarkup(){
  return '<div class="sg-dashboard-scenarios" id="sgDashboardScenarios">'+
    '<div class="sgds-head"><div><b>SCENARI POSSIBILI</b><small>Banco di prova del simulatore · casi limite già preparati</small></div><span>6 TEST</span></div>'+
    '<div class="sgds-grid">'+
      SCENARI_POSSIBILI.map(s=>'<button type="button" class="sgds-case" data-sg-scenario="'+s.id+'"><strong>TEST '+s.id+'</strong><b>'+s.name+'</b><small>'+s.desc+'</small><em>'+s.expected+'</em></button>').join("")+
    '</div>'+
    '<div class="sgds-detail" id="sgDashboardScenarioDetail"><b>Seleziona un test</b><span>Il dettaglio dello scenario comparirà qui.</span></div>'+
  '</div>';
}

function installScenarioBank(){
  const panel=document.getElementById("sg7");
  if(!panel)return false;
  if(panel.querySelector("#sgDashboardScenarios"))return true;

  const styleId="sg-dashboard-scenarios-style";
  if(!document.getElementById(styleId)){
    const st=document.createElement("style");
    st.id=styleId;
    st.textContent=
      ".sg-dashboard-scenarios{margin:10px 0;padding:10px;border:1px solid #2b6590;border-radius:10px;background:#0d3554;color:#eaf4fb;box-sizing:border-box}"+
      ".sgds-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.sgds-head b{display:block;font-size:11px;letter-spacing:.4px}.sgds-head small{display:block;margin-top:3px;color:#9dbbd0;font-size:7px}.sgds-head>span{font-size:7px;font-weight:900;color:#79c7ff;border:1px solid #397da7;border-radius:999px;padding:4px 7px}.sgds-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.sgds-case{display:block;text-align:left;padding:8px;border:1px solid #285c7d;border-radius:8px;background:#0a2942;color:#eaf4fb;cursor:pointer}.sgds-case:hover,.sgds-case.active{border-color:#52aef0;background:#103c5d}.sgds-case strong{display:block;color:#79c7ff;font-size:7px}.sgds-case b{display:block;margin-top:3px;font-size:9px}.sgds-case small{display:block;margin-top:4px;color:#a5c2d5;font-size:6.5px;line-height:1.3}.sgds-case em{display:block;margin-top:5px;color:#dcecf6;font-size:6.5px;font-style:normal;font-weight:700}.sgds-detail{display:none;margin-top:8px;padding:8px;border:1px solid #285c7d;border-radius:8px;background:#09253b}.sgds-detail b{display:block;font-size:8px}.sgds-detail>span{display:block;margin-top:3px;color:#9eb8ca;font-size:7px}.sgds-values{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.sgds-values>div{border:1px solid #244f6a;border-radius:7px;padding:7px}.sgds-values h4{margin:0 0 5px;font-size:7px;color:#79c7ff}.sgds-values span{display:inline-block;margin:2px 3px 2px 0;font-size:6px;color:#d7e7f1}.sgds-values b{color:#fff}.sgds-nav-added{position:relative}.sgds-nav-added::after{content:"";display:inline-block;width:5px;height:5px;margin-left:5px;border-radius:50%;background:#54b5ff;vertical-align:middle}@media(max-width:820px){.sgds-grid{grid-template-columns:1fr 1fr}.sgds-values{grid-template-columns:1fr}}@media(max-width:520px){.sgds-grid{grid-template-columns:1fr}.sgds-head{display:block}.sgds-head>span{display:inline-block;margin-top:6px}";
    document.head.appendChild(st);
  }

  const wrap=document.createElement("div");
  wrap.innerHTML=scenarioBankMarkup();
  const bank=wrap.firstElementChild;

  const tabs=[...panel.querySelectorAll("button,a,[role=tab]")];
  const baseTab=tabs.find(el=>norm(el.textContent)==="SCENARIO NAZIONALE");
  if(baseTab){
    const nav=baseTab.parentElement;
    const tab=baseTab.cloneNode(true);
    tab.removeAttribute("id");
    tab.removeAttribute("name");
    tab.removeAttribute("href");
    tab.removeAttribute("data-tab");
    tab.classList.add("sgds-nav-added");
    tab.textContent="Scenari possibili";
    tab.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();
      bank.scrollIntoView({behavior:"smooth",block:"start"});
    });
    nav.appendChild(tab);
    nav.insertAdjacentElement("afterend",bank);
  }else{
    panel.insertBefore(bank,panel.firstChild);
  }

  bank.querySelectorAll("[data-sg-scenario]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      bank.querySelectorAll(".sgds-case").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      const s=SCENARI_POSSIBILI.find(x=>x.id===btn.dataset.sgScenario);
      const detail=bank.querySelector("#sgDashboardScenarioDetail");
      if(!s||!detail)return;
      const extra=s.lombardia?'<div><h4>Senato · Lombardia</h4><div class="sgds-values-list">'+scenarioRows(s.lombardia)+'</div></div>':"";
      detail.style.display="block";
      detail.innerHTML='<b>TEST '+s.id+' · '+s.name+'</b><span>'+s.desc+'</span><span style="margin-top:5px;color:#dcecf6;font-weight:900">'+s.expected+'</span><div class="sgds-values"><div><h4>Camera nazionale</h4>'+scenarioRows(s.camera)+'</div><div><h4>Senato nazionale</h4>'+scenarioRows(s.senate)+'</div>'+extra+'</div>';
    });
  });

  return true;
}

function cleanSideSondaggi(){
  try{
    document.querySelectorAll("#sideSondaggi").forEach(el=>el.remove());
  }catch(_){}
}

function ensure(){
  cleanSideSondaggi();
  installScenarioBank();
}

loadMobileStyles();
loadLawEngine();
loadIntegrityGuard();

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensure,{once:true});
else ensure();
setTimeout(ensure,200);
setTimeout(ensure,700);
setTimeout(ensure,1500);
setInterval(ensure,2500);

try{
  const observer=new MutationObserver(()=>{installScenarioBank();cleanSideSondaggi();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
}catch(_){}

})();