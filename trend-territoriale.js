/* ANALISI TERRITORIALE — modello statistico trasparente
 * Usa dati elettorali osservati e li combina con lo scenario nazionale corrente.
 * Non sostituisce la legge elettorale: i seggi sono calcolati dal motore
 * statutario già verificato.
 */
(function(){
"use strict";
const DATA_URL="data/trend-territoriale-core.json?v=20261012";
const REGIONAL_URL="data/trend-regionali-generated.json?v=20261012";
const APP_KEY="lombardia_sondaggi_2026";
const DEFAULTS={
 FdI:["Fratelli d'Italia",26.8],PD:["Partito Democratico",20.4],M5S:["Movimento 5 Stelle",12.8],
 FI:["Forza Italia",7.4],LEGA:["Lega",5.7],AVS:["Alleanza Verdi Sinistra",6.3],
 FN:["Futuro Nazionale",7.7],AZ:["Azione",3.2],IV:["Italia Viva",2.2],
 PIU:["+Europa",1.7],NM:["Noi Moderati",1.1],PLD:["Partito Liberaldemocratico",1.3],ALTRI:["Altri",3.4]
};
const WEIGHTS={politiche2022:.35,europee2019:.20,europee2024:.35,regionali:.10};
const esc=v=>String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"");
const pct=v=>num(v).toFixed(1).replace(".",",");
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,num(v)));
let CORE=null,REGIONALS=null,STATE={chamber:"camera",region:"",college:"",party:"FdI",strength:1,weights:{...WEIGHTS}};
function appState(){try{const x=JSON.parse(localStorage.getItem(APP_KEY)||"null");return x&&typeof x==="object"?x:{};}catch(_){return{};}}
function getParties(){
  const a=appState(),o={};
  Object.entries(DEFAULTS).forEach(([id,[name,v]])=>{const p=a.parties?.[id]||{};o[id]={name:String(p.name||name),camera:num(p.camera??v),senate:num(p.senate??v)};});
  Object.entries(a.parties||{}).forEach(([id,p])=>{if(!o[id])o[id]={name:String(p?.name||id),camera:num(p?.camera),senate:num(p?.senate)};});
  return o;
}
function keyCollege(v){return norm(v).replace(/^COLLEGIO/,"");}
function collections(ch,election){return CORE?.[ch]?.[election]||{};}
function item(ch,election,college){
  const src=collections(ch,election),key=keyCollege(college);
  for(const [k,v] of Object.entries(src))if(keyCollege(k)===key)return v;
  return null;
}
function obs(ch,election,college,id){
  const x=item(ch,election,college),v=x?.shares?.[id];
  return v==null?null:num(v);
}
function regionForCollege(ch,college){return CORE?.[ch]?.seats?.[college]?.region||"";}
function collegesForRegion(ch,region){
  return Object.entries(CORE?.[ch]?.seats||{}).filter(([,v])=>v.region===region).map(([k])=>k).sort((a,b)=>a.localeCompare(b,"it"));
}
function regionObserved(ch,election,region,id){
  const rows=Object.entries(CORE?.[ch]?.[election]||{}).filter(([,v])=>v.region===region&&v.totalVotes>0);
  const T=rows.reduce((a,[,v])=>a+num(v.totalVotes),0);if(!T)return null;
  let s=0,has=false;
  rows.forEach(([,v])=>{const q=v.shares?.[id];if(q!=null){s+=num(v.totalVotes)*num(q);has=true;}});
  return has?100*s/T:null;
}
function nationalObserved(ch,election,id){const v=CORE?.nationalShares?.[ch]?.[election]?.[id];return v==null?null:num(v);}
function regionalSignals(region,id){
  const base=regionObserved("camera","politiche2022",region,id);
  const arr=REGIONALS?.byRegion?.[region]||[];
  return arr.map(e=>({date:e.date,year:e.year,share:e.shares?.[id]??null,delta:base!=null&&e.shares?.[id]!=null?num(e.shares[id])-base:null}));
}
function baseNational(ch,id){
  const p=getParties()[id];
  return num(p?.[ch==="camera"?"camera":"senate"]);
}
function modelForCollege(ch,region,college){
  const ps=getParties(),out={},diagnostic={};
  const sources=[["politiche2022","politiche2022"],["europee2019","europee2019"],["europee2024","europee2024"]];
  Object.keys(ps).forEach(id=>{
    let weighted=0,totalW=0,parts=[];
    for(const [key,label] of sources){
      const local=obs(ch,keyCollegeElection(key),college,id), nat=nationalObserved(ch,label,id), w=num(STATE.weights[label]);
      if(local!=null&&nat!=null&&w>0){weighted+=(local-nat)*w;totalW+=w;parts.push({label,local,national:nat,delta:local-nat,weight:w});}
    }
    const rs=regionalSignals(region,id);
    const rw=num(STATE.weights.regionali);
    if(rw>0&&rs.length){rs.forEach(x=>{if(x.delta!=null){weighted+=x.delta*rw/rs.length;totalW+=rw/rs.length;parts.push({label:"regionali "+x.year,local:x.share,delta:x.delta,weight:rw/rs.length});}});}
    const delta=totalW?weighted/totalW:0;
    out[id]=clamp(baseNational(ch,id)+STATE.strength*delta);
    diagnostic[id]={delta,parts};
  });
  const sum=Object.values(out).reduce((a,v)=>a+v,0)||1;
  Object.keys(out).forEach(id=>out[id]=out[id]/sum*100);
  return {shares:out,diagnostic};
}
function keyCollegeElection(x){return x;}
function cameraMap(){
  const grouped={};
  Object.entries(CORE?.camera?.seats||{}).forEach(([name,v])=>{(grouped[v.region]??=[]).push([name,v]);});
  return Object.fromEntries(Object.entries(grouped).map(([r,arr])=>[r,arr.map(([n,v])=>n+"|"+v.noPrizeSeats+"|"+v.withPrizeSeats+(v.special?"|SPECIAL":""))]));
}
function senateMap(){
  const grouped={};
  Object.entries(CORE?.senato?.seats||{}).forEach(([name,v])=>{(grouped[v.region]??=[]).push([name,v]);});
  return Object.fromEntries(Object.entries(grouped).map(([r,arr])=>[r,arr.map(([n,v])=>n+"|"+v.noPrizeSeats+"|"+v.withPrizeSeats+(v.special?"|SPECIAL":""))]));
}
function scenarioAll(ch){
  const ps=getParties(),out={};
  for(const [name,meta] of Object.entries(CORE?.[ch]?.seats||{})){
    if(meta.special)continue;
    const r=meta.region;out[name]=modelForCollege(ch,r,name).shares;
  }
  return out;
}
function currentSpecial(){
  const a=appState();const base={camera:{estero:{},valleDAosta:{},trentinoAltoAdige:{}},senato:{estero:{},valleDAosta:{},trentinoAltoAdige:{}}};
  ["camera","senato"].forEach(ch=>["estero","valleDAosta","trentinoAltoAdige"].forEach(cat=>base[ch][cat]={...(a.specialSeats?.[ch]?.[cat]||{})}));
  return base;
}
function currentNational(){
  const ps=getParties(),out={};
  Object.keys(ps).forEach(id=>out[id]=baseNational("camera",id));
  const vals=Object.values(out).reduce((a,v)=>a+v,0)||1;
  Object.keys(out).forEach(id=>out[id]=out[id]/vals*100);
  return out;
}
function engineInput(){
  const ps=getParties(),national=currentNational(),camValues=scenarioAll("camera"),regional={};
  const camMap=cameraMap(),senMap=senateMap();
  Object.keys(CORE?.senato?.seats||{}).forEach(name=>{
    const r=CORE.senato.seats[name].region;if(CORE.senato.seats[name].special)return;
    regional[r]??={};
    const row=camValues;void row;
  });
  const regions=[...new Set(Object.values(CORE?.senato?.seats||{}).map(v=>v.region))].filter(Boolean);
  regions.forEach(region=>{
    const cols=collegesForRegion("senato",region),weights=cols.map(c=>num(CORE.senato.seats[c]?.noPrizeSeats)||1),tw=weights.reduce((a,v)=>a+v,0)||1;
    regional[region]={};
    Object.keys(ps).forEach(id=>regional[region][id]=cols.reduce((a,c,i)=>a+((modelForCollege("senato",region,c).shares[id]||0)*weights[i]),0)/tw);
  });
  const partiesShape=Object.fromEntries(Object.entries(ps).map(([id,p])=>[id,{name:p.name,camera:p.camera,senate:p.senate}]));
  return {
    law:window.SONDAGGI_LAW_20261008,
    parties:partiesShape,
    coalitions:appState().coalitions||[],
    specialSeats:currentSpecial(),
    camera:{nationalValues:national,collegeValues:camValues,collegeWeights:{},collegeMap:camMap},
    senato:{nationalValues:national,regionalValuesByRegion:regional,collegeMap:senMap,premiumByRegion:window.SONDAGGI_LAW_20261008?.rules?.senatePremiumByRegion||{}}
  };
}
function runSeats(){
  const engine=window.SONDAGGI_ELECTION_ENGINE_20261008;
  if(!engine?.simulate||!window.SONDAGGI_LAW_20261008)return null;
  try{return engine.simulate(engineInput());}catch(err){console.error("Territorial seat simulation",err);return {error:String(err?.message||err)};}
}
function cameraCollegeSeat(sim,college,id){
  if(!sim?.cam)return 0;
  const circ=String(college).replace(/\s-\sP\d+$/,"");
  const ordinary=num(sim.cam.collegeResults?.ordinary?.[circ]?.[college]?.alloc?.[id]);
  const prize=num(sim.cam.collegeResults?.prize?.[circ]?.[id]?.seats?.[college]);
  return ordinary+prize;
}
function senateCollegeSeat(sim,region,college,id){
  return num(sim?.sen?.regions?.[region]?.collegeResults?.byList?.[id]?.[college]);
}
function allRows(ch,region,id,sim){
  return collegesForRegion(ch,region).map(college=>{
    const m=modelForCollege(ch,region,college),share=m.shares[id]??0;
    const seats=ch==="camera"?cameraCollegeSeat(sim,college,id):senateCollegeSeat(sim,region,college,id);
    return {college,share,seats};
  });
}
function regions(ch){return [...new Set(Object.values(CORE?.[ch]?.seats||{}).map(v=>v.region))].filter(Boolean).sort((a,b)=>a.localeCompare(b,"it"));}
function render(){
  const host=document.getElementById("sgTerritorialAnalysis");if(!host||!CORE)return;
  const ps=getParties(),rs=regions(STATE.chamber);if(!rs.includes(STATE.region))STATE.region=rs.includes("Lombardia")?"Lombardia":(rs[0]||"");
  const cols=collegesForRegion(STATE.chamber,STATE.region);if(!cols.includes(STATE.college))STATE.college=cols[0]||"";
  if(!ps[STATE.party])STATE.party="FdI";
  const model=modelForCollege(STATE.chamber,STATE.region,STATE.college),p=ps[STATE.party]||ps.FdI;
  const row=model.diagnostic[STATE.party]||{delta:0,parts:[]};
  const obsRows=["politiche2022","europee2019","europee2024"].map(k=>({label:k,share:obs(STATE.chamber,k,STATE.college,STATE.party),nat:nationalObserved(STATE.chamber,k,STATE.party)}));
  const regObs=regionalSignals(STATE.region,STATE.party);
  const sim=runSeats(), rows=allRows(STATE.chamber,STATE.region,STATE.party,sim);
  const totalSelected=rows.reduce((a,x)=>a+x.seats,0);
  host.innerHTML=`
  <section class="sta">
    <div class="sta-head"><div><div class="sta-kicker">ANALISI TERRITORIALE</div><h2>Scenario per regione e collegio</h2><p>Modello statistico trasparente: parte dal valore nazionale corrente e applica gli scostamenti territoriali osservati nelle elezioni precedenti. Il risultato è uno <b>scenario</b>, non un dato elettorale già avvenuto.</p></div><div class="sta-badges"><span>Politiche 2022</span><span>Europee 2019</span><span>Europee 2024</span><span>Regionali</span></div></div>
    <div class="sta-controls">
      <label>Camera / Senato<select id="staCh"><option value="camera">Camera</option><option value="senato">Senato</option></select></label>
      <label>Regione<select id="staReg">${rs.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select></label>
      <label>Collegio<select id="staCol">${cols.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select></label>
      <label>Partito<select id="staParty">${Object.entries(ps).map(([id,x])=>`<option value="${esc(id)}">${esc(x.name)}</option>`).join("")}</select></label>
      <label>Intensità territoriale<input id="staStrength" type="number" min="0" max="2" step="0.1" value="${STATE.strength.toFixed(1)}"><small>0 = solo nazionale · 1 = effetto pieno · 2 = effetto raddoppiato</small></label>
    </div>
    <div class="sta-card sta-main">
      <div><div class="sta-overline">${esc(p.name)} · ${esc(STATE.region)} · ${esc(STATE.college)}</div><div class="sta-big">${pct(model.shares[STATE.party])}%</div><div class="sta-sub">quota stimata nello scenario territoriale</div></div>
      <div class="sta-kpis">
        <div><b>${pct(baseNational(STATE.chamber,STATE.party))}%</b><span>base nazionale</span></div>
        <div><b>${row.delta>=0?"+":""}${pct(row.delta)} pt</b><span>aggiustamento territoriale</span></div>
        <div><b>${totalSelected}</b><span>seggi simulati nella regione</span></div>
      </div>
    </div>
    <div class="sta-grid">
      <section class="sta-card"><div class="sta-title"><b>Dati osservati nel collegio</b><span>percentuali reali</span></div><table><thead><tr><th>Elezione</th><th>Collegio</th><th>Dato nazionale</th><th>Scostamento</th></tr></thead><tbody>${obsRows.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.share==null?"—":pct(x.share)+"%"}</td><td>${x.nat==null?"—":pct(x.nat)+"%"}</td><td>${x.share==null||x.nat==null?"—":(x.share-x.nat>=0?"+":"")+pct(x.share-x.nat)+" pt"}</td></tr>`).join("")}</tbody></table>${regObs.length?`<div class="sta-note"><b>Regionali della regione:</b> ${regObs.map(x=>x.share==null?x.year+" —":x.year+" "+pct(x.share)+"%").join(" · ")}</div>`:"<div class='sta-note'>Dati Regionali in aggiornamento per questa regione.</div>"}</section>
      <section class="sta-card"><div class="sta-title"><b>Seggi per collegio</b><span>${STATE.chamber==="camera"?"riparto Camera":"riparto Senato con lettura territoriale"}</span></div><div class="sta-bars">${rows.map(x=>`<div class="sta-bar"><div><b>${esc(x.college)}</b><span>${x.seats} seggi · ${pct(x.share)}%</span></div><div class="sta-track"><i style="width:${Math.max(2,Math.min(100,x.share))}%"></i></div></div>`).join("")}</div><div class="sta-note">${STATE.chamber==="camera"?"Per la Camera i seggi sono quelli restituiti dal motore di riparto statutario sullo scenario territoriale.":"Per il Senato la legge ripartisce i seggi a livello regionale; la colonna per collegio è una lettura territoriale di servizio, mentre il totale regionale proviene dal motore statutario."}</div></section>
    </div>
    <section class="sta-card"><div class="sta-title"><b>Come si forma la stima</b><span>pesi modificabili nel codice</span></div><table><thead><tr><th>Segnale</th><th>Peso</th><th>Disponibile</th><th>Effetto sul collegio</th></tr></thead><tbody>
      <tr><td>Politiche 2022</td><td>${Math.round(STATE.weights.politiche2022*100)}%</td><td>${obs(STATE.chamber,"politiche2022",STATE.college,STATE.party)==null?"NO":"SI"}</td><td>${(()=>{const a=obs(STATE.chamber,"politiche2022",STATE.college,STATE.party),n=nationalObserved(STATE.chamber,"politiche2022",STATE.party);return a==null||n==null?"—":(a-n>=0?"+":"")+pct(a-n)+" pt"})()}</td></tr>
      <tr><td>Europee 2019</td><td>${Math.round(STATE.weights.europee2019*100)}%</td><td>${obs(STATE.chamber,"europee2019",STATE.college,STATE.party)==null?"NO":"SI"}</td><td>${(()=>{const a=obs(STATE.chamber,"europee2019",STATE.college,STATE.party),n=nationalObserved(STATE.chamber,"europee2019",STATE.party);return a==null||n==null?"—":(a-n>=0?"+":"")+pct(a-n)+" pt"})()}</td></tr>
      <tr><td>Europee 2024</td><td>${Math.round(STATE.weights.europee2024*100)}%</td><td>${obs(STATE.chamber,"europee2024",STATE.college,STATE.party)==null?"NO":"SI"}</td><td>${(()=>{const a=obs(STATE.chamber,"europee2024",STATE.college,STATE.party),n=nationalObserved(STATE.chamber,"europee2024",STATE.party);return a==null||n==null?"—":(a-n>=0?"+":"")+pct(a-n)+" pt"})()}</td></tr>
      <tr><td>Regionali</td><td>${Math.round(STATE.weights.regionali*100)}%</td><td>${regObs.length?"SI":"NO"}</td><td>${regObs.length&&regObs.some(x=>x.delta!=null)?"SI":"—"}</td></tr>
    </tbody></table>
    </section>
    <div class="sta-foot">Fonti: dati elettorali pubblici comunali e codici territoriali; le Europee 2019/2024 e le Politiche 2022 sono ricondotte ai collegi 2022 tramite identificazione comunale. Nessun risultato storico viene modificato.</div>
  </section>`;
  document.getElementById("staCh").value=STATE.chamber;document.getElementById("staReg").value=STATE.region;document.getElementById("staCol").value=STATE.college;document.getElementById("staParty").value=STATE.party;
  document.getElementById("staCh").onchange=e=>{STATE.chamber=e.target.value;render();};
  document.getElementById("staReg").onchange=e=>{STATE.region=e.target.value;STATE.college=collegesForRegion(STATE.chamber,STATE.region)[0]||"";render();};
  document.getElementById("staCol").onchange=e=>{STATE.college=e.target.value;render();};
  document.getElementById("staParty").onchange=e=>{STATE.party=e.target.value;render();};
  document.getElementById("staStrength").onchange=e=>{STATE.strength=clamp(e.target.value,0,2);render();};
}
function injectStyle(){
 if(document.getElementById("staStyle"))return;
 const st=document.createElement("style");st.id="staStyle";st.textContent=`
#sgTerritorialAnalysis{display:block;width:100%;margin:14px 0 20px}.sta{background:#071a2b;color:#eaf4fb;border:1px solid #294b62;border-radius:14px;padding:16px;font-family:Arial,sans-serif}.sta *{box-sizing:border-box}.sta-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.sta-kicker{font-size:9px;font-weight:900;letter-spacing:.15em;color:#66c2ff}.sta h2{margin:4px 0 5px;font-size:22px;color:#fff}.sta-head p{margin:0;color:#9eb6c7;font-size:10px;line-height:1.5;max-width:950px}.sta-badges{display:flex;gap:6px;flex-wrap:wrap}.sta-badges span{padding:6px 8px;border:1px solid #35586d;background:#0e2a3f;border-radius:999px;color:#c6dce6;font-size:7px;font-weight:900}.sta-controls{display:grid;grid-template-columns:140px 1fr 1fr 1fr 150px;gap:8px;margin-top:12px}.sta-controls label{font-size:7px;color:#7895a8;text-transform:uppercase;font-weight:900}.sta-controls select,.sta-controls input{display:block;margin-top:4px;width:100%;height:34px;border:1px solid #31536a;border-radius:8px;background:#091827;color:#fff;padding:7px 8px;font-size:9px}.sta-controls small{display:block;font-size:6px;color:#6e899b;margin-top:4px;line-height:1.25;text-transform:none}.sta-card{background:#0a2033;border:1px solid #24465e;border-radius:10px;padding:11px}.sta-main{display:flex;justify-content:space-between;gap:14px;margin-top:10px;background:#0b253b}.sta-overline{font-size:8px;color:#7fa0b4;text-transform:uppercase;font-weight:900}.sta-big{font-size:36px;font-weight:900;color:#fff;line-height:1.05;margin-top:3px}.sta-sub{font-size:7px;color:#88a3b3;margin-top:3px}.sta-kpis{display:grid;grid-template-columns:repeat(3,minmax(110px,1fr));gap:8px}.sta-kpis div{padding:9px;border:1px solid #294b64;background:#102b41;border-radius:8px}.sta-kpis b{display:block;color:#fff;font-size:16px}.sta-kpis span{display:block;margin-top:2px;color:#7998aa;font-size:6px;text-transform:uppercase}.sta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.sta-title{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}.sta-title b{font-size:10px;color:#fff}.sta-title span{font-size:7px;color:#7590a3}.sta table{width:100%;border-collapse:collapse;font-size:8px}.sta th{padding:7px 6px;border-bottom:1px solid #2a4c61;color:#7896a8;text-align:left;font-size:6px;text-transform:uppercase}.sta td{padding:7px 6px;border-bottom:1px solid #18384f;color:#d8e8ef}.sta-bars{display:grid;gap:7px}.sta-bar>div:first-child{display:flex;justify-content:space-between;gap:8px;font-size:7px}.sta-bar span{color:#8fb1c0}.sta-track{height:10px;background:#123149;border-radius:5px;overflow:hidden;margin-top:3px}.sta-track i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#287fae,#67c5eb)}.sta-note{margin-top:9px;padding:8px 9px;border:1px solid #294b62;border-radius:8px;background:#0d2539;color:#90aabb;font-size:7px;line-height:1.45}.sta-foot{margin-top:9px;color:#6f899b;font-size:7px;line-height:1.45}@media(max-width:1050px){.sta-controls{grid-template-columns:1fr 1fr}.sta-grid{grid-template-columns:1fr}.sta-main{display:block}.sta-kpis{margin-top:10px}}@media(max-width:650px){.sta{padding:10px}.sta-head{display:block}.sta-badges{margin-top:8px}.sta-controls{grid-template-columns:1fr}.sta-kpis{grid-template-columns:1fr 1fr}.sta-big{font-size:30px}.sta table{min-width:560px}.sta-card{overflow:auto}}`;
 document.head.appendChild(st);
}
async function start(){
  injectStyle();
  const host=document.createElement("section");host.id="sgTerritorialAnalysis";
  const anchor=document.getElementById("tab-sondaggi");if(!anchor)return;
  anchor.appendChild(host);
  try{const r=await fetch(DATA_URL,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);CORE=await r.json();}catch(err){host.innerHTML="<div class='sta'><b>Archivio territoriale non disponibile.</b><div class='sta-foot'>"+esc(err?.message||err)+"</div></div>";return;}
  try{const r=await fetch(REGIONAL_URL,{cache:"no-store"});if(r.ok)REGIONALS=await r.json();}catch(_){REGIONALS=null;}
  const ps=getParties(),rs=regions("camera");STATE.region=rs.includes("Lombardia")?"Lombardia":rs[0]||"";STATE.college=collegesForRegion("camera",STATE.region)[0]||"";
  render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();