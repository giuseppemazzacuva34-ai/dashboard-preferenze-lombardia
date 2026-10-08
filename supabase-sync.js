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
installMobileAnalysisToolsStatic();
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

function installMobileAnalysisToolsStatic(){
  const style=document.createElement("style");
  style.id="mobile-analysis-static-v2";
  style.textContent=
    "@media(max-width:820px){" +
    ".mobile-analysis-static{display:block!important;margin-top:12px}" +
    ".mobile-static-card{background:#0b2035;border:1px solid #1e3d59;border-radius:12px;padding:12px;margin-bottom:10px}" +
    ".mobile-static-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}" +
    ".mobile-static-head b{font-size:13px;color:#eaf4fb}.mobile-static-head small{font-size:8px;color:#89a2ba}" +
    ".mobile-static-currents{display:grid;gap:7px}" +
    ".mobile-static-current{display:grid;grid-template-columns:28px minmax(0,1fr);gap:7px;align-items:center;padding:8px;background:#0e2740;border:1px solid #203e59;border-radius:9px}" +
    ".mobile-static-rank{font-size:10px;font-weight:900;color:#84a5bf;text-align:center}" +
    ".mobile-static-main{min-width:0}.mobile-static-candidate{font-size:11px;font-weight:900;color:#edf6fb;overflow-wrap:anywhere}" +
    ".mobile-static-total{font-size:11px;font-weight:900;color:#d9ecf8;margin-top:2px}" +
    ".mobile-static-edit{display:grid;grid-template-columns:minmax(0,1fr) 58px;gap:6px;margin-top:6px}" +
    ".mobile-static-edit input{width:100%;min-width:0;box-sizing:border-box;height:34px;background:#0b1725;color:#fff;border:1px solid #2d4860;border-radius:8px;padding:7px 9px;font-size:10px;pointer-events:auto}" +
    ".mobile-static-edit button{width:58px!important;min-width:58px!important;height:34px!important;padding:0 5px!important;font-size:9px!important}" +
    ".mobile-static-ticket-grid{display:grid;grid-template-columns:1fr;gap:7px}" +
    ".mobile-static-ticket-grid label{display:block;font-size:8px;color:#89a2ba;text-transform:uppercase;font-weight:800;margin-bottom:3px}" +
    ".mobile-static-ticket-grid select{width:100%;min-width:0;box-sizing:border-box;background:#0b1725;color:#fff;border:1px solid #2d4860;border-radius:8px;padding:8px;font-size:10px}" +
    ".mobile-static-ticket-add{width:100%!important;height:36px!important;margin-top:8px;font-size:9px!important}" +
    ".mobile-static-ticket-list{display:grid;gap:7px;margin-top:10px}" +
    ".mobile-static-ticket{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;background:#0e2740;border:1px solid #203e59;border-radius:9px}" +
    ".mobile-static-ticket-prov{font-size:8px;color:#89a2ba;text-transform:uppercase;font-weight:800;margin-bottom:3px}" +
    ".mobile-static-ticket-cands{font-size:10px;font-weight:900;color:#edf6fb;overflow-wrap:anywhere}" +
    ".mobile-static-ticket-del{margin-top:5px;height:29px!important;font-size:8px!important;padding:0 8px!important}" +
    ".mobile-static-ticket-value{font-size:12px;font-weight:900;color:#f1f7fb;white-space:nowrap}" +
    "}" +
    "@media(min-width:821px){.mobile-analysis-static{display:none!important}}";
  document.head.appendChild(style);

  function build(){
    if(!window.matchMedia("(max-width:820px)").matches) return;
    const tab=document.getElementById("tab-analisi");
    if(!tab) return;

    let mount=tab.querySelector(".mobile-analysis-static");
    if(!mount){
      mount=document.createElement("div");
      mount.className="mobile-analysis-static";
      tab.appendChild(mount);
    }

    const candidates=(Array.isArray(CANDS)?CANDS:[]).map(name=>{
      const total=(Array.isArray(data)?data:[]).reduce((sum,r)=>{
        const a=norm(r.candidato);
        const b=norm(name);
        return sum+(a===b?(Number(r.preferenze)||0):0);
      },0);
      return {name:String(name),total};
    }).sort((a,b)=>b.total-a.total);

    const currentRows=candidates.map((x,i)=>{
      const val=String(correnti[x.name]||"");
      return '<div class="mobile-static-current">'+
        '<div class="mobile-static-rank">'+(i+1)+'</div>'+
        '<div class="mobile-static-main">'+
        '<div class="mobile-static-candidate">'+esc(x.name)+'</div>'+
        '<div class="mobile-static-total">'+x.total.toLocaleString("it-IT")+' preferenze</div>'+
        '<div class="mobile-static-edit">'+
        '<input type="text" value="'+esc(val)+'" placeholder="Nome della corrente" data-mobile-current="'+esc(x.name)+'">'+
        '<button type="button" class="btn bg2" data-save-mobile-current="'+esc(x.name)+'">Salva</button>'+
        '</div></div></div>';
    }).join("") || '<div class="muted">Nessun candidato disponibile.</div>';

    const provOptions=Object.keys(PROV_FULL||{}).map(code=>
      '<option value="'+esc(code)+'">'+esc(PROV_FULL[code])+'</option>'
    ).join("");

    const candOptions=(Array.isArray(CANDS)?CANDS:[]).map(name=>
      '<option value="'+esc(name)+'">'+esc(name)+'</option>'
    ).join("");

    const ticketRows=(Array.isArray(ticketGroups)?ticketGroups:[]).map(t=>{
      const prov=PROV_FULL[PROV_CODE[norm(t.prov)]]||t.prov;
      const sums={};
      (Array.isArray(data)?data:[]).forEach(r=>{
        const provOk=norm(r.prov)===norm(t.prov);
        if(!provOk) return;
        const candidate=String(r.candidato||"");
        if(!t.candidates.some(c=>norm(c)===norm(candidate))) return;
        const key=t.candidates.find(c=>norm(c)===norm(candidate))||candidate;
        sums[key]=(sums[key]||0)+(Number(r.preferenze)||0);
      });
      const value=Math.max(0,...t.candidates.map(c=>Number(sums[c]||0)));
      return '<div class="mobile-static-ticket">'+
        '<div><div class="mobile-static-ticket-prov">'+esc(prov)+'</div>'+
        '<div class="mobile-static-ticket-cands">'+t.candidates.map(esc).join(" + ")+'</div>'+
        '<button type="button" class="btn bg2 mobile-static-ticket-del" data-mobile-ticket-del="'+esc(t.id)+'">Elimina</button></div>'+
        '<div class="mobile-static-ticket-value">'+value.toLocaleString("it-IT")+'</div></div>';
    }).join("") || '<div class="muted">Nessun ticket inserito.</div>';

    mount.innerHTML=
      '<div class="mobile-static-card">'+
      '<div class="mobile-static-head"><b>Analisi delle correnti</b><small>Registra la corrente FdI</small></div>'+
      '<div class="mobile-static-currents">'+currentRows+'</div></div>'+
      '<div class="mobile-static-card">'+
      '<div class="mobile-static-head"><b>Ticket</b><small>Provincia e due candidati</small></div>'+
      '<div class="mobile-static-ticket-grid">'+
      '<div><label>Provincia</label><select id="mobileStaticTkProv"><option value="">Seleziona provincia</option>'+provOptions+'</select></div>'+
      '<div><label>Candidato 1</label><select id="mobileStaticTkA"><option value="">Seleziona candidato</option>'+candOptions+'</select></div>'+
      '<div><label>Candidato 2</label><select id="mobileStaticTkB"><option value="">Seleziona candidato</option>'+candOptions+'</select></div>'+
      '</div>'+
      '<button type="button" class="btn bg2 mobile-static-ticket-add" id="mobileStaticAddTicket">AGGIUNGI TICKET</button>'+
      '<div class="mobile-static-ticket-list">'+ticketRows+'</div></div>';

    mount.querySelectorAll("[data-save-mobile-current]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const name=btn.getAttribute("data-save-mobile-current")||"";
        let input=null;
        mount.querySelectorAll("[data-mobile-current]").forEach(el=>{
          if((el.getAttribute("data-mobile-current")||"")===name) input=el;
        });
        if(input&&typeof saveCorrente==="function") saveCorrente(name,input.value||"");
      });
    });

    mount.querySelectorAll("[data-mobile-current]").forEach(input=>{
      input.addEventListener("keydown",e=>{
        if(e.key!=="Enter") return;
        e.preventDefault();
        const name=input.getAttribute("data-mobile-current")||"";
        if(typeof saveCorrente==="function") saveCorrente(name,input.value||"");
      });
    });

    const add=mount.querySelector("#mobileStaticAddTicket");
    add?.addEventListener("click",()=>{
      const prov=mount.querySelector("#mobileStaticTkProv")?.value||"";
      const a=mount.querySelector("#mobileStaticTkA")?.value||"";
      const b=mount.querySelector("#mobileStaticTkB")?.value||"";
      if(!prov||!a||!b){alert("Compila Provincia, Candidato 1 e Candidato 2.");return;}
      const ca=(Array.isArray(CANDS)?CANDS:[]).find(c=>norm(c)===norm(a));
      const cb=(Array.isArray(CANDS)?CANDS:[]).find(c=>norm(c)===norm(b));
      if(!ca||!cb){alert("I due candidati devono essere selezionati dall’elenco.");return;}
      if(ca===cb){alert("Seleziona due candidati diversi.");return;}
      const exists=(Array.isArray(ticketGroups)?ticketGroups:[]).some(t=>
        t.prov===prov&&t.candidates.includes(ca)&&t.candidates.includes(cb));
      if(exists){alert("Questo ticket esiste già.");return;}
      const item={id:"T"+Date.now(),prov,candidates:[ca,cb]};
      ticketGroups.push(item);
      if(typeof saveTickets==="function") saveTickets();
      if(typeof uploadTickets==="function") uploadTickets([item]).catch(err=>console.error("Supabase ticket mobile",err));
      if(typeof refreshTicketList==="function") refreshTicketList();
      if(typeof refreshTicketColumn==="function") refreshTicketColumn();
      setTimeout(build,0);
    });

    mount.querySelectorAll("[data-mobile-ticket-del]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const id=btn.getAttribute("data-mobile-ticket-del");
        if(typeof removeTicket==="function") removeTicket(id);
        setTimeout(build,0);
      });
    });
  }

  window.refreshMobileAnalysisTools=build;
  setTimeout(build,150);
  setTimeout(build,700);

  document.addEventListener("click",ev=>{
    if(ev.target?.closest?.(".side-tab")){
      setTimeout(build,120);
      setTimeout(build,600);
    }
  });
}

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


function installAnalysisCompareFix(){
  const style=document.createElement("style");
  style.id="analysis-compare-fix-v1";
  style.textContent=
    "#tab-analisi #analisiCandidateCompare{color:#eaf4fb!important;background:transparent!important}" +
    "#tab-analisi .analysis-c2{background:#0b2137;border:1px solid #24455f;border-radius:10px;padding:12px}" +
    "#tab-analisi .analysis-c2-controls{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-bottom:10px}" +
    "#tab-analisi .analysis-c2-field{min-width:0}" +
    "#tab-analisi .analysis-c2-field label{display:block;margin-bottom:4px;font-size:8px;text-transform:uppercase;font-weight:900;color:#86a1b8}" +
    "#tab-analisi .analysis-c2-field select{width:100%;box-sizing:border-box;background:#091827!important;color:#eff7fb!important;border:1px solid #2a4861!important;border-radius:8px;padding:9px 10px;font-size:10px!important;outline:none!important}" +
    "#tab-analisi .analysis-c2-field select:focus{border-color:#4b8ebd!important;box-shadow:0 0 0 2px #2a6e9d33!important}" +
    "#tab-analisi .analysis-c2-main{display:grid;grid-template-columns:1fr 40px 1fr;gap:8px;align-items:stretch}" +
    "#tab-analisi .analysis-c2-player{background:#0e2942;border:1px solid #28506c;border-radius:9px;padding:10px;min-width:0}" +
    "#tab-analisi .analysis-c2-player small{display:block;font-size:7px;color:#8aa6bb;text-transform:uppercase;font-weight:800}" +
    "#tab-analisi .analysis-c2-player strong{display:block;margin-top:4px;font-size:11px;color:#eef7fb;overflow-wrap:anywhere}" +
    "#tab-analisi .analysis-c2-player b{display:block;margin-top:7px;font-size:22px;color:#fff}" +
    "#tab-analisi .analysis-c2-player span{display:block;margin-top:2px;font-size:8px;color:#93aec1}" +
    "#tab-analisi .analysis-c2-vs{display:flex;align-items:center;justify-content:center;color:#7f9bb0;font-weight:900;font-size:10px}" +
    "#tab-analisi .analysis-c2-delta{margin-top:8px;padding:9px;border-radius:8px;background:#102a41;border:1px solid #24475f;font-size:9px;color:#a8bfd0}" +
    "#tab-analisi .analysis-c2-delta b{color:#fff;font-size:12px}" +
    "#tab-analisi .analysis-c2-note{margin-top:8px;font-size:8px;line-height:1.45;color:#8fa9bc}" +
    "#tab-analisi #analisiInsight{overflow:visible!important}" +
    "#tab-analisi .analysis-s2{display:grid;grid-template-columns:1fr 1fr;gap:7px}" +
    "#tab-analisi .analysis-s2-item{background:#0e2942;border:1px solid #28506c;border-radius:9px;padding:9px;min-width:0}" +
    "#tab-analisi .analysis-s2-item small{display:block;font-size:7px;color:#7f9bb0;text-transform:uppercase;font-weight:900}" +
    "#tab-analisi .analysis-s2-item b{display:block;margin-top:4px;font-size:10px;color:#eff7fb;overflow-wrap:anywhere;line-height:1.25}" +
    "#tab-analisi .analysis-s2-item span{display:block;margin-top:4px;font-size:8px;color:#94adbf;line-height:1.4}" +
    "@media(max-width:820px){#tab-analisi .analysis-c2-controls{grid-template-columns:1fr;gap:7px}#tab-analisi .analysis-c2-main{grid-template-columns:1fr;gap:7px}#tab-analisi .analysis-c2-vs{height:18px}#tab-analisi .analysis-s2{grid-template-columns:1fr 1fr;gap:6px}}" +
    "@media(max-width:420px){#tab-analisi .analysis-s2{grid-template-columns:1fr}}" ;
  document.head.appendChild(style);

  const fmt=n=>Number(n||0).toLocaleString("it-IT");
  const pct2=(n,d)=>d?((Number(n||0)/Number(d))*100).toFixed(1)+"%":"0.0%";

  function group(rows,key){
    const m={};
    (Array.isArray(rows)?rows:[]).forEach(r=>{
      const k=String(key(r)||"").trim();
      if(!k) return;
      m[k]=(m[k]||0)+(Number(r.preferenze)||0);
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }
  function uniqueCandidates(rows){
    return group(rows,r=>r.candidato).map(x=>x[0]);
  }

  const state={a:"",b:""};

  function enhance(){
    try{
      const compare=document.getElementById("analisiCandidateCompare");
      const insight=document.getElementById("analisiInsight");
      if(!compare&&!insight)return;

      const rows=typeof filtered==="function"?filtered():[];
      const candidates=uniqueCandidates(rows);
      if(candidates.length<2){
        if(compare) compare.innerHTML='<div class="analysis-c2"><div class="analysis-c2-note">Servono almeno due candidati nel perimetro selezionato per effettuare il confronto.</div></div>';
      }else{
        if(!candidates.includes(state.a)) state.a=candidates[0];
        if(!candidates.includes(state.b)||state.b===state.a) state.b=candidates[1]||candidates[0];

        const list=candidates.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
        const aRows=rows.filter(r=>String(r.candidato||"")===state.a);
        const bRows=rows.filter(r=>String(r.candidato||"")===state.b);
        const aTotal=aRows.reduce((n,r)=>n+(Number(r.preferenze)||0),0);
        const bTotal=bRows.reduce((n,r)=>n+(Number(r.preferenze)||0),0);
        const total=rows.reduce((n,r)=>n+(Number(r.preferenze)||0),0);
        const d=aTotal-bTotal;

        compare.innerHTML=
          '<div class="analysis-c2">'+
          '<div class="analysis-c2-controls">'+
            '<div class="analysis-c2-field"><label>Candidato A</label><select id="analysisCompareA">'+list+'</select></div>'+
            '<div class="analysis-c2-field"><label>Candidato B</label><select id="analysisCompareB">'+list+'</select></div>'+
            '<button type="button" class="btn bg2" id="analysisCompareApply">CONFRONTA</button>'+
          '</div>'+
          '<div class="analysis-c2-main">'+
            '<div class="analysis-c2-player"><small>Candidato A</small><strong>'+esc(state.a)+'</strong><b>'+fmt(aTotal)+'</b><span>'+pct2(aTotal,total)+' delle preferenze nel filtro</span></div>'+
            '<div class="analysis-c2-vs">VS</div>'+
            '<div class="analysis-c2-player"><small>Candidato B</small><strong>'+esc(state.b)+'</strong><b>'+fmt(bTotal)+'</b><span>'+pct2(bTotal,total)+' delle preferenze nel filtro</span></div>'+
          '</div>'+
          '<div class="analysis-c2-delta">Distacco: <b>'+(d>=0?"+":"")+fmt(d)+'</b> preferenze</div>'+
          '<div class="analysis-c2-note">Il confronto usa esclusivamente il perimetro attualmente filtrato. Cliccando CONFRONTA il confronto resta indipendente dagli altri filtri.</div>'+
          '</div>';

        const sa=document.getElementById("analysisCompareA");
        const sb=document.getElementById("analysisCompareB");
        if(sa)sa.value=state.a;
        if(sb)sb.value=state.b;
        document.getElementById("analysisCompareApply")?.addEventListener("click",()=>{
          state.a=sa?.value||state.a;
          state.b=sb?.value||state.b;
          enhance();
        });
      }

      if(insight){
        const total=rows.reduce((n,r)=>n+(Number(r.preferenze)||0),0);
        const prov=group(rows,r=>r.prov);
        const cand=group(rows,r=>r.candidato);
        const corr=typeof effectiveCurrentTotals==="function"?effectiveCurrentTotals(rows):[];
        const cam=group(rows,r=>r.geo?.camP);
        const sen=group(rows,r=>r.geo?.senP);
        const comuni=group(rows,r=>r.comune);

        const items=[
          ["Provincia dominante",prov[0]?((typeof PROV_FULL==="object"?PROV_FULL[PROV_CODE[norm(prov[0][0])]]||prov[0][0]:prov[0][0])):"—",
           prov[0]?fmt(prov[0][1])+" preferenze · "+pct2(prov[0][1],total):"Nessun dato"],
          ["Candidato leader",cand[0]?cand[0][0]:"—",cand[0]?fmt(cand[0][1])+" preferenze · "+pct2(cand[0][1],total):"Nessun dato"],
          ["Corrente più forte",election==="regionali"&&corr[0]?corr[0][0]:"—",
           election==="regionali"&&corr[0]?fmt(corr[0][1])+" preferenze · "+pct2(corr[0][1],total):"Disponibile per le Regionali"],
          ["Camera più forte",cam[0]?cam[0][0]:"—",cam[0]?fmt(cam[0][1])+" preferenze · "+pct2(cam[0][1],total):"Nessun dato"],
          ["Senato più forte",sen[0]?sen[0][0]:"—",sen[0]?fmt(sen[0][1])+" preferenze · "+pct2(sen[0][1],total):"Nessun dato"],
          ["Comune più forte",comuni[0]?comuni[0][0]:"—",comuni[0]?fmt(comuni[0][1])+" preferenze · "+pct2(comuni[0][1],total):"Nessun dato"]
        ];

        insight.innerHTML='<div class="analysis-s2">'+items.map(x=>
          '<div class="analysis-s2-item"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b><span>'+esc(x[2])+'</span></div>'
        ).join("")+'</div>';
      }
    }catch(err){
      console.error("Fix confronto/lettura strategica",err);
    }
  }

  const base=window.renderAnalisi;
  if(typeof base==="function" && !base.__analysisWrapped){
    const wrapped=function(){
      const ret=base.apply(this,arguments);
      setTimeout(enhance,0);
      return ret;
    };
    wrapped.__analysisWrapped=true;
    window.renderAnalisi=wrapped;
  }
  setTimeout(enhance,250);
  setTimeout(enhance,900);
}
installAnalysisCompareFix();


})();