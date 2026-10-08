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
  style.id="analysis-compare-decision-v3";
  style.textContent=
    "#tab-analisi #analisiCandidateCompare{display:block!important;color:#eaf4fb!important;background:transparent!important;min-height:120px!important}" +
    "#tab-analisi .decision-panel{background:#0b2137;border:1px solid #24455f;border-radius:11px;padding:13px;width:100%;box-sizing:border-box}" +
    "#tab-analisi .decision-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:11px}" +
    "#tab-analisi .decision-head b{font-size:14px;color:#fff}" +
    "#tab-analisi .decision-head small{display:block;margin-top:3px;font-size:8px;line-height:1.4;color:#91aabd;max-width:680px}" +
    "#tab-analisi .decision-controls{display:grid;grid-template-columns:150px minmax(180px,1fr) minmax(180px,1fr) minmax(180px,1fr) auto;gap:8px;align-items:end}" +
    "#tab-analisi .decision-field{min-width:0}" +
    "#tab-analisi .decision-field label{display:block;margin-bottom:4px;font-size:7px;text-transform:uppercase;font-weight:900;color:#86a1b8}" +
    "#tab-analisi .decision-field select{width:100%;box-sizing:border-box;background:#091827!important;color:#eff7fb!important;border:1px solid #2a4861!important;border-radius:8px;padding:9px 10px;font-size:10px!important;outline:none!important}" +
    "#tab-analisi .decision-field select:focus{border-color:#4b8ebd!important;box-shadow:0 0 0 2px #2a6e9d33!important}" +
    "#tab-analisi .decision-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:11px}" +
    "#tab-analisi .decision-kpi{background:#0e2942;border:1px solid #28506c;border-radius:9px;padding:10px;min-width:0}" +
    "#tab-analisi .decision-kpi small{display:block;font-size:7px;text-transform:uppercase;font-weight:900;color:#88a4ba}" +
    "#tab-analisi .decision-kpi b{display:block;margin-top:5px;font-size:18px;color:#fff;overflow-wrap:anywhere}" +
    "#tab-analisi .decision-kpi span{display:block;margin-top:3px;font-size:8px;color:#95adbf}" +
    "#tab-analisi .decision-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}" +
    "#tab-analisi .decision-box{background:#0e2942;border:1px solid #28506c;border-radius:9px;padding:10px;min-width:0}" +
    "#tab-analisi .decision-box h4{margin:0 0 8px;font-size:9px;text-transform:uppercase;color:#91abc0}" +
    "#tab-analisi .decision-compare{display:grid;grid-template-columns:1fr 26px 1fr;gap:7px;align-items:center}" +
    "#tab-analisi .decision-player{background:#102f49;border:1px solid #315b78;border-radius:8px;padding:9px;min-width:0}" +
    "#tab-analisi .decision-player b{display:block;font-size:10px;color:#fff;overflow-wrap:anywhere;line-height:1.3}" +
    "#tab-analisi .decision-player strong{display:block;margin-top:5px;font-size:21px;color:#fff}" +
    "#tab-analisi .decision-player span{display:block;margin-top:2px;font-size:8px;color:#91aabd}" +
    "#tab-analisi .decision-vs{text-align:center;font-size:8px;font-weight:900;color:#7895aa}" +
    "#tab-analisi .decision-table{width:100%;border-collapse:collapse;font-size:8px}" +
    "#tab-analisi .decision-table th{text-align:left;font-size:7px;text-transform:uppercase;color:#7895aa;padding:6px;border-bottom:1px solid #26475e}" +
    "#tab-analisi .decision-table td{padding:6px;border-bottom:1px solid #17354b;color:#dcecf6}" +
    "#tab-analisi .decision-table td.num{text-align:right;font-weight:900;white-space:nowrap}" +
    "#tab-analisi .decision-table tr:last-child td{border-bottom:0}" +
    "#tab-analisi .decision-note{margin-top:9px;padding:8px 9px;background:#102a41;border:1px solid #24475f;border-radius:8px;font-size:8px;line-height:1.45;color:#99b0c0}" +
    "@media(max-width:820px){#tab-analisi .decision-controls{grid-template-columns:1fr 1fr}#tab-analisi .decision-controls .decision-apply{grid-column:1/-1}#tab-analisi .decision-kpis{grid-template-columns:repeat(2,1fr)}#tab-analisi .decision-grid{grid-template-columns:1fr}#tab-analisi .decision-table-wrap{overflow-x:auto!important}#tab-analisi .decision-table{min-width:500px!important}}" +
    "@media(max-width:420px){#tab-analisi .decision-controls{grid-template-columns:1fr}#tab-analisi .decision-controls .decision-apply{grid-column:auto}#tab-analisi .decision-kpis{grid-template-columns:1fr 1fr}#tab-analisi .decision-compare{grid-template-columns:1fr}#tab-analisi .decision-vs{height:14px}}";
  document.head.appendChild(style);

  const fmt=n=>Number(n||0).toLocaleString("it-IT");
  const pct=(n,d)=>d?((Number(n||0)/Number(d))*100):0;
  const norm3=v=>typeof norm==="function"?norm(String(v||"")):String(v||"").trim().toUpperCase();

  function rowsFor(raw){
    const src=Array.isArray(raw)?raw:[];
    return src.map(r=>{
      let g=r&&r.geo;
      if(!g && typeof GEO!=="undefined" && GEO && r){
        try{g=GEO[norm3(r.comune)]||GEO[r.comune]||null;}catch(_){}
      }
      return {...r,geo:g||{}};
    });
  }

  function collegioValue(r,kind){
    const g=r?.geo||{};
    return kind==="camera" ? (g.camP??g.camera??"") : (g.senP??g.senato??"");
  }

  function collegi(rows,kind){
    const m={};
    rows.forEach(r=>{
      const v=String(collegioValue(r,kind)||"").trim();
      if(v)m[v]=(m[v]||0)+(Number(r.preferenze)||0);
    });
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0],"it",{numeric:true}));
  }

  function candidateTotals(rows){
    const m={};
    rows.forEach(r=>{
      const k=String(r.candidato||"").trim();
      if(k)m[k]=(m[k]||0)+(Number(r.preferenze)||0);
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }

  function communeTotals(rows){
    const m={};
    rows.forEach(r=>{
      const k=String(r.comune||"").trim();
      if(k)m[k]=(m[k]||0)+(Number(r.preferenze)||0);
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }

  function ticketAdjustedTotal(rows){
    const base=candidateTotals(rows);
    const byProv={};
    rows.forEach(r=>{
      const p=norm3(r.prov);
      const c=String(r.candidato||"").trim();
      if(!p||!c)return;
      if(!byProv[p])byProv[p]={};
      byProv[p][c]=(byProv[p][c]||0)+(Number(r.preferenze)||0);
    });

    const seen={};
    let total=base.reduce((s,x)=>s+x[1],0);

    (Array.isArray(ticketGroups)?ticketGroups:[]).forEach(t=>{
      const names=t?.candidates||[];
      if(names.length!==2)return;
      const prov=norm3(t.prov);
      const a=names[0],b=names[1];
      if(seen[String(t.id)])return;
      const vals=byProv[prov]||{};
      const av=Number(vals[a]||0),bv=Number(vals[b]||0);
      if(av>0&&bv>0) total-=Math.min(av,bv);
      seen[String(t.id)]=1;
    });
    return total;
  }

  function euroForCommuneSet(communes,kindValue){
    const e=rowsFor(typeof EURO_RAW!=="undefined"?EURO_RAW:[]);
    const wanted=new Set(communes.map(norm3));
    return e.reduce((s,r)=>{
      if(!wanted.has(norm3(r.comune)))return s;
      return s+(Number(r.preferenze)||0);
    },0);
  }

  const state={kind:"camera",collegio:"",a:"",b:""};

  function build(){
    try{
      const host=document.getElementById("analisiCandidateCompare");
      if(!host)return;

      const reg=rowsFor(typeof RAW!=="undefined"?RAW:[]);
      const available=collegi(reg,state.kind);

      if(!available.length){
        host.innerHTML='<div class="decision-panel"><div class="decision-note">Nessun collegio disponibile nei dati Regionali 2023.</div></div>';
        return;
      }

      if(!available.some(x=>x[0]===state.collegio))state.collegio=available[0][0];
      const inCol=reg.filter(r=>String(collegioValue(r,state.kind)||"").trim()===state.collegio);
      const cands=candidateTotals(inCol);
      if(cands.length<2){
        host.innerHTML='<div class="decision-panel"><div class="decision-note">Il collegio selezionato non contiene abbastanza candidati per il confronto.</div></div>';
        return;
      }
      if(!cands.some(x=>x[0]===state.a))state.a=cands[0][0];
      if(!cands.some(x=>x[0]===state.b)||state.b===state.a)state.b=cands[1][0]||cands[0][0];

      const collegioList=available.map(x=>'<option value="'+esc(x[0])+'">'+esc(x[0])+'</option>').join("");
      const candidateList=cands.map(x=>'<option value="'+esc(x[0])+'">'+esc(x[0])+'</option>').join("");

      const totalRaw=inCol.reduce((s,r)=>s+(Number(r.preferenze)||0),0);
      const totalEff=ticketAdjustedTotal(inCol);
      const aVal=Number(cands.find(x=>x[0]===state.a)?.[1]||0);
      const bVal=Number(cands.find(x=>x[0]===state.b)?.[1]||0);
      const communes=[...new Set(inCol.map(r=>String(r.comune||"").trim()).filter(Boolean))];
      const communeRows=communeTotals(inCol).slice(0,8);
      const europee=euroForCommuneSet(communes,state.collegio);

      const winner=aVal>=bVal?state.a:state.b;
      const lead=Math.abs(aVal-bVal);
      const euroDelta=totalRaw?((europee-totalEff)/Math.max(totalEff,1))*100:0;

      host.innerHTML=
        '<div class="decision-panel">'+
          '<div class="decision-head"><div><b>Confronto nel collegio</b><small>Strumento operativo: seleziona il collegio Camera o Senato e confronta due candidati sulle Regionali 2023. Sotto trovi anche la dimensione FdI del collegio e il raffronto con le Europee.</small></div></div>'+
          '<div class="decision-controls">'+
            '<div class="decision-field"><label>Tipo collegio</label><select id="decisionKind"><option value="camera">Camera</option><option value="senato">Senato</option></select></div>'+
            '<div class="decision-field"><label>Collegio</label><select id="decisionCollegio">'+collegioList+'</select></div>'+
            '<div class="decision-field"><label>Candidato A</label><select id="decisionA">'+candidateList+'</select></div>'+
            '<div class="decision-field"><label>Candidato B</label><select id="decisionB">'+candidateList+'</select></div>'+
            '<button type="button" class="btn bg2 decision-apply">AGGIORNA</button>'+
          '</div>'+
          '<div class="decision-kpis">'+
            '<div class="decision-kpi"><small>FdI · Regionali</small><b>'+fmt(totalRaw)+'</b><span>preferenze nel collegio</span></div>'+
            '<div class="decision-kpi"><small>FdI · ticket corretti</small><b>'+fmt(totalEff)+'</b><span>valore effettivo</span></div>'+
            '<div class="decision-kpi"><small>Comuni</small><b>'+fmt(communes.length)+'</b><span>comuni nel collegio</span></div>'+
            '<div class="decision-kpi"><small>Europee 2024</small><b>'+fmt(europee)+'</b><span>stessi comuni · FdI</span></div>'+
          '</div>'+
          '<div class="decision-grid">'+
            '<div class="decision-box"><h4>Confronto candidati</h4>'+
              '<div class="decision-compare">'+
                '<div class="decision-player"><b>'+esc(state.a)+'</b><strong>'+fmt(aVal)+'</strong><span>'+pct(aVal,totalRaw).toFixed(1)+'% del collegio</span></div>'+
                '<div class="decision-vs">VS</div>'+
                '<div class="decision-player"><b>'+esc(state.b)+'</b><strong>'+fmt(bVal)+'</strong><span>'+pct(bVal,totalRaw).toFixed(1)+'% del collegio</span></div>'+
              '</div>'+
              '<div class="decision-note"><b>Leader nel confronto:</b> '+esc(winner)+' · distacco '+fmt(lead)+' preferenze.</div>'+
            '</div>'+
            '<div class="decision-box"><h4>Comuni più forti del collegio</h4>'+
              '<div class="decision-table-wrap"><table class="decision-table"><thead><tr><th>Comune</th><th>FdI</th><th>%</th></tr></thead><tbody>'+
                communeRows.map(x=>'<tr><td>'+esc(x[0])+'</td><td class="num">'+fmt(x[1])+'</td><td class="num">'+pct(x[1],totalRaw).toFixed(1)+'%</td></tr>').join("")+
              '</tbody></table></div>'+
            '</div>'+
          '</div>'+
          '<div class="decision-note"><b>Lettura:</b> nel collegio selezionato FdI ha '+fmt(totalEff)+' preferenze effettive dopo la correzione dei ticket. Le Europee 2024, sugli stessi comuni, valgono '+fmt(europee)+' preferenze; differenza indicativa '+(euroDelta>=0?"+":"")+euroDelta.toFixed(1)+'%.</div>'+
          '<div class="decision-note">Questo modulo misura il peso interno di FdI e dei suoi candidati. Non è una previsione del vincitore del collegio: per quella servono anche i voti delle altre liste.</div>'+
        '</div>';

      const kindEl=document.getElementById("decisionKind");
      const colEl=document.getElementById("decisionCollegio");
      const aEl=document.getElementById("decisionA");
      const bEl=document.getElementById("decisionB");
      if(kindEl)kindEl.value=state.kind;
      if(colEl)colEl.value=state.collegio;
      if(aEl)aEl.value=state.a;
      if(bEl)bEl.value=state.b;

      const apply=()=>{
        state.kind=kindEl?.value||"camera";
        state.collegio=colEl?.value||"";
        state.a=aEl?.value||"";
        state.b=bEl?.value||"";
        build();
      };
      [kindEl,colEl,aEl,bEl].forEach(el=>el?.addEventListener("change",apply));
      host.querySelector(".decision-apply")?.addEventListener("click",apply);
    }catch(err){
      console.error("Confronto collegio",err);
      const host=document.getElementById("analisiCandidateCompare");
      if(host)host.innerHTML='<div class="decision-panel"><div class="decision-note">Impossibile costruire il confronto. I dati non sono stati modificati.</div></div>';
    }
  }

  window.refreshAnalysisCompare=build;
  const run=()=>{
    build();
    setTimeout(build,80);
    setTimeout(build,300);
  };

  setTimeout(run,120);
  setTimeout(run,500);
  setTimeout(run,1200);

  document.addEventListener("click",ev=>{
    if(ev.target?.closest?.(".side-tab"))setTimeout(run,100);
  });

  const base=window.renderAnalisi;
  if(typeof base==="function" && !base.__analysisDecisionWrapped){
    const wrapped=function(){
      const ret=base.apply(this,arguments);
      setTimeout(run,30);
      return ret;
    };
    wrapped.__analysisDecisionWrapped=true;
    window.renderAnalisi=wrapped;
  }
}

installAnalysisCompareFix();


function installEuropeeRegionaliFix(){
  const style=document.createElement("style");
  style.id="euro-reg-fix-v2";
  style.textContent=
    "#tab-analisi #analisiConfronto{display:block!important;color:#eaf4fb!important;min-height:80px!important}" +
    "#tab-analisi .euro-reg-box{background:#0b2137;border:1px solid #24455f;border-radius:10px;padding:12px;width:100%;box-sizing:border-box}" +
    "#tab-analisi .euro-reg-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}" +
    "#tab-analisi .euro-reg-kpi{background:#0e2942;border:1px solid #28506c;border-radius:9px;padding:10px}" +
    "#tab-analisi .euro-reg-kpi b{display:block;font-size:18px;color:#fff}" +
    "#tab-analisi .euro-reg-kpi span{display:block;margin-top:3px;font-size:7px;text-transform:uppercase;font-weight:900;color:#88a4ba}" +
    "#tab-analisi .euro-reg-table-wrap{width:100%;overflow-x:auto}" +
    "#tab-analisi .euro-reg-table{width:100%;border-collapse:collapse;font-size:9px}" +
    "#tab-analisi .euro-reg-table th{font-size:7px;text-transform:uppercase;color:#7e9ab2;text-align:left;padding:7px;border-bottom:1px solid #24445e}" +
    "#tab-analisi .euro-reg-table td{padding:7px;border-bottom:1px solid #17354c;color:#dcecf6}" +
    "#tab-analisi .euro-reg-table td.num{text-align:right;font-weight:900;white-space:nowrap}" +
    "#tab-analisi .euro-reg-table tr:last-child td{border-bottom:0}" +
    "#tab-analisi .euro-reg-note{margin-top:8px;padding:8px;border-radius:8px;background:#102a41;border:1px solid #24475f;font-size:8px;line-height:1.45;color:#93aabd}" +
    "@media(max-width:820px){#tab-analisi .euro-reg-kpis{grid-template-columns:1fr 1fr}#tab-analisi .euro-reg-table{min-width:620px!important}}" +
    "@media(max-width:420px){#tab-analisi .euro-reg-kpis{grid-template-columns:1fr}}";
  document.head.appendChild(style);

  const fmt=n=>Number(n||0).toLocaleString("it-IT");
  const pct=(a,b)=>b?((Number(a||0)/Number(b)-1)*100):0;
  const norm2=v=>typeof norm==="function"?norm(String(v||"")):String(v||"").trim().toUpperCase();
  const provName=v=>{
    try{
      const full=(typeof PROV_FULL!=="undefined"&&PROV_FULL)||{};
      const codes=(typeof PROV_CODE!=="undefined"&&PROV_CODE)||{};
      return full[codes[norm2(v)]]||v||"—";
    }catch(_){return v||"—";}
  };

  function rows(){
    const e=(typeof EURO_RAW!=="undefined"&&Array.isArray(EURO_RAW))?EURO_RAW:[];
    const r=(typeof RAW!=="undefined"&&Array.isArray(RAW))?RAW:[];
    const map={};

    e.forEach(x=>{
      const p=norm2(x.prov); if(!p)return;
      if(!map[p])map[p]={prov:x.prov,euro:0,reg:0};
      map[p].euro+=(Number(x.preferenze)||0);
    });
    r.forEach(x=>{
      const p=norm2(x.prov); if(!p)return;
      if(!map[p])map[p]={prov:x.prov,euro:0,reg:0};
      map[p].reg+=(Number(x.preferenze)||0);
    });
    return Object.values(map).sort((a,b)=>b.reg-a.reg);
  }

  function render(){
    const host=document.getElementById("analisiConfronto");
    if(!host)return false;
    try{
      const data=rows();
      const euro=data.reduce((s,x)=>s+x.euro,0);
      const reg=data.reduce((s,x)=>s+x.reg,0);

      if(!data.length){
        host.innerHTML='<div class="euro-reg-box"><div class="euro-reg-note">Dati del confronto ancora in caricamento. Riprova tra un istante.</div></div>';
        return false;
      }

      const top=[...data]
        .sort((a,b)=>{
          const da=Math.abs(b.reg-b.euro), db=Math.abs(a.reg-a.euro);
          return da-db;
        })
        .slice(0,12);

      host.innerHTML=
        '<div class="euro-reg-box">'+
          '<div class="euro-reg-kpis">'+
            '<div class="euro-reg-kpi"><b>'+fmt(euro)+'</b><span>Preferenze FdI · Europee 2024</span></div>'+
            '<div class="euro-reg-kpi"><b>'+fmt(reg)+'</b><span>Preferenze FdI · Regionali 2023</span></div>'+
          '</div>'+
          '<div class="euro-reg-table-wrap"><table class="euro-reg-table"><thead><tr><th>Provincia</th><th>Europee</th><th>Regionali</th><th>Var. %</th><th>Δ</th></tr></thead><tbody>'+
          top.map(x=>{
            const d=x.reg-x.euro;
            return '<tr><td>'+esc(provName(x.prov))+'</td><td class="num">'+fmt(x.euro)+'</td><td class="num">'+fmt(x.reg)+'</td><td class="num">'+(x.euro?pct(x.reg,x.euro).toFixed(1):"—")+'%</td><td class="num">'+(d>=0?"+":"")+fmt(d)+'</td></tr>';
          }).join("")+
          '</tbody></table></div>'+
          '<div class="euro-reg-note">Il confronto usa i dati FdI delle Europee 2024 e delle Regionali 2023 e mostra, per provincia, dove le preferenze sono cresciute o diminuite.</div>'+
        '</div>';
      return true;
    }catch(err){
      console.error("Confronto Europee/Regionali",err);
      host.innerHTML='<div class="euro-reg-box"><div class="euro-reg-note">Errore nella costruzione del confronto. I dati non sono stati modificati.</div></div>';
      return false;
    }
  }

  function retryRender(){
    render();
    setTimeout(render,80);
    setTimeout(render,300);
    setTimeout(render,800);
  }

  window.refreshEuropeeRegionali=retryRender;

  setTimeout(retryRender,100);
  setTimeout(retryRender,500);
  setTimeout(retryRender,1200);

  document.addEventListener("click",ev=>{
    if(ev.target?.closest?.(".side-tab")){
      setTimeout(retryRender,80);
    }
  });

  const old=window.renderAnalisi;
  if(typeof old==="function" && !old.__euroRegWrappedV2){
    const wrapped=function(){
      const result=old.apply(this,arguments);
      setTimeout(retryRender,20);
      return result;
    };
    wrapped.__euroRegWrappedV2=true;
    window.renderAnalisi=wrapped;
  }
}

installEuropeeRegionaliFix();


function installComuniPreferencesFix(){
  const style=document.createElement("style");
  style.id="comuni-preferences-fix-v1";
  style.textContent=
    "#tab-comuni .comuni-pref-fixed{font-weight:900!important;color:#fff!important}" +
    "#tab-comuni .comuni-pref-zero{color:#7f9ab0!important}" ;
  document.head.appendChild(style);

  const normC=v=>{
    try{return typeof norm==="function"?norm(String(v||"")):String(v||"").trim().toUpperCase();}
    catch(_){return String(v||"").trim().toUpperCase();}
  };

  function buildTotals(){
    const raw=(typeof election!=="undefined"&&election==="europee"&&typeof EURO_RAW!=="undefined")
      ? EURO_RAW
      : (typeof RAW!=="undefined"?RAW:[]);
    const totals={};
    (Array.isArray(raw)?raw:[]).forEach(r=>{
      const comune=normC(r?.comune);
      if(!comune)return;
      totals[comune]=(totals[comune]||0)+(Number(r?.preferenze)||0);
    });
    return totals;
  }

  function getHost(){
    return document.getElementById("tab-comuni")
      || document.getElementById("panel-comuni")
      || document.querySelector('[data-panel="comuni"]');
  }

  function repair(){
    try{
      const host=getHost();
      if(!host)return false;

      const totals=buildTotals();
      const tables=[...host.querySelectorAll("table")];
      let changed=false;

      tables.forEach(table=>{
        const ths=[...table.querySelectorAll("thead th")];
        const prefIndex=ths.findIndex(th=>normC(th.textContent).includes("PREFERENZE"));
        if(prefIndex<0)return;

        table.querySelectorAll("tbody tr").forEach(tr=>{
          const cells=[...tr.children];
          if(cells.length<=prefIndex)return;
          const comuneCell=cells[0];
          if(!comuneCell)return;
          const comune=normC(comuneCell.textContent);
          if(!comune)return;

          const value=Number(totals[comune]||0);
          const cell=cells[prefIndex];
          cell.textContent=value.toLocaleString("it-IT");
          cell.classList.remove("comuni-pref-fixed","comuni-pref-zero");
          cell.classList.add("comuni-pref-fixed");
          if(value===0)cell.classList.add("comuni-pref-zero");
          changed=true;
        });
      });

      return changed;
    }catch(err){
      console.error("Correzione preferenze Comuni",err);
      return false;
    }
  }

  window.refreshComuniPreferences=repair;

  const run=()=>{
    repair();
    setTimeout(repair,80);
    setTimeout(repair,300);
    setTimeout(repair,800);
  };

  setTimeout(run,150);
  setTimeout(run,700);
  setTimeout(run,1300);

  document.addEventListener("click",ev=>{
    if(ev.target?.closest?.(".side-tab")){
      const txt=String(ev.target.closest(".side-tab")?.textContent||"").toUpperCase();
      if(txt.includes("COMUNI"))setTimeout(run,100);
    }
  });
}
installComuniPreferencesFix();


function installSondaggiModule(){
  const KEY="lombardia_sondaggi_2026";

  const REGIONS=[
    "Piemonte","Valle d'Aosta","Lombardia","Trentino-Alto Adige/Südtirol","Veneto",
    "Friuli-Venezia Giulia","Liguria","Emilia-Romagna","Toscana","Umbria","Marche",
    "Lazio","Abruzzo","Molise","Campania","Puglia","Basilicata","Calabria","Sicilia","Sardegna"
  ];

  const CAM_COLLEGI={
    "Piemonte":["Piemonte 1 - P01|8","Piemonte 1 - P02|7","Piemonte 2 - P01|6","Piemonte 2 - P02|8"],
    "Valle d'Aosta":["Valle d'Aosta - U01|1"],
    "Lombardia":["Lombardia 1 - P01|13","Lombardia 1 - P02|12","Lombardia 2 - P01|6","Lombardia 2 - P02|8","Lombardia 3 - P01|6","Lombardia 3 - P02|8","Lombardia 4 - P01|11"],
    "Trentino-Alto Adige/Südtirol":["Trentino-Alto Adige - P01|7"],
    "Veneto":["Veneto 1 - P01|13","Veneto 2 - P01|7","Veneto 2 - P02|6","Veneto 2 - P03|6"],
    "Friuli-Venezia Giulia":["Friuli-Venezia Giulia - P01|8"],
    "Liguria":["Liguria - P01|10"],
    "Emilia-Romagna":["Emilia-Romagna - P01|8","Emilia-Romagna - P02|11","Emilia-Romagna - P03|10"],
    "Toscana":["Toscana - P01|8","Toscana - P02|8","Toscana - P03|8"],
    "Umbria":["Umbria - P01|6"],
    "Marche":["Marche - P01|10"],
    "Lazio":["Lazio 1 - P01|8","Lazio 1 - P02|8","Lazio 1 - P03|8","Lazio 2 - P01|5","Lazio 2 - P02|7"],
    "Abruzzo":["Abruzzo - P01|9"],
    "Molise":["Molise - P01|2"],
    "Campania":["Campania 1 - P01|9","Campania 1 - P02|11","Campania 2 - P01|8","Campania 2 - P02|10"],
    "Puglia":["Puglia - P01|7","Puglia - P02|6","Puglia - P03|6","Puglia - P04|8"],
    "Basilicata":["Basilicata - P01|4"],
    "Calabria":["Calabria - P01|13"],
    "Sicilia":["Sicilia 1 - P01|8","Sicilia 1 - P02|7","Sicilia 2 - P01|5","Sicilia 2 - P02|6","Sicilia 2 - P03|6"],
    "Sardegna":["Sardegna - P01|11"]
  };

  const SEN_COLLEGI={
    "Piemonte":["Piemonte - P01|6","Piemonte - P02|8"],
    "Valle d'Aosta":["Valle d'Aosta - U01|1"],
    "Lombardia":["Lombardia - P01|9","Lombardia - P02|12","Lombardia - P03|10"],
    "Trentino-Alto Adige/Südtirol":["Trentino-Alto Adige - U01|1","Trentino-Alto Adige - U02|1","Trentino-Alto Adige - U03|1","Trentino-Alto Adige - U04|1","Trentino-Alto Adige - U05|1","Trentino-Alto Adige - U06|1"],
    "Veneto":["Veneto - P01|7","Veneto - P02|9"],
    "Friuli-Venezia Giulia":["Friuli-Venezia Giulia - P01|4"],
    "Liguria":["Liguria - P01|5","Liguria - P02|5"],
    "Emilia-Romagna":["Emilia-Romagna - P01|6","Emilia-Romagna - P02|8"],
    "Toscana":["Toscana - P01|12"],
    "Umbria":["Umbria - P01|3"],
    "Marche":["Marche - P01|5"],
    "Lazio":["Lazio - P01|9","Lazio - P02|9"],
    "Abruzzo":["Abruzzo - P01|4"],
    "Molise":["Molise - P01|2"],
    "Campania":["Campania - P01|10","Campania - P02|8"],
    "Puglia":["Puglia - P01|13"],
    "Basilicata":["Basilicata - P01|3"],
    "Calabria":["Calabria - P01|6"],
    "Sicilia":["Sicilia - P01|8","Sicilia - P02|8"],
    "Sardegna":["Sardegna - P01|5"]
  };

  const POLLS=[
    ["FdI","Fratelli d'Italia",26.8],
    ["PD","Partito Democratico",20.4],
    ["M5S","Movimento 5 Stelle",12.8],
    ["FN","Futuro Nazionale",7.7],
    ["FI","Forza Italia",7.4],
    ["AVS","Alleanza Verdi e Sinistra",6.3],
    ["LEGA","Lega",5.7],
    ["AZ","Azione",3.2],
    ["IV","Italia Viva",2.2],
    ["PIU","+Europa",1.7],
    ["PLD","Partito Liberaldemocratico",1.3],
    ["NM","Noi Moderati",1.1],
    ["ALTRI","Altri",4.4]
  ];

  const COALITION_PRESET_VERSION=2;
  const DEFAULT_COALITIONS=[
    {id:"C-CD",name:"Centrodestra",members:["FdI","LEGA","FI","NM"]},
    {id:"C-CS",name:"Centrosinistra",members:["PD","M5S","AVS","PIU","IV"]}
  ];

  function defaultCoalitions(){
    return DEFAULT_COALITIONS.map(c=>({...c,members:[...(c.members||[])]}));
  }

  function freshState(){
    const s={
      chamber:"camera",
      region:"Lombardia",
      college:"Lombardia 1 - P01",
      parties:{},
      regionalSenate:{},
      collegeValues:{camera:{},senato:{}},
      coalitions:defaultCoalitions(),
      coalitionPresetVersion:COALITION_PRESET_VERSION
    };
    POLLS.forEach(p=>{
      s.parties[p[0]]={name:p[1],camera:p[2],senate:p[2]};
    });
    s.regionalSenate.Lombardia=Object.fromEntries(POLLS.map(p=>[p[0],p[2]]));
    return s;
  }

  function loadState(){
    let base=freshState();
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||"null");
      if(!saved||typeof saved!=="object")return base;
      base={...base,...saved};
      base.parties={...freshState().parties,...(saved.parties||{})};
      base.regionalSenate=saved.regionalSenate&&typeof saved.regionalSenate==="object"?saved.regionalSenate:{};
      base.collegeValues=saved.collegeValues&&typeof saved.collegeValues==="object"?saved.collegeValues:{camera:{},senato:{}};
      if(!base.collegeValues.camera)base.collegeValues.camera={};
      if(!base.collegeValues.senato)base.collegeValues.senato={};

      const savedCoalitions=Array.isArray(saved.coalitions)?saved.coalitions:null;
      base.coalitions=savedCoalitions?savedCoalitions:[];
      base.coalitionPresetVersion=Number(saved.coalitionPresetVersion)||0;

      // Migrazione una tantum delle vecchie configurazioni senza coalizioni.
      // Le coalizioni preimpostate restano poi completamente modificabili.
      if(base.coalitionPresetVersion<COALITION_PRESET_VERSION && (!savedCoalitions || savedCoalitions.length===0)){
        base.coalitions=defaultCoalitions();
      }
      base.coalitionPresetVersion=COALITION_PRESET_VERSION;

      POLLS.forEach(p=>{
        if(base.parties[p[0]].camera==null)base.parties[p[0]].camera=p[2];
        if(base.parties[p[0]].senate==null)base.parties[p[0]].senate=p[2];
      });
      return base;
    }catch(_){return base;}
  }

  let S=loadState();

  function save(){localStorage.setItem(KEY,JSON.stringify(S));}

  function esc2(v){
    try{return typeof esc==="function"?esc(String(v??"")):String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
    catch(_){return String(v??"");}
  }

  const fmt=n=>Number(n||0).toFixed(1).replace(".",",");
  const fmt0=n=>Math.round(Number(n||0)).toLocaleString("it-IT");
  const num=v=>{
    const n=parseFloat(String(v??"").replace(",","."));
    return Number.isFinite(n)?Math.min(100,Math.max(0,n)):0;
  };

  function ensureNav(){
    const side=document.querySelector(".app-sidebar");
    if(!side)return;
    let btn=side.querySelector("#sideSondaggi");
    if(!btn){
      btn=document.createElement("button");
      btn.type="button";
      btn.id="sideSondaggi";
      btn.className="side-tab";
      btn.innerHTML="<span>📊</span><b> Sondaggi</b>";
      side.appendChild(btn);
    }
  }

  function ensurePanel(){
    let host=document.getElementById("tab-sondaggi");
    if(!host){
      host=document.createElement("section");
      host.id="tab-sondaggi";
      host.className="panel";
      host.style.display="none";
      const main=document.querySelector("main");
      if(main)main.appendChild(host);
    }
    return host;
  }

  function openPanel(){
    const host=ensurePanel();
    document.querySelectorAll("main .panel").forEach(p=>{if(p!==host)p.style.display="none";});
    host.style.display="block";
    document.querySelectorAll(".side-tab").forEach(x=>x.classList.remove("active"));
    document.getElementById("sideSondaggi")?.classList.add("active");
    render();
  }

  function closePanel(){
    const host=document.getElementById("tab-sondaggi");
    if(host)host.style.display="none";
  }

  function collegesFor(chamber,region){
    const src=chamber==="camera"?CAM_COLLEGI:SEN_COLLEGI;
    return (src[region]||[]).map(x=>{
      const [name,seats]=x.split("|");
      return {name,seats:Number(seats)||0,special:name.includes(" - U")};
    });
  }

  function selectedCollege(){
    const list=collegesFor(S.chamber,S.region);
    if(!list.length){S.college="";return null;}
    if(!list.some(x=>x.name===S.college))S.college=list[0].name;
    return list.find(x=>x.name===S.college)||list[0];
  }

  function regionValues(){
    S.regionalSenate[S.region]??={};
    Object.keys(S.parties).forEach(k=>{
      if(S.regionalSenate[S.region][k]==null)S.regionalSenate[S.region][k]=num(S.parties[k].senate);
    });
    return Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.regionalSenate[S.region][k])]));
  }

  function collegeValues(){
    const c=selectedCollege();
    const bucket=(S.collegeValues[S.chamber]??={})[c?.name]??{};
    const base={};
    const region=regionValues();
    Object.keys(S.parties).forEach(k=>{
      const fallback=S.chamber==="camera"?S.parties[k].camera:region[k];
      base[k]=num(bucket[k]??fallback);
    });
    return base;
  }

  function coalitionFor(id){return S.coalitions.find(c=>c.id===id);}

  function coalitionMap(){
    const m={};
    S.coalitions.forEach(c=>(c.members||[]).forEach(k=>m[k]=c.id));
    return m;
  }

  function makeCoalition(){
    const name=prompt("Nome della coalizione:");
    if(!name||!name.trim())return;
    S.coalitions.push({id:"C"+Date.now(),name:name.trim(),members:[]});
    save();render();
  }

  function toggleMember(id,slug){
    const c=coalitionFor(id);if(!c)return;
    S.coalitions.forEach(x=>{if(x.id!==id)x.members=(x.members||[]).filter(k=>k!==slug);});
    c.members=(c.members||[]).includes(slug)?c.members.filter(k=>k!==slug):[...(c.members||[]),slug];
    save();render();
  }

  function removeCoalition(id){
    S.coalitions=S.coalitions.filter(c=>c.id!==id);
    save();render();
  }

  function eligibility(values,chamber){
    const cmap=coalitionMap();
    const coalTotals={};
    S.coalitions.forEach(c=>{
      coalTotals[c.id]=(c.members||[]).reduce((s,k)=>s+(values[k]||0),0);
    });
    const ok=new Set();
    Object.keys(values).forEach(k=>{
      const v=values[k]||0,cid=cmap[k];
      if(!cid){
        if(v>=3||chamber==="senato"&&v>=20)ok.add(k);
      }else{
        if((coalTotals[cid]||0)>=10&&v>=3)ok.add(k);
      }
    });
    S.coalitions.forEach(c=>{
      if((coalTotals[c.id]||0)>=10){
        const m=(c.members||[]).filter(k=>values[k]!=null).sort((a,b)=>(values[b]||0)-(values[a]||0));
        if(m.length&&!m.some(k=>(values[k]||0)>=3))ok.add(m[0]);
      }
    });
    return {ok:[...ok],coalTotals};
  }

  function allocate(values,seats,chamber){
    const el=eligibility(values,chamber),list=el.ok;
    const total=list.reduce((s,k)=>s+(values[k]||0),0);
    const out={};
    if(!list.length||!total)return {seats:out,eligible:[],coalTotals:el.coalTotals};
    list.forEach(k=>out[k]=Math.floor(seats*(values[k]||0)/total));
    let used=Object.values(out).reduce((s,v)=>s+v,0);
    list.map(k=>({k,rest:seats*(values[k]||0)/total-Math.floor(seats*(values[k]||0)/total)}))
      .sort((a,b)=>b.rest-a.rest)
      .slice(0,Math.max(0,seats-used))
      .forEach(x=>out[x.k]++);
    return {seats:out,eligible:list,coalTotals:el.coalTotals};
  }

  function bonusTarget(){
    const cam=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].camera)]));
    const sen=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
    const cmap=coalitionMap();
    const blocks=[];
    S.coalitions.forEach(c=>blocks.push({id:c.id,members:[...(c.members||[])]}));
    Object.keys(S.parties).forEach(k=>{if(!cmap[k])blocks.push({id:"P:"+k,members:[k]});});
    const candidates=blocks.map(b=>{
      const cv=b.members.reduce((s,k)=>s+(cam[k]||0),0);
      const sv=b.members.reduce((s,k)=>s+(sen[k]||0),0);
      return {...b,cam:cv,sen:sv};
    }).filter(b=>b.cam>=42&&b.sen>=42);
    if(!candidates.length)return null;
    candidates.sort((a,b)=>Math.min(b.cam,b.sen)-Math.min(a.cam,a.sen));
    const best=candidates[0];
    const topCam=Math.max(...blocks.map(b=>b.cam),0);
    const topSen=Math.max(...blocks.map(b=>b.sen),0);
    if(best.cam<topCam||best.sen<topSen)return null;
    return best;
  }

  const SPECIAL_SEATS={
    camera:{estero:8,valleDAosta:1,trentinoAltoAdige:7,total:16,proportional:384},
    senato:{estero:4,valleDAosta:1,trentinoAltoAdige:6,total:11,proportional:189}
  };

  function nationalResults(){
    const camVals=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].camera)]));
    const senVals=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
    const bonus=bonusTarget();
    const camBase=SPECIAL_SEATS.camera.proportional;
    const senBase=SPECIAL_SEATS.senato.proportional;
    const cam=allocate(camVals,bonus?camBase-70:camBase,"camera");
    const sen=allocate(senVals,bonus?senBase-35:senBase,"senato");

    function applyBonus(res,amount,cap,chamber,winner){
      if(!bonus||!amount)return;
      const members=winner.members;
      const values=chamber==="camera"?camVals:senVals;
      const total=members.reduce((s,k)=>s+(values[k]||0),0);
      if(total<=0)return;
      let current=members.reduce((s,k)=>s+(res.seats[k]||0),0);
      const add=Math.min(amount,Math.max(0,cap-current));
      if(!add)return;
      let used=0;
      members.forEach(k=>{
        const q=Math.floor(add*(values[k]/total));
        res.seats[k]=(res.seats[k]||0)+q;
        used+=q;
      });
      const best=members.slice().sort((a,b)=>(values[b]||0)-(values[a]||0))[0];
      if(best)res.seats[best]=(res.seats[best]||0)+(add-used);
      res.bonusSeats=add;
    }

    if(bonus){
      applyBonus(cam,70,220,"camera",bonus);
      applyBonus(sen,35,113,"senato",bonus);
    }

    return {
      cam,sen,bonus,
      special:{camera:{...SPECIAL_SEATS.camera},senato:{...SPECIAL_SEATS.senato}}
    };
  }

  function saveValue(slug,kind,value){
    if(!S.parties[slug])return;
    if(kind==="camera")S.parties[slug].camera=num(value);
    if(kind==="senate")S.parties[slug].senate=num(value);
    if(kind==="region"){
      S.regionalSenate[S.region]??={};
      S.regionalSenate[S.region][slug]=num(value);
    }
    if(kind==="college"){
      S.collegeValues[S.chamber]??={};
      S.collegeValues[S.chamber][S.college]??={};
      S.collegeValues[S.chamber][S.college][slug]=num(value);
    }
    save();
  }

  async function refreshYouTrend(){
    const btn=document.getElementById("sondaggiRefreshYT");
    if(btn){btn.disabled=true;btn.textContent="AGGIORNO…";}
    try{
      const res=await fetch("https://supermedia.youtrend.it/api/supermedia/");
      if(!res.ok)throw new Error("HTTP "+res.status);
      const j=await res.json();
      const parts=Array.isArray(j.partiti)?j.partiti:[];
      let matched=0;
      parts.forEach(p=>{
        const slug=String(p.slug??"").trim().toUpperCase();
        const name=String(p.nome??p.name??slug).trim();
        const value=num(p.valore??p.value);
        if(!slug)return;
        if(!S.parties[slug])S.parties[slug]={name,camera:value,senate:value};
        else{
          S.parties[slug].name=name||S.parties[slug].name;
          S.parties[slug].camera=value;
          S.parties[slug].senate=value;
        }
        matched++;
      });
      save();render();
      alert(matched?"YouTrend aggiornato: "+matched+" liste.":"YouTrend non ha restituito partiti nel formato atteso.");
    }catch(err){
      console.error("YouTrend",err);
      alert("Aggiornamento YouTrend non disponibile. I valori già presenti sono rimasti invariati.");
    }finally{
      const b=document.getElementById("sondaggiRefreshYT");
      if(b){b.disabled=false;b.textContent="AGGIORNA DA YOUTREND";}
    }
  }

  function render(){
    const host=ensurePanel();
    if(!host)return;
    const c=selectedCollege();
    const cVals=collegeValues();
    const rVals=regionValues();
    const national=nationalResults();
    const partyKeys=Object.keys(S.parties);

    const partyRows=partyKeys.map(k=>{
      const p=S.parties[k],cid=coalitionMap()[k];
      return '<tr><td><b>'+esc2(p.name)+'</b><small>'+esc2(k)+'</small></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="camera" type="number" step="0.1" min="0" max="100" value="'+num(p.camera).toFixed(1)+'"></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="senate" type="number" step="0.1" min="0" max="100" value="'+num(p.senate).toFixed(1)+'"></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="region" type="number" step="0.1" min="0" max="100" value="'+num(rVals[k]).toFixed(1)+'"></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="college" type="number" step="0.1" min="0" max="100" value="'+num(cVals[k]).toFixed(1)+'"></td>'+
        '<td>'+(cid?esc2(coalitionFor(cid)?.name||""):"—")+'</td></tr>';
    }).join("");

    const coalRows=S.coalitions.map(co=>{
      const vals=S.chamber==="camera"?cVals:rVals;
      const total=(co.members||[]).reduce((s,k)=>s+(vals[k]||0),0);
      const members=partyKeys.map(k=>
        '<label><input type="checkbox" data-member="'+esc2(co.id)+'" data-party="'+esc2(k)+'" '+((co.members||[]).includes(k)?"checked":"")+'>'+esc2(S.parties[k].name)+'</label>'
      ).join("");
      return '<div class="sg-coal"><div class="sg-coal-head"><b>'+esc2(co.name)+'</b><strong>'+fmt(total)+'%</strong><button type="button" data-coal-del="'+esc2(co.id)+'">Elimina</button></div><div class="sg-members">'+members+'</div></div>';
    }).join("")||'<div class="sg-empty">Nessuna coalizione definita. Crea una coalizione e assegna le liste.</div>';

    function resultRows(res,type){
      const vals=type==="camera"?Object.fromEntries(partyKeys.map(k=>[k,S.parties[k].camera])):Object.fromEntries(partyKeys.map(k=>[k,S.parties[k].senate]));
      return Object.entries(res.seats).sort((a,b)=>b[1]-a[1]).map(([k,seats])=>
        '<tr><td>'+esc2(S.parties[k]?.name||k)+'</td><td>'+num(vals[k]).toFixed(1)+'%</td><td><b>'+fmt0(seats)+'</b></td></tr>'
      ).join("")||'<tr><td colspan="3">Nessun partito supera le soglie con i valori inseriti.</td></tr>';
    }

    const collegeAlloc=allocate(cVals,c?.seats||0,S.chamber==="camera"?"camera":"senato");
    const collegeRows=Object.entries(collegeAlloc.seats).sort((a,b)=>b[1]-a[1]).map(([k,seats])=>
      '<tr><td>'+esc2(S.parties[k]?.name||k)+'</td><td>'+num(cVals[k]).toFixed(1)+'%</td><td><b>'+fmt0(seats)+'</b></td></tr>'
    ).join("")||'<tr><td colspan="3">Nessun seggio assegnabile con le percentuali inserite.</td></tr>';

    host.innerHTML=
      '<div class="sg-wrap">'+
        '<div class="sg-head"><div><div class="sg-kicker">SONDAGGI ELETTORALI</div><h1>Simulatore nazionale e per collegio</h1><p>Inserisci le percentuali nazionali e quelle del territorio selezionato, costruisci le coalizioni e verifica l&#39;effetto sul riparto dei seggi.</p></div><button class="sg-btn primary" id="sondaggiRefreshYT">AGGIORNA DA YOUTREND</button></div>'+
        '<div class="sg-law">LEGGE ELETTORALE · TESTO APPROVATO 8 OTTOBRE 2026 · sistema proporzionale su collegi plurinominali · soglie 3% liste / 10% coalizioni · premio di 70 seggi alla Camera e 35 al Senato con soglia 42% nella stessa lista/coalizione in entrambe le Camere. Testo approvato definitivamente, non ancora pubblicato.</div>'+
        '<div class="sg-layout">'+
          '<div class="sg-map-card"><div class="sg-card-title"><b>Italia</b><span>'+esc2(S.region)+'</span></div><div class="sg-map"><img src="https://upload.wikimedia.org/wikipedia/commons/9/9b/Italy_map_with_regions.svg" alt="Mappa d’Italia divisa in regioni"><div class="sg-map-caption">La mappa mostra la divisione regionale; usa i pulsanti per selezionare la regione e caricare i relativi collegi.</div></div><div class="sg-regions">'+REGIONS.map(x=>'<button type="button" data-region="'+esc2(x)+'" class="'+(x===S.region?"active":"")+'">'+esc2(x)+'</button>').join("")+'</div></div>'+
          '<div class="sg-main">'+
            '<div class="sg-controls"><div><label>Camera / Senato</label><select id="sgChamber"><option value="camera">Camera</option><option value="senato">Senato</option></select></div><div><label>Regione</label><select id="sgRegion">'+REGIONS.map(x=>'<option value="'+esc2(x)+'">'+esc2(x)+'</option>').join("")+'</select></div><div><label>Collegio</label><select id="sgCollege">'+collegesFor(S.chamber,S.region).map(x=>'<option value="'+esc2(x.name)+'">'+esc2(x.name)+' · '+x.seats+' seggi</option>').join("")+'</select></div></div>'+
            '<div class="sg-card"><div class="sg-card-title"><b>Percentuali di voto</b><span>nazionale · regione · collegio</span></div><div class="sg-table-wrap"><table class="sg-table"><thead><tr><th>Partito</th><th>Camera naz.</th><th>Senato naz.</th><th>Senato regione</th><th>'+ (S.chamber==="camera"?"Camera":"Senato") +' collegio</th><th>Coalizione</th></tr></thead><tbody>'+partyRows+'</tbody></table></div><div class="sg-actions"><button type="button" class="sg-btn" id="sgSaveAll">SALVA SCENARIO</button><button type="button" class="sg-btn" id="sgReset">RIPRISTINA BASE YOUTREND</button></div></div>'+
            '<div class="sg-card"><div class="sg-card-title"><b>Coalizioni preimpostate e modificabili</b><span><button type="button" class="sg-btn small" id="sgNewCoal">+ NUOVA COALIZIONE</button></span></div><div class="sg-note">Le coalizioni di base sono già caricate. Spunta un partito per aggiungerlo o togli la spunta per rimuoverlo; ogni partito può appartenere a una sola coalizione alla volta.</div>'+coalRows+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="sg-results">'+
          '<div class="sg-card"><div class="sg-card-title"><b>Distribuzione seggi nazionale</b><span>scenario legge 8/10/2026</span></div><div class="sg-two"><div><h3>Camera · 400</h3><table class="sg-table"><thead><tr><th>Partito</th><th>%</th><th>Seggi</th></tr></thead><tbody>'+resultRows(national.cam,"camera")+'</tbody></table></div><div><h3>Senato · 200</h3><table class="sg-table"><thead><tr><th>Partito</th><th>%</th><th>Seggi</th></tr></thead><tbody>'+resultRows(national.sen,"senato")+'</tbody></table></div></div><div class="sg-special"><b>SEGGI SPECIALI ESCLUSI DAL RIPARTO PROPORZIONALE</b> · Camera ${SPECIAL_SEATS.camera.total} (Estero ${SPECIAL_SEATS.camera.estero}, Valle d&#39;Aosta ${SPECIAL_SEATS.camera.valleDAosta}, Trentino-Alto Adige ${SPECIAL_SEATS.camera.trentinoAltoAdige}) · Senato ${SPECIAL_SEATS.senato.total} (Estero ${SPECIAL_SEATS.senato.estero}, Valle d&#39;Aosta ${SPECIAL_SEATS.senato.valleDAosta}, Trentino-Alto Adige ${SPECIAL_SEATS.senato.trentinoAltoAdige})</div>'+(national.bonus?'<div class="sg-bonus">PREMIO ATTIVO · '+esc2(coalitionFor(national.bonus.id)?.name||national.bonus.members.map(k=>S.parties[k]?.name||k).join(" + "))+' · 70 Camera / 35 Senato</div>':'<div class="sg-note">Il premio non scatta: la stessa lista o coalizione deve essere prima e raggiungere almeno il 42% in entrambe le Camere.</div>')+'</div>'+
          '<div class="sg-card"><div class="sg-card-title"><b>Distribuzione nel collegio</b><span>'+esc2(c?.name||"")+' · '+fmt0(c?.seats||0)+' seggi</span></div><table class="sg-table"><thead><tr><th>Partito</th><th>% collegio</th><th>Seggi</th></tr></thead><tbody>'+collegeRows+'</tbody></table><div class="sg-note">Il collegio usa le percentuali locali che inserisci. Le assegnazioni nazionali della riforma restano nella simulazione sopra.</div></div>'+
        '</div>'+
        '<div class="sg-source">Partiti e valori iniziali: Supermedia YouTrend/Agi, rilevazione 1 ottobre 2026. Collegamento dei collegi alla geografia plurinominale vigente utilizzata dalla riforma. La simulazione è uno scenario operativo e va riallineata al testo ufficiale pubblicato.</div>'+
      '</div>';

    document.getElementById("sgChamber").value=S.chamber;
    document.getElementById("sgRegion").value=S.region;
    document.getElementById("sgCollege").value=S.college;

    host.querySelectorAll("[data-sv]").forEach(inp=>{
      inp.addEventListener("change",()=>{
        saveValue(inp.getAttribute("data-sv"),inp.getAttribute("data-kind"),inp.value);
        render();
      });
    });
    host.querySelectorAll("[data-region]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        S.region=btn.getAttribute("data-region")||"Lombardia";
        regionValues();
        S.college=collegesFor(S.chamber,S.region)[0]?.name||"";
        save();render();
      });
    });
    document.getElementById("sgChamber").addEventListener("change",e=>{
      S.chamber=e.target.value;
      S.college=collegesFor(S.chamber,S.region)[0]?.name||"";
      save();render();
    });
    document.getElementById("sgRegion").addEventListener("change",e=>{
      S.region=e.target.value;
      regionValues();
      S.college=collegesFor(S.chamber,S.region)[0]?.name||"";
      save();render();
    });
    document.getElementById("sgCollege").addEventListener("change",e=>{S.college=e.target.value;save();render();});
    document.getElementById("sgNewCoal").addEventListener("click",makeCoalition);
    document.getElementById("sgSaveAll").addEventListener("click",()=>{save();alert("Scenario Sondaggi salvato.");});
    document.getElementById("sgReset").addEventListener("click",()=>{
      const keep={chamber:S.chamber,region:S.region,college:S.college};
      S=freshState();
      S.chamber=keep.chamber;S.region=keep.region;
      S.college=collegesFor(S.chamber,S.region)[0]?.name||"";
      save();render();
    });
    document.getElementById("sondaggiRefreshYT").addEventListener("click",refreshYouTrend);
    host.querySelectorAll("[data-member]").forEach(ch=>ch.addEventListener("change",()=>toggleMember(ch.getAttribute("data-member"),ch.getAttribute("data-party"))));
    host.querySelectorAll("[data-coal-del]").forEach(btn=>btn.addEventListener("click",()=>removeCoalition(btn.getAttribute("data-coal-del"))));
  }

  const style=document.createElement("style");
  style.id="sondaggi-module-v1";
  style.textContent=String.raw`
#tab-sondaggi{padding:0!important}
.sg-wrap{color:#eaf4fb}
.sg-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:12px}
.sg-kicker{font-size:9px;letter-spacing:.16em;color:#3ca8ff;font-weight:900}
.sg-head h1{margin:4px 0 5px;font-size:26px;line-height:1.05;color:#fff}
.sg-head p{margin:0;color:#9db3c3;font-size:10px;line-height:1.5;max-width:780px}
.sg-btn{border:1px solid #2b4c65;background:#0b2034;color:#eaf4fb;border-radius:8px;padding:9px 11px;font-size:9px;font-weight:900;cursor:pointer}
.sg-btn.primary{background:#1c7ed0;border-color:#2b91e6;color:#fff}
.sg-btn.small{padding:6px 8px;font-size:8px}
.sg-special{margin-top:10px;padding:9px 11px;border-radius:9px;background:#102a40;border:1px solid #2b5a7d;color:#c7d8e5;font-size:8px;line-height:1.5}.sg-special b{color:#6cb7ff;font-size:8px}.sg-law{padding:9px 11px;margin-bottom:12px;border-radius:9px;background:#132c42;border:1px solid #2b4d67;color:#aac0d0;font-size:8px;line-height:1.45}
.sg-layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:12px}
.sg-map-card,.sg-main .sg-card,.sg-results .sg-card{background:#0b1e31;border:1px solid #203d55;border-radius:11px;padding:12px;box-sizing:border-box}
.sg-card{background:#0b1e31;border:1px solid #203d55;border-radius:11px;padding:12px}
.sg-card-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:9px}
.sg-card-title b{font-size:12px;color:#fff}.sg-card-title span{font-size:8px;color:#819db2}
.sg-map{background:linear-gradient(180deg,#315d7e 0%,#254b69 100%);border:1px solid #5f8cac;border-radius:10px;padding:10px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.06)}
.sg-map img{display:block;width:100%;height:410px;object-fit:contain;background:#315d7e;filter:invert(1) brightness(.82) contrast(1.7) saturate(.35);opacity:1}
.sg-map-caption{color:#b7cbda}
.sg-map-caption{margin-top:8px;font-size:8px;line-height:1.45;color:#839caf}
.sg-regions{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:9px;max-height:300px;overflow:auto}
.sg-regions button{border:1px solid #23445e;background:#0b2137;color:#b9ccda;border-radius:7px;padding:7px 8px;text-align:left;font-size:8px;cursor:pointer}
.sg-regions button.active{border-color:#2187ff;background:#113a5f;color:#fff}
.sg-controls{display:grid;grid-template-columns:170px 1fr 1.5fr;gap:8px;margin-bottom:10px}
.sg-controls label{display:block;font-size:7px;color:#819db2;text-transform:uppercase;font-weight:900;margin-bottom:4px}
.sg-controls select{width:100%;box-sizing:border-box;background:#091827;color:#eff7fb;border:1px solid #2a4861;border-radius:8px;padding:9px;font-size:10px}
.sg-table-wrap{width:100%;overflow:auto}
.sg-table{width:100%;border-collapse:collapse;font-size:8px}
.sg-table th{text-align:left;padding:7px 6px;border-bottom:1px solid #29465b;color:#7f9bb0;font-size:7px;text-transform:uppercase}
.sg-table td{padding:6px;border-bottom:1px solid #18364c;color:#dcecf6;vertical-align:middle}
.sg-table td small{display:block;font-size:6px;color:#7391a7;margin-top:2px}
.sg-table input{width:78px;box-sizing:border-box;background:#091827;color:#fff;border:1px solid #2b4960;border-radius:6px;padding:6px 7px;font-size:9px}
.sg-actions{display:flex;gap:7px;margin-top:9px}
.sg-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sg-two h3{font-size:10px;margin:0 0 6px;color:#fff}
.sg-coal{padding:9px;border:1px solid #23465f;background:#0d2740;border-radius:9px;margin-bottom:7px}
.sg-coal-head{display:flex;align-items:center;gap:7px}
.sg-coal-head b{flex:1;font-size:10px;color:#fff}.sg-coal-head strong{font-size:11px;color:#fff}.sg-coal-head button{border:0;background:none;color:#9eb4c4;font-size:8px;cursor:pointer}
.sg-members{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}
.sg-members label{font-size:7px;color:#b6c9d7;padding:5px;border:1px solid #23465f;border-radius:6px;background:#0a1d30}
.sg-members input{margin-right:4px}
.sg-empty,.sg-note,.sg-bonus{margin-top:8px;padding:8px;border-radius:8px;font-size:8px;line-height:1.45}
.sg-empty,.sg-note{background:#102a41;border:1px solid #24475f;color:#94abbc}
.sg-bonus{background:#174b35;border:1px solid #2a7651;color:#dff7e8;font-weight:800}
.sg-results{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.sg-results .sg-card:first-child{grid-column:1/-1}
.sg-source{margin-top:8px;font-size:7px;color:#66859d;line-height:1.4}
@media(max-width:1000px){.sg-layout,.sg-results{grid-template-columns:1fr}.sg-map-card{max-width:none}.sg-map img{height:360px}.sg-controls{grid-template-columns:1fr 1fr}.sg-controls>div:last-child{grid-column:1/-1}}
@media(max-width:820px){.sg-head{display:block}.sg-head h1{font-size:22px}.sg-head .sg-btn{width:100%;margin-top:9px}.sg-map img{height:330px}.sg-regions{grid-template-columns:1fr 1fr}.sg-table{min-width:820px}.sg-table input{width:72px}.sg-members{grid-template-columns:1fr 1fr}.sg-controls{grid-template-columns:1fr}.sg-controls>div:last-child{grid-column:auto}.sg-actions{display:grid;grid-template-columns:1fr 1fr}.sg-two{grid-template-columns:1fr}.sg-results{display:block}.sg-results .sg-card{margin-bottom:10px}}`;
  document.head.appendChild(style);

  document.addEventListener("click",ev=>{
    if(ev.target?.closest?.("#sideSondaggi")){
      ev.preventDefault();
      ev.stopPropagation();
      openPanel();
    }else if(ev.target?.closest?.(".side-tab")&&!ev.target.closest("#sideSondaggi")){
      closePanel();
    }
  });

  setTimeout(ensureNav,100);
  setTimeout(ensureNav,800);
  setInterval(ensureNav,2000);
}
installSondaggiModule();


})();

/* ===== FIX HOME EUROPEE / REGIONALI ===== */
  // Sostituisce il vecchio setElectionData che faceva riferimento a elementi
  // HTML non più presenti nella Home.
  const originalSetElectionData=window.setElectionData;
  window.setElectionData=function(){
    try{
      const raw=(typeof election!=="undefined"&&election==="europee")?EURO_RAW:RAW;
      data=raw.map(r=>({...r,geo:geoMap.get(norm(r.prov)+"|"+norm(r.comune))||null}));
      CANDS=[...new Set(data.map(r=>r.candidato).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"it"));
      PROVS=["BERGAMO","BRESCIA","COMO","CREMONA","LECCO","LODI","MANTOVA","MILANO","MONZA E DELLA BRIANZA","PAVIA","SONDRIO","VARESE"];
      filters={prov:"",comune:"",candidato:"",corrente:"",camP:"",senP:"",lista:""};
      if(typeof applyCorrenti==="function")applyCorrenti();
      const title=(typeof election!=="undefined"&&election==="europee")?"DATI EUROPEE · 2024":"DATI REGIONALI · 2023";
      const p="prefEyebrow";
      const mt=document.getElementById("macroTitle");
      if(mt)mt.textContent=title;
      const pe=document.getElementById(p);
      if(pe)pe.textContent=title+" · PREFERENZE";
      document.querySelectorAll(".macro-tab").forEach(x=>x.classList.toggle("active",x.id==="macro-"+election));
    }catch(err){
      console.error("setElectionData",err);
      if(typeof originalSetElectionData==="function"){
        try{ originalSetElectionData(); }catch(_){}
      }
    }
  };

(function(){
  function homeDatasetComuneCount(){
    const rows=Array.isArray(window.data)?window.data:(typeof data!=="undefined"?data:[]);
    const normalize=(v)=>String(v??"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase().replace(/\\s+/g," ").trim();
    const seen=new Set();
    rows.forEach(r=>seen.add(normalize(r.prov)+"|"+normalize(r.comune)));
    return seen.size;
  }

  function refreshHomeForElection(){
    try{
      const label=(typeof election!=="undefined"&&election==="europee")
        ?"Europee 2024 · FdI"
        :"Regionali 2023 · FdI";

      document.querySelectorAll('[id="homeElectionLabel"]').forEach(el=>{el.textContent=label});

      const kComuni=document.getElementById("k-comuni");
      if(kComuni)kComuni.textContent=homeDatasetComuneCount().toLocaleString("it-IT");

      const currentCandidates=Array.isArray(window.CANDS)
        ?window.CANDS
        :(typeof CANDS!=="undefined"?CANDS:[]);
      const kCand=document.getElementById("k-candidati");
      if(kCand)kCand.textContent=currentCandidates.length.toLocaleString("it-IT");

      const corrMap=(typeof correnti!=="undefined"&&correnti&&typeof correnti==="object")?correnti:{};
      const assigned=currentCandidates.filter(c=>String(corrMap[c]||"").trim()).length;
      const kCorr=document.getElementById("k-correnti");
      if(kCorr)kCorr.textContent=assigned.toLocaleString("it-IT");

      const quick=document.getElementById("homeQuick");
      if(quick){
        quick.querySelectorAll(".quick-item").forEach((item,idx)=>{
          if(idx===0){
            const small=item.querySelector("small");
            if(small)small.textContent=homeDatasetComuneCount().toLocaleString("it-IT")+" comuni nel dataset";
          }
          if(idx===3){
            const small=item.querySelector("small");
            if(small)small.textContent="Europee + Regionali";
            const em=item.querySelector("em");
            if(em)em.textContent=label.replace(" · FdI","");
          }
        });
      }
    }catch(err){console.error("Home election refresh",err)}
  }

  const originalMacro=window.dashboardSetMacro;
  window.dashboardSetMacro=function(v){
    if(v!=="europee"&&v!=="regionali")return;
    try{
      if(typeof election!=="undefined")election=v;
      if(typeof setElectionData==="function")setElectionData();
      if(typeof current!=="undefined")current="home";
      document.querySelectorAll(".macro-tab").forEach(x=>x.classList.toggle("active",x.id==="macro-"+v));
      document.querySelectorAll(".side-tab,.side-home").forEach(x=>x.classList.remove("active"));
      document.querySelector(".side-home")?.classList.add("active");
      if(typeof render==="function")render();
      refreshHomeForElection();
    }catch(err){
      console.error("Cambio macro Home",err);
      if(typeof originalMacro==="function")originalMacro(v);
      refreshHomeForElection();
    }
  };
  window.switchElection=window.dashboardSetMacro;
  window.refreshHomeForElection=refreshHomeForElection;

  const originalRenderHome=window.renderHome;
  if(typeof originalRenderHome==="function"){
    window.renderHome=function(){
      originalRenderHome();
      refreshHomeForElection();
    };
  }

  setTimeout(refreshHomeForElection,0);
})();

