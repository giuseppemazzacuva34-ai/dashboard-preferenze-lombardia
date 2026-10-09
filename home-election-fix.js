(function(){
"use strict";

const HOME_COUNT=1501;
const WRONG=/^(?:1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504)$/;
const WRONG_IN_TEXT=/(?:1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504)(?=\s*(?:comuni|COMUNI)|$)/g;

function textHasComuniNear(el){
  let p=el;
  for(let i=0;p&&i<8;i++,p=p.parentElement){
    if(/\bCOMUNI\b/i.test(String(p.textContent||""))) return true;
  }
  return false;
}

function setCount(el){
  if(!el)return;
  const t=String(el.textContent||"");
  if(WRONG.test(t.trim())){
    el.textContent="1.501";
    return true;
  }
  if(WRONG_IN_TEXT.test(t) && /\bCOMUNI\b/i.test(t)){
    WRONG_IN_TEXT.lastIndex=0;
    el.textContent=t.replace(WRONG_IN_TEXT,"1.501");
    return true;
  }
  WRONG_IN_TEXT.lastIndex=0;
  return false;
}

function forceHomeComuneCount(){
  try{
    // ID/KPI conosciuti.
    ["k-comuni"].forEach(id=>{
      const el=document.getElementById(id);
      if(el)setCount(el);
    });

    // Elementi della Home che riportano il numero dei comuni.
    const selectors=[
      "#homeQuick .quick-item",
      ".home-kpi",
      ".top-kpis .kpi",
      ".home-status",
      "[data-kpi]",
      "[data-label]"
    ];
    document.querySelectorAll(selectors.join(",")).forEach(el=>{
      if(textHasComuniNear(el)) setCount(el);
    });

    // Ultimo livello: corregge esclusivamente nodi di testo numerici,
    // solo quando un loro antenato parla esplicitamente di comuni.
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walker.nextNode()){
      const raw=String(node.nodeValue||"");
      const trimmed=raw.trim();
      if(!trimmed)continue;
      if(WRONG.test(trimmed) && textHasComuniNear(node.parentElement)){
        node.nodeValue=raw.replace(trimmed,"1.501");
      }else if(/\bCOMUNI\b/i.test(raw) && WRONG_IN_TEXT.test(raw)){
        WRONG_IN_TEXT.lastIndex=0;
        node.nodeValue=raw.replace(WRONG_IN_TEXT,"1.501");
      }
      WRONG_IN_TEXT.lastIndex=0;
    }

    document.title=document.title;
  }catch(err){
    console.error("Home comuni 1501 definitive fix",err);
  }
}

function redrawHomeElectionChart(){
  try{
    const c=document.getElementById("provChart");
    if(!c || typeof c.getContext!=="function") return;
    const source=(typeof election!=="undefined"&&election==="europee")
      ?(typeof EURO_RAW!=="undefined"&&Array.isArray(EURO_RAW)?EURO_RAW:[])
      :(typeof RAW!=="undefined"&&Array.isArray(RAW)?RAW:[]);
    const sums=Object.create(null);
    source.forEach(r=>{
      const p=String(r?.prov||"").trim().toUpperCase();
      if(p)sums[p]=(sums[p]||0)+(Number(r?.preferenze)||0);
    });
    const rows=Object.entries(sums).sort((a,b)=>b[1]-a[1]);
    const w=c.clientWidth||700,h=c.clientHeight||300,d=Math.max(2,window.devicePixelRatio||1);
    c.width=Math.max(1,Math.round(w*d)); c.height=Math.max(1,Math.round(h*d));
    const x=c.getContext("2d"); if(!x)return;
    x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,w,h);
    const max=Math.max(...rows.map(r=>r[1]),1);
    const left=Math.min(225,Math.max(195,w*.32)),right=120,top=10,bottom=10;
    const rowH=Math.max(21,(h-top-bottom)/Math.max(rows.length,1));
    const barMax=Math.max(45,w-left-right);
    const total=rows.reduce((s,r)=>s+r[1],0);
    const names={"MONZA E DELLA BRIANZA":"MONZA E BRIANZA"};
    const palette=["#2b8cff","#22c88a","#8b5cf6","#f0a500"];
    rows.forEach((r,i)=>{
      const y=top+i*rowH+rowH/2,bw=barMax*(r[1]/max);
      x.textBaseline="middle";x.textAlign="right";x.font="600 13px Arial";x.fillStyle="#d7e5f2";
      x.fillText(names[r[0]]||r[0],left-12,y);
      x.fillStyle="rgba(16,44,69,.9)";x.fillRect(left,y-6,barMax,12);
      x.fillStyle=palette[i%palette.length];x.fillRect(left,y-6,Math.max(4,bw),12);
      x.textAlign="left";x.font="700 13px Arial";x.fillStyle="#f2f7fb";
      const pct=total?((r[1]/total)*100).toFixed(1)+"%":"0.0%";
      x.fillText(r[1].toLocaleString("it-IT")+" · "+pct,Math.min(left+bw+10,w-118),y);
    });
    const label=document.getElementById("homeElectionLabel");
    if(label)label.textContent=(typeof election!=="undefined"&&election==="europee")?"Europee 2024 · FdI":"Regionali 2023 · FdI";
  }catch(err){console.error("Home election chart definitive fix",err);}
}

function run(){
  forceHomeComuneCount();
  redrawHomeElectionChart();
}

function afterMacro(){
  setTimeout(run,0);
  setTimeout(run,100);
  setTimeout(run,350);
  setTimeout(run,800);
  setTimeout(run,1500);
}

const previous=window.dashboardSetMacro;
window.dashboardSetMacro=function(v){
  if(typeof previous==="function")previous(v);
  afterMacro();
};
window.switchElection=window.dashboardSetMacro;

const observer=new MutationObserver(function(){
  forceHomeComuneCount();
});
observer.observe(document.documentElement||document,{
  subtree:true,
  childList:true,
  characterData:true
});

document.addEventListener("click",function(ev){
  if(ev.target?.closest?.(".macro-tab"))afterMacro();
},true);

window.addEventListener("resize",afterMacro);
window.addEventListener("load",run);

// Il runtime principale può ridisegnare la Home molto dopo il boot:
// manteniamo il contatore corretto durante le fasi di render.
const started=Date.now();
const timer=setInterval(function(){
  forceHomeComuneCount();
  if(Date.now()-started>30000)clearInterval(timer);
},100);

window.forceHomeGeoCount=forceHomeComuneCount;
window.redrawHomeElectionChart=redrawHomeElectionChart;
run();

})();
