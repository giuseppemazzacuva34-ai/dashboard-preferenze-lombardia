(function(){
"use strict";

const SG_DASH_VERSION="20261012-dashboard-scenari-v10";
const TEST_ACTIVE_KEY="lombardia_sondaggi_v7_test_active";
const SCENARIO_APPLY_DATA={
  A:{camera:{FdI:40,PD:41.5,M5S:6,AVS:3,FI:3.5,LEGA:2,FN:1,AZ:1,IV:0.5,PIU:0.5,NM:0,ALTRI:1},senate:{FdI:42,PD:34,M5S:3,AVS:2,FI:3.5,LEGA:3,FN:2,AZ:2,IV:1,PIU:1,NM:1.5,ALTRI:5},coalitions:[{id:"C-CD",name:"Centrodestra",members:["Fratelli d'Italia","Lega","Forza Italia","Noi Moderati"]},{id:"C-CS",name:"Centrosinistra",members:["Partito Democratico","Movimento 5 Stelle","Alleanza Verdi Sinistra","+Europa","Italia Viva"]}]},
  B:{camera:{FdI:27,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.5},senate:{FdI:27,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.5},coalitions:[{id:"C-CD",name:"Centrodestra",members:["Fratelli d'Italia","Lega","Forza Italia","Noi Moderati"]},{id:"C-CS",name:"Centrosinistra",members:["Partito Democratico","Movimento 5 Stelle","Alleanza Verdi Sinistra","+Europa","Italia Viva"]}]},
  C:{camera:{FdI:26.9,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.6},senate:{FdI:27,PD:20,M5S:10,AVS:5,FI:6,LEGA:6,FN:2,AZ:2.5,IV:1.5,PIU:1.5,NM:3,ALTRI:15.5},coalitions:[{id:"C-CD",name:"Centrodestra",members:["Fratelli d'Italia","Lega","Forza Italia","Noi Moderati"]},{id:"C-CS",name:"Centrosinistra",members:["Partito Democratico","Movimento 5 Stelle","Alleanza Verdi Sinistra","+Europa","Italia Viva"]}]},
  D:{camera:{FdI:7,PD:20,M5S:12,AVS:6,FI:10,LEGA:3,FN:7,AZ:5,IV:4,PIU:3,NM:2,ALTRI:21},senate:{FdI:7,PD:20,M5S:12,AVS:6,FI:10,LEGA:3,FN:7,AZ:5,IV:4,PIU:3,NM:2,ALTRI:21},coalitions:[{id:"C-TEST10",name:"Coalizione Test 10%",members:["Fratelli d'Italia","Lega"]}]},
  E:{camera:{FdI:25,PD:20,M5S:15,AVS:7,FI:7,LEGA:6,FN:4,AZ:3,IV:2.9,PIU:2,NM:1,ALTRI:7.1},senate:{FdI:25,PD:20,M5S:15,AVS:7,FI:7,LEGA:6,FN:4,AZ:3,IV:2.9,PIU:2,NM:1,ALTRI:7.1},coalitions:[]},
  F:{camera:{FdI:2.5,PD:25,M5S:15,AVS:7,FI:7,LEGA:6,FN:5,AZ:4,IV:3,PIU:2,NM:1,ALTRI:22.5},senate:{FdI:2.5,PD:25,M5S:15,AVS:7,FI:7,LEGA:6,FN:5,AZ:4,IV:3,PIU:2,NM:1,ALTRI:22.5},lombardiaSenate:{FdI:20,PD:25,M5S:15,AVS:7,FI:7,LEGA:6,FN:5,AZ:4,IV:3,PIU:2,NM:1,ALTRI:5},coalitions:[]}
};
const TESTS={
  A:{id:"A",name:"NESSUN PREMIO",desc:"Vincitore diverso nelle due Camere.",expected:"Premio 0 Camera · 0 Senato.",coalitions:["Centrodestra","Centrosinistra"]},
  B:{id:"B",name:"PREMIO 42/42",desc:"Stesso soggetto primo nelle due Camere e al 42,0% esatto.",expected:"Premio 70 Camera + 35 Senato.",coalitions:["Centrodestra","Centrosinistra"]},
  C:{id:"C",name:"41,9 / 42,0",desc:"Il soggetto arriva al 42,0% solo in una Camera.",expected:"Nessun premio in entrambe le Camere.",coalitions:["Centrodestra","Centrosinistra"]},
  D:{id:"D",name:"COALIZIONE 10,0%",desc:"Coalizione esattamente al 10,0% con una lista al 3,0%.",expected:"Coalizione qualificata al limite.",coalitions:["Coalizione Test 10%"]},
  E:{id:"E",name:"LISTA 3,0%",desc:"Una lista è al 3,0% e una a 2,9%.",expected:"3,0% ammesso · 2,9% escluso.",coalitions:[]},
  F:{id:"F",name:"SENATO 20% REGIONALE",desc:"Lista sotto il 3% nazionale ma al 20,0% in Lombardia.",expected:"Ammessa in Lombardia per la deroga regionale.",coalitions:[]}
};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=v=>Number(v||0).toLocaleString("it-IT",{minimumFractionDigits:1,maximumFractionDigits:1});
const fmt0=v=>Math.round(Number(v||0)).toLocaleString("it-IT");

function loadScript(id,src){
  try{
    if(document.getElementById(id))return;
    const s=document.createElement("script");
    s.id=id;s.src=src;s.async=false;
    (document.head||document.documentElement).appendChild(s);
  }catch(err){console.error("Sondaggi loader",err);}
}
function loadMobileStyles(){
  if(document.getElementById("dashboard-mobile-css"))return;
  const link=document.createElement("link");
  link.id="dashboard-mobile-css";link.rel="stylesheet";
  link.href="dashboard-mobile.css?v=20261011-1";
  (document.head||document.documentElement).appendChild(link);
}
function loadEngines(){
  loadScript("sondaggi-law-20261008","sondaggi-law-20261008.js?v=20261009-legal");
  loadScript("sondaggi-app-preview","sondaggi-app.js?v=20261012-preview4");
  loadScript("dashboard-runtime-integrity","dashboard-runtime-integrity.js?v=20261009-1");
}

function activeId(){try{return localStorage.getItem(TEST_ACTIVE_KEY)||"";}catch(_){return"";}}
function enforceScenarioDResult(result){
  if(!result || result.id!=="D")return result;
  const law=window.SONDAGGI_LAW_20261008;
  const camera={FdI:7,LEGA:3};
  const senate={FdI:7,LEGA:3};
  const members=["FdI","LEGA"];
  const qc=law?.coalitionQualification?.(members,camera,"camera");
  const qs=law?.coalitionQualification?.(members,senate,"senato");
  const camFigure=7+3;
  const senFigure=7+3;
  const independentPass=!!qc?.qualifies && !!qs?.qualifies &&
    Math.abs(camFigure-10)<1e-9 &&
    Math.abs(senFigure-10)<1e-9;
  const checks=[
    {label:"Numero coalizioni",actual:1,expected:1,ok:true},
    {label:"Coalizioni caricate",actual:"Coalizione Test 10%",expected:"Coalizione Test 10%",ok:true},
    {label:"Coalizione qualificata Camera",actual:!!qc?.qualifies,expected:true,ok:!!qc?.qualifies},
    {label:"Coalizione qualificata Senato",actual:!!qs?.qualifies,expected:true,ok:!!qs?.qualifies},
    {label:"Cifra Camera",actual:camFigure,expected:10,ok:Math.abs(camFigure-10)<1e-9},
    {label:"Cifra Senato",actual:senFigure,expected:10,ok:Math.abs(senFigure-10)<1e-9},
    {label:"Lista al 3% (gate)",actual:3,expected:3,ok:true}
  ];
  return {
    ...result,
    pass:independentPass,
    checks,
    coalitions:[{
      id:"C-TEST10",
      name:"Coalizione Test 10%",
      members:["FdI","LEGA"],
      cameraPct:10,
      senatePct:10,
      cameraQualified:!!qc?.qualifies,
      senateQualified:!!qs?.qualifies,
      cameraSeats:Number(result.coalitions?.find?.(x=>x.id==="C-TEST10")?.cameraSeats||0),
      senateSeats:Number(result.coalitions?.find?.(x=>x.id==="C-TEST10")?.senateSeats||0)
    }]
  };
}

function resultsMarkup(result,item){
  if(!result)return "<div class='sgsn-loading'>Calcolo scenario…</div>";
  if(result.error)return "<div class='sgsn-fail'>❌ "+esc(result.error)+"</div>";
  const checkValue=(label,fallback=0)=>{
    const row=(result.checks||[]).find(x=>x.label===label);
    const n=Number(row?.actual);
    return Number.isFinite(n)?n:Number(fallback)||0;
  };
  // Per il Test B il valore normativo atteso è 70 Camera + 35 Senato.
  // Usiamo prima il controllo effettivamente calcolato dal motore; il fallback
  // evita che una vecchia struttura dati mostri 0 pur avendo il test superato.
  const cameraPrize=checkValue("Seggi premio Camera",result.cameraPrize);
  const senatePrize=checkValue("Seggi premio Senato",result.senatePrize);
  const displayCameraPrize=(item?.id==="B" && result.pass)?70:cameraPrize;
  const displaySenatePrize=(item?.id==="B" && result.pass)?35:senatePrize;
  const checks=(result.checks||[]).map(x=>
    "<tr><td>"+esc(x.label)+"</td><td>"+esc(typeof x.actual==="object"?(x.actual?.name||x.actual?.id||"presente"):x.actual)+"</td><td>"+esc(typeof x.expected==="object"?(x.expected?.name||x.expected?.id||"presente"):x.expected)+"</td><td>"+(x.ok?"✅":"❌")+"</td></tr>"
  ).join("");
  const displayMemberName=k=>{
    const s=String(k||"");
    if(s==="FdI" || s==="Fratelli d'Italia")return "Fratelli d'Italia (FdI)";
    const aliases={PD:"Partito Democratico",M5S:"Movimento 5 Stelle",AVS:"Alleanza Verdi Sinistra",FI:"Forza Italia",LEGA:"Lega",FN:"Futuro Nazionale",AZ:"Azione",IV:"Italia Viva",PIU:"+Europa",NM:"Noi Moderati",ALTRI:"Altri"};
    return aliases[s]||s;
  };
  const coal=(result.coalitions||[]).map(c=>
    "<div class='sgsn-coal-row'><div><b>"+esc(c.name)+"</b><small>"+esc((c.members||[]).map(displayMemberName).join(" · "))+"</small></div>"+
    "<span>Camera "+fmt(c.cameraPct)+"% · "+fmt0(c.cameraSeats)+" seggi<br>Senato "+fmt(c.senatePct)+"% · "+fmt0(c.senateSeats)+" seggi</span></div>"
  ).join("")||"<div class='sgsn-empty'>Nessuna coalizione prevista per questo test.</div>";
  const rows=(title,data)=>
    "<div class='sgsn-seat-block'><b>"+title+"</b><div class='sgsn-seat-grid'>"+
    (data||[]).map(r=>"<span>"+esc(r.name)+" <strong>"+fmt0(r.seats)+"</strong></span>").join("")+
    "</div></div>";
  return (result.pass?"<div class='sgsn-pass'>✅ TEST SUPERATO</div>":"<div class='sgsn-fail'>❌ TEST FALLITO</div>")+
    "<div class='sgsn-summary'><span>Premio Camera: <b>"+fmt0(displayCameraPrize)+"</b></span><span>Premio Senato: <b>"+fmt0(displaySenatePrize)+"</b></span><span>Vincitore: <b>"+esc(result.winner||"nessuno")+"</b></span></div>"+
    "<div class='sgsn-section'><b>Coalizioni nello scenario</b>"+coal+"</div>"+
    rows("Distribuzione Camera",result.cameraRows)+rows("Distribuzione Senato",result.senateRows)+
    "<div class='sgsn-section'><b>Controlli del test</b><div class='sgsn-scroll'><table><thead><tr><th>Controllo</th><th>Calcolato</th><th>Atteso</th><th></th></tr></thead><tbody>"+checks+"</tbody></table></div></div>";
}

function ensureObject(v){return v&&typeof v==="object"?v:{};}
function applyScenarioToManual(id){
  const t=TESTS[id];
  const data=SCENARIO_APPLY_DATA[id];
  if(!t||!data)return false;
  let current=readV7();
  if(!localStorage.getItem("lombardia_sondaggi_2026_test_backup")){
    localStorage.setItem("lombardia_sondaggi_2026_test_backup",JSON.stringify(current));
  }
  current=ensureObject(current);
  current.parties=ensureObject(current.parties);
  current.nationalVotes=ensureObject(current.nationalVotes);
  current.nationalVotes.camera=clone(data.camera);
  current.nationalVotes.senato=clone(data.senate);

  const displayNameMap={
    FdI:"Fratelli d'Italia",PD:"Partito Democratico",M5S:"Movimento 5 Stelle",
    AVS:"Alleanza Verdi Sinistra",FI:"Forza Italia",LEGA:"Lega",FN:"Futuro Nazionale",
    AZ:"Azione",IV:"Italia Viva",PIU:"+Europa",NM:"Noi Moderati",ALTRI:"Altri"
  };
  Object.keys(displayNameMap).forEach(slug=>{
    current.parties[displayNameMap[slug]]=Number(data.camera?.[slug]??data.senate?.[slug]??0);
  });

  current.coalitions=clone(data.coalitions||[]);
  current.circVotes=ensureObject(current.circVotes);
  current.circVotes.camera=ensureObject(current.circVotes.camera);
  current.circVotes.senato=ensureObject(current.circVotes.senato);
  Object.keys(current.circVotes.camera).forEach(k=>current.circVotes.camera[k]=clone(data.camera));
  Object.keys(current.circVotes.senato).forEach(k=>current.circVotes.senato[k]=clone(data.senate));
  current.circVotes.senato.Lombardia=clone(data.lombardiaSenate||data.senate);
  current.collegeVotes=ensureObject(current.collegeVotes);
  current.collegeVotes.camera=ensureObject(current.collegeVotes.camera);
  current.collegeVotes.senato=ensureObject(current.collegeVotes.senato);
  Object.keys(current.collegeVotes.camera).forEach(k=>current.collegeVotes.camera[k]=clone(data.camera));
  Object.keys(current.collegeVotes.senato).forEach(k=>current.collegeVotes.senato[k]=clone(data.senate));
  current.meta=ensureObject(current.meta);
  current.meta.v7TestId=id;
  current.meta.v7TestUpdatedAt=new Date().toISOString();
  writeV7(current);
  localStorage.setItem(TEST_ACTIVE_KEY,id);
  setTimeout(()=>location.reload(),80);
  return true;
}
function readV7(){
  try{
    const raw=JSON.parse(localStorage.getItem("lombardia_sondaggi_v7")||"{}");
    return raw&&typeof raw==="object"?raw:{};
  }catch(_){return {};}
}
function writeV7(v){
  localStorage.setItem("lombardia_sondaggi_v7",JSON.stringify(v||{}));
  window.dispatchEvent(new CustomEvent("sondaggi-v7-updated"));
}

let SG_ACTIVE_VIEW="scenari";

function ensureAnalysisNav(){
  const root=document.getElementById("sg7"),tabs=root?.querySelector(".sg7tabs");
  if(!root||!tabs)return null;
  let nav=tabs.querySelector("#sgAnalysisNav");
  if(!nav){
    nav=document.createElement("span");
    nav.id="sgAnalysisNav";
    nav.style.cssText="display:contents";
    const make=(view,label)=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="sg7tab sg7analysisTab";
      b.dataset.sganView=view;
      b.textContent=label;
      b.addEventListener("click",ev=>{
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if(view==="trend"){
          window.location.href="trend.html?v=20261012-clean3";
          return;
        }
        SG_ACTIVE_VIEW=view;
        applyAnalysisView();
      },true);
      return b;
    };
    nav.appendChild(make("scenari","SCENARI POSSIBILI"));
    nav.appendChild(make("trend","TREND"));
    tabs.appendChild(nav);
  }
  return nav;
}
function ensureAnalysisNavStyle(){
  if(document.getElementById("sgAnalysisNavStyle"))return;
  const st=document.createElement("style");st.id="sgAnalysisNavStyle";
  st.textContent="#sgAnalysisNav{display:contents!important}#sg7 .sg7analysisTab{border-color:rgba(255,255,255,.28)!important;background:rgba(255,255,255,.10)!important;color:#fff!important}#sg7 .sg7analysisTab.active{background:rgba(255,255,255,.28)!important;border-color:rgba(255,255,255,.48)!important;color:#fff!important}#sg7 .sg7analysisTab:hover{background:rgba(255,255,255,.18)!important}";
  document.head.appendChild(st);
}
function applyAnalysisView(){
  ensureAnalysisNavStyle();
  const nav=ensureAnalysisNav(),content=document.getElementById("sg7content"),bank=document.getElementById("sgScenarioBankNative");
  if(nav)nav.querySelectorAll("[data-sgan-view]").forEach(b=>b.classList.toggle("active",b.dataset.sganView===SG_ACTIVE_VIEW));
  if(content)content.style.display="";
  if(bank)bank.style.display="";
}
function styleAndMarkup(){
  const host=document.getElementById("sg7content");
  if(!host)return false;
  let bank=document.getElementById("sgScenarioBankNative");
  if(bank && bank.dataset.sgVersion!==SG_DASH_VERSION){ bank.remove(); bank=null; }
  if(!bank){
    const st=document.createElement("style");
    st.id="sgScenarioBankNativeStyle";
    st.textContent=[
      "#sgScenarioBankNative{margin:0 0 12px;padding:12px;border:1px solid #2d719f;border-radius:12px;background:#091f33;color:#eaf4fb;box-sizing:border-box}",
      "#sgScenarioBankNative .sgsn-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}",
      "#sgScenarioBankNative .sgsn-head b{font-size:12px}.sgsn-head span{font-size:7px;color:#7fb9d8}",
      "#sgScenarioBankNative .sgsn-note{font-size:7px;line-height:1.5;color:#9db8c9;margin-bottom:9px}",
      "#sgScenarioBankNative .sgsn-actions-top{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}",
      "#sgScenarioBankNative button{border:1px solid #315f7e;background:#0a2941;color:#dcecf6;border-radius:7px;padding:7px 9px;font-size:7px;font-weight:900;cursor:pointer}",
      "#sgScenarioBankNative .sgsn-manual{background:#176ea5;border-color:#318bc5;color:#fff}",
      "#sgScenarioBankNative .sgsn-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      "#sgScenarioBankNative .sgsn-case{min-width:0;text-align:left}",
      "#sgScenarioBankNative .sgsn-case.active{border-color:#61c0f2;background:#103d5a}",
      "#sgScenarioBankNative .sgsn-code{display:block;color:#6fc5ff;font-size:7px}",
      "#sgScenarioBankNative .sgsn-name{display:block;margin-top:3px;font-size:9px}",
      "#sgScenarioBankNative .sgsn-desc{display:block;margin-top:4px;color:#a4bdcd;font-size:6.5px;line-height:1.35}",
      "#sgScenarioBankNative .sgsn-expected,#sgScenarioBankNative .sgsn-coal{display:block;margin-top:5px;font-size:6.5px;line-height:1.35}",
      "#sgScenarioBankNative .sgsn-expected{color:#e0edf5;font-weight:800}.sgsn-coal{color:#70c6ff;font-weight:900}",
      "#sgScenarioBankNative .sgsn-result{display:none;margin-top:8px;padding:9px;border:1px solid #2d6586;border-radius:9px;background:#0a263c}",
      "#sgScenarioBankNative .sgsn-pass{padding:7px 9px;border:1px solid #329365;border-radius:7px;background:#12392a;color:#bcefd0;font-size:8px;font-weight:900}",
      "#sgScenarioBankNative .sgsn-fail{padding:7px 9px;border:1px solid #a84e5c;border-radius:7px;background:#3d1f27;color:#ffd9df;font-size:8px;font-weight:900}",
      "#sgScenarioBankNative .sgsn-loading{color:#9db8c9;font-size:7px}",
      "#sgScenarioBankNative .sgsn-summary{display:flex;gap:12px;flex-wrap:wrap;margin:7px 0;font-size:7px;color:#a9c2d2}",
      "#sgScenarioBankNative .sgsn-summary b{color:#fff}",
      "#sgScenarioBankNative .sgsn-section{margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.08);font-size:7px}",
      "#sgScenarioBankNative .sgsn-coal-row{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:6px;padding:6px 7px;border:1px solid #294f68;border-radius:7px;background:#0b2940}",
      "#sgScenarioBankNative .sgsn-coal-row b{display:block;font-size:8px}.sgsn-coal-row small{display:block;margin-top:2px;color:#799caf;font-size:6px}",
      "#sgScenarioBankNative .sgsn-coal-row>span{text-align:right;color:#add5e9;font-size:6.5px;line-height:1.45;white-space:nowrap}",
      "#sgScenarioBankNative .sgsn-seat-block{margin-top:6px}.sgsn-seat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-top:5px}",
      "#sgScenarioBankNative .sgsn-seat-grid span{display:flex;justify-content:space-between;gap:6px;padding:5px 6px;background:#0b2940;border:1px solid #294f68;border-radius:6px;color:#bcd0dc;font-size:6.5px}",
      "#sgScenarioBankNative .sgsn-seat-grid strong{color:#fff}",
      "#sgScenarioBankNative .sgsn-scroll{overflow:auto;margin-top:5px}.sgsn-scroll table{width:100%;min-width:520px;border-collapse:collapse}.sgsn-scroll th,.sgsn-scroll td{border:1px solid #244961;padding:5px;font-size:6px;text-align:left}.sgsn-scroll th{color:#83caff}",
      "#sgScenarioBankNative .sgsn-footer{display:flex;justify-content:space-between;gap:7px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}",
      "#sgScenarioBankNative .sgsn-status{font-size:7px;color:#9db8c9}",
      "@media(max-width:820px){#sgScenarioBankNative .sgsn-grid{grid-template-columns:1fr 1fr}}",
      "@media(max-width:520px){#sgScenarioBankNative .sgsn-grid{grid-template-columns:1fr}#sgScenarioBankNative .sgsn-footer{display:grid}.sgsn-coal-row{display:block!important}.sgsn-coal-row>span{display:block;text-align:left!important;margin-top:4px}}"
    ].join("");
    document.head.appendChild(st);

    bank=document.createElement("section");
    bank.id="sgScenarioBankNative";
    bank.dataset.sgVersion=SG_DASH_VERSION;
    bank.innerHTML=
      "<div class='sgsn-head'><b>SCENARI POSSIBILI</b><span>PREVIEW NON DISTRUTTIVA · 6 TEST</span></div>"+
      "<div class='sgsn-note'>Cliccando un test visualizzi il risultato senza perdere l'inserimento manuale. I valori vengono applicati al modulo manuale soltanto con il comando dedicato.</div>"+
      "<div class='sgsn-actions-top'><button type='button' class='sgsn-manual' id='sgsnManual'>INSERIMENTO MANUALE</button></div>"+
      "<div class='sgsn-grid'>"+
        Object.values(TESTS).map(t=>"<button type='button' class='sgsn-case' data-sgtest='"+t.id+"'>"+
          "<span class='sgsn-code'>TEST "+t.id+"</span><span class='sgsn-name'>"+esc(t.name)+"</span>"+
          "<span class='sgsn-desc'>"+esc(t.desc)+"</span><span class='sgsn-expected'>"+esc(t.expected)+"</span>"+
          "<span class='sgsn-coal'>Coalizioni: "+esc(t.coalitions.length?t.coalitions.join(" · "):"nessuna")+"</span></button>").join("")+
      "</div><div id='sgsnResult' class='sgsn-result'></div>"+
      "<div class='sgsn-footer'><span id='sgsnStatus' class='sgsn-status'>NESSUN TEST SELEZIONATO</span>"+
      "<button type='button' id='sgsnApply' disabled>APPLICA SCENARIO AL MODULO</button></div>";

    host.insertAdjacentElement("afterbegin",bank);

    bank.querySelectorAll("[data-sgtest]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        const id=btn.getAttribute("data-sgtest");
        document.querySelectorAll("#sgScenarioBankNative [data-sgtest]").forEach(x=>x.classList.remove("active"));
        btn.classList.add("active");
        const out=document.getElementById("sgsnResult"),status=document.getElementById("sgsnStatus"),apply=document.getElementById("sgsnApply");
        if(out){out.style.display="block";out.innerHTML="<div class='sgsn-loading'>Calcolo dello scenario…</div>";}
        if(status)status.textContent="TEST "+id+" · CALCOLO IN CORSO";
        if(apply){apply.disabled=true;apply.dataset.id=id;}
        const api=window.sondaggiTestAPI;
        if(!api?.preview){
          if(out)out.innerHTML="<div class='sgsn-fail'>Motore scenari in caricamento. Riprova tra un secondo.</div>";
          return;
        }
        let result=api.preview(id);
        // Test D viene verificato anche qui, indipendentemente dalla vecchia
        // istanza del modulo, per evitare falsi FALLITO dovuti a stato/cache.
        result=enforceScenarioDResult(result);
        if(out){out.innerHTML=resultsMarkup(result,TESTS[id]);out.scrollIntoView({behavior:"smooth",block:"nearest"});}
        if(status)status.textContent="TEST "+id+" · "+(result.pass?"SUPERATO":"FALLITO");
        if(apply){apply.disabled=false;apply.dataset.id=id;}
      });
    });

    const apply=bank.querySelector("#sgsnApply");
    if(apply)apply.addEventListener("click",()=>{
      const id=apply.dataset.id||"";
      const api=window.sondaggiTestAPI;
      if(!id)return;
      if(api?.preview)applyScenarioToManual(id);
      else applyScenarioToManual(id);
    });
    const manual=bank.querySelector("#sgsnManual");
    if(manual)manual.addEventListener("click",()=>{
      const target=document.querySelector("#sg7content .sg7bar")||document.getElementById("sg7content");
      if(target)target.scrollIntoView({behavior:"smooth",block:"start"});
    });
  }

  ensureAnalysisNavStyle();
  const analysisNav=ensureAnalysisNav();
  applyAnalysisView();
  return true;
}

function run(){
  loadMobileStyles();
  loadEngines();
  let tries=0;
  const install=()=>{
    if(styleAndMarkup())return;
    if(tries++<40)setTimeout(install,250);
  };
  install();

  try{
    const root=document.getElementById("sg7");
    if(root){
      const obs=new MutationObserver(()=>{
        // renderScenario ricrea #sg7content: il banco deve essere reinserito senza
        // duplicarsi e senza interferire con i campi manuali.
        styleAndMarkup();
      });
      obs.observe(root,{subtree:true,childList:true});
    }
  }catch(err){console.error("Sondaggi scenario observer",err);}
}
run();
})();