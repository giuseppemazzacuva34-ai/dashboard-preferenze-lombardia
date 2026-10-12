/* ANALISI TERRITORIALE — modello statistico trasparente
 * Usa dati elettorali osservati e li combina con lo scenario nazionale corrente.
 * Non sostituisce la legge elettorale: i seggi sono calcolati dal motore
 * statutario già verificato.
 */
(function(){
"use strict";
const APP_KEY="lombardia_sondaggi_v7";
const D=window.SG_TERRITORIAL_DATA||{};
const LAW=window.SONDAGGI_LAW_20261008;
const ENGINE=window.SONDAGGI_ELECTION_ENGINE_20261008;
const REGIONS=D.regions||[];
const DEFAULTS={
 FdI:["Fratelli d'Italia",26.8],PD:["Partito Democratico",20.4],M5S:["Movimento 5 Stelle",12.8],
 FI:["Forza Italia",7.4],LEGA:["Lega",5.7],AVS:["Alleanza Verdi Sinistra",6.3],
 FN:["Futuro Nazionale",7.7],AZ:["Azione",3.2],IV:["Italia Viva",2.2],
 PIU:["+Europa",1.7],NM:["Noi Moderati",1.1],PLD:["Partito Liberaldemocratico",1.3],ALTRI:["Altri",3.4]
};
const REGION_CODE={"Piemonte":1,"Valle d'Aosta":2,"Lombardia":3,"Trentino-Alto Adige":4,"Trentino-Alto Adige/Südtirol":4,"Veneto":5,"Friuli-Venezia Giulia":6,"Liguria":7,"Emilia-Romagna":8,"Toscana":9,"Umbria":10,"Marche":11,"Lazio":12,"Abruzzo":13,"Molise":14,"Campania":15,"Puglia":16,"Basilicata":17,"Calabria":18,"Sicilia":19,"Sardegna":20};
const WEIGHTS={politiche2018:.10,politiche2022:.30,europee2019:.20,europee2024:.40};
let CORE=buildCore(),REGIONALS=null;
let STATE={chamber:"camera",region:"Lombardia",college:"",party:"Fratelli d'Italia",strength:1,weights:{...WEIGHTS}};

function esc(v){return String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
function num(v){const x=Number(String(v??"").replace(",","."));return Number.isFinite(x)?x:0;}
function pct(v){return num(v).toFixed(1).replace(".",",");}
function appState(){try{const x=JSON.parse(localStorage.getItem(APP_KEY)||"null");return x&&typeof x==="object"?x:{};}catch(_){return{};}}
function norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"");}
function regionCode(region){return String(REGION_CODE[region]||0).padStart(2,"0");}
function cleanRegion(region){return region==="Trentino-Alto Adige/Südtirol"?"Trentino-Alto Adige":region;}

function parseRows(map,source,ch){
  const out={};
  Object.entries(map||{}).forEach(([region,rows])=>{
    const prefix=regionCode(region)+"-";
    const codes=Object.keys(source||{}).filter(k=>String(k).startsWith(prefix)).sort((a,b)=>{
      const aa=Number(String(a).split("-")[1]||0),bb=Number(String(b).split("-")[1]||0);return aa-bb;
    });
    let j=0;
    (rows||[]).forEach(raw=>{
      const p=String(raw).split("|"),name=p[0],special=String(p[3]||"").toUpperCase()==="SPECIAL";
      if(special){out[name]={region:cleanRegion(region),noPrizeSeats:num(p[1]),withPrizeSeats:num(p[2]??p[1]),special:true,code:"",shares:{}};return;}
      const code=codes[j++]||"";
      out[name]={region:cleanRegion(region),noPrizeSeats:num(p[1]),withPrizeSeats:num(p[2]??p[1]),special:false,code,shares:source?.[code]||{}};
    });
  });
  return out;
}
function buildCore(){
  const cam=parseRows(D.collegeMaps?.camera,D.politiche?.[2022]?.camera,"camera");
  const sen=parseRows(D.collegeMaps?.senato,D.politiche?.[2022]?.senato,"senato");
  return {camera:{seats:Object.fromEntries(Object.entries(cam).map(([k,v])=>[k,{region:v.region,noPrizeSeats:v.noPrizeSeats,withPrizeSeats:v.withPrizeSeats,special:v.special}])) ,politiche2022:Object.fromEntries(Object.entries(cam).map(([k,v])=>[k,{region:v.region,shares:v.shares}]))},
          senato:{seats:Object.fromEntries(Object.entries(sen).map(([k,v])=>[k,{region:v.region,noPrizeSeats:v.noPrizeSeats,withPrizeSeats:v.withPrizeSeats,special:v.special}])) ,politiche2022:Object.fromEntries(Object.entries(sen).map(([k,v])=>[k,{region:v.region,shares:v.shares}]))}};
}
const COLLEGE_RECORDS={camera:parseRows(D.collegeMaps?.camera,D.politiche?.[2022]?.camera,"camera"),senato:parseRows(D.collegeMaps?.senato,D.politiche?.[2022]?.senato,"senato")};

function getParties(){
  const a=appState(),out={},knownNames=new Set();
  Object.entries(DEFAULTS).forEach(([id,def])=>{
    const defaultName=def[0];
    const stored=a.parties?.[defaultName] ?? a.parties?.[id] ?? {};
    const name=String(stored?.name||defaultName);
    const cam=a.nationalVotes?.camera?.[name]??a.nationalVotes?.camera?.[defaultName]??stored?.camera??def[1];
    const sen=a.nationalVotes?.senato?.[name]??a.nationalVotes?.senato?.[defaultName]??stored?.senate??def[1];
    out[id]={name,camera:num(cam),senate:num(sen)};
    knownNames.add(name);knownNames.add(defaultName);
  });
  Object.entries(a.parties||{}).forEach(([key,p])=>{
    const name=String(p?.name||key);
    if(knownNames.has(key)||knownNames.has(name)||Object.values(out).some(x=>x.name===name))return;
    out[key]={name,camera:num(a.nationalVotes?.camera?.[name]??p?.camera),senate:num(a.nationalVotes?.senato?.[name]??p?.senate)};
    knownNames.add(name);
  });
  return out;
}
function currentNational(ch){
  const ps=getParties(),out={};
  Object.values(ps).forEach(p=>out[p.name]=num(p[ch==="camera"?"camera":"senate"]));
  const total=Object.values(out).reduce((a,b)=>a+b,0)||1;
  Object.keys(out).forEach(p=>out[p]=out[p]/total*100);
  return out;
}
function baseNational(ch,partyName){return currentNational(ch)[partyName]||0;}
function keyCollege(v){return norm(v).replace(/^COLLEGIO/,"");}
function collegesForRegion(ch,region){return Object.entries(CORE?.[ch]?.seats||{}).filter(([,v])=>v.region===region&&!v.special).map(([k])=>k).sort((a,b)=>a.localeCompare(b,"it"));}
function regions(ch){return [...new Set(Object.values(CORE?.[ch]?.seats||{}).map(v=>v.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"it"));}
function collegeRecord(ch,college){const k=Object.keys(COLLEGE_RECORDS[ch]||{}).find(x=>keyCollege(x)===keyCollege(college));return k?COLLEGE_RECORDS[ch][k]:null;}
function politicalRegion(ch,year,region,partyName){const v=D.politicheRegioni?.[ch]?.[year]?.[region]?.[partyName];return v==null?null:num(v);}
function euroRegion(year,region,partyName){const v=D.europee?.[year]?.[region]?.[partyName];return v==null?null:num(v);}
function eventValues(ch,event,partyName){return REGIONS.map(r=>event==="europee2019"?euroRegion(2019,r,partyName):event==="europee2024"?euroRegion(2024,r,partyName):politicalRegion(ch,event==="politiche2018"?2018:2022,r,partyName)).filter(v=>v!=null&&v>0);}
function median(a){const x=a.slice().sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length?x.length%2?x[m]:(x[m-1]+x[m])/2:0;}
function eventMedian(ch,event,partyName){return median(eventValues(ch,event,partyName));}
function regionalMultiplier(ch,region,partyName){
  const events=[
    ["politiche2018",politicalRegion(ch,2018,region,partyName)],
    ["politiche2022",politicalRegion(ch,2022,region,partyName)],
    ["europee2019",euroRegion(2019,region,partyName)],
    ["europee2024",euroRegion(2024,region,partyName)]
  ];
  let z=0,w=0,signals=[];
  events.forEach(([event,v])=>{
    const med=eventMedian(ch,event,partyName),ew=WEIGHTS[event];
    if(v!=null&&v>0&&med>0){z+=ew*Math.log(v/med);w+=ew;signals.push({event,value:v,median:med,ratio:v/med,weight:ew});}
  });
  return {factor:w?Math.exp(z/w):1,signals};
}
function regionScenario(ch,region){
  const nat=currentNational(ch),shares={},diagnostic={};
  Object.keys(nat).forEach(p=>{
    const m=regionalMultiplier(ch,region,p);
    shares[p]=nat[p]*Math.pow(m.factor,0.90);
    diagnostic[p]={factor:m.factor,signals:m.signals};
  });
  const total=Object.values(shares).reduce((a,b)=>a+b,0)||1;
  Object.keys(shares).forEach(p=>shares[p]=shares[p]/total*100);
  return {shares,diagnostic};
}
function collegeMultiplier(ch,region,college,partyName){
  const rec=collegeRecord(ch,college),hist22=politicalRegion(ch,2022,region,partyName),local22=rec?.shares?.[partyName];
  if(hist22>0&&local22>0)return {factor:local22/hist22,signals:[{event:"politiche2022 · collegio/regione",local:local22,region:hist22,ratio:local22/hist22}]};
  return {factor:1,signals:[]};
}
function modelForCollege(ch,region,college){
  const rs=regionScenario(ch,region),shares={},diagnostic={};
  Object.keys(rs.shares).forEach(p=>{
    const m=collegeMultiplier(ch,region,college,p);
    shares[p]=rs.shares[p]*Math.pow(m.factor,0.80);
    diagnostic[p]={region:rs.diagnostic[p],college:m.factor,signals:m.signals};
  });
  const total=Object.values(shares).reduce((a,b)=>a+b,0)||1;
  Object.keys(shares).forEach(p=>shares[p]=shares[p]/total*100);
  return {shares,diagnostic,regional:rs};
}
function obs(ch,event,college,partyName){
  if(event==="politiche2022")return collegeRecord(ch,college)?.shares?.[partyName]??null;
  if(event==="politiche2018")return politicalRegion(ch,2018,COLLEGE_RECORDS[ch]?.[college]?.region||"",partyName);
  if(event==="europee2019")return euroRegion(2019,COLLEGE_RECORDS[ch]?.[college]?.region||"",partyName);
  if(event==="europee2024")return euroRegion(2024,COLLEGE_RECORDS[ch]?.[college]?.region||"",partyName);
  return null;
}
function nationalObserved(ch,event,partyName){return eventMedian(ch,event,partyName);}
function regionalSignals(region,partyName){
  return [];
}
function cameraMap(){return D.collegeMaps?.camera||{};}
function senateMap(){return D.collegeMaps?.senato||{};}
function appSpecial(){
  const a=appState(),base={camera:{estero:{},valleDAosta:{},trentinoAltoAdige:{}},senato:{estero:{},valleDAosta:{},trentinoAltoAdige:{}}};
  ["camera","senato"].forEach(ch=>["estero","valleDAosta","trentinoAltoAdige"].forEach(cat=>base[ch][cat]={...(a.specialSeats?.[ch]?.[cat]||{})}));
  return base;
}
function engineInput(){
  const ps=getParties(),a=appState(),partiesShape=Object.fromEntries(Object.values(ps).map(p=>[p.name,{name:p.name,camera:p.camera,senate:p.senate}]));
  const camValues={},senCollegeValues={};
  Object.keys(COLLEGE_RECORDS.camera).forEach(col=>{const r=COLLEGE_RECORDS.camera[col].region;if(!COLLEGE_RECORDS.camera[col].special)camValues[col]=modelForCollege("camera",r,col).shares;});
  Object.keys(COLLEGE_RECORDS.senato).forEach(col=>{const r=COLLEGE_RECORDS.senato[col].region;if(!COLLEGE_RECORDS.senato[col].special)senCollegeValues[col]=modelForCollege("senato",r,col).shares;});
  const reg={};regions("senato").forEach(r=>reg[r]=regionScenario("senato",r).shares);
  return {
    law:LAW,parties:partiesShape,coalitions:Array.isArray(a.coalitions)?a.coalitions:[],specialSeats:appSpecial(),
    camera:{nationalValues:currentNational("camera"),collegeValues:camValues,collegeWeights:{},collegeMap:cameraMap()},
    senato:{nationalValues:currentNational("senato"),regionalValuesByRegion:reg,collegeValues:senCollegeValues,collegeWeights:{},collegeMap:senateMap(),premiumByRegion:LAW?.rules?.senatePremiumByRegion||{}}
  };
}
function runSeats(){if(!ENGINE?.simulate||!LAW)return null;try{return ENGINE.simulate(engineInput());}catch(err){console.error("Territorial seat engine",err);return{error:String(err?.message||err)};}}
function cameraSeat(sim,college,partyName){
  const circ=String(college).replace(/\s-\sP\d+$/,"");
  return num(sim?.cam?.collegeResults?.ordinary?.[circ]?.[college]?.alloc?.[partyName])+num(sim?.cam?.collegeResults?.prize?.[circ]?.[partyName]?.seats?.[college]);
}
function senateSeat(sim,region,college,partyName){return num(sim?.sen?.regions?.[region]?.collegeResults?.byList?.[partyName]?.[college]);}
function selectedSeats(ch,sim,region,college,partyName){return ch==="camera"?cameraSeat(sim,college,partyName):senateSeat(sim,region,college,partyName);}
function allRows(ch,region,partyName,sim){return collegesForRegion(ch,region).map(col=>({college:col,share:modelForCollege(ch,region,col).shares[partyName]||0,seats:selectedSeats(ch,sim,region,col,partyName)}));}
function getHistorical(ch,region,year,id){
 const map={FdI:"Fratelli d'Italia",PD:"Partito Democratico",M5S:"Movimento 5 Stelle",LEGA:"Lega",FI:"Forza Italia",PIU:"+Europa",AVS:"Alleanza Verdi Sinistra",NM:"Noi Moderati"};
 const p=map[id];return p?politicalRegion(ch,year,region,p):null;
}
function cityScenario(){}
function injectStyle(){
 if(document.getElementById("staStyle"))return;
 const st=document.createElement("style");st.id="staStyle";st.textContent=`
#sgTerritorialAnalysis{display:block;width:100%;margin:14px 0 20px}.sta{background:#071a2b;color:#eaf4fb;border:1px solid #294b62;border-radius:14px;padding:16px;font-family:Arial,sans-serif}.sta *{box-sizing:border-box}.sta-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.sta-kicker{font-size:9px;font-weight:900;letter-spacing:.15em;color:#66c2ff}.sta h2{margin:4px 0 5px;font-size:22px;color:#fff}.sta-head p{margin:0;color:#9eb6c7;font-size:10px;line-height:1.5;max-width:950px}.sta-badges{display:flex;gap:6px;flex-wrap:wrap}.sta-badges span{padding:6px 8px;border:1px solid #35586d;background:#0e2a3f;border-radius:999px;color:#c6dce6;font-size:7px;font-weight:900}.sta-controls{display:grid;grid-template-columns:140px 1fr 1fr 1fr 150px;gap:8px;margin-top:12px}.sta-controls label{font-size:7px;color:#7895a8;text-transform:uppercase;font-weight:900}.sta-controls select,.sta-controls input{display:block;margin-top:4px;width:100%;height:34px;border:1px solid #31536a;border-radius:8px;background:#091827;color:#fff;padding:7px 8px;font-size:9px}.sta-controls small{display:block;font-size:6px;color:#6e899b;margin-top:4px;line-height:1.25;text-transform:none}.sta-card{background:#0a2033;border:1px solid #24465e;border-radius:10px;padding:11px}.sta-main{display:flex;justify-content:space-between;gap:14px;margin-top:10px;background:#0b253b}.sta-overline{font-size:8px;color:#7fa0b4;text-transform:uppercase;font-weight:900}.sta-big{font-size:36px;font-weight:900;color:#fff;line-height:1.05;margin-top:3px}.sta-sub{font-size:7px;color:#88a3b3;margin-top:3px}.sta-kpis{display:grid;grid-template-columns:repeat(3,minmax(110px,1fr));gap:8px}.sta-kpis div{padding:9px;border:1px solid #294b64;background:#102b41;border-radius:8px}.sta-kpis b{display:block;color:#fff;font-size:16px}.sta-kpis span{display:block;margin-top:2px;color:#7998aa;font-size:6px;text-transform:uppercase}.sta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.sta-title{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}.sta-title b{font-size:10px;color:#fff}.sta-title span{font-size:7px;color:#7590a3}.sta table{width:100%;border-collapse:collapse;font-size:8px}.sta th{padding:7px 6px;border-bottom:1px solid #2a4c61;color:#7896a8;text-align:left;font-size:6px;text-transform:uppercase}.sta td{padding:7px 6px;border-bottom:1px solid #18384f;color:#d8e8ef}.sta-bars{display:grid;gap:7px}.sta-bar>div:first-child{display:flex;justify-content:space-between;gap:8px;font-size:7px}.sta-bar span{color:#8fb1c0}.sta-track{height:10px;background:#123149;border-radius:5px;overflow:hidden;margin-top:3px}.sta-track i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#287fae,#67c5eb)}.sta-note{margin-top:9px;padding:8px 9px;border:1px solid #294b62;border-radius:8px;background:#0d2539;color:#90aabb;font-size:7px;line-height:1.45}.sta-foot{margin-top:9px;color:#6f899b;font-size:7px;line-height:1.45}@media(max-width:1050px){.sta-controls{grid-template-columns:1fr 1fr}.sta-grid{grid-template-columns:1fr}.sta-main{display:block}.sta-kpis{margin-top:10px}}@media(max-width:650px){.sta{padding:10px}.sta-head{display:block}.sta-badges{margin-top:8px}.sta-controls{grid-template-columns:1fr}.sta-kpis{grid-template-columns:1fr 1fr}.sta-big{font-size:30px}.sta table{min-width:560px}.sta-card{overflow:auto}}`;
 document.head.appendChild(st);
}
async function start(){
  injectStyle();
  const anchor=document.getElementById("tab-sondaggi");
  if(!anchor)return;
  let host=document.getElementById("sgTerritorialAnalysis");
  if(!host){host=document.createElement("section");host.id="sgTerritorialAnalysis";anchor.appendChild(host);}
  if(!D||!D.collegeMaps){
    host.innerHTML="<div class='sta'><b>Dataset territoriale non disponibile.</b></div>";
    return;
  }
  render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
window.SG_TERRITORIAL_MODEL={version:"2026-10-12-model6",regionalScenario:regionScenario,collegeScenario:modelForCollege,runSimulation:runSeats};
})();