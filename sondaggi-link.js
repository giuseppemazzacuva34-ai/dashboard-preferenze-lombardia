(function(){
"use strict";

const SG_DASH_VERSION="20261011-dashboard-scenari-v2";

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

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
}

const TESTS=[
  {id:"A",name:"NESSUN PREMIO",desc:"Vincitore diverso nelle due Camere.",expected:"Premio 0 Camera · 0 Senato.",coalitions:["Centrodestra","Centrosinistra"]},
  {id:"B",name:"PREMIO 42/42",desc:"Stesso soggetto primo nelle due Camere e al 42,0%.",expected:"Premio 70 Camera + 35 Senato.",coalitions:["Centrodestra","Centrosinistra"]},
  {id:"C",name:"41,9 / 42,0",desc:"Il soggetto arriva al 42,0% solo in una Camera.",expected:"Nessun premio in entrambe le Camere.",coalitions:["Centrodestra","Centrosinistra"]},
  {id:"D",name:"COALIZIONE 10,0%",desc:"Coalizione esattamente al 10,0% con una lista al 3,0%.",expected:"Coalizione qualificata al limite.",coalitions:["Coalizione Test 10%"]},
  {id:"E",name:"LISTA 3,0%",desc:"Una lista è al 3,0% e una a 2,9%.",expected:"3,0% ammesso · 2,9% escluso.",coalitions:[]},
  {id:"F",name:"SENATO 20% REGIONALE",desc:"Lista sotto il 3% nazionale ma al 20,0% in Lombardia.",expected:"Ammessa in Lombardia per la deroga regionale.",coalitions:[]}
];

function scenarioMarkup(){
  return '<section id="sgScenariPossibili" class="sg-dashboard-scenarios">'+
    '<div class="sgds-head"><div><b>SCENARI POSSIBILI</b><small>Banco di prova del simulatore · casi limite già preparati</small></div><strong>6 TEST</strong></div>'+
    '<div class="sgds-grid">'+
      TESTS.map(t=>'<button type="button" class="sgds-case" data-sg-test="'+t.id+'"><strong>TEST '+t.id+'</strong><b>'+t.name+'</b><small>'+t.desc+'</small><em>'+t.expected+'</em><span class="sgds-coal">Coalizioni: '+(t.coalitions.length?t.coalitions.join(" · "):"nessuna")+'</span></button>').join("")+
    '</div>'+
    '<div id="sgScenariDetail" class="sgds-detail"><b>Seleziona uno scenario</b><span>Il dettaglio apparirà qui.</span></div>'+
  '</section>';
}

function installStyles(){
  if(document.getElementById("sg-dashboard-scenarios-style"))return;
  const st=document.createElement("style");
  st.id="sg-dashboard-scenarios-style";
  st.textContent=
    "#sgScenariPossibili{display:block!important;clear:both!important;width:100%!important;box-sizing:border-box!important;margin:10px 0;padding:11px;border:1px solid #2d6d9a;border-radius:10px;background:#0c3554;color:#eaf4fb;box-sizing:border-box}"+
    "#sgScenariPossibili .sgds-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}"+
    "#sgScenariPossibili .sgds-head b{display:block;font-size:11px;letter-spacing:.3px}"+
    "#sgScenariPossibili .sgds-head small{display:block;margin-top:3px;color:#9ebdd0;font-size:7px}"+
    "#sgScenariPossibili .sgds-head strong{font-size:7px;border:1px solid #3e83ac;border-radius:99px;padding:4px 7px;color:#7ecaff}"+
    "#sgScenariPossibili .sgds-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}"+
    "#sgScenariPossibili .sgds-case{display:block;width:100%;min-width:0;text-align:left;padding:9px;border:1px solid #295e7e;border-radius:8px;background:#0a2942;color:#eaf4fb;cursor:pointer;box-sizing:border-box}"+
    "#sgScenariPossibili .sgds-case:hover,#sgScenariPossibili .sgds-case.active{border-color:#5bb8f0;background:#103e5e}"+
    "#sgScenariPossibili .sgds-case strong{display:block;color:#7ecaff;font-size:7px}"+
    "#sgScenariPossibili .sgds-case b{display:block;margin-top:3px;font-size:9px}"+
    "#sgScenariPossibili .sgds-case small{display:block;margin-top:4px;color:#a7c3d5;font-size:6.5px;line-height:1.3}"+
    "#sgScenariPossibili .sgds-case em{display:block;margin-top:5px;color:#dcecf6;font-style:normal;font-weight:700;font-size:6.5px}"+
    "#sgScenariPossibili .sgds-detail{display:none;margin-top:8px;padding:9px;border:1px solid #285c7d;border-radius:8px;background:#09263c}"+
    "#sgScenariPossibili .sgds-detail b{display:block;font-size:8px}"+
    "#sgScenariPossibili .sgds-detail span{display:block;margin-top:4px;color:#a0bacb;font-size:7px}"+
    "#sgScenariPossibili .sgds-coal{display:block;margin-top:5px;color:#7fcfff;font-size:6.5px;font-weight:900}"+
    ".sg-scenari-link{position:relative}"+
    ".sg-scenari-link::after{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;margin-left:5px;background:#55b9ff;vertical-align:middle}"+
    "@media(max-width:820px){#sgScenariPossibili .sgds-grid{grid-template-columns:1fr 1fr}}"+
    "@media(max-width:520px){#sgScenariPossibili .sgds-grid{grid-template-columns:1fr}#sgScenariPossibili .sgds-head{display:block}#sgScenariPossibili .sgds-head strong{display:inline-block;margin-top:6px}}#sgScenariPossibili .sgds-actions{margin-top:8px;display:flex;justify-content:flex-end}#sgScenariPossibili .sgds-actions button{border:1px solid #3c6e8f;border-radius:7px;background:#0a2942;color:#dcecf6;padding:7px 10px;font-size:7px;font-weight:900;cursor:pointer}#sgScenariPossibili .sgds-pass{padding:7px 9px;margin-bottom:6px;border:1px solid #2f9362;border-radius:7px;background:#123a2a;color:#bff0d0;font-size:9px;font-weight:900}#sgScenariPossibili .sgds-fail{padding:7px 9px;margin-bottom:6px;border:1px solid #9f4b57;border-radius:7px;background:#3a1d25;color:#ffd7de;font-size:9px;font-weight:900}#sgScenariPossibili .sgds-case.active-pass{border-color:#36a96f;background:#103c2c}#sgScenariPossibili .sgds-case.active-fail{border-color:#c15866;background:#3e1f28}#sgScenariPossibili .sgds-result{display:flex;gap:12px;flex-wrap:wrap;margin:7px 0}.sgds-result span{font-size:7px;color:#a9c2d2}.sgds-table-wrap{overflow:auto;margin-top:7px}.sgds-table-wrap table{width:100%;border-collapse:collapse;min-width:560px}.sgds-table-wrap th,.sgds-table-wrap td{border:1px solid #244b64;padding:5px;font-size:6.5px;text-align:left}.sgds-table-wrap th{color:#8dcfff;background:#0a2942}";
  document.head.appendChild(st);
}

function visible(el){
  try{
    const cs=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    return cs.display!=="none"&&cs.visibility!=="hidden"&&r.width>0&&r.height>0;
  }catch(_){return false;}
}

function findSondaggiNav(){
  const all=[...document.querySelectorAll("button,a,[role='tab']")];
  const visibleAll=all.filter(visible);
  const exact=visibleAll.find(el=>norm(el.textContent)==="SCENARIO NAZIONALE");
  const loose=visibleAll.find(el=>norm(el.textContent).includes("SCENARIO NAZIONALE"));
  const anchor=exact||loose;
  if(!anchor)return null;

  let nav=anchor.parentElement||anchor;
  for(let i=0;i<7&&nav;i++,nav=nav.parentElement){
    const t=norm(nav.textContent);
    if(t.includes("ITALIA / REGIONI")&&
       (t.includes("CALCOLO SEGGI LOMBARDIA")||t.includes("CALCOLO SEGGI")))return {anchor,nav};
  }
  return {anchor,nav:anchor.parentElement||anchor};
}

function findSondaggiFallback(){
  const candidates=[...document.querySelectorAll("h1,h2,h3,h4,div,strong,span")].filter(visible);
  const title=candidates.find(el=>{
    const t=norm(el.textContent);
    return t.includes("SONDAGGI")&&t.includes("NUOVO SISTEMA ELETTORALE");
  });
  if(!title)return null;
  let host=title.parentElement||title;
  for(let i=0;i<5&&host;i++,host=host.parentElement){
    const t=norm(host.textContent);
    if(t.includes("SCENARIO NAZIONALE")||t.includes("ITALIA / REGIONI"))return host;
  }
  return title.parentElement||title;
}

function formatTestValue(v){
  if(v===null||v===undefined)return "—";
  if(typeof v==="object")return v.id||v.name||"presente";
  if(typeof v==="number")return Number(v).toLocaleString("it-IT",{maximumFractionDigits:2});
  if(typeof v==="boolean")return v?"SÌ":"NO";
  return String(v);
}

function testClick(test){
  const detail=document.getElementById("sgScenariDetail");
  const item=TESTS.find(x=>x.id===test);
  if(!detail||!item)return;

  const api=window.sondaggiTestAPI;
  if(!api||typeof api.run!=="function"){
    detail.style.display="block";
    detail.innerHTML="<b>TEST "+item.id+" · "+item.name+"</b><span>Il motore Sondaggi non è ancora pronto. Riprovo automaticamente…</span>";
    setTimeout(()=>testClick(test),700);
    return;
  }

  detail.style.display="block";
  detail.innerHTML="<b>TEST "+item.id+" · "+item.name+"</b><span>Caricamento scenario e ricalcolo del Parlamento…</span>";

  setTimeout(()=>{
    let result;
    try{result=api.run(item.id);}catch(err){result={id:item.id,pass:false,error:String(err&&err.message||err)};}

    if(!result||result.error){
      detail.innerHTML="<div class='sgds-fail'>❌ TEST FALLITO</div><b>TEST "+item.id+" · "+item.name+"</b><span>"+(result&&result.error||"Errore durante il test.")+"</span>";
      return;
    }

    const status=result.pass
      ?"<div class='sgds-pass'>✅ TEST SUPERATO</div>"
      :"<div class='sgds-fail'>❌ TEST FALLITO</div>";

    const rows=(result.checks||[]).map(x=>
      "<tr><td>"+x.label+"</td><td>"+formatTestValue(x.actual)+"</td><td>"+formatTestValue(x.expected)+"</td><td>"+(x.ok?"✅":"❌")+"</td></tr>"
    ).join("");

    detail.innerHTML=
      status+
      "<b>TEST "+item.id+" · "+item.name+"</b>"+
      "<span>"+item.desc+"</span>"+
      "<span style='margin-top:5px;color:#dcecf6;font-weight:900'>Atteso: "+item.expected+"</span>"+
      "<span style='margin-top:5px;color:#7fcfff;font-weight:900'>Coalizioni previste: "+(item.coalitions.length?item.coalitions.join(" · "):"nessuna")+"</span>"+
      "<div class='sgds-result'><span>Vincitore premio: <b>"+(result.winner||"nessuno")+"</b></span><span>Premio Camera: <b>"+result.cameraPrize+"</b> · Senato: <b>"+result.senatePrize+"</b></span></div>"+
      "<div class='sgds-table-wrap'><table><thead><tr><th>Controllo</th><th>Calcolato</th><th>Atteso</th><th>Esito</th></tr></thead><tbody>"+rows+"</tbody></table></div>";

    document.querySelectorAll("#sgScenariPossibili .sgds-case").forEach(b=>b.classList.remove("active","active-pass","active-fail"));
    const active=document.querySelector('#sgScenariPossibili [data-sg-test="'+item.id+'"]');
    if(active)active.classList.add(result.pass?"active-pass":"active-fail");
  },20);
}

function wireScenarioBank(bank){
  bank.querySelectorAll("[data-sg-test]").forEach(btn=>{
    btn.addEventListener("click",()=>testClick(btn.getAttribute("data-sg-test")||""));
  });
  const restore=bank.querySelector("#sgScenariRestore");
  if(restore){
    restore.addEventListener("click",()=>{
      const api=window.sondaggiTestAPI;
      const detail=bank.querySelector("#sgScenariDetail");
      if(!api||typeof api.restore!=="function"){
        if(detail)detail.innerHTML="<b>Impossibile ripristinare</b><span>Il motore Sondaggi non è ancora pronto.</span>";
        return;
      }
      const ok=api.restore();
      bank.querySelectorAll(".sgds-case").forEach(x=>x.classList.remove("active","active-pass","active-fail"));
      if(detail){
        detail.style.display="block";
        detail.innerHTML=ok
          ?"<div class='sgds-pass'>✅ STATO PRE-TEST RIPRISTINATO</div><span>I dati precedenti al test sono stati recuperati.</span>"
          :"<b>Nessun backup disponibile</b><span>Non c'è uno stato pre-test da ripristinare.</span>";
      }
    });
  }
}

function installScenarioBank(){
  if(document.getElementById("sgScenariPossibili"))return true;
  const found=findSondaggiNav();
  if(found){
    installStyles();
    const wrap=document.createElement("div");
    wrap.innerHTML=scenarioMarkup();
    const bank=wrap.firstElementChild;
    found.nav.insertAdjacentElement("afterend",bank);

    const tab=found.anchor.cloneNode(true);
    tab.removeAttribute("id");tab.removeAttribute("href");tab.removeAttribute("name");tab.removeAttribute("data-tab");
    tab.classList.add("sg-scenari-link");
    tab.textContent="Scenari possibili";
    tab.addEventListener("click",ev=>{
      ev.preventDefault();ev.stopPropagation();
      bank.scrollIntoView({behavior:"smooth",block:"start"});
    });
    found.nav.appendChild(tab);

    wireScenarioBank(bank);
    return true;
  }

  const fallback=findSondaggiFallback();
  if(!fallback)return false;
  installStyles();
  const wrap=document.createElement("div");
  wrap.innerHTML=scenarioMarkup();
  const bank=wrap.firstElementChild;
  fallback.insertAdjacentElement("afterend",bank);
  wireScenarioBank(bank);
  return true;

  return true;
}

function cleanSideSondaggi(){
  try{document.querySelectorAll("#sideSondaggi").forEach(el=>el.remove());}catch(_){}
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
setTimeout(ensure,3000);
setTimeout(ensure,6000);
setInterval(ensure,2500);

try{
  const observer=new MutationObserver(()=>ensure());
  observer.observe(document.documentElement,{subtree:true,childList:true});
}catch(_){}

})();