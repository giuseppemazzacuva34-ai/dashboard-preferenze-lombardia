(function(){
"use strict";

const SUPA_URL="https://ywunvmanmdubnvuolneu.supabase.co";
const SUPA_KEY="sb_publishable_g7byaP5qsNM0FoPNPSIU5A_zXS5nXXE";
const CKEY="lombardia_correnti_2026";
const TKEY="lombardia_ticket_2026";
const H={
  apikey:SUPA_KEY,
  Authorization:"Bearer "+SUPA_KEY,
  "Content-Type":"application/json"
};

async function api(path,options){
  const r=await fetch(SUPA_URL+"/rest/v1/"+path,{
    ...options,
    headers:{...H,...(options&&options.headers||{})}
  });
  if(!r.ok) throw new Error("Supabase "+r.status+" "+await r.text());
  return r;
}

function localJSON(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||"");}catch(_){return fallback;}
}

async function loadShared(){
  try{
    const [cr,tr]=await Promise.all([
      api("correnti?select=candidato,corrente&order=candidato",{method:"GET"}),
      api("ticket_groups?select=id,provincia,candidato_1,candidato_2&order=created_at",{method:"GET"})
    ]);
    const cloudCorr=await cr.json();
    const cloudTickets=await tr.json();

    if(Array.isArray(cloudCorr)&&cloudCorr.length){
      const next={};
      cloudCorr.forEach(x=>{if(x&&x.candidato)next[String(x.candidato)]=String(x.corrente||"");});
      correnti=next;
      localStorage.setItem(CKEY,JSON.stringify(next));
    }else{
      await migrateLocal();
    }

    if(Array.isArray(cloudTickets)&&cloudTickets.length){
      ticketGroups=cloudTickets.filter(x=>x&&x.id&&x.provincia&&x.candidato_1&&x.candidato_2).map(x=>({
        id:String(x.id),
        prov:String(x.provincia),
        candidates:[String(x.candidato_1),String(x.candidato_2)]
      }));
      localStorage.setItem(TKEY,JSON.stringify(ticketGroups));
    }else{
      const local=localJSON(TKEY,[]);
      if(Array.isArray(local)&&local.length) await uploadTickets(local);
    }

    applyCorrenti();
    refreshKpi();
    refreshTicketList();
    refreshTicketColumn();
    render();
  }catch(err){
    console.error("Supabase load",err);
  }
}

async function migrateLocal(){
  const c=localJSON(CKEY,{});
  const t=localJSON(TKEY,[]);
  if(c&&typeof c==="object"&&!Array.isArray(c)){
    for(const k of Object.keys(c)){
      await uploadCorrente(k,c[k]);
    }
  }
  if(Array.isArray(t)&&t.length) await uploadTickets(t);
}

async function uploadCorrente(c,v){
  return api("correnti",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({
      candidato:String(c),
      corrente:String(v||""),
      updated_at:new Date().toISOString()
    })
  });
}

async function uploadTickets(list){
  if(!Array.isArray(list)||!list.length)return;
  return api("ticket_groups",{
    method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(list.map(t=>({
      id:String(t.id),
      provincia:String(t.prov),
      candidato_1:String(t.candidates[0]),
      candidato_2:String(t.candidates[1]),
      updated_at:new Date().toISOString()
    })))
  });
}

async function deleteTicket(id){
  return api("ticket_groups?id=eq."+encodeURIComponent(String(id)),{
    method:"DELETE",
    headers:{Prefer:"return=minimal"}
  });
}

document.addEventListener("click",function(ev){
  const currentButton=ev.target.closest&&ev.target.closest("#candTable .btn.bg2");
  if(currentButton){
    const row=currentButton.closest("tr");
    const input=row&&row.querySelector("input.inline-input");
    const candidate=row&&row.children[0]&&row.children[0].textContent.trim();
    if(input&&candidate){
      uploadCorrente(candidate,input.value).catch(err=>console.error("Supabase corrente",err));
    }
  }

  const ticketButton=ev.target.closest&&ev.target.closest('[data-ticket-id]');
  if(ticketButton){
    const id=ticketButton.getAttribute("data-ticket-id");
    if(id){
      deleteTicket(id).catch(err=>console.error("Supabase ticket delete",err));
    }
  }

  const addTicket=ev.target.closest&&ev.target.closest("#ticketManagerInline button");
  if(addTicket && (addTicket.textContent||"").includes("AGGIUNGI TICKET")){
    setTimeout(function(){
      try{ uploadTickets(ticketGroups); }catch(err){console.error("Supabase ticket add",err);}
    },0);
  }
});

document.addEventListener("change",function(ev){
  const input=ev.target.closest&&ev.target.closest("#candTable input.inline-input");
  if(input){
    const row=input.closest("tr");
    const candidate=row&&row.children[0]&&row.children[0].textContent.trim();
    if(candidate) uploadCorrente(candidate,input.value).catch(err=>console.error("Supabase corrente",err));
  }
});


function refreshElectionProvinceViews(){
  try{
    const raw=(typeof election!=="undefined" && election==="europee")?EURO_RAW:RAW;
    const sums={};
    raw.forEach(r=>{
      const k=String(r.prov||"").trim();
      sums[k]=(sums[k]||0)+(Number(r.preferenze)||0);
    });
    const rows=Object.entries(sums).sort((a,b)=>b[1]-a[1]);
    if(typeof barChart==="function") barChart("provChart",rows);
    if(typeof current!=="undefined" && current==="analisi" && typeof renderAnalisi==="function"){
      renderAnalisi();
    }
    const sub=document.querySelector(".home-toolbar-left small");
    if(sub && typeof electionLabel==="function") sub.textContent=electionLabel()+" · FdI";
  }catch(err){
    console.error("Election province refresh",err);
  }
}

const _originalDashboardSetMacro=window.dashboardSetMacro;
window.dashboardSetMacro=function(v){
  if(typeof _originalDashboardSetMacro==="function"){
    _originalDashboardSetMacro(v);
  }else{
    try{
      election=v;
      if(typeof setElectionData==="function") setElectionData();
      if(typeof render==="function") render();
    }catch(err){ console.error("Election switch",err); }
  }
  setTimeout(refreshElectionProvinceViews,0);
};
window.switchElection=window.dashboardSetMacro;


function installMobileLayout(){
  if(typeof document==="undefined" || document.getElementById("dashboard-mobile-fixes")) return;
  const style=document.createElement("style");
  style.id="dashboard-mobile-fixes";
  style.textContent=String.raw`
@media (max-width: 820px){
  html,body{width:100%;max-width:100%;overflow-x:hidden}
  body{padding-bottom:72px!important}

  header.app-header{
    position:sticky!important;
    top:0!important;
    z-index:200!important;
    height:auto!important;
    min-height:66px!important;
    display:grid!important;
    grid-template-columns:1fr auto!important;
    gap:8px!important;
    padding:9px 10px!important;
  }
  .brand-block{gap:9px!important;min-width:0}
  .brand-mark{width:34px!important;height:34px!important;border-radius:9px!important;font-size:11px!important}
  .brand-title{font-size:15px!important;white-space:nowrap}
  .brand-sub{display:none!important}

  .header-center{
    grid-column:1/-1!important;
    width:100%!important;
    min-width:0!important;
  }
  .province-select{display:none!important}
  .global-search{
    display:block!important;
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:38px!important;
    font-size:11px!important;
  }
  .header-actions{gap:5px!important}
  .header-actions .btn,.header-actions .sync-state{display:none!important}
  .icon-action{width:34px!important;height:34px!important}

  .app-sidebar{
    top:auto!important;
    bottom:0!important;
    left:0!important;
    right:0!important;
    width:100%!important;
    height:68px!important;
    display:flex!important;
    align-items:stretch!important;
    gap:4px!important;
    padding:5px 4px!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    white-space:nowrap!important;
    border-right:0!important;
    border-top:1px solid #1e3954!important;
    background:#071a2d!important;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
  }
  .app-sidebar::-webkit-scrollbar{display:none}
  .side-label{display:none!important}
  .side-home,.side-tab,.macro-tab{
    flex:0 0 auto!important;
    width:auto!important;
    min-width:72px!important;
    height:58px!important;
    margin:0!important;
    padding:4px 7px!important;
    border-radius:9px!important;
    justify-content:center!important;
    align-items:center!important;
    flex-direction:column!important;
    gap:3px!important;
    font-size:8px!important;
    line-height:1.05!important;
    text-align:center!important;
  }
  .side-home span,.side-tab span,.macro-tab span{
    width:auto!important;
    font-size:17px!important;
    line-height:1!important;
  }
  .macro-tab{
    min-width:94px!important;
    border:1px solid transparent!important;
    font-size:8px!important;
  }
  .macro-tab small{
    display:block!important;
    margin:0!important;
    font-size:7px!important;
    line-height:1!important;
  }
  .side-home.active{box-shadow:0 3px 12px #1678ff33!important}
  .side-tab.active{box-shadow:inset 0 3px #2187ff!important}

  .top-kpis{
    position:static!important;
    left:auto!important;
    right:auto!important;
    top:auto!important;
    height:auto!important;
    width:100%!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    margin:0 0 12px!important;
    box-shadow:none!important;
  }
  .top-kpis .kpi{padding:10px 11px!important}
  .top-kpis .kv{font-size:18px!important}
  .top-kpis .kl{font-size:7px!important}

  main{
    margin-left:0!important;
    padding:12px 9px 82px!important;
    min-height:calc(100vh - 66px)!important;
  }
  .panel{max-width:none!important;width:100%!important}
  .home-head{display:block!important;margin-bottom:12px!important}
  .home-head h2{font-size:22px!important}
  .home-head p{font-size:11px!important;line-height:1.45!important}
  .home-status{margin-top:10px!important;min-width:0!important;width:100%!important}

  .home-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
  .home-kpi{min-height:105px!important;padding:13px!important}
  .home-kpi .kicon{width:35px!important;height:35px!important;font-size:18px!important;margin-right:9px!important}
  .home-kpi strong{font-size:22px!important}
  .home-kpi small{font-size:8px!important}
  .home-kpi em{padding-top:12px!important;font-size:8px!important}

  .dashboard-grid{grid-template-columns:1fr!important;gap:9px!important}
  .dash-card{padding:12px!important;border-radius:11px!important}
  .quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .quick-item{padding:10px!important}
  .quick-item>span{font-size:19px!important}
  .status-list{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  .status-list>div{padding:9px!important}
  .status-list b{font-size:18px!important}
  .status-list span{font-size:8px!important}

  .card-title{margin-bottom:9px!important}
  .card-title b{font-size:13px!important}
  .card-title small{font-size:8px!important}

  .filter-bar{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:8px!important;
    padding:10px!important;
    border-radius:11px!important;
  }
  .filter-control{min-width:0!important;width:100%!important}
  .filter-control span{font-size:8px!important}
  .filter-control select{
    width:100%!important;
    min-width:0!important;
    font-size:10px!important;
    padding:9px 8px!important;
  }
  .filter-bar>.btn{
    grid-column:1/-1!important;
    width:100%!important;
    justify-content:center!important;
  }

  .table-wrap{
    width:100%!important;
    max-width:100%!important;
    overflow-x:auto!important;
    overflow-y:auto!important;
    -webkit-overflow-scrolling:touch!important;
    max-height:65vh!important;
  }
  .data-table{font-size:11px!important}
  .data-table th{font-size:8px!important;padding:9px 8px!important}
  .data-table td{padding:9px 8px!important}

  /* Preferenze: su telefono trasformiamo la tabella in schede leggibili. */
  #tab-preferenze .pref-table-wrap{overflow:visible!important;max-height:none!important}
  #tab-preferenze .pref-table{
    min-width:0!important;
    width:100%!important;
    table-layout:auto!important;
    border-collapse:separate!important;
    border-spacing:0 7px!important;
  }
  #tab-preferenze .pref-table thead{display:none!important}
  #tab-preferenze .pref-table tbody{display:grid!important;gap:0!important}
  #tab-preferenze .pref-table tbody tr{
    display:grid!important;
    grid-template-columns:31px minmax(0,1fr) auto!important;
    grid-template-areas:
      "rank candidate total"
      "rank corrente total"!important;
    align-items:center!important;
    gap:4px 8px!important;
    padding:9px!important;
    margin:0 0 7px!important;
    background:#0c2137!important;
    border:1px solid #1e3d59!important;
    border-radius:10px!important;
  }
  #tab-preferenze .pref-table tbody td{
    border:0!important;
    padding:3px 0!important;
    min-width:0!important;
    white-space:normal!important;
  }
  #tab-preferenze .pref-table tbody td:nth-child(1){grid-area:rank!important;text-align:center!important;width:auto!important;font-weight:800!important;color:#7fa6d0!important}
  #tab-preferenze .pref-table tbody td:nth-child(2){grid-area:candidate!important;width:auto!important}
  #tab-preferenze .pref-table tbody td:nth-child(3){grid-area:corrente!important;width:auto!important}
  #tab-preferenze .pref-table tbody td:nth-child(4){grid-area:total!important;width:auto!important;text-align:right!important;align-self:center!important;font-size:15px!important}
  #tab-preferenze .pref-table .candidate-total{
    display:block!important;
    width:100%!important;
    overflow:visible!important;
    text-overflow:clip!important;
    white-space:normal!important;
    font-size:12px!important;
    line-height:1.2!important;
  }
  #tab-preferenze .pref-table td:nth-child(3)>div{
    display:flex!important;
    width:100%!important;
    min-width:0!important;
    gap:6px!important;
  }
  #tab-preferenze .pref-table td:nth-child(3) .inline-input{
    flex:1 1 auto!important;
    width:100%!important;
    min-width:0!important;
    height:34px!important;
    font-size:10px!important;
    padding:6px 7px!important;
  }
  #tab-preferenze .pref-table td:nth-child(3) .btn{
    flex:0 0 58px!important;
    min-width:58px!important;
    height:34px!important;
    padding:0 7px!important;
    font-size:9px!important;
  }

  .inline-input{max-width:100%!important}
  .mini-card{padding:11px!important;margin-bottom:7px!important}
  .collegio-list-grid{grid-template-columns:1fr!important}
  .collegio-summary{grid-template-columns:1fr 1fr 1fr!important}
  .manual-grid{grid-template-columns:1fr!important}
  .manual-row{grid-template-columns:1fr!important}

  .modal-backdrop{
    padding:8px!important;
    align-items:flex-start!important;
    overflow-y:auto!important;
  }
  .modal-card{
    width:100%!important;
    max-width:none!important;
    max-height:none!important;
    min-height:0!important;
    margin:0!important;
    padding:13px!important;
    border-radius:15px!important;
  }
  .modal-head{
    display:flex!important;
    flex-direction:column!important;
    gap:9px!important;
    margin-bottom:11px!important;
  }
  .modal-head h2{font-size:19px!important}
  .modal-head p{font-size:10px!important;line-height:1.4!important}
  .modal-head>.btn{width:100%!important}
  .modal-grid{grid-template-columns:1fr!important;gap:9px!important}
  .modal-grid .dash-card{padding:10px!important}
  .rank-row{gap:8px!important;padding:8px 0!important}
  .rank-row>b{width:22px!important}
  .rank-row small,.rank-row span{font-size:9px!important}

  .matrix-table{min-width:850px!important}
  .matrix-table th,.matrix-table td{font-size:9px!important;padding:7px!important}

  #homeQuick{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  #analisiKpi{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}

@media (max-width: 420px){
  .quick-grid,#homeQuick{grid-template-columns:1fr!important}
  .filter-bar{grid-template-columns:1fr!important}
  .filter-bar>.btn{grid-column:auto!important}
  .status-list{gap:5px!important}
  .status-list>div{padding:8px 6px!important}
  .status-list b{font-size:16px!important}
  .status-list span{font-size:7px!important}
  .top-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  #tab-preferenze .pref-table tbody tr{
    grid-template-columns:28px minmax(0,1fr) auto!important;
  }
}

@media (min-width: 821px){
  #dashboard-mobile-fixes{display:none}
}

  @media (max-width: 820px){
    #tab-preferenze .pref-table,
    #tab-preferenze .pref-table tbody,
    #tab-preferenze .pref-table tbody tr,
    #tab-preferenze .pref-table tbody td{
      width:100%!important;
      max-width:100%!important;
      min-width:0!important;
      box-sizing:border-box!important;
    }
    #tab-preferenze .pref-table tbody tr{
      grid-template-columns:28px minmax(0,1fr)!important;
      grid-template-areas:
        "rank candidate"
        "rank total"
        "rank corrente"!important;
      overflow:hidden!important;
    }
    #tab-preferenze .pref-table tbody td:nth-child(1){grid-area:rank!important}
    #tab-preferenze .pref-table tbody td:nth-child(2){grid-area:candidate!important;min-width:0!important;max-width:100%!important}
    #tab-preferenze .pref-table tbody td:nth-child(3){grid-area:corrente!important;min-width:0!important;max-width:100%!important;width:100%!important}
    #tab-preferenze .pref-table tbody td:nth-child(4){grid-area:total!important;min-width:0!important;max-width:100%!important;width:100%!important;text-align:left!important;font-size:14px!important}
    #tab-preferenze .pref-table td:nth-child(3)>div{
      width:100%!important;
      max-width:100%!important;
      min-width:0!important;
      box-sizing:border-box!important;
      display:grid!important;
      grid-template-columns:minmax(0,1fr) 58px!important;
      gap:6px!important;
    }
    #tab-preferenze .pref-table td:nth-child(3) .inline-input{
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      box-sizing:border-box!important;
      height:34px!important;
    }
    #tab-preferenze .pref-table td:nth-child(3) .btn{
      width:58px!important;
      min-width:58px!important;
      max-width:58px!important;
      padding:0 5px!important;
      box-sizing:border-box!important;
    }
    #tab-preferenze .pref-table .candidate-total{
      max-width:100%!important;
      overflow-wrap:anywhere!important;
      word-break:break-word!important;
    }
  }

  @media (max-width: 420px){
    #tab-preferenze .pref-table tbody tr{
      grid-template-columns:25px minmax(0,1fr)!important;
    }
    #tab-preferenze .pref-table td:nth-child(3)>div{
      grid-template-columns:minmax(0,1fr) 54px!important;
      gap:5px!important;
    }
    #tab-preferenze .pref-table td:nth-child(3) .btn{
      width:54px!important;
      min-width:54px!important;
      max-width:54px!important;
      font-size:8px!important;
    }
  }
`;
  document.head.appendChild(style);
}

installMobileLayout();
installMobileLayout();
installMobilePreferences();
cleanupStrayMobileText();

loadShared();
setTimeout(cleanupStrayMobileText,1200);
function installMobilePreferences(){
  const st=document.createElement("style");
  st.id="mobile-pref-v4";
  st.textContent='@media(max-width:820px){#tab-preferenze .pref-table-wrap{display:none!important}#tab-preferenze .pref-mobile-list{display:block!important}.pref-mobile-card{background:#0c2137;border:1px solid #1e3d59;border-radius:11px;padding:11px;margin-bottom:8px}.pref-mobile-top{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:7px;align-items:start}.pref-mobile-name{background:none;border:0;color:#e8f3fb;text-align:left;font-size:12px;font-weight:900;overflow-wrap:anywhere;padding:0}.pref-mobile-total{font-size:14px;font-weight:900;white-space:nowrap}.pref-mobile-label{margin:9px 0 4px 35px;font-size:8px;color:#8da2b8;text-transform:uppercase;font-weight:800}.pref-mobile-edit{display:grid;grid-template-columns:minmax(0,1fr) 58px;gap:6px;margin-left:35px}.pref-mobile-input{width:100%;min-width:0;box-sizing:border-box;height:36px;background:#0d1826;color:#fff;border:1px solid #2a4058;border-radius:8px;padding:7px 9px;pointer-events:auto}.pref-mobile-save{width:58px!important;min-width:58px!important;height:36px!important;padding:0 5px!important}@media(max-width:420px){.pref-mobile-edit{margin-left:31px;grid-template-columns:minmax(0,1fr) 54px}.pref-mobile-save{width:54px!important;min-width:54px!important}.pref-mobile-label{margin-left:31px}}}@media(min-width:821px){.pref-mobile-list{display:none!important}}';
  document.head.appendChild(st);

  const card=document.querySelector("#tab-preferenze .pref-card");
  if(!card) return;
  let list=document.getElementById("prefMobileList");
  if(!list){
    list=document.createElement("div");
    list.id="prefMobileList";
    list.className="pref-mobile-list";
    card.appendChild(list);
  }

  const renderMobile=()=>{
    if(!window.matchMedia("(max-width:820px)").matches) return;
    try{
      const totals=agg(filtered(),r=>r.candidato);
      list.innerHTML=totals.map((x,i)=>{
        const name=String(x[0]);
        const val=String((correnti[name]||""));
        return '<div class="pref-mobile-card"><div class="pref-mobile-top"><div>'+String(i+1)+'</div><button type="button" class="pref-mobile-name" data-name="'+esc(name).replace(/"/g,"&quot;")+'">'+esc(name)+'</button><div class="pref-mobile-total">'+Number(x[1]||0).toLocaleString("it-IT")+'</div></div><div class="pref-mobile-label">Corrente FdI</div><div class="pref-mobile-edit"><input type="text" class="pref-mobile-input" value="'+esc(val)+'" placeholder="Scrivi il nome della corrente"><button type="button" class="btn bg2 pref-mobile-save">Salva</button></div></div>';
      }).join("");
      list.querySelectorAll(".pref-mobile-card").forEach(box=>{
        const b=box.querySelector(".pref-mobile-name");
        const input=box.querySelector(".pref-mobile-input");
        const save=box.querySelector(".pref-mobile-save");
        const name=b.getAttribute("data-name")||"";
        b.addEventListener("click",()=>typeof openCandidate==="function"&&openCandidate(name));
        const doSave=()=>typeof saveCorrente==="function"&&saveCorrente(name,input.value);
        save.addEventListener("click",doSave);
        input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();doSave();}});
      });
    }catch(e){console.error("Mobile preferenze",e);}
  };

  const t=document.getElementById("prefTable");
  if(t&&typeof MutationObserver!=="undefined"){
    let busy=false;
    new MutationObserver(()=>{if(busy)return;busy=true;Promise.resolve().then(()=>{renderMobile();busy=false;});}).observe(t,{childList:true,subtree:true});
  }
  setTimeout(renderMobile,100);
}


function installAnalysisModule(){
  const style=document.createElement("style");
  style.id="analysis-module-v2";
  style.textContent=
    "#tab-analisi{color:#eaf4fb!important}" +
    "#tab-analisi .analysis-v2{display:block!important}" +
    "@media(min-width:821px){#tab-analisi .analysis-v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}" +
    "#tab-analisi .analysis-v2-wide{grid-column:1/-1}}" +
    "@media(max-width:820px){#tab-analisi .analysis-v2-grid{display:grid;grid-template-columns:1fr;gap:9px}" +
    "#tab-analisi .analysis-v2-head{display:block!important}.analysis-v2-controls{grid-template-columns:1fr!important}" +
    ".analysis-v2-card{padding:11px!important}.analysis-v2-table-wrap{overflow-x:auto!important}" +
    ".analysis-v2-table{min-width:720px!important}}" +
    ".analysis-v2-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}" +
    ".analysis-v2-head h2{margin:0;font-size:22px;color:#eef7fb}.analysis-v2-head p{margin:5px 0 0;font-size:11px;line-height:1.45;color:#8da5ba;max-width:760px}" +
    ".analysis-v2-badge{border:1px solid #294862;background:#0c2238;color:#9bc0da;border-radius:9px;padding:7px 10px;font-size:9px;font-weight:800;white-space:nowrap}" +
    ".analysis-v2-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}" +
    ".analysis-v2-control{min-width:0}.analysis-v2-control label{display:block;margin:0 0 4px;font-size:8px;text-transform:uppercase;font-weight:900;color:#87a2ba}" +
    ".analysis-v2-control input,.analysis-v2-control select{width:100%;box-sizing:border-box;background:#091827!important;color:#f0f7fb!important;border:1px solid #2a455e!important;border-radius:8px;padding:9px 10px;font-size:10px;outline:none}" +
    ".analysis-v2-control input:focus,.analysis-v2-control select:focus{border-color:#3e83bb!important;box-shadow:0 0 0 2px #2a6e9d33!important}" +
    ".analysis-v2-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.analysis-v2-actions .btn{font-size:9px}" +
    ".analysis-v2-card{background:#0a2034!important;border:1px solid #1d3a54!important;border-radius:12px!important;padding:13px!important;box-sizing:border-box}" +
    ".analysis-v2-card h3{margin:0 0 9px;font-size:13px;color:#eaf4fb}.analysis-v2-card h3 small{font-size:8px;color:#7f9ab1;font-weight:700;margin-left:6px}" +
    ".analysis-v2-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}" +
    "@media(max-width:820px){.analysis-v2-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    ".analysis-v2-kpi{background:#0e2841;border:1px solid #20435f;border-radius:9px;padding:9px;min-width:0}" +
    ".analysis-v2-kpi b{display:block;font-size:17px;color:#f0f7fb}.analysis-v2-kpi span{display:block;margin-top:3px;font-size:7px;text-transform:uppercase;font-weight:900;color:#86a2ba}" +
    ".analysis-v2-compare{display:grid;grid-template-columns:1fr 34px 1fr;gap:8px;align-items:stretch}.analysis-v2-player{background:#0e2841;border:1px solid #20435f;border-radius:9px;padding:10px;min-width:0}" +
    ".analysis-v2-player strong{display:block;font-size:11px;overflow-wrap:anywhere;color:#eff7fb}.analysis-v2-player b{display:block;font-size:20px;margin-top:6px;color:#f4f9fc}.analysis-v2-player small{font-size:8px;color:#89a4bb}.analysis-v2-vs{display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#7595ae}" +
    ".analysis-v2-delta{margin-top:8px;padding:8px;border-radius:8px;background:#0d263d;font-size:10px;color:#b6cede}.analysis-v2-delta b{color:#eef7fb}" +
    ".analysis-v2-list{display:grid;gap:6px}.analysis-v2-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px 0;border-bottom:1px solid #17344d}.analysis-v2-row:last-child{border-bottom:0}.analysis-v2-rank{font-size:9px;color:#7f9ab0;font-weight:900;text-align:center}.analysis-v2-name{font-size:10px;font-weight:900;overflow-wrap:anywhere}.analysis-v2-meta{font-size:8px;color:#83a0b8;margin-top:2px}.analysis-v2-value{font-size:11px;font-weight:900;white-space:nowrap}" +
    ".analysis-v2-table{width:100%;border-collapse:collapse;font-size:9px}.analysis-v2-table th{font-size:7px;text-transform:uppercase;color:#7e9ab2;text-align:left;padding:7px;border-bottom:1px solid #24445e}.analysis-v2-table td{padding:7px;border-bottom:1px solid #17354c;color:#dcecf6}.analysis-v2-table td.num{text-align:right;font-weight:900;white-space:nowrap}.analysis-v2-table tr:last-child td{border-bottom:0}" +
    ".analysis-v2-note{padding:9px;border-radius:8px;background:#0d263d;border:1px solid #244963;color:#91abc0;font-size:8px;line-height:1.45}.analysis-v2-note b{color:#dcecf6}" +
    ".analysis-v2-empty{padding:18px;text-align:center;color:#7893aa;font-size:10px}" +
    ".analysis-v2-ticket{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px;background:#0e2841;border:1px solid #20435f;border-radius:8px}.analysis-v2-ticket div:first-child{min-width:0}.analysis-v2-ticket b{display:block;font-size:10px;overflow-wrap:anywhere}.analysis-v2-ticket small{display:block;margin-top:2px;font-size:8px;color:#88a3b9}.analysis-v2-ticket strong{font-size:12px;white-space:nowrap}" +
    ".analysis-v2-tag{display:inline-block;margin:2px 4px 2px 0;padding:3px 6px;border-radius:999px;background:#17344e;border:1px solid #2c4f69;font-size:7px;color:#a8c2d4}" +
    ".analysis-v2-error{padding:10px;border-radius:8px;background:#321a1a;border:1px solid #6b3434;color:#f0b4b4;font-size:9px}";

  document.head.appendChild(style);

  const state={
    dimension:"Camera P",
    collegio:"",
    comune:"",
    current:"",
    candA:"",
    candB:"",
    compare:true,
    election:null
  };
  const peerMaxCache={};

  const escH=(v)=>typeof esc==="function"?esc(String(v??"")):String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const normH=(v)=>typeof norm==="function"?norm(String(v??"")):String(v??"").trim().toUpperCase();

  function geoForComune(comune){
    const g=typeof GEO==="object"&&GEO?GEO:null;
    if(!g) return {};
    const keys=Object.keys(g);
    const k=keys.find(x=>normH(x)===normH(comune));
    return k?(g[k]||{}):{};
  }

  function valueByKey(obj,patterns){
    if(!obj||typeof obj!=="object") return "";
    const keys=Object.keys(obj);
    for(const pattern of patterns){
      const k=keys.find(x=>pattern.test(String(x).toLowerCase().replace(/\s+/g,"")));
      if(k && obj[k]!=null && String(obj[k]).trim()!=="") return String(obj[k]).trim();
    }
    return "";
  }

  function getComune(r){
    return String(r?.comune??r?.Comune??r?.nome_comune??r?.nome??r?.municipio??"").trim();
  }
  function getProvince(r){
    return String(r?.prov??r?.provincia??r?.province??"").trim();
  }
  function geoDimension(r,dimension){
    const direct=valueByKey(r,[/^(camera|cam).*p/,/^(camera|cam).*u/,/^(senato|sen).*p/,/^(senato|sen).*u/,/^(camera|cam).*plur/,/^(camera|cam).*uni/,/^(senato|sen).*plur/,/^(senato|sen).*uni/]);
    const g=geoForComune(getComune(r));
    const d=dimension.toLowerCase();
    const type=d.startsWith("camera")?"cam":"sen";
    const mode=d.endsWith("p")?"p":"u";
    const v1=valueByKey(r,[new RegExp("^"+type+".*"+mode),new RegExp("^"+type+".*"+(mode==="p"?"plur":"uni"))]);
    if(v1) return v1;
    const v2=valueByKey(g,[new RegExp("^"+type+".*"+mode),new RegExp("^"+type+".*"+(mode==="p"?"plur":"uni"))]);
    if(v2) return v2;
    if(dimension==="Provincia") return getProvince(r);
    return "";
  }

  function sourceFor(label){
    return label==="Europee"?EURO_RAW:RAW;
  }

  function rowsFor(src,dimension,collegio,comune){
    const arr=Array.isArray(src)?src:[];
    return arr.filter(r=>{
      if(comune && normH(getComune(r))!==normH(comune)) return false;
      if(dimension==="Provincia") return !collegio || normH(getProvince(r))===normH(collegio);
      return !collegio || normH(geoDimension(r,dimension))===normH(collegio);
    });
  }

  function sumsByCandidate(rows){
    const m={};
    rows.forEach(r=>{
      const c=String(r.candidato||"").trim();
      if(!c) return;
      m[c]=(m[c]||0)+(Number(r.preferenze)||0);
    });
    return m;
  }

  function sumsByComune(rows){
    const m={};
    rows.forEach(r=>{
      const c=getComune(r);
      if(!c) return;
      m[c]=(m[c]||0)+(Number(r.preferenze)||0);
    });
    return m;
  }

  function ticketAdjustedTotal(rows){
    const raw=sumsByCandidate(rows);
    const used=new Set();
    let total=0;
    const ts=Array.isArray(ticketGroups)?ticketGroups:[];
    ts.forEach(t=>{
      const candidates=Array.isArray(t.candidates)?t.candidates:[];
      const scopeProv=String(t.prov||"");
      const rowProv=new Set(rows.map(r=>normH(getProvince(r))));
      if(!candidates.length || ![...rowProv].some(p=>p===normH(scopeProv))) return;
      const present=candidates.filter(c=>raw[c]!=null);
      if(!present.length) return;
      present.forEach(c=>used.add(c));
      total+=Math.max(...present.map(c=>raw[c]||0));
    });
    Object.keys(raw).forEach(c=>{if(!used.has(c)) total+=raw[c]||0});
    return total;
  }

  function ticketForCandidate(name, rows){
    const raw=sumsByCandidate(rows);
    const rowProv=new Set(rows.map(r=>normH(getProvince(r))));
    return (Array.isArray(ticketGroups)?ticketGroups:[]).filter(t=>{
      return Array.isArray(t.candidates)&&t.candidates.some(c=>normH(c)===normH(name))&&[...rowProv].some(p=>p===normH(t.prov));
    }).map(t=>{
      const vals=t.candidates.map(c=>[c,raw[c]||0]);
      return {prov:t.prov,candidates:t.candidates,value:Math.max(...vals.map(x=>x[1]))};
    });
  }

  function currentGroups(rows){
    const raw=sumsByCandidate(rows);
    const out={};
    Object.keys(raw).forEach(c=>{
      const cur=String(correnti?.[c]||"").trim()||"Non classificata";
      if(!out[cur]) out[cur]={prefs:0,cands:0};
      out[cur].prefs+=raw[c]||0;
      out[cur].cands++;
    });
    return Object.entries(out).map(([name,v])=>({name,...v})).sort((a,b)=>b.prefs-a.prefs);
  }

  function provinceForCandidateTotals(src,dimension,collegio){
    const rows=rowsFor(src,dimension,collegio,"");
    return sumsByCandidate(rows);
  }

  function candidateList(label){
    const rows=Array.isArray(sourceFor(label))?sourceFor(label):[];
    const m=sumsByCandidate(rows);
    return Object.keys(m).sort((a,b)=>(m[b]||0)-(m[a]||0));
  }

  function collegioOptions(dimension,label){
    const rows=Array.isArray(sourceFor(label))?sourceFor(label):[];
    const values=new Map();
    rows.forEach(r=>{
      const v=geoDimension(r,dimension);
      if(v) values.set(normH(v),v);
    });
    return [...values.values()].sort((a,b)=>String(a).localeCompare(String(b),"it"));
  }

  function comunaOptions(label,dimension,collegio){
    const rows=rowsFor(sourceFor(label),dimension,collegio,"");
    const values=new Map();
    rows.forEach(r=>{const v=getComune(r);if(v)values.set(normH(v),v)});
    return [...values.values()].sort((a,b)=>String(a).localeCompare(String(b),"it"));
  }

  function labelElection(){
    return typeof electionLabel==="function"?electionLabel():(typeof election==="string"?election:"Regionali");
  }

  function refreshAnalysis(){
    const tab=document.getElementById("tab-analisi");
    if(!tab || !window.matchMedia("(max-width:820px), (min-width:821px)").matches) return;

    try{
      const primary=state.election||labelElection();
      const secondary=primary==="Regionali"?"Europee":"Regionali";
      const srcP=sourceFor(primary);
      const srcS=sourceFor(secondary);

      const dim=state.dimension;
      const collegi=collegioOptions(dim,primary);
      if(state.collegio && !collegi.some(x=>normH(x)===normH(state.collegio))) state.collegio="";
      const comuni=comunaOptions(primary,dim,state.collegio);
      if(state.comune && !comuni.some(x=>normH(x)===normH(state.comune))) state.comune="";

      const rawRowsP=rowsFor(srcP,dim,state.collegio,state.comune);
      const currentCandidates=new Set(
        Object.keys(sumsByCandidate(rawRowsP)).filter(c=>
          state.current && normH(String(correnti?.[c]||""))===normH(state.current))
      );
      const rowsP=state.current ? rawRowsP.filter(r=>currentCandidates.has(String(r.candidato||""))) : rawRowsP;
      const rawRowsS=rowsFor(srcS,dim,state.collegio,state.comune);
      const rowsS=state.current ? rawRowsS.filter(r=>currentCandidates.has(String(r.candidato||""))) : rawRowsS;
      const candP=candidateList(primary);
      if(!state.candA || !candP.some(x=>normH(x)===normH(state.candA))) state.candA=candP[0]||"";
      if(!state.candB || !candP.some(x=>normH(x)===normH(state.candB)) || normH(state.candB)===normH(state.candA)) state.candB=candP[1]||"";

      const totalsP=sumsByCandidate(rowsP);
      const totalsS=sumsByCandidate(rowsS);
      const totalPrimary=Object.values(totalsP).reduce((a,b)=>a+b,0);
      const totalSecondary=Object.values(totalsS).reduce((a,b)=>a+b,0);
      const adjusted=ticketAdjustedTotal(rowsP);
      const currents=currentGroups(rawRowsP);
      const ticketA=ticketForCandidate(state.candA,rowsP);
      const ticketB=ticketForCandidate(state.candB,rowsP);
      const allCurrentLabel=primary+" · "+dim;
      const communesPrimary=sumsByComune(rowsP);
      const rankedCommunes=Object.entries(communesPrimary).sort((a,b)=>b[1]-a[1]).slice(0,12);
      const peerKey=primary+"|"+dim;
      if(peerMaxCache[peerKey]==null){
        const peerTotals={};
        rowsFor(srcP,dim,"","").forEach(r=>{
          const g=geoDimension(r,dim)||"";
          if(g) peerTotals[g]=(peerTotals[g]||0)+(Number(r.preferenze)||0);
        });
        peerMaxCache[peerKey]=Math.max(0,...Object.values(peerTotals));
      }
      const relativeStrength=state.collegio&&peerMaxCache[peerKey]?Math.min(100,totalPrimary/peerMaxCache[peerKey]*100):0;
      const shareA=totalPrimary?((totalsP[state.candA]||0)/totalPrimary*100):0;
      const shareB=totalPrimary?((totalsP[state.candB]||0)/totalPrimary*100):0;
      const diff=(totalsP[state.candA]||0)-(totalsP[state.candB]||0);
      const crossRows=Object.keys({...sumsByComune(rowsP),...sumsByComune(rowsS)}).map(c=>{
        const p=(sumsByComune(rowsP)[c]||0), s2=(sumsByComune(rowsS)[c]||0);
        return {c,p,s:s2,d:s2-p};
      }).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,12);

      const dl="analysisCandidates";
      const optionsP=candP.map(c=>"<option value=\""+escH(c)+"\"></option>").join("");
      const optionsCollegio=collegi.map(c=>"<option value=\""+escH(c)+"\">"+escH(c)+"</option>").join("");
      const optionsComuni=comuni.map(c=>"<option value=\""+escH(c)+"\"></option>").join("");

      const currentOptions=currents.map(x=>"<option value=\""+escH(x.name)+"\">"+escH(x.name)+"</option>").join("");
      const currentFiltered=state.current?currents.filter(x=>normH(x.name)===normH(state.current)):currents;

      const currentRows=currentFiltered.slice(0,12).map((x,i)=>
        "<div class=\"analysis-v2-row\"><div class=\"analysis-v2-rank\">"+(i+1)+"</div><div><div class=\"analysis-v2-name\">"+escH(x.name)+"</div><div class=\"analysis-v2-meta\">"+x.cands+" candidati</div></div><div class=\"analysis-v2-value\">"+x.prefs.toLocaleString("it-IT")+"</div></div>"
      ).join("")||"<div class=\"analysis-v2-empty\">Nessuna corrente classificata nel perimetro.</div>";

      const commRows=rankedCommunes.map((x,i)=>
        "<tr><td>"+(i+1)+"</td><td>"+escH(x[0])+"</td><td class=\"num\">"+Number(x[1]).toLocaleString("it-IT")+"</td><td class=\"num\">"+(totalPrimary?((x[1]/totalPrimary)*100).toFixed(1):"0.0")+"%</td></tr>"
      ).join("")||"<tr><td colspan=\"4\" class=\"analysis-v2-empty\">Nessun comune disponibile.</td></tr>";

      const crossTable=crossRows.map((x,i)=>
        "<tr><td>"+(i+1)+"</td><td>"+escH(x.c)+"</td><td class=\"num\">"+x.p.toLocaleString("it-IT")+"</td><td class=\"num\">"+x.s.toLocaleString("it-IT")+"</td><td class=\"num\">"+(x.d>=0?"+":"")+x.d.toLocaleString("it-IT")+"</td></tr>"
      ).join("")||"<tr><td colspan=\"5\" class=\"analysis-v2-empty\">Nessun incrocio disponibile.</td></tr>";

      function ticketHtml(items){
        return items.map(t=>
          "<div class=\"analysis-v2-ticket\"><div><b>"+t.candidates.map(escH).join(" + ")+"</b><small>"+escH(t.prov)+" · ticket: valore massimo nel perimetro</small></div><strong>"+t.value.toLocaleString("it-IT")+"</strong></div>"
        ).join("");
      }

      const scope=state.comune?("Comune: "+state.comune):(state.collegio?(dim+" · "+state.collegio):"Tutta la Lombardia");
      const comparisonNote=
        "<div class=\"analysis-v2-note\"><b>Come leggere questo pannello.</b> Il confronto misura la forza delle preferenze FdI nel perimetro scelto, incrociando collegio, comuni, correnti, ticket e Regionali/Europee. Non è una previsione matematica del vincitore del collegio: per stimare il risultato complessivo servono anche i voti delle altre liste.</div>";

      tab.innerHTML=
        "<div class=\"analysis-v2\">"+
        "<div class=\"analysis-v2-head\"><div><h2>Analisi del collegio</h2><p>Uno strumento semplice per capire dove è forte FdI, quali candidati prevalgono, quali correnti pesano e cosa cambia tra Regionali ed Europee.</p></div><div class=\"analysis-v2-badge\">"+escH(scope)+"</div></div>"+
        "<div class=\"analysis-v2-controls\">"+
          "<div class=\"analysis-v2-control\"><label>Elezione</label><select id=\"a2Election\"><option>Regionali</option><option>Europee</option></select></div>"+
          "<div class=\"analysis-v2-control\"><label>Perimetro</label><select id=\"a2Dimension\"><option>Camera P</option><option>Camera U</option><option>Senato P</option><option>Senato U</option><option>Provincia</option></select></div>"+
          "<div class=\"analysis-v2-control\"><label>Collegio / Provincia</label><select id=\"a2Collegio\"><option value=\"\">Tutti</option>"+optionsCollegio+"</select></div>"+
          "<div class=\"analysis-v2-control\"><label>Comune</label><input id=\"a2Comune\" list=\"analysisComuni\" value=\""+escH(state.comune)+"\" placeholder=\"Tutti i comuni\"><datalist id=\"analysisComuni\">"+optionsComuni+"</datalist></div>"+
          "<div class=\"analysis-v2-control\"><label>Corrente</label><select id=\"a2Current\"><option value=\"\">Tutte le correnti</option>"+currentOptions+"</select></div>"+
        "</div>"+
        "<div class=\"analysis-v2-controls\">"+
          "<div class=\"analysis-v2-control\"><label>Candidato A</label><input id=\"a2CandA\" list=\""+dl+"\" value=\""+escH(state.candA)+"\" placeholder=\"Scrivi o scegli il candidato\"><datalist id=\""+dl+"\">"+optionsP+"</datalist></div>"+
          "<div class=\"analysis-v2-control\"><label>Candidato B</label><input id=\"a2CandB\" list=\""+dl+"\" value=\""+escH(state.candB)+"\" placeholder=\"Scrivi o scegli il candidato\"></div>"+
          "<div class=\"analysis-v2-control\"><label>Incrocio dati</label><select id=\"a2Compare\"><option value=\"1\">Regionali ↔ Europee</option><option value=\"0\">Solo elezione corrente</option></select></div>"+
          "<div class=\"analysis-v2-actions\"><button type=\"button\" class=\"btn bg2\" id=\"a2Apply\">AGGIORNA ANALISI</button><button type=\"button\" class=\"btn\" id=\"a2Reset\">RESET</button></div>"+
        "</div>"+

        "<div class=\"analysis-v2-grid\">"+
          "<div class=\"analysis-v2-card analysis-v2-wide\"><h3>Quadro del perimetro <small>"+escH(allCurrentLabel)+"</small></h3><div class=\"analysis-v2-kpis\">"+
            "<div class=\"analysis-v2-kpi\"><b>"+totalPrimary.toLocaleString("it-IT")+"</b><span>Preferenze "+escH(primary)+"</span></div>"+
            "<div class=\"analysis-v2-kpi\"><b>"+adjusted.toLocaleString("it-IT")+"</b><span>Totale con ticket</span></div>"+
            "<div class=\"analysis-v2-kpi\"><b>"+totalSecondary.toLocaleString("it-IT")+"</b><span>Preferenze "+escH(secondary)+"</span></div>"+
            "<div class=\"analysis-v2-kpi\"><b>"+Object.keys(communesPrimary).length.toLocaleString("it-IT")+"</b><span>Comuni coinvolti</span></div>"+
          "</div></div>"+

          "<div class=\"analysis-v2-card\"><h3>Confronto candidati</h3><div class=\"analysis-v2-compare\">"+
            "<div class=\"analysis-v2-player\"><strong>"+escH(state.candA||"Candidato A")+"</strong><b>"+Number(totalsP[state.candA]||0).toLocaleString("it-IT")+"</b><small>"+shareA.toFixed(1)+"% delle preferenze FdI nel perimetro</small></div>"+
            "<div class=\"analysis-v2-vs\">VS</div>"+
            "<div class=\"analysis-v2-player\"><strong>"+escH(state.candB||"Candidato B")+"</strong><b>"+Number(totalsP[state.candB]||0).toLocaleString("it-IT")+"</b><small>"+shareB.toFixed(1)+"% delle preferenze FdI nel perimetro</small></div>"+
          "</div><div class=\"analysis-v2-delta\">Distacco A − B: <b>"+(diff>=0?"+":"")+diff.toLocaleString("it-IT")+"</b></div>"+
          (state.collegio?"<div class=\"analysis-v2-delta\">Forza relativa del collegio FdI: <b>"+relativeStrength.toFixed(1)+"%</b></div>":"")+
          "</div>"+

          "<div class=\"analysis-v2-card\"><h3>Correnti</h3><div class=\"analysis-v2-list\">"+currentRows+"</div></div>"+

          "<div class=\"analysis-v2-card\"><h3>Comuni più forti <small>"+escH(primary)+"</small></h3><div class=\"analysis-v2-table-wrap\"><table class=\"analysis-v2-table\"><thead><tr><th>#</th><th>Comune</th><th>Pref.</th><th>Peso</th></tr></thead><tbody>"+commRows+"</tbody></table></div></div>"+

          "<div class=\"analysis-v2-card\"><h3>Ticket</h3>"+
            "<div class=\"analysis-v2-list\">"+
              (ticketA.length?"<div class=\"analysis-v2-meta\" style=\"margin:0 0 5px\">Ticket di "+escH(state.candA)+"</div>"+ticketHtml(ticketA):"")+
              (ticketB.length?"<div class=\"analysis-v2-meta\" style=\"margin:8px 0 5px\">Ticket di "+escH(state.candB)+"</div>"+ticketHtml(ticketB):"")+
              ((!ticketA.length&&!ticketB.length)?"<div class=\"analysis-v2-empty\">Nessun ticket applicabile al perimetro.</div>":"")+
            "</div></div>"+

          "<div class=\"analysis-v2-card analysis-v2-wide\"><h3>Incrocio Regionali ↔ Europee <small>comuni con maggiore variazione</small></h3><div class=\"analysis-v2-table-wrap\"><table class=\"analysis-v2-table\"><thead><tr><th>#</th><th>Comune</th><th>Regionali</th><th>Europee</th><th>Δ</th></tr></thead><tbody>"+crossTable+"</tbody></table></div></div>"+

          "<div class=\"analysis-v2-card analysis-v2-wide\">"+comparisonNote+"</div>"+
        "</div></div>";

      const dimEl=document.getElementById("a2Dimension");
      const colEl=document.getElementById("a2Collegio");
      const comEl=document.getElementById("a2Comune");
      const curEl=document.getElementById("a2Current");
      const cmpEl=document.getElementById("a2Compare");
      const eleEl=document.getElementById("a2Election");
      if(eleEl) eleEl.value=primary;
      if(dimEl) dimEl.value=dim;
      if(colEl) colEl.value=collegi.find(x=>normH(x)===normH(state.collegio))||"";
      if(curEl) curEl.value=currents.find(x=>normH(x.name)===normH(state.current))?state.current:"";
      if(cmpEl) cmpEl.value=state.compare?"1":"0";

      document.getElementById("a2Apply")?.addEventListener("click",()=>{
        state.election=document.getElementById("a2Election")?.value||labelElection();
        state.dimension=document.getElementById("a2Dimension")?.value||"Camera P";
        state.collegio=document.getElementById("a2Collegio")?.value||"";
        state.comune=(document.getElementById("a2Comune")?.value||"").trim();
        state.current=document.getElementById("a2Current")?.value||"";
        state.candA=(document.getElementById("a2CandA")?.value||"").trim();
        state.candB=(document.getElementById("a2CandB")?.value||"").trim();
        state.compare=document.getElementById("a2Compare")?.value!=="0";
        refreshAnalysis();
      });

      document.getElementById("a2Reset")?.addEventListener("click",()=>{
        state.dimension="Camera P"; state.collegio=""; state.comune=""; state.current=""; state.candA=""; state.candB=""; state.compare=true; state.election=null;
        refreshAnalysis();
      });
    }catch(err){
      console.error("Analisi collegio v2",err);
      tab.innerHTML="<div class=\"analysis-v2\"><div class=\"analysis-v2-head\"><div><h2>Analisi del collegio</h2><p>Errore di caricamento del modulo.</p></div></div><div class=\"analysis-v2-error\">"+escH(err?.message||err)+"</div></div>";
    }
  }

  window.renderAnalisi=refreshAnalysis;
  window.dashboardRenderAnalisi=refreshAnalysis;
  setTimeout(refreshAnalysis,120);
  setTimeout(refreshAnalysis,700);
}

installAnalysisModule();

function cleanupStrayMobileText(){
  try{
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const remove=[];
    let n;
    while(n=walker.nextNode()){
      if(String(n.nodeValue||"").trim()==="\\n") remove.push(n);
    }
    remove.forEach(x=>x.remove());
  }catch(_){}
}


})();