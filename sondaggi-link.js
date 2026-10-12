(function(){
"use strict";

const SG_DASH_VERSION="20261012-dashboard-scenari-v5";
const V7_KEY="lombardia_sondaggi_v7";
const TEST_BACKUP_KEY=V7_KEY+"_test_backup";
const TEST_ACTIVE_KEY=V7_KEY+"_test_active";

const TESTS={
  A:{
    id:"A",
    name:"NESSUN PREMIO",
    desc:"Vincitore diverso nelle due Camere.",
    expected:"Premio 0 Camera · 0 Senato.",
    camera:{"Fratelli d'Italia":40,"Partito Democratico":41.5,"Movimento 5 Stelle":6,"Alleanza Verdi Sinistra":3,"Forza Italia":3.5,"Lega":2,"Futuro Nazionale":1,"Azione":1,"Italia Viva":0.5,"+Europa":0.5,"Noi Moderati":0,"Partito Liberaldemocratico":0,"Altri":1},
    senate:{"Fratelli d'Italia":42,"Partito Democratico":34,"Movimento 5 Stelle":3,"Alleanza Verdi Sinistra":2,"Forza Italia":3.5,"Lega":3,"Futuro Nazionale":2,"Azione":2,"Italia Viva":1,"+Europa":1,"Noi Moderati":1.5,"Partito Liberaldemocratico":0,"Altri":5},
    coalitions:[
      {id:"V7-CD",name:"Centrodestra",members:["Fratelli d'Italia","Lega","Forza Italia","Noi Moderati"]},
      {id:"V7-CS",name:"Centrosinistra",members:["Partito Democratico","Movimento 5 Stelle","Alleanza Verdi Sinistra","+Europa","Italia Viva"]}
    ]
  },
  B:{
    id:"B",
    name:"PREMIO 42/42",
    desc:"Stesso soggetto primo nelle due Camere e al 42,0% esatto.",
    expected:"Premio 70 Camera + 35 Senato.",
    camera:{"Fratelli d'Italia":27,"Partito Democratico":20,"Movimento 5 Stelle":10,"Alleanza Verdi Sinistra":5,"Forza Italia":6,"Lega":6,"Futuro Nazionale":2,"Azione":2.5,"Italia Viva":1.5,"+Europa":1.5,"Noi Moderati":3,"Partito Liberaldemocratico":0,"Altri":15.5},
    senate:{"Fratelli d'Italia":27,"Partito Democratico":20,"Movimento 5 Stelle":10,"Alleanza Verdi Sinistra":5,"Forza Italia":6,"Lega":6,"Futuro Nazionale":2,"Azione":2.5,"Italia Viva":1.5,"+Europa":1.5,"Noi Moderati":3,"Partito Liberaldemocratico":0,"Altri":15.5},
    coalitions:[
      {id:"V7-CD",name:"Centrodestra",members:["Fratelli d'Italia","Lega","Forza Italia","Noi Moderati"]},
      {id:"V7-CS",name:"Centrosinistra",members:["Partito Democratico","Movimento 5 Stelle","Alleanza Verdi Sinistra","+Europa","Italia Viva"]}
    ]
  },
  C:{
    id:"C",
    name:"41,9 / 42,0",
    desc:"Il soggetto arriva al 42,0% solo in una Camera.",
    expected:"Nessun premio in entrambe le Camere.",
    camera:{"Fratelli d'Italia":26.9,"Partito Democratico":20,"Movimento 5 Stelle":10,"Alleanza Verdi Sinistra":5,"Forza Italia":6,"Lega":6,"Futuro Nazionale":2,"Azione":2.5,"Italia Viva":1.5,"+Europa":1.5,"Noi Moderati":3,"Partito Liberaldemocratico":0,"Altri":15.6},
    senate:{"Fratelli d'Italia":27,"Partito Democratico":20,"Movimento 5 Stelle":10,"Alleanza Verdi Sinistra":5,"Forza Italia":6,"Lega":6,"Futuro Nazionale":2,"Azione":2.5,"Italia Viva":1.5,"+Europa":1.5,"Noi Moderati":3,"Partito Liberaldemocratico":0,"Altri":15.5},
    coalitions:[
      {id:"V7-CD",name:"Centrodestra",members:["Fratelli d'Italia","Lega","Forza Italia","Noi Moderati"]},
      {id:"V7-CS",name:"Centrosinistra",members:["Partito Democratico","Movimento 5 Stelle","Alleanza Verdi Sinistra","+Europa","Italia Viva"]}
    ]
  },
  D:{
    id:"D",
    name:"COALIZIONE 10,0%",
    desc:"Coalizione esattamente al 10,0% con una lista al 3,0%.",
    expected:"Coalizione qualificata al limite.",
    camera:{"Fratelli d'Italia":7,"Partito Democratico":20,"Movimento 5 Stelle":12,"Alleanza Verdi Sinistra":6,"Forza Italia":10,"Lega":3,"Futuro Nazionale":7,"Azione":5,"Italia Viva":4,"+Europa":3,"Noi Moderati":2,"Partito Liberaldemocratico":0,"Altri":21},
    senate:{"Fratelli d'Italia":7,"Partito Democratico":20,"Movimento 5 Stelle":12,"Alleanza Verdi Sinistra":6,"Forza Italia":10,"Lega":3,"Futuro Nazionale":7,"Azione":5,"Italia Viva":4,"+Europa":3,"Noi Moderati":2,"Partito Liberaldemocratico":0,"Altri":21},
    coalitions:[
      {id:"C-TEST10",name:"Coalizione Test 10%",members:["Fratelli d'Italia","Lega"]}
    ]
  },
  E:{
    id:"E",
    name:"LISTA 3,0%",
    desc:"Una lista è al 3,0% e una a 2,9%, entrambe fuori da coalizioni.",
    expected:"3,0% ammesso · 2,9% escluso.",
    camera:{"Fratelli d'Italia":25,"Partito Democratico":20,"Movimento 5 Stelle":15,"Alleanza Verdi Sinistra":7,"Forza Italia":7,"Lega":6,"Futuro Nazionale":4,"Azione":3,"Italia Viva":2.9,"+Europa":2,"Noi Moderati":1,"Partito Liberaldemocratico":0,"Altri":7.1},
    senate:{"Fratelli d'Italia":25,"Partito Democratico":20,"Movimento 5 Stelle":15,"Alleanza Verdi Sinistra":7,"Forza Italia":7,"Lega":6,"Futuro Nazionale":4,"Azione":3,"Italia Viva":2.9,"+Europa":2,"Noi Moderati":1,"Partito Liberaldemocratico":0,"Altri":7.1},
    coalitions:[]
  },
  F:{
    id:"F",
    name:"SENATO 20% REGIONALE",
    desc:"Lista sotto il 3% nazionale ma al 20,0% in Lombardia.",
    expected:"Ammessa in Lombardia per la deroga regionale.",
    camera:{"Fratelli d'Italia":2.5,"Partito Democratico":25,"Movimento 5 Stelle":15,"Alleanza Verdi Sinistra":7,"Forza Italia":7,"Lega":6,"Futuro Nazionale":5,"Azione":4,"Italia Viva":3,"+Europa":2,"Noi Moderati":1,"Partito Liberaldemocratico":0,"Altri":22.5},
    senate:{"Fratelli d'Italia":2.5,"Partito Democratico":25,"Movimento 5 Stelle":15,"Alleanza Verdi Sinistra":7,"Forza Italia":7,"Lega":6,"Futuro Nazionale":5,"Azione":4,"Italia Viva":3,"+Europa":2,"Noi Moderati":1,"Partito Liberaldemocratico":0,"Altri":22.5},
    lombardiaSenate:{"Fratelli d'Italia":20,"Partito Democratico":25,"Movimento 5 Stelle":15,"Alleanza Verdi Sinistra":7,"Forza Italia":7,"Lega":6,"Futuro Nazionale":5,"Azione":4,"Italia Viva":3,"+Europa":2,"Noi Moderati":1,"Partito Liberaldemocratico":0,"Altri":5},
    coalitions:[]
  }
};

function clone(x){return JSON.parse(JSON.stringify(x));}
function esc(x){return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function readState(){
  try{
    const raw=JSON.parse(localStorage.getItem(V7_KEY)||"{}");
    return raw&&typeof raw==="object"?raw:{};
  }catch(_){return {};}
}
function writeState(state){
  localStorage.setItem(V7_KEY,JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("sondaggi-v7-updated"));
}
function ensureContainers(s){
  s.parties=s.parties&&typeof s.parties==="object"?s.parties:{};
  s.nationalVotes=s.nationalVotes&&typeof s.nationalVotes==="object"?s.nationalVotes:{camera:{},senato:{}};
  s.nationalVotes.camera=s.nationalVotes.camera&&typeof s.nationalVotes.camera==="object"?s.nationalVotes.camera:{};
  s.nationalVotes.senato=s.nationalVotes.senato&&typeof s.nationalVotes.senato==="object"?s.nationalVotes.senato:{};
  s.circVotes=s.circVotes&&typeof s.circVotes==="object"?s.circVotes:{camera:{},senato:{}};
  s.circVotes.camera=s.circVotes.camera&&typeof s.circVotes.camera==="object"?s.circVotes.camera:{};
  s.circVotes.senato=s.circVotes.senato&&typeof s.circVotes.senato==="object"?s.circVotes.senato:{};
  s.collegeVotes=s.collegeVotes&&typeof s.collegeVotes==="object"?s.collegeVotes:{camera:{},senato:{}};
  s.collegeVotes.camera=s.collegeVotes.camera&&typeof s.collegeVotes.camera==="object"?s.collegeVotes.camera:{};
  s.collegeVotes.senato=s.collegeVotes.senato&&typeof s.collegeVotes.senato==="object"?s.collegeVotes.senato:{};
  return s;
}
function applyTest(id){
  const t=TESTS[id];
  if(!t)return false;
  const current=readState();
  if(!localStorage.getItem(TEST_BACKUP_KEY)){
    localStorage.setItem(TEST_BACKUP_KEY,JSON.stringify(current));
  }
  const next=ensureContainers(clone(current));
  next.parties=next.parties||{};
  Object.keys(t.camera).forEach(name=>{
    next.parties[name]=Number(t.camera[name]);
  });
  Object.keys(t.senate).forEach(name=>{
    next.parties[name]=Number(t.senate[name]);
  });
  next.nationalVotes.camera=clone(t.camera);
  next.nationalVotes.senato=clone(t.senate);
  next.coalitions=clone(t.coalitions);
  next.meta=next.meta&&typeof next.meta==="object"?next.meta:{};
  next.meta.v7TestId=id;
  next.meta.v7TestUpdatedAt=new Date().toISOString();

  // Rendo coerenti anche i dati territoriali esistenti con il nazionale.
  Object.keys(next.circVotes.camera).forEach(k=>{next.circVotes.camera[k]=clone(t.camera);});
  Object.keys(next.circVotes.senato).forEach(k=>{next.circVotes.senato[k]=clone(t.senate);});
  next.circVotes.senato.Lombardia=clone(t.lombardiaSenate||t.senate);
  Object.keys(next.collegeVotes.camera).forEach(k=>{next.collegeVotes.camera[k]=clone(t.camera);});
  Object.keys(next.collegeVotes.senato).forEach(k=>{next.collegeVotes.senato[k]=clone(t.senate);});

  localStorage.setItem(TEST_ACTIVE_KEY,id);
  writeState(next);

  // Il dashboard storico legge il file v7 all'avvio: un reload è intenzionale
  // per aggiornare anche le variabili interne non esposte dalla pagina.
  setTimeout(()=>location.reload(),80);
  return true;
}
function restoreTest(){
  const raw=localStorage.getItem(TEST_BACKUP_KEY);
  if(!raw)return false;
  try{
    const restored=JSON.parse(raw);
    localStorage.setItem(TEST_ACTIVE_KEY,"");
    localStorage.removeItem(TEST_BACKUP_KEY);
    writeState(restored);
    setTimeout(()=>location.reload(),80);
    return true;
  }catch(_){return false;}
}

function styleAndMarkup(){
  if(document.getElementById("sgScenarioBankNative"))return;
  if(!document.getElementById("sg7content"))return;

  const st=document.createElement("style");
  st.id="sgScenarioBankNativeStyle";
  st.textContent=[
    "#sgScenarioBankNative{margin:0 0 12px;padding:12px;border:1px solid #2b6790;border-radius:11px;background:#0b2338;color:#eaf4fb;box-sizing:border-box}",
    "#sgScenarioBankNative .sgsn-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}",
    "#sgScenarioBankNative .sgsn-head b{font-size:12px;letter-spacing:.04em}",
    "#sgScenarioBankNative .sgsn-head span{font-size:7px;color:#7fb6d6}",
    "#sgScenarioBankNative .sgsn-note{font-size:7px;line-height:1.45;color:#9fb8c9;margin-bottom:8px}",
    "#sgScenarioBankNative .sgsn-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
    "#sgScenarioBankNative .sgsn-case{border:1px solid #295776;background:#0a1d30;color:#fff;border-radius:9px;padding:9px;text-align:left;cursor:pointer;min-width:0}",
    "#sgScenarioBankNative .sgsn-case:hover{border-color:#5ab8ef;background:#123b59}",
    "#sgScenarioBankNative .sgsn-case.active{border-color:#57b7ef;background:#12415f;box-shadow:0 0 0 1px rgba(87,183,239,.22) inset}",
    "#sgScenarioBankNative .sgsn-code{display:block;color:#72c5ff;font-size:7px;font-weight:900}",
    "#sgScenarioBankNative .sgsn-name{display:block;margin-top:3px;font-size:9px;font-weight:900}",
    "#sgScenarioBankNative .sgsn-desc{display:block;margin-top:4px;color:#a8c1d1;font-size:6.5px;line-height:1.35}",
    "#sgScenarioBankNative .sgsn-expected{display:block;margin-top:5px;color:#e1edf5;font-size:6.5px;font-weight:800;line-height:1.35}",
    "#sgScenarioBankNative .sgsn-coal{display:block;margin-top:5px;color:#70c7ff;font-size:6.5px;font-weight:900;line-height:1.35}",
    "#sgScenarioBankNative .sgsn-footer{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}",
    "#sgScenarioBankNative .sgsn-status{font-size:7px;color:#9fb8c9}",
    "#sgScenarioBankNative .sgsn-restore{border:1px solid #365e78;background:#0a1d30;color:#dcecf6;border-radius:7px;padding:7px 9px;font-size:7px;font-weight:900;cursor:pointer}",
    "#sgScenarioBankNative .sgsn-result{display:none;margin-top:8px;padding:8px;border-radius:8px;background:#102f48;border:1px solid #2d6688;font-size:7px;line-height:1.4}",
    "@media(max-width:820px){#sgScenarioBankNative .sgsn-grid{grid-template-columns:1fr 1fr}}",
    "@media(max-width:520px){#sgScenarioBankNative .sgsn-grid{grid-template-columns:1fr}#sgScenarioBankNative .sgsn-head{display:block}.sgsn-footer{display:grid!important;grid-template-columns:1fr}.sgsn-restore{width:100%}}"
  ].join("");

  document.head.appendChild(st);

  const bank=document.createElement("section");
  bank.id="sgScenarioBankNative";
  const active=localStorage.getItem(TEST_ACTIVE_KEY)||"";
  bank.innerHTML=
    "<div class='sgsn-head'><b>SCENARI POSSIBILI</b><span>6 TEST DI CONTROLLO</span></div>"+
    "<div class='sgsn-note'>Ogni pulsante carica uno scenario sintetico direttamente nel modulo Sondaggi nazionale. I dati correnti vengono salvati prima del primo test e possono essere ripristinati.</div>"+
    "<div class='sgsn-grid'>"+
      Object.values(TESTS).map(t=>{
        const coal=t.coalitions.length?t.coalitions.map(c=>c.name).join(" · "):"nessuna";
        return "<button type='button' class='sgsn-case "+(active===t.id?"active":"")+"' data-sgtest='"+t.id+"'>"+
          "<span class='sgsn-code'>TEST "+t.id+"</span>"+
          "<span class='sgsn-name'>"+esc(t.name)+"</span>"+
          "<span class='sgsn-desc'>"+esc(t.desc)+"</span>"+
          "<span class='sgsn-expected'>"+esc(t.expected)+"</span>"+
          "<span class='sgsn-coal'>Coalizioni: "+esc(coal)+"</span>"+
        "</button>";
      }).join("")+
    "</div>"+
    "<div id='sgsnResult' class='sgsn-result'></div>"+
    "<div class='sgsn-footer'><span id='sgsnStatus' class='sgsn-status'>"+
      (active&&TESTS[active]?"TEST "+active+" ATTIVO · "+TESTS[active].name:"NESSUN TEST ATTIVO")+
    "</span><button type='button' id='sgsnRestore' class='sgsn-restore'>RIPRISTINA STATO PRE-TEST</button></div>";

  const host=document.getElementById("sg7content");
  host.insertAdjacentElement("afterbegin",bank);

  bank.querySelectorAll("[data-sgtest]").forEach(btn=>{
    btn.addEventListener("click",()=>applyTest(btn.getAttribute("data-sgtest")));
  });
  const restore=bank.querySelector("#sgsnRestore");
  if(restore)restore.addEventListener("click",()=>{
    restoreTest();
  });

  if(active&&TESTS[active]){
    const r=document.getElementById("sgsnResult");
    if(r){
      r.style.display="block";
      r.innerHTML="<b>TEST "+esc(active)+" · "+esc(TESTS[active].name)+"</b><br>Atteso: "+esc(TESTS[active].expected)+"<br>Coalizioni previste: "+esc(TESTS[active].coalitions.length?TESTS[active].coalitions.map(c=>c.name).join(" · "):"nessuna")+"<br><span>Il risultato numerico completo è riportato nel pannello Sondaggi subito sotto.</span>";
    }
  }
}

function run(){
  // Non carichiamo il vecchio modulo Sondaggi separato qui: il dashboard principale
  // possiede già il modulo nativo #sg7, che deve essere l'unica interfaccia.
  const start=()=>{
    styleAndMarkup();
    const root=document.getElementById("sg7");
    if(root&&root.__sgScenarioObserver)return;
    if(root){
      const obs=new MutationObserver(()=>{
        if(document.getElementById("sg7content"))styleAndMarkup();
      });
      obs.observe(root,{subtree:true,childList:true});
      root.__sgScenarioObserver=obs;
    }
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
  setTimeout(start,150);
  setTimeout(start,600);
  setTimeout(start,1400);
  setTimeout(start,2500);
}
run();
})();