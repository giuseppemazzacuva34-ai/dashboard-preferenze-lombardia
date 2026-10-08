(function(){
"use strict";
function homeElectionSource(){
  try{
    return (typeof election!=="undefined" && election==="europee")
      ? (typeof EURO_RAW!=="undefined" && Array.isArray(EURO_RAW) ? EURO_RAW : [])
      : (typeof RAW!=="undefined" && Array.isArray(RAW) ? RAW : []);
  }catch(_){ return []; }
}
function redrawHomeElectionChart(){
  try{
    const c=document.getElementById("provChart");
    if(!c || typeof c.getContext!=="function") return;
    const src=homeElectionSource(), sums=Object.create(null);
    src.forEach(r=>{
      const p=String(r?.prov||"").trim().toUpperCase();
      if(p) sums[p]=(sums[p]||0)+(Number(r?.preferenze)||0);
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
      const y=top+i*rowH+rowH/2, bw=barMax*(r[1]/max);
      x.textBaseline="middle"; x.textAlign="right"; x.font="600 13px Arial"; x.fillStyle="#d7e5f2";
      x.fillText(names[r[0]]||r[0],left-12,y);
      x.fillStyle="rgba(16,44,69,.9)"; x.fillRect(left,y-6,barMax,12);
      x.fillStyle=palette[i%palette.length]; x.fillRect(left,y-6,Math.max(4,bw),12);
      x.textAlign="left"; x.font="700 13px Arial"; x.fillStyle="#f2f7fb";
      const pct=total?((r[1]/total)*100).toFixed(1)+"%":"0.0%";
      x.fillText(r[1].toLocaleString("it-IT")+" · "+pct,Math.min(left+bw+10,w-118),y);
    });
    const label=document.getElementById("homeElectionLabel");
    if(label) label.textContent=(typeof election!=="undefined"&&election==="europee")?"Europee 2024 · FdI":"Regionali 2023 · FdI";
  }catch(err){console.error("Home election chart definitive fix",err);}
}
function afterMacro(){
  setTimeout(redrawHomeElectionChart,0);
  setTimeout(redrawHomeElectionChart,100);
  setTimeout(redrawHomeElectionChart,500);
}
const previous=window.dashboardSetMacro;
window.dashboardSetMacro=function(v){
  if(typeof previous==="function") previous(v);
  afterMacro();
};
window.switchElection=window.dashboardSetMacro;
document.addEventListener("click",function(ev){
  const b=ev.target?.closest?.(".macro-tab");
  if(b) afterMacro();
},true);
window.addEventListener("resize",afterMacro);
window.addEventListener("load",afterMacro);
window.redrawHomeElectionChart=redrawHomeElectionChart;
afterMacro();
})();