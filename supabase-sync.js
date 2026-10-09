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
      uploadTickets(ticketGroups).catch(err=>console.error("Supabase ticket add",err));
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
      const cc=typeof currentComune==="function"?currentComune(r?.comune):r?.comune;
      let g=r&&r.geo;
      if(!g && typeof geoMap!=="undefined" && geoMap && typeof geoMap.get==="function"){
        try{g=geoMap.get(norm3(r?.prov)+"|"+norm3(cc))||null;}catch(_){}
      }
      return {...r,comune:cc,geo:g||{}};
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

  function canonicalComune(v){
    try{return typeof currentComune==="function"?currentComune(String(v||"")):String(v||"");}
    catch(_){return String(v||"");}
  }
  function normalizeProv(v){
    const n=normC(v);
    try{if(typeof PROV_CODE!=="undefined" && PROV_CODE && PROV_CODE[n])return normC(PROV_CODE[n]);}catch(_){}
    return n;
  }
  function totalsKey(prov,comune){
    const c=normC(canonicalComune(comune));
    if(!c)return "";
    const p=normalizeProv(prov);
    return p?p+"|"+c:c;
  }
  function buildTotals(){
    const raw=(typeof election!=="undefined"&&election==="europee"&&typeof EURO_RAW!=="undefined")
      ? EURO_RAW
      : (typeof RAW!=="undefined"?RAW:[]);
    const totals={};
    (Array.isArray(raw)?raw:[]).forEach(r=>{
      const key=totalsKey(r?.prov,r?.comune);
      if(!key)return;
      totals[key]=(totals[key]||0)+(Number(r?.preferenze)||0);
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

          const provIndex=ths.findIndex(th=>normC(th.textContent).includes("PROVINCIA"));
          let value=0;
          if(provIndex>=0 && cells[provIndex]){
            const prov=normalizeProv(cells[provIndex].textContent);
            value=Number(totals[prov+"|"+comune]||0);
          }else{
            value=Number(totals[comune]||0);
          }
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
    "Piemonte":["Piemonte 1 - P01|8|7","Piemonte 1 - P02|7|5","Piemonte 2 - P01|6|5","Piemonte 2 - P02|8|7"],
    "Valle d'Aosta":["Valle d'Aosta - U01|1|1|SPECIAL"],
    "Lombardia":["Lombardia 1 - P01|14|12","Lombardia 1 - P02|13|10","Lombardia 2 - P01|6|5","Lombardia 2 - P02|8|7","Lombardia 3 - P01|7|5","Lombardia 3 - P02|8|7","Lombardia 4 - P01|11|9"],
    "Trentino-Alto Adige/Südtirol":["Trentino-Alto Adige - P01|7|7|SPECIAL"],
    "Veneto":["Veneto 1 - P01|13|11","Veneto 2 - P01|7|6","Veneto 2 - P02|6|4","Veneto 2 - P03|6|5"],
    "Friuli-Venezia Giulia":["Friuli-Venezia Giulia - P01|8|7"],
    "Liguria":["Liguria - P01|10|8"],
    "Emilia-Romagna":["Emilia-Romagna - P01|8|7","Emilia-Romagna - P02|11|9","Emilia-Romagna - P03|10|8"],
    "Toscana":["Toscana - P01|8|7","Toscana - P02|8|6","Toscana - P03|8|7"],
    "Umbria":["Umbria - P01|6|5"],
    "Marche":["Marche - P01|10|8"],
    "Lazio":["Lazio 1 - P01|8|6","Lazio 1 - P02|8|7","Lazio 1 - P03|9|7","Lazio 2 - P01|6|5","Lazio 2 - P02|7|6"],
    "Abruzzo":["Abruzzo - P01|8|6"],
    "Molise":["Molise - P01|2|2"],
    "Campania":["Campania 1 - P01|9|7","Campania 1 - P02|11|9","Campania 2 - P01|8|6","Campania 2 - P02|9|8"],
    "Puglia":["Puglia - P01|6|5","Puglia - P02|6|5","Puglia - P03|6|4","Puglia - P04|8|7"],
    "Basilicata":["Basilicata - P01|4|3"],
    "Calabria":["Calabria - P01|12|10"],
    "Sicilia":["Sicilia 1 - P01|8|6","Sicilia 1 - P02|7|6","Sicilia 2 - P01|5|4","Sicilia 2 - P02|6|5","Sicilia 2 - P03|6|5"],
    "Sardegna":["Sardegna - P01|10|8"]
  };

  const SEN_COLLEGI={
    "Piemonte":["Piemonte - P01|6|5","Piemonte - P02|8|6"],
    "Valle d'Aosta":["Valle d'Aosta - U01|1|1|SPECIAL"],
    "Lombardia":["Lombardia - P01|9|8","Lombardia - P02|13|10","Lombardia - P03|10|8"],
    "Trentino-Alto Adige/Südtirol":["Trentino-Alto Adige - U01|1|1|SPECIAL","Trentino-Alto Adige - U02|1|1|SPECIAL","Trentino-Alto Adige - U03|1|1|SPECIAL","Trentino-Alto Adige - U04|1|1|SPECIAL","Trentino-Alto Adige - U05|1|1|SPECIAL","Trentino-Alto Adige - U06|1|1|SPECIAL"],
    "Veneto":["Veneto - P01|7|6","Veneto - P02|9|7"],
    "Friuli-Venezia Giulia":["Friuli-Venezia Giulia - P01|4|3"],
    "Liguria":["Liguria - P01|5|4"],
    "Emilia-Romagna":["Emilia-Romagna - P01|6|5","Emilia-Romagna - P02|8|6"],
    "Toscana":["Toscana - P01|12|10"],
    "Umbria":["Umbria - P01|3|2"],
    "Marche":["Marche - P01|5|4"],
    "Lazio":["Lazio - P01|9|8","Lazio - P02|9|7"],
    "Abruzzo":["Abruzzo - P01|4|3"],
    "Molise":["Molise - P01|2|2"],
    "Campania":["Campania - P01|10|9","Campania - P02|8|6"],
    "Puglia":["Puglia - P01|13|11"],
    "Basilicata":["Basilicata - P01|3|3"],
    "Calabria":["Calabria - P01|6|5"],
    "Sicilia":["Sicilia - P01|7|6","Sicilia - P02|8|6"],
    "Sardegna":["Sardegna - P01|5|4"]
  };

  const POLLS=[
    ["FdI","Fratelli d'Italia",26.8],
    ["PD","Partito Democratico",20.4],
    ["M5S","Movimento 5 Stelle",12.8],
    ["FN","Futuro Nazionale",7.7],
    ["FI","Forza Italia",7.4],
    ["AVS","Alleanza Verdi Sinistra",6.3],
    ["LEGA","Lega",5.7],
    ["AZ","Azione",3.2],
    ["IV","Italia Viva",2.2],
    ["PIU","+Europa",1.7],
    ["PLD","Partito Liberaldemocratico",1.3],
    ["NM","Noi Moderati",1.1],
    ["ALTRI","Altri",3.4]
  ];

  const COALITION_PRESET_VERSION=2;
  const DEFAULT_COALITIONS=[
    {id:"C-CD",name:"Centrodestra",members:["FdI","LEGA","FI","NM"]},
    {id:"C-CS",name:"Centrosinistra",members:["PD","M5S","AVS","PIU","IV"]}
  ];

  const SENATE_PREMIO_REGIONI={
    "Piemonte":3,
    "Lombardia":6,
    "Veneto":3,
    "Friuli-Venezia Giulia":1,
    "Liguria":1,
    "Emilia-Romagna":3,
    "Toscana":2,
    "Umbria":1,
    "Marche":1,
    "Lazio":3,
    "Abruzzo":1,
    "Molise":0,
    "Campania":3,
    "Puglia":2,
    "Basilicata":0,
    "Calabria":1,
    "Sicilia":3,
    "Sardegna":1
  };

  const SENATE_PROP_REGIONS=REGIONS.filter(r=>Object.prototype.hasOwnProperty.call(SENATE_PREMIO_REGIONI,r));

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
      regionalCustom:{},
      specialSeats:specialSeatState(),
      meta:{legacyBridgeInitialized:false},
      collegeValues:{camera:{},senato:{}},
      coalitions:defaultCoalitions(),
      coalitionPresetVersion:COALITION_PRESET_VERSION
    };
    POLLS.forEach(p=>{
      s.parties[p[0]]={name:p[1],camera:p[2],senate:p[2]};
    });
    [...SENATE_PROP_REGIONS,"Valle d'Aosta","Trentino-Alto Adige/Südtirol"].forEach(region=>{
      s.regionalSenate[region]=Object.fromEntries(POLLS.map(p=>[p[0],p[2]]));
    });
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
      if(!base.regionalSenate || typeof base.regionalSenate!=="object")base.regionalSenate={};
      base.meta=saved.meta&&typeof saved.meta==="object"?saved.meta:{legacyBridgeInitialized:false};
      base.regionalCustom=saved.regionalCustom&&typeof saved.regionalCustom==="object"?saved.regionalCustom:{};
      [...SENATE_PROP_REGIONS,"Valle d'Aosta","Trentino-Alto Adige/Südtirol"].forEach(region=>{
        base.regionalSenate[region]=base.regionalSenate[region]&&typeof base.regionalSenate[region]==="object"
          ?base.regionalSenate[region]
          :Object.fromEntries(POLLS.map(p=>[p[0],p[2]]));
        POLLS.forEach(p=>{
          if(base.regionalSenate[region][p[0]]==null)base.regionalSenate[region][p[0]]=Number(base.parties[p[0]]?.senate??p[2]);
        });
      });
      [...SENATE_PROP_REGIONS,"Valle d'Aosta","Trentino-Alto Adige/Südtirol"].forEach(region=>{
        if(base.regionalCustom[region]===undefined)base.regionalCustom[region]=false;
        if(!base.regionalCustom[region] && SENATE_PROP_REGIONS.includes(region)){
          base.regionalSenate[region]=Object.fromEntries(POLLS.map(p=>[p[0],Number(base.parties[p[0]]?.senate??p[2])]));
        }
      });
      base.collegeValues=saved.collegeValues&&typeof saved.collegeValues==="object"?saved.collegeValues:{camera:{},senato:{}};
      if(!base.collegeValues.camera)base.collegeValues.camera={};
      if(!base.collegeValues.senato)base.collegeValues.senato={};

      const savedCoalitions=Array.isArray(saved.coalitions)?saved.coalitions:null;
      base.coalitions=savedCoalitions?savedCoalitions:[];
      base.coalitionPresetVersion=Number(saved.coalitionPresetVersion)||0;

      // Seggi fuori dal riparto nazionale: conserviamo solo valori interi validi
      // e non permettiamo che una categoria superi il numero di seggi disponibile.
      const savedSpecial=saved.specialSeats&&typeof saved.specialSeats==="object"?saved.specialSeats:null;
      base.specialSeats=specialSeatState();
      if(savedSpecial){
        ["camera","senato"].forEach(ch=>{
          SPECIAL_CATS.forEach(cat=>{
            let remaining=Number(SPECIAL_SEATS[ch][cat]||0);
            const src=savedSpecial[ch]?.[cat]&&typeof savedSpecial[ch][cat]==="object"?savedSpecial[ch][cat]:{};
            Object.entries(src).forEach(([k,v])=>{
              if(!POLLS.some(p=>p[0]===k)||remaining<=0)return;
              const n=Math.max(0,Math.min(remaining,Math.floor(Number(v)||0)));
              if(n>0){base.specialSeats[ch][cat][k]=n;remaining-=n;}
            });
          });
        });
      }

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

  function normalizePartyName(v){
    return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9+]/g,"");
  }
  const LEGACY_PARTY_MAP=Object.fromEntries(POLLS.map(p=>[normalizePartyName(p[1]),p[0]]));
  LEGACY_PARTY_MAP["ALLEANZAVERDISINISTRA"]="AVS";

  function syncFromLegacyV7(){
    try{
      const raw=localStorage.getItem("lombardia_sondaggi_v7");
      if(!raw)return false;
      const legacy=JSON.parse(raw);
      if(!legacy||typeof legacy!=="object")return false;

      ["camera","senato"].forEach(ch=>{
        const source=legacy.nationalVotes?.[ch]||{};
        Object.entries(source).forEach(([name,value])=>{
          const slug=LEGACY_PARTY_MAP[normalizePartyName(name)];
          if(slug&&S.parties[slug]){
            if(ch==="camera")S.parties[slug].camera=num(value);
            else S.parties[slug].senate=num(value);
          }
        });
      });

      const mappedCoalitions=Array.isArray(legacy.coalitions)
        ?legacy.coalitions.map((c,i)=>({
          id:String(c.id||("C"+i)),
          name:String(c.name||("Coalizione "+(i+1))),
          members:(c.members||[]).map(name=>LEGACY_PARTY_MAP[normalizePartyName(name)]).filter(Boolean)
        })).filter(c=>c.members.length)
        : [];
      if(mappedCoalitions.length)S.coalitions=mappedCoalitions;

      const firstBridge=!S.meta?.legacyBridgeInitialized;
      const beforeRegions={};
      SENATE_PROP_REGIONS.forEach(region=>{beforeRegions[region]={...(S.regionalSenate[region]||{})};});

      // Al primo allineamento partiamo da un legame pulito: tutte le regioni
      // ereditano il nazionale. Da quel momento una regione diventa
      // PERSONALIZZATA solo quando viene modificata esplicitamente o aggiornata
      // dal vecchio modulo territoriale.
      const legacyRegions=legacy.circVotes?.senato||{};
      SENATE_PROP_REGIONS.forEach(region=>{
        const source=legacyRegions[region];
        const currentBefore=beforeRegions[region]||{};
        let sourceChanged=false;
        if(source&&typeof source==="object"){
          Object.keys(S.parties).forEach(k=>{
            const legacyName=POLLS.find(p=>p[0]===k)?.[1];
            if(legacyName&&source[legacyName]!=null){
              const value=num(source[legacyName]);
              if(Math.abs(value-num(currentBefore[k]??S.parties[k].senate))>0.0001)sourceChanged=true;
            }
          });
        }

        if(firstBridge){
          S.regionalCustom[region]=false;
          S.regionalSenate[region]=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
        }else if(S.regionalCustom[region]){
          // Una regione già personalizzata resta indipendente dal nazionale.
          // Se l'utente ha modificato quel territorio dal vecchio modulo v7,
          // importiamo anche il nuovo valore.
          if(sourceChanged&&source&&typeof source==="object"){
            Object.keys(S.parties).forEach(k=>{
              const legacyName=POLLS.find(p=>p[0]===k)?.[1];
              if(legacyName&&source[legacyName]!=null)S.regionalSenate[region][k]=num(source[legacyName]);
            });
          }
        }else{
          // Regione collegata al nazionale: segue automaticamente il nuovo
          // sondaggio nazionale e ignora vecchi valori regionali rimasti indietro.
          S.regionalSenate[region]=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
          if(sourceChanged&&source&&typeof source==="object"){
            // Una modifica effettiva fatta nel vecchio modulo rende la regione
            // indipendente dal nazionale.
            const looksUserEdited=Object.keys(S.parties).some(k=>{
              const legacyName=POLLS.find(p=>p[0]===k)?.[1];
              return legacyName&&source[legacyName]!=null&&Math.abs(num(source[legacyName])-num(S.parties[k].senate))>0.0001;
            });
            if(looksUserEdited){
              S.regionalCustom[region]=true;
              Object.keys(S.parties).forEach(k=>{
                const legacyName=POLLS.find(p=>p[0]===k)?.[1];
                if(legacyName&&source[legacyName]!=null)S.regionalSenate[region][k]=num(source[legacyName]);
              });
            }
          }
        }
      });
      S.meta.legacyBridgeInitialized=true;
      return true;
    }catch(err){
      console.error("Sync Sondaggi v7",err);
      return false;
    }
  }

  function mirrorToLegacyV7(){
    try{
      const legacy=JSON.parse(localStorage.getItem("lombardia_sondaggi_v7")||"{}");
      legacy.parties=legacy.parties&&typeof legacy.parties==="object"?legacy.parties:{};
      legacy.nationalVotes=legacy.nationalVotes&&typeof legacy.nationalVotes==="object"?legacy.nationalVotes:{};
      legacy.nationalVotes.camera={};
      legacy.nationalVotes.senato={};
      const LEGACY_NAMES={AVS:"Alleanza Verdi Sinistra"};
      Object.entries(S.parties).forEach(([slug,p])=>{
        const name=LEGACY_NAMES[slug]||p.name||POLLS.find(x=>x[0]===slug)?.[1]||slug;
        legacy.parties[name]=num(p.senate);
        legacy.nationalVotes.camera[name]=num(p.camera);
        legacy.nationalVotes.senato[name]=num(p.senate);
      });
      legacy.coalitions=S.coalitions.map(c=>({
        id:c.id,name:c.name,members:(c.members||[]).map(slug=>S.parties[slug]?.name||slug)
      }));
      legacy.circVotes=legacy.circVotes&&typeof legacy.circVotes==="object"?legacy.circVotes:{camera:{},senato:{}};
      legacy.circVotes.senato=legacy.circVotes.senato||{};
      SENATE_PROP_REGIONS.forEach(region=>{
        legacy.circVotes.senato[region]={};
        Object.entries(S.parties).forEach(([slug,p])=>{
          const name=LEGACY_NAMES[slug]||p.name||POLLS.find(x=>x[0]===slug)?.[1]||slug;
          legacy.circVotes.senato[region][name]=num(S.regionalSenate[region]?.[slug]??p.senate);
        });
      });
      legacy.meta=legacy.meta&&typeof legacy.meta==="object"?legacy.meta:{};
      legacy.meta.bridgeUpdatedAt=new Date().toISOString();
      localStorage.setItem("lombardia_sondaggi_v7",JSON.stringify(legacy));
      window.dispatchEvent(new CustomEvent("sondaggi-data-sync"));
    }catch(err){
      console.error("Mirror Sondaggi v7",err);
    }
  }

  function save(){localStorage.setItem(KEY,JSON.stringify(S));mirrorToLegacyV7();}

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

  syncFromLegacyV7();
  window.addEventListener("sondaggi-v7-updated",()=>{
    try{
      syncFromLegacyV7();
      localStorage.setItem(KEY,JSON.stringify(S));
      render();
    }catch(err){console.error("Sync aggiornamento Sondaggi v7",err);}
  });

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

  function normalizedCollegeSeatMap(chamber,bonusActive){
    const src=chamber==="camera"?CAM_COLLEGI:SEN_COLLEGI;
    const out=new Map();
    Object.entries(src).forEach(([region,items])=>{
      (items||[]).forEach(raw=>{
        const parts=String(raw).split("|");
        const name=parts[0];
        const special=String(parts[3]||"").toUpperCase()==="SPECIAL" || (chamber==="senato" && name.includes(" - U"));
        const seats=Number(bonusActive?(parts[2]??parts[1]):parts[1])||0;
        out.set(region+"|"+name,{seats,special});
      });
    });
    return out;
  }

  function collegesFor(chamber,region){
    const src=chamber==="camera"?CAM_COLLEGI:SEN_COLLEGI;
    const bonusActive=!!bonusTarget();
    const normalized=normalizedCollegeSeatMap(chamber,bonusActive);
    return (src[region]||[]).map(x=>{
      const parts=String(x).split("|");
      const name=parts[0];
      const rec=normalized.get(region+"|"+name)||{seats:0,special:false};
      return {
        name,
        seats:Number(rec.seats)||0,
        special:!!rec.special,
        noBonusSeats:Number(parts[1])||0,
        bonusSeats:Number(parts[2]??parts[1])||0,
        provisional:chamber==="senato"
      };
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
    S.coalitions.forEach(x=>{
      if(x.id!==id)x.members=(x.members||[]).filter(k=>k!==slug);
    });
    c.members=(c.members||[]).includes(slug)
      ?c.members.filter(k=>k!==slug)
      :[...(c.members||[]),slug];
    save();render();
  }

  function removeCoalition(id){
    S.coalitions=S.coalitions.filter(c=>c.id!==id);
    save();render();
  }

  function senate20Exception(slug,regionContext){
    if(!slug||!regionContext)return false;
    try{return Number(S.regionalSenate?.[regionContext]?.[slug]||0)>=20;}
    catch(_){return false;}
  }

  function senate20ExceptionAny(slug){
    if(!slug)return false;
    return SENATE_PROP_REGIONS.some(region=>senate20Exception(slug,region));
  }

  function coalitionFigure(members,values,chamber,regionContext=null){
    const all=[...(members||[])];
    const admitted=all.filter(k=>
      (values[k]||0)>=3 ||
      (chamber==="senato" && (regionContext?senate20Exception(k,regionContext):senate20ExceptionAny(k)))
    );
    const admittedTotal=admitted.reduce((sum,k)=>sum+(values[k]||0),0);
    const qualifies=admitted.length>0&&admittedTotal>=10;
    const nationalValues=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(chamber==="camera"?S.parties[k].camera:S.parties[k].senate)]));
    const below=all.filter(k=>!admitted.includes(k)).sort((a,b)=>(nationalValues[b]||0)-(nationalValues[a]||0)||String(a).localeCompare(String(b),"it"));
    const ripCandidate=qualifies?(below[0]||null):null;
    const total=admittedTotal+(ripCandidate?(values[ripCandidate]||0):0);
    return {total,admitted,ripCandidate,qualifies};
  }

  function allocationUnits(values,chamber,regionContext=null){
    const cmap=coalitionMap();
    const units=[];
    const admittedByCoalition=new Map();
    const coalStats=[];

    S.coalitions.forEach(c=>{
      const members=(c.members||[]).filter(k=>values[k]!=null);
      if(!members.length)return;
      const stats=coalitionFigure(members,values,chamber,regionContext);
      if(!stats.qualifies)return;

      const admitted=[...stats.admitted];
      const rip=stats.ripCandidate;
      if(rip&&!admitted.includes(rip))admitted.push(rip);

      admittedByCoalition.set(c.id,admitted);
      units.push({id:"C:"+c.id,type:"coalition",coalitionId:c.id,members:admitted,votes:stats.total,name:c.name});
      coalStats.push({id:c.id,members,figure:stats.total,admitted});
    });

    const coalitionIds=new Set(coalStats.map(c=>c.id));
    Object.keys(values).forEach(k=>{
      if(cmap[k]&&coalitionIds.has(cmap[k]))return;
      const v=values[k]||0;
      const eligible=v>=3 || (chamber==="senato" && (regionContext?senate20Exception(k,regionContext):senate20ExceptionAny(k)));
      if(eligible)units.push({id:"P:"+k,type:"list",members:[k],votes:v,name:k});
    });

    return {units,admittedByCoalition,coalStats};
  }

  function hamilton(items,seats){
    const clean=(items||[]).filter(x=>(Number(x.votes)||0)>0);
    const out={};
    if(!clean.length||seats<=0)return out;
    const total=clean.reduce((sum,x)=>sum+(Number(x.votes)||0),0);
    if(total<=0)return out;
    clean.forEach(x=>{out[x.id]=Math.floor(seats*(Number(x.votes)||0)/total);});
    let used=Object.values(out).reduce((sum,v)=>sum+v,0);
    clean.map(x=>{
      const q=seats*(Number(x.votes)||0)/total;
      return {id:x.id,rest:q-Math.floor(q),votes:Number(x.votes)||0};
    }).sort((a,b)=>b.rest-a.rest||b.votes-a.votes||String(a.id).localeCompare(String(b.id),"it"))
      .slice(0,Math.max(0,seats-used)).forEach(x=>{out[x.id]=(out[x.id]||0)+1;});
    return out;
  }

  function splitCoalitionSeats(unit,seatCount,values){
    if(!unit||unit.type!=="coalition")return {[unit?.members?.[0]||unit?.id]:seatCount};
    const items=(unit.members||[]).map(k=>({id:k,votes:values[k]||0}));
    return hamilton(items,seatCount);
  }

  function eligibility(values,chamber,regionContext=null){
    const {units,admittedByCoalition,coalStats}=allocationUnits(values,chamber,regionContext);
    const ok=[];
    units.forEach(u=>(u.members||[]).forEach(k=>{if(!ok.includes(k))ok.push(k);}));
    const coalTotals={};
    coalStats.forEach(c=>{coalTotals[c.id]=c.figure;});
    return {ok,coalTotals,units,admittedByCoalition};
  }

  function allocate(values,seats,chamber,regionContext=null){
    const plan=allocationUnits(values,chamber,regionContext);
    const unitItems=plan.units.map(u=>({id:u.id,votes:u.votes}));
    const unitSeats=hamilton(unitItems,seats);
    const out={};
    plan.units.forEach(u=>{
      const count=unitSeats[u.id]||0;
      if(!count)return;
      if(u.type==="coalition"){
        const split=splitCoalitionSeats(u,count,values);
        Object.entries(split).forEach(([k,v])=>{out[k]=(out[k]||0)+v;});
      }else{
        const k=u.members[0];
        out[k]=(out[k]||0)+count;
      }
    });
    return {seats:out,eligible:plan.units.flatMap(u=>u.members),coalTotals:Object.fromEntries(plan.coalStats.map(c=>[c.id,c.figure])),units:plan.units,unitSeats,admittedByCoalition:plan.admittedByCoalition};
  }

  function bonusTarget(){
    const cam=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].camera)]));
    const sen=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
    const camPlan=allocationUnits(cam,"camera");
    const senPlan=allocationUnits(sen,"senato");
    const allIds=[...new Set(camPlan.units.map(u=>u.id).concat(senPlan.units.map(u=>u.id)))];
    const cm=new Map(camPlan.units.map(u=>[u.id,u]));
    const sm=new Map(senPlan.units.map(u=>[u.id,u]));
    const candidates=allIds.map(id=>{
      const c=cm.get(id),s=sm.get(id);
      if(!c||!s)return null;
      return {...c,cam:c.votes,sen:s.votes,members:c.members};
    }).filter(Boolean).filter(b=>b.cam>=42&&b.sen>=42);
    if(!candidates.length)return null;
    candidates.sort((a,b)=>Math.min(b.cam,b.sen)-Math.min(a.cam,a.sen)||Math.max(b.cam,b.sen)-Math.max(a.cam,a.sen)||String(a.id).localeCompare(String(b.id),"it"));
    const best=candidates[0];
    const topCam=Math.max(...camPlan.units.map(u=>u.votes),0);
    const topSen=Math.max(...senPlan.units.map(u=>u.votes),0);
    if(best.cam<topCam||best.sen<topSen)return null;
    return best;
  }

  const SPECIAL_SEATS={
    camera:{estero:8,valleDAosta:1,trentinoAltoAdige:7,total:16,proportional:384},
    senato:{estero:4,valleDAosta:1,trentinoAltoAdige:6,total:11,proportional:189}
  };

  const SPECIAL_CATS=["estero","valleDAosta","trentinoAltoAdige"];

  function specialSeatState(){
    const out={camera:{},senato:{}};
    ["camera","senato"].forEach(ch=>{
      SPECIAL_CATS.forEach(cat=>{out[ch][cat]={};});
    });
    return out;
  }

  function senateRegionSeatInfo(region){
    const src=SEN_COLLEGI[region]||[];
    let total=0;
    src.forEach(raw=>{
      const p=String(raw).split("|");
      if(String(p[3]||"").toUpperCase()!=="SPECIAL")total+=Number(p[1])||0;
    });
    const premium=Number(SENATE_PREMIO_REGIONI[region]||0);
    return {total,withPrize:Math.max(0,total-premium),premium};
  }

  function senateRegionalValues(region){
    const out={};
    S.regionalSenate[region]??={};
    Object.keys(S.parties).forEach(k=>{
      if(S.regionalSenate[region][k]==null)S.regionalSenate[region][k]=num(S.parties[k].senate);
      out[k]=num(S.regionalSenate[region][k]);
    });
    return out;
  }

  function isRegionalCustom(region){
    return !!S.regionalCustom?.[region];
  }

  function hamiltonDetailed(items,seats){
    const clean=(items||[]).filter(x=>(Number(x.votes)||0)>0);
    const out={},remainders={},remainderWinners=new Set();
    if(!clean.length||seats<=0)return {seats:out,remainders,remainderWinners,total:0,quota:0};
    const total=clean.reduce((sum,x)=>sum+(Number(x.votes)||0),0);
    if(total<=0)return {seats:out,remainders,remainderWinners,total,quota:0};
    const quota=total/seats;
    clean.forEach(x=>{
      const exact=(Number(x.votes)||0)/quota;
      out[x.id]=Math.floor(exact);
      remainders[x.id]=exact-Math.floor(exact);
    });
    const used=Object.values(out).reduce((sum,v)=>sum+v,0);
    clean.map(x=>({id:x.id,rest:remainders[x.id]||0,votes:Number(x.votes)||0}))
      .sort((a,b)=>b.rest-a.rest||b.votes-a.votes||String(a.id).localeCompare(String(b.id),"it"))
      .slice(0,Math.max(0,seats-used))
      .forEach(x=>{out[x.id]=(out[x.id]||0)+1;remainderWinners.add(x.id);});
    return {seats:out,remainders,remainderWinners,total,quota};
  }

  function regionalSenateUnits(region,regionalValues,nationalPlan){
    const units=[];
    const nationalCoalitions=new Set(nationalPlan.units.filter(u=>u.type==="coalition").map(u=>u.coalitionId));
    const used=new Set();
    const cmap=coalitionMap();

    nationalPlan.units.forEach(nu=>{
      if(nu.type==="coalition"){
        const coalition=coalitionFor(nu.coalitionId);
        const allMembers=(coalition?.members||[]).filter(k=>regionalValues[k]!=null);

        // 2-bis: nella ripartizione entrano le liste della coalizione che
        // raggiungono il 3% nazionale oppure il 20% nella regione. 2-ter:
        // una sola lista ulteriore sotto soglia, la più forte a livello
        // nazionale, già presente in nu.members.
        const admitted=new Set(nu.members||[]);
        allMembers.forEach(k=>{if(regionalValues[k]>=20)admitted.add(k);});
        const splitMembers=[...admitted].filter(k=>allMembers.includes(k));
        const figure=splitMembers.reduce((sum,k)=>sum+(regionalValues[k]||0),0);

        if(figure>0){
          units.push({
            id:nu.id,type:"coalition",coalitionId:nu.coalitionId,name:nu.name,
            members:splitMembers,votes:figure
          });
        }

        // Le liste della stessa coalizione non ammesse non vengono
        // trasformate in liste autonome nella medesima regione.
        allMembers.forEach(k=>used.add(k));
      }else{
        const k=nu.members?.[0],v=regionalValues[k]||0;
        if(k&&v>0){
          units.push({id:nu.id,type:"list",members:[k],votes:v,name:nu.name});
          used.add(k);
        }
      }
    });

    // Eccezione regionale del 20% per liste non già comprese in una
    // coalizione nazionale ammessa.
    Object.keys(regionalValues).forEach(k=>{
      const v=regionalValues[k]||0;
      if(v<20||used.has(k))return;
      const coalId=cmap[k];
      if(coalId&&nationalCoalitions.has(coalId))return;
      units.push({id:"P:"+k,type:"list",members:[k],votes:v,name:k});
      used.add(k);
    });
    return units;
  }

  function splitRegionalUnit(unit,count,regionalValues){
    if(!unit||count<=0)return {};
    if(unit.type!=="coalition")return {[unit.members[0]]:count};
    return hamilton((unit.members||[]).map(k=>({id:k,votes:regionalValues[k]||0})),count);
  }

  function simulateSenateRegions(usePrize){
    const nationalValues=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
    const nationalPlan=allocationUnits(nationalValues,"senato");
    const bonus=bonusTarget();
    const winnerId=bonus?.id||null;
    const regionResults={};

    SENATE_PROP_REGIONS.forEach(region=>{
      const vals=senateRegionalValues(region);
      const info=senateRegionSeatInfo(region);
      const seats=usePrize?info.withPrize:info.total;
      const units=regionalSenateUnits(region,vals,nationalPlan);
      const detailed=hamiltonDetailed(units.map(u=>({id:u.id,votes:u.votes})),seats);
      regionResults[region]={
        region,seats,totalRegionSeats:info.total,premiumSeats:usePrize?info.premium:0,
        units,unitSeats:{...detailed.seats},remainders:{...detailed.remainders},
        remainderWinners:new Set(detailed.remainderWinners),
        premiumWinner:0,premiumResidual:usePrize?info.premium:0
      };
    });

    const winnerUnit=winnerId
      ?SENATE_PROP_REGIONS.map(r=>regionResults[r].units.find(u=>u.id===winnerId)).find(Boolean)
      :null;
    const winnerTerritorial=winnerUnit
      ?winnerUnit.members.reduce((sum,k)=>sum+specialNonEsteroPartySeats("senato",k),0)
      :(winnerId?specialNonEsteroPartySeats("senato",winnerId):0);

    let winnerOrdinary=SENATE_PROP_REGIONS.reduce((sum,r)=>sum+(regionResults[r].unitSeats[winnerId]||0),0);
    let winnerPremium=0;
    let ordinaryRedistributed=0;

    if(usePrize&&winnerId){
      // I 35 seggi-premio sono collocati nelle regioni in cui l'unità vincente
      // è presente. La graduatoria è deterministica e usa forza regionale,
      // quota ordinaria e resto di Hamilton.
      const candidateSlots=[];
      SENATE_PROP_REGIONS.forEach(region=>{
        const rr=regionResults[region];
        const unit=rr.units.find(u=>u.id===winnerId);
        if(!unit||rr.premiumSeats<=0)return;
        const ordinary=rr.unitSeats[winnerId]||0;
        const score=(Number(unit.votes)||0)/(ordinary+1);
        const rest=rr.remainders[winnerId]||0;
        for(let n=0;n<rr.premiumSeats;n++){
          candidateSlots.push({region,score,rest,votes:Number(unit.votes)||0,ordinal:n});
        }
      });
      candidateSlots.sort((a,b)=>
        b.score-a.score||b.rest-a.rest||b.votes-a.votes||a.region.localeCompare(b.region,"it")||a.ordinal-b.ordinal
      );

      const winnerSlots=Math.min(35,candidateSlots.length);
      const byRegion={};
      candidateSlots.slice(0,winnerSlots).forEach(x=>{byRegion[x.region]=(byRegion[x.region]||0)+1;});
      winnerPremium=Object.values(byRegion).reduce((sum,v)=>sum+v,0);

      SENATE_PROP_REGIONS.forEach(region=>{
        const rr=regionResults[region];
        rr.premiumWinner=byRegion[region]||0;
        rr.premiumResidual=Math.max(0,rr.premiumSeats-rr.premiumWinner);
      });

      // Tetto complessivo di 113: per il vincitore contiamo anche i seggi
      // speciali non-estero già assegnati ai suoi membri.
      let excess=Math.max(0,(winnerOrdinary+winnerPremium+winnerTerritorial)-113);

      if(excess>0){
        // Togliamo i seggi ordinari eccedenti e poi li riassegniamo
        // nello stesso territorio con Hamilton, così la somma regionale
        // resta invariata.
        const removalSlots=[];
        SENATE_PROP_REGIONS.forEach(region=>{
          const rr=regionResults[region];
          const count=rr.unitSeats[winnerId]||0;
          const rest=rr.remainders[winnerId]||0;
          const unit=rr.units.find(u=>u.id===winnerId);
          const votes=Number(unit?.votes||0);
          for(let n=0;n<count;n++) removalSlots.push({region,rest,votes,ordinal:n});
        });
        removalSlots.sort((a,b)=>
          a.rest-b.rest||a.votes-b.votes||a.region.localeCompare(b.region,"it")||a.ordinal-b.ordinal
        );

        const removedByRegion={};
        for(const slot of removalSlots){
          if(excess<=0)break;
          const rr=regionResults[slot.region];
          if((rr.unitSeats[winnerId]||0)<=0)continue;
          rr.unitSeats[winnerId]-=1;
          removedByRegion[slot.region]=(removedByRegion[slot.region]||0)+1;
          excess--;
          ordinaryRedistributed++;
        }

        Object.entries(removedByRegion).forEach(([region,removed])=>{
          const rr=regionResults[region];
          const alternatives=rr.units.filter(u=>u.id!==winnerId);
          if(!alternatives.length)return;
          const alloc=hamilton(alternatives.map(u=>({id:u.id,votes:u.votes})),removed);
          alternatives.forEach(u=>{
            const count=alloc[u.id]||0;
            if(count)rr.unitSeats[u.id]=(rr.unitSeats[u.id]||0)+count;
          });
        });
      }
    }

    const partySeats={},ordinaryPartySeats={},prizePartySeats={},regionPartySeats={},regionUnitSeats={};
    SENATE_PROP_REGIONS.forEach(region=>{
      const rr=regionResults[region],vals=senateRegionalValues(region);
      regionPartySeats[region]={};regionUnitSeats[region]={};

      Object.entries(rr.unitSeats).forEach(([unitId,count])=>{
        const unit=rr.units.find(u=>u.id===unitId);
        if(!unit||!count)return;
        regionUnitSeats[region][unitId]=count;
        const split=splitRegionalUnit(unit,count,vals);
        Object.entries(split).forEach(([k,v])=>{
          partySeats[k]=(partySeats[k]||0)+v;
          ordinaryPartySeats[k]=(ordinaryPartySeats[k]||0)+v;
          regionPartySeats[region][k]=(regionPartySeats[region][k]||0)+v;
        });
      });

      if(usePrize&&winnerId){
        const winCount=rr.premiumWinner||0;
        if(winCount){
          const win=rr.units.find(u=>u.id===winnerId);
          const split=splitRegionalUnit(win,winCount,vals);
          Object.entries(split).forEach(([k,v])=>{
            partySeats[k]=(partySeats[k]||0)+v;
            prizePartySeats[k]=(prizePartySeats[k]||0)+v;
            regionPartySeats[region][k]=(regionPartySeats[region][k]||0)+v;
          });
        }

        const residual=rr.premiumResidual||0;
        if(residual){
          const alternatives=rr.units.filter(u=>u.id!==winnerId);
          const alloc=hamilton(alternatives.map(u=>({id:u.id,votes:u.votes})),residual);
          alternatives.forEach(u=>{
            const count=alloc[u.id]||0;
            if(!count)return;
            const split=splitRegionalUnit(u,count,vals);
            Object.entries(split).forEach(([k,v])=>{
              partySeats[k]=(partySeats[k]||0)+v;
              prizePartySeats[k]=(prizePartySeats[k]||0)+v;
              regionPartySeats[region][k]=(regionPartySeats[region][k]||0)+v;
            });
          });
        }
      }
    });

    const premiumRedistributed=usePrize
      ?SENATE_PROP_REGIONS.reduce((sum,r)=>sum+(regionResults[r].premiumResidual||0),0)
      :0;
    const simulatedTotal=Object.values(partySeats).reduce((sum,v)=>sum+v,0);
    return {
      seats:partySeats,ordinarySeatsByParty:ordinaryPartySeats,prizeSeatsByParty:prizePartySeats,
      regions:regionResults,regionPartySeats,regionUnitSeats,nationalPlan,
      complete:SENATE_PROP_REGIONS.every(r=>Object.keys(senateRegionalValues(r)).length===Object.keys(S.parties).length),
      regionCount:SENATE_PROP_REGIONS.length,
      customizedRegions:SENATE_PROP_REGIONS.filter(isRegionalCustom).length,
      ordinarySeats:usePrize?154:189,premiumSeats:usePrize?35:0,
      winnerOrdinary,winnerPremiumSeats:usePrize?winnerPremium:0,
      premiumWinnerSeats:usePrize?winnerPremium:0,
      premiumRedistributed,
      ordinaryRedistributed,simulatedTotal
    };
  }

  function specialPartyTotal(chamber,slug,includeEstero=true){
    if(!slug)return 0;
    const cats=includeEstero?SPECIAL_CATS:SPECIAL_CATS.filter(x=>x!=="estero");
    return cats.reduce((sum,cat)=>sum+Number(S.specialSeats?.[chamber]?.[cat]?.[slug]||0),0);
  }

  function specialAssigned(chamber,cat){
    return Object.values(S.specialSeats?.[chamber]?.[cat]||{}).reduce((sum,v)=>sum+Number(v||0),0);
  }

  function specialUnassigned(chamber,cat){
    return Math.max(0,Number(SPECIAL_SEATS[chamber]?.[cat]||0)-specialAssigned(chamber,cat));
  }

  function specialNonEsteroPartySeats(chamber,slug){
    return specialPartyTotal(chamber,slug,false);
  }

  function specialPartyTotal(chamber,slug,includeEstero=true){
    if(!slug)return 0;
    const cats=includeEstero?SPECIAL_CATS:SPECIAL_CATS.filter(x=>x!=="estero");
    return cats.reduce((sum,cat)=>sum+Number(S.specialSeats?.[chamber]?.[cat]?.[slug]||0),0);
  }

  function specialAssigned(chamber,cat){
    return Object.values(S.specialSeats?.[chamber]?.[cat]||{}).reduce((sum,v)=>sum+Number(v||0),0);
  }

  function specialUnassigned(chamber,cat){
    return Math.max(0,Number(SPECIAL_SEATS[chamber]?.[cat]||0)-specialAssigned(chamber,cat));
  }

  function specialNonEsteroPartySeats(chamber,slug){
    return specialPartyTotal(chamber,slug,false);
  }

  function nationalResults(){
    const camVals=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].camera)]));
    const senVals=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
    const bonus=bonusTarget();
    const cam={seats:{},ordinarySeatsByParty:{},prizeSeatsByParty:{},eligible:[],coalTotals:{}};
    const sen={seats:{},ordinarySeatsByParty:{},prizeSeatsByParty:{},eligible:[],coalTotals:{}};
    const camPlan=allocationUnits(camVals,"camera");

    function addSeatMap(target,source){
      Object.entries(source||{}).forEach(([k,v])=>{if(v)target[k]=(target[k]||0)+v;});
    }

    function addUnitResult(res,unit,count,values,regionValues,kind){
      if(!unit||count<=0)return;
      const split=regionValues?splitRegionalUnit(unit,count,regionValues):splitCoalitionSeats(unit,count,values);
      Object.entries(split).forEach(([k,v])=>{
        res.seats[k]=(res.seats[k]||0)+v;
        const bucket=kind==="prize"?res.prizeSeatsByParty:res.ordinarySeatsByParty;
        bucket[k]=(bucket[k]||0)+v;
      });
    }

    if(!bonus){
      const camBase=allocate(camVals,384,"camera");
      Object.assign(cam,camBase);
      cam.ordinarySeatsByParty={...camBase.seats};
      cam.prizeSeatsByParty={};
      Object.assign(sen,simulateSenateRegions(false));
      sen.ordinarySeatsByParty={...sen.ordinarySeatsByParty};
      sen.prizeSeatsByParty={...sen.prizeSeatsByParty};
      cam.premiumSeats=0;cam.bonusSeats=0;cam.prizeWinnerSeats=0;cam.ordinarySeats=384;
      sen.premiumSeats=0;sen.bonusSeats=0;sen.prizeWinnerSeats=0;
    }else{
      // Il premio è fisso: prima si ripartiscono 314 seggi ordinari e poi
      // 70 seggi-premio. Se il vincitore supera il tetto di 220, l'eccedenza
      // viene sottratta dalla sua quota proporzionale, non dal premio.
      const camBase=allocate(camVals,314,"camera");
      cam.seats={...camBase.seats};
      cam.ordinarySeatsByParty={...camBase.seats};

      const camWin=camPlan.units.find(u=>u.id===bonus.id);
      const winnerOrdinary=camWin?(camWin.members||[]).reduce((sum,k)=>sum+(camBase.seats[k]||0),0):0;
      const winnerTerritorial=camWin?(camWin.members||[]).reduce((sum,k)=>sum+specialNonEsteroPartySeats("camera",k),0):0;

      // Distribuzione del premio fisso di 70 all'unità vincente.
      if(camWin)addUnitResult(cam,camWin,70,camVals,null,"prize");

      const excess=Math.max(0,winnerOrdinary+70+winnerTerritorial-220);
      if(excess>0&&camWin){
        const removable=(camWin.members||[]).map(k=>({k,seats:cam.ordinarySeatsByParty[k]||0})).filter(x=>x.seats>0)
          .sort((a,b)=>b.seats-a.seats||String(a.k).localeCompare(String(b.k),"it"));
        let left=excess;
        for(const item of removable){
          while(item.seats>0&&left>0){
            cam.ordinarySeatsByParty[item.k]-=1;
            item.seats--;left--;
          }
          if(left<=0)break;
        }
        // Le eccedenze sottratte al vincitore tornano nel riparto ordinario
        // e vengono assegnate agli altri soggetti secondo Hamilton.
        const others=camPlan.units.filter(u=>u.id!==bonus.id);
        const redis=hamilton(others.map(u=>({id:u.id,votes:u.votes})),excess);
        others.forEach(u=>{
          const count=redis[u.id]||0;
          if(!count)return;
          const split=u.type==="coalition"?splitCoalitionSeats(u,count,camVals):{[u.members[0]]:count};
          Object.entries(split).forEach(([k,v])=>{cam.ordinarySeatsByParty[k]=(cam.ordinarySeatsByParty[k]||0)+v;});
        });
        cam.ordinaryRedistributed=excess;
      }else cam.ordinaryRedistributed=0;

      cam.seats={};
      addSeatMap(cam.seats,cam.ordinarySeatsByParty);
      addSeatMap(cam.seats,cam.prizeSeatsByParty);
      cam.premiumSeats=70;cam.bonusSeats=70;cam.prizeWinnerSeats=70;cam.prizeRedistributed=0;cam.ordinarySeats=314;

      Object.assign(sen,simulateSenateRegions(true));
      sen.premiumSeats=35;sen.bonusSeats=35;
      sen.prizeWinnerSeats=sen.premiumWinnerSeats||0;
      sen.prizeRedistributed=sen.premiumRedistributed||0;
      sen.ordinarySeats=154;
    }

    cam.eligible=camPlan.units.flatMap(u=>u.members);
    cam.units=camPlan.units;
    cam.coalTotals=Object.fromEntries(camPlan.coalStats.map(c=>[c.id,c.figure]));
    const senPlan=allocationUnits(senVals,"senato");
    sen.eligible=senPlan.units.flatMap(u=>u.members);
    sen.units=senPlan.units;
    sen.coalTotals=Object.fromEntries(senPlan.coalStats.map(c=>[c.id,c.figure]));
    return {cam,sen,bonus,special:{camera:{...SPECIAL_SEATS.camera},senato:{...SPECIAL_SEATS.senato}}};
  }

  function saveValue(slug,kind,value){
    if(!S.parties[slug])return;
    if(kind==="camera")S.parties[slug].camera=num(value);
    if(kind==="senate"){
      S.parties[slug].senate=num(value);
      SENATE_PROP_REGIONS.forEach(region=>{
        if(!S.regionalCustom[region]){
          S.regionalSenate[region]??={};
          S.regionalSenate[region][slug]=S.parties[slug].senate;
        }
      });
    }
    if(kind==="region"){
      S.regionalSenate[S.region]??={};
      S.regionalSenate[S.region][slug]=num(value);
      S.regionalCustom[S.region]=true;
    }
    if(kind==="college"){
      S.collegeValues[S.chamber]??={};
      S.collegeValues[S.chamber][S.college]??={};
      S.collegeValues[S.chamber][S.college][slug]=num(value);
    }
    save();
  }

  function saveSpecialSeat(slug,chamber,cat,value){
    if(!S.parties[slug]||!SPECIAL_CATS.includes(cat))return;
    S.specialSeats[chamber]??=specialSeatState()[chamber];
    S.specialSeats[chamber][cat]??={};
    const cap=Number(SPECIAL_SEATS[chamber]?.[cat]||0);
    const others=Object.entries(S.specialSeats[chamber][cat]).filter(([k])=>k!==slug).reduce((sum,[,v])=>sum+Number(v||0),0);
    const wanted=Math.max(0,Math.floor(num(value)));
    S.specialSeats[chamber][cat][slug]=Math.min(cap-others,wanted);
    if(S.specialSeats[chamber][cat][slug]<=0)delete S.specialSeats[chamber][cat][slug];
    save();render();
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
    const senateComplete=SENATE_PROP_REGIONS.every(r=>Object.keys(senateRegionalValues(r)).length===partyKeys.length);
    const senateCustomRegions=SENATE_PROP_REGIONS.filter(isRegionalCustom).length;

    const partyRows=partyKeys.map(k=>{
      const p=S.parties[k],cid=coalitionMap()[k];
      return '<tr><td><b>'+esc2(p.name)+'</b><small>'+esc2(k)+'</small></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="camera" type="number" step="0.1" min="0" max="100" value="'+num(p.camera).toFixed(1)+'"></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="senate" type="number" step="0.1" min="0" max="100" value="'+num(p.senate).toFixed(1)+'"></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="region" type="number" step="0.1" min="0" max="100" value="'+num(rVals[k]).toFixed(1)+'"></td>'+
        '<td><input data-sv="'+esc2(k)+'" data-kind="college" type="number" step="0.1" min="0" max="100" value="'+num(cVals[k]).toFixed(1)+'"></td>'+
        '<td>'+(cid?esc2(coalitionFor(cid)?.name||""):"—")+'</td></tr>';
    }).join("");

    const nationalCamera=Object.fromEntries(partyKeys.map(k=>[k,num(S.parties[k].camera)]));
    const nationalSenate=Object.fromEntries(partyKeys.map(k=>[k,num(S.parties[k].senate)]));
    const coalRows=S.coalitions.map(co=>{
      const camTotal=coalitionFigure(co.members,nationalCamera,"camera").total;
      const senTotal=coalitionFigure(co.members,nationalSenate,"senato").total;
      const totalLabel="Camera "+fmt(camTotal)+"% · Senato "+fmt(senTotal)+"%";
      const members=partyKeys.map(k=>
        '<label><input type="checkbox" data-member="'+esc2(co.id)+'" data-party="'+esc2(k)+'" '+((co.members||[]).includes(k)?"checked":"")+'>'+esc2(S.parties[k].name)+'</label>'
      ).join("");
      return '<div class="sg-coal"><div class="sg-coal-head"><b>'+esc2(co.name)+'</b><strong>'+esc2(totalLabel)+'</strong><button type="button" data-coal-del="'+esc2(co.id)+'">Elimina</button></div><div class="sg-members">'+members+'</div></div>';
    }).join("")||'<div class="sg-empty">Nessuna coalizione definita. Crea una coalizione e assegna le liste.</div>';

    function resultRows(res,type){
      const vals=type==="camera"?Object.fromEntries(partyKeys.map(k=>[k,S.parties[k].camera])):Object.fromEntries(partyKeys.map(k=>[k,S.parties[k].senate]));
      return Object.entries(res.seats).sort((a,b)=>b[1]-a[1]).map(([k,seats])=>
        '<tr><td>'+esc2(S.parties[k]?.name||k)+'</td><td>'+num(vals[k]).toFixed(1)+'%</td><td><b>'+fmt0(seats)+'</b></td></tr>'
      ).join("")||'<tr><td colspan="3">Nessun partito supera le soglie con i valori inseriti.</td></tr>';
    }

    function coalitionResultRows(res,type){
      return S.coalitions.map(co=>{
        const members=new Set(co.members||[]);
        const seats=(Object.entries(res.seats||{}).filter(([k])=>members.has(k)).reduce((sum,[,v])=>sum+Number(v||0),0));
        const values=Object.fromEntries(partyKeys.map(k=>[k,num(type==="camera"?S.parties[k]?.camera:S.parties[k]?.senate)]));
        const total=coalitionFigure(co.members,values,type==="camera"?"camera":"senato").total;
        return {name:co.name,seats,total};
      }).filter(x=>x.seats>0||x.total>0)
        .sort((a,b)=>b.seats-a.seats||b.total-a.total||a.name.localeCompare(b.name,"it"))
        .map(x=>'<tr><td><b>'+esc2(x.name)+'</b></td><td>'+x.total.toFixed(1).replace(".",",")+'%</td><td><b>'+fmt0(x.seats)+'</b></td></tr>')
        .join("")||'<tr><td colspan="3">Nessuna coalizione con seggi nello scenario.</td></tr>';
    }
    function parliamentRows(res,chamber){
      const totalSeats=chamber==="camera"?400:200;
      const rows=partyKeys.map(k=>{
        const p=S.parties[k];
        const ordinary=Number(res.ordinarySeatsByParty?.[k]||0);
        const prize=Number(res.prizeSeatsByParty?.[k]||0);
        const territorial=specialPartyTotal(chamber,k,true);
        return {
          k,name:p?.name||k,pct:Number(chamber==="camera"?p.camera:p.senate)||0,
          ordinary,prize,territorial,total:ordinary+prize+territorial
        };
      }).sort((a,b)=>b.total-a.total||b.pct-a.pct||a.name.localeCompare(b.name,"it"));
      const assigned=rows.reduce((sum,x)=>sum+x.total,0);
      const pending=Math.max(0,totalSeats-assigned);
      return {
        rows:rows.map(x=>'<tr><td><b>'+esc2(x.name)+'</b><small>'+esc2(x.k)+'</small></td><td>'+x.pct.toFixed(1).replace(".",",")+'%</td><td>'+fmt0(x.ordinary)+'</td><td>'+fmt0(x.prize)+'</td><td>'+fmt0(x.territorial)+'</td><td><b>'+fmt0(x.total)+'</b></td></tr>').join("")+
          '<tr class="sg-pending-row"><td><b>Seggi da assegnare</b></td><td>—</td><td>—</td><td>—</td><td>—</td><td><b>'+fmt0(pending)+'</b></td></tr>',
        assigned,pending,total:totalSeats
      };
    }

    function specialEditor(chamber){
      const cats=[
        ["estero","Estero"],["valleDAosta","Valle d'Aosta"],["trentinoAltoAdige","Trentino-Alto Adige"]
      ];
      const assigned=Object.fromEntries(cats.map(([cat])=>[cat,specialAssigned(chamber,cat)]));
      return '<div class="sg-special-editor"><div class="sg-card-title"><b>Seggi fuori dal riparto proporzionale</b><span>'+ (chamber==="camera"?"Camera · 16":"Senato · 11") +'</span></div>'+
        '<div class="sg-note">Questi seggi non sono deducibili dal solo sondaggio nazionale. Inserisci qui gli eletti delle circoscrizioni territoriali/speciali. Estero non entra nel tetto di 220/113; Valle d\'Aosta e Trentino-Alto Adige sì.</div>'+
        '<div class="sg-special-totals">'+cats.map(([cat,label])=>'<span><b>'+assigned[cat]+'/'+Number(SPECIAL_SEATS[chamber][cat]||0)+'</b><small>'+label+'</small></span>').join("")+'</div>'+
        '<div class="sg-table-wrap"><table class="sg-table sg-special-table"><thead><tr><th>Partito</th>'+cats.map(([,label])=>'<th>'+label+'</th>').join("")+'<th>Totale</th></tr></thead><tbody>'+
        partyKeys.map(k=>{
          const name=esc2(S.parties[k]?.name||k);
          const cells=cats.map(([cat])=>'<td><input data-special="'+esc2(k)+'" data-special-ch="'+chamber+'" data-special-cat="'+cat+'" type="number" min="0" step="1" value="'+Number(S.specialSeats?.[chamber]?.[cat]?.[k]||0)+'"></td>').join("");
          const tot=specialPartyTotal(chamber,k,true);
          return '<tr><td><b>'+name+'</b><small>'+esc2(k)+'</small></td>'+cells+'<td><b>'+fmt0(tot)+'</b></td></tr>';
        }).join("")+
        '</tbody></table></div></div>';
    }



    const collegeAlloc=c?.special
      ? {seats:{},eligible:[]}
      : allocate(cVals,c?.seats||0,S.chamber==="camera"?"camera":"senato",S.chamber==="senato"?S.region:null);
    const collegeRows=c?.special
      ? '<tr><td colspan="3">Collegio speciale: escluso dal riparto proporzionale della simulazione.</td></tr>'
      : Object.entries(collegeAlloc.seats).sort((a,b)=>b[1]-a[1]).map(([k,seats])=>
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
            '<div class="sg-card"><div class="sg-card-title"><b>Gestione sondaggi regionali · Senato</b><span><button type="button" class="sg-btn small" id="sgPropagateNational">PROPAGA NAZIONALE</button></span></div><div class="sg-note">'+(senateComplete?'Dati regionali completi: '+SENATE_PROP_REGIONS.length+'/'+SENATE_PROP_REGIONS.length+' regioni proporzionali valorizzate. ':'Dati regionali incompleti. ')+(senateCustomRegions?senateCustomRegions+' regioni personalizzate rispetto al nazionale. ':'Nessuna regione personalizzata rispetto al nazionale. ')+'Il pulsante PROPAGA NAZIONALE copia i valori del Senato nazionale in tutte le regioni proporzionali.</div><div class="sg-regional-status">'+SENATE_PROP_REGIONS.map(region=>{const info=senateRegionSeatInfo(region),custom=isRegionalCustom(region);return '<button type="button" class="sg-region-status '+(region===S.region?'active ':'')+(custom?'custom':'')+'" data-region-jump="'+esc2(region)+'"><span><b>'+esc2(region)+'</b><small>'+info.total+' seggi'+(info.premium?' · '+info.premium+' premio':'')+'</small></span><em>'+(custom?'PERSONALIZZATA':'NAZIONALE')+'</em></button>';}).join('')+'</div></div>'+
            '<div class="sg-card"><div class="sg-card-title"><b>Coalizioni preimpostate e modificabili</b><span><button type="button" class="sg-btn small" id="sgNewCoal">+ NUOVA COALIZIONE</button></span></div><div class="sg-note">Le coalizioni di base sono già caricate. Spunta un partito per aggiungerlo o togli la spunta per rimuoverlo; ogni partito può appartenere a una sola coalizione alla volta.</div>'+coalRows+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="sg-results">'+
          '<div class="sg-card"><div class="sg-card-title"><b>COMPOSIZIONE DEL PARLAMENTO</b><span>distribuzione complessiva dei seggi</span></div>'+
            '<div class="sg-two">'+
              '<div><h3>Camera dei deputati · 400</h3><div class="sg-parliament-kpi"><b>'+fmt0(201)+'</b><span>maggioranza assoluta</span><em>Seggi assegnati: '+fmt0(parliamentRows(national.cam,"camera").assigned)+' / 400 · da assegnare: '+fmt0(parliamentRows(national.cam,"camera").pending)+'</em></div>'+
                '<table class="sg-table sg-parliament"><thead><tr><th>Partito</th><th>%</th><th>Ordinari</th><th>Premio</th><th>Fuori riparto</th><th>TOTALE</th></tr></thead><tbody>'+parliamentRows(national.cam,"camera").rows+'</tbody></table>'+
                '<div class="sg-coal-total"><div class="sg-card-title"><b>Riepilogo coalizioni · Camera</b><span>solo seggi già assegnati</span></div><table class="sg-table"><thead><tr><th>Coalizione</th><th>%</th><th>Seggi</th></tr></thead><tbody>'+coalitionResultRows(national.cam,"camera")+'</tbody></table></div>'+
              '</div>'+
              '<div><h3>Senato della Repubblica · 200</h3><div class="sg-parliament-kpi"><b>'+fmt0(101)+'</b><span>maggioranza assoluta</span><em>Seggi assegnati: '+fmt0(parliamentRows(national.sen,"senato").assigned)+' / 200 · da assegnare: '+fmt0(parliamentRows(national.sen,"senato").pending)+'</em></div>'+
                '<table class="sg-table sg-parliament"><thead><tr><th>Partito</th><th>%</th><th>Proporz.</th><th>Fuori riparto</th><th>TOTALE</th></tr></thead><tbody>'+parliamentRows(national.sen,"senato").rows+'</tbody></table>'+
                '<div class="sg-coal-total"><div class="sg-card-title"><b>Riepilogo coalizioni · Senato</b><span>solo seggi già assegnati</span></div><table class="sg-table"><thead><tr><th>Coalizione</th><th>%</th><th>Seggi</th></tr></thead><tbody>'+coalitionResultRows(national.sen,"senato")+'</tbody></table></div>'+
              '</div>'+
            '</div>'+
            '<div class="sg-note">'+(national.bonus?'✅ Premio attivo: Camera '+fmt0(national.cam.prizeWinnerSeats||0)+' seggi-premio al vincitore e '+fmt0(national.cam.prizeRedistributed||0)+' ridistribuiti; Senato '+fmt0(national.sen.prizeWinnerSeats||0)+' al vincitore e '+fmt0(national.sen.prizeRedistributed||0)+' agli altri.':'ℹ️ Nessun premio: i 384 seggi proporzionali della Camera e i 189 del Senato sono ripartiti senza i 70/35 seggi premio.')+'</div>'+
            '<div class="sg-note">CONTROLLO DI QUADRATURA · Camera: '+fmt0(parliamentRows(national.cam,"camera").assigned)+' assegnati + '+fmt0(parliamentRows(national.cam,"camera").pending)+' da assegnare = 400 · Senato: '+fmt0(parliamentRows(national.sen,"senato").assigned)+' assegnati + '+fmt0(parliamentRows(national.sen,"senato").pending)+' da assegnare = 200.</div>'+
          '</div>'+
          '<div class="sg-card">'+specialEditor("camera")+specialEditor("senato")+'</div>'+
          '<div class="sg-card"><div class="sg-card-title"><b>Distribuzione dei seggi modellati</b><span>quote ordinarie + premio; esclusi i seggi speciali non inseriti</span></div><div class="sg-two"><div><h3>Camera · pool nazionale 384</h3><table class="sg-table"><thead><tr><th>Partito</th><th>%</th><th>Seggi modellati</th></tr></thead><tbody>'+resultRows(national.cam,"camera")+'</tbody></table></div><div><h3>Senato · pool nazionale 189</h3><table class="sg-table"><thead><tr><th>Partito</th><th>%</th><th>Seggi modellati</th></tr></thead><tbody>'+resultRows(national.sen,"senato")+'</tbody></table><div class="sg-note">'+(national.sen.complete?'✅ Senato: riparto regione per regione su '+national.sen.regionCount+' regioni proporzionali.':'⚠️ Dati regionali Senato incompleti: risultato provvisorio.')+'</div></div></div></div>'+
          (national.bonus?'<div class="sg-bonus">PREMIO ATTIVO · '+esc2(coalitionFor(national.bonus.id)?.name||national.bonus.members.map(k=>S.parties[k]?.name||k).join(" + "))+' · pool 70 Camera / 35 Senato</div>':'<div class="sg-note">Il premio non scatta: la stessa lista o coalizione deve essere prima e raggiungere almeno il 42% in entrambe le Camere.</div>')+
        '</div>'+
          '<div class="sg-card"><div class="sg-card-title"><b>Distribuzione nel collegio</b><span>'+esc2(c?.name||"")+' · '+fmt0(c?.seats||0)+' seggi</span></div><table class="sg-table"><thead><tr><th>Partito</th><th>% collegio</th><th>Seggi</th></tr></thead><tbody>'+collegeRows+'</tbody></table><div class="sg-note">Il collegio usa le percentuali locali che inserisci. Le assegnazioni nazionali della riforma restano nella simulazione sopra.</div></div>'+
        '</div>'+
        '<div class="sg-source">Partiti e valori iniziali: Supermedia YouTrend/Agi, rilevazione 1 ottobre 2026. Camera: 384 seggi proporzionali, oppure 314 nella base su cui opera il premio. Senato: 189 seggi proporzionali senza premio; con premio, 154 seggi ordinari + 35 seggi premio. Il riparto del Senato è ora calcolato regione per regione sulle '+SENATE_PROP_REGIONS.length+' regioni proporzionali, con deroga del 20% regionale e controllo del tetto di 113 seggi del vincitore. Valle d’Aosta e Trentino-Alto Adige sono gestiti come seggi speciali separati.</div>'+
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

    host.querySelectorAll("[data-special]").forEach(inp=>{
      inp.addEventListener("change",()=>{
        saveSpecialSeat(
          inp.getAttribute("data-special"),
          inp.getAttribute("data-special-ch"),
          inp.getAttribute("data-special-cat"),
          inp.value
        );
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
    document.getElementById("sgPropagateNational").addEventListener("click",()=>{
      const msg="Copiare il sondaggio nazionale del Senato in tutte le "+SENATE_PROP_REGIONS.length+" regioni proporzionali? Le modifiche regionali verranno sovrascritte.";
      if(!confirm(msg))return;
      const nationalVals=Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)]));
      SENATE_PROP_REGIONS.forEach(region=>{S.regionalSenate[region]={...nationalVals};S.regionalCustom[region]=false;});
      save();render();
    });
    host.querySelectorAll("[data-region-jump]").forEach(btn=>btn.addEventListener("click",()=>{
      S.region=btn.getAttribute("data-region-jump")||S.region;
      S.college=collegesFor(S.chamber,S.region)[0]?.name||"";
      save();render();
    }));
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
.sg-coal-total{margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.08)}
.sg-coal-total .sg-card-title{margin-bottom:5px}
.sg-parliament{min-width:860px}.sg-parliament th{text-align:right}.sg-parliament th:first-child{text-align:left}.sg-parliament td:not(:first-child){text-align:right}.sg-parliament td:first-child small{display:block;color:#6f8ca2;font-size:6px;margin-top:2px}.sg-pending-row td{background:#173249;color:#9eb5c5;border-top:1px solid #2d526e}.sg-parliament-kpi{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;align-items:center;background:#102b42;border:1px solid #254b67;border-radius:8px;padding:8px;margin:7px 0}.sg-parliament-kpi b{font-size:20px;color:#fff}.sg-parliament-kpi span{font-size:7px;text-transform:uppercase;font-weight:900;color:#7fa3bd}.sg-parliament-kpi em{grid-column:1/-1;font-size:7px;color:#9eb9ca;font-style:normal}.sg-special-editor{background:#0b1e31;border:1px solid #203d55;border-radius:10px;padding:11px;margin-top:0}.sg-special-editor+.sg-special-editor{margin-top:10px}.sg-special-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}.sg-special-totals span{display:block;background:#102a40;border:1px solid #274a64;border-radius:7px;padding:7px}.sg-special-totals b{display:block;color:#fff;font-size:11px}.sg-special-totals small{display:block;margin-top:2px;color:#7898ae;font-size:6px;text-transform:uppercase}.sg-special-table{min-width:840px}.sg-special-table input{width:54px;box-sizing:border-box;padding:6px 5px}.sg-special-table td,.sg-special-table th{text-align:center}.sg-special-table td:first-child,.sg-special-table th:first-child{text-align:left}.sg-special-table td:first-child small{display:block;color:#6f8ca2;font-size:6px;margin-top:2px}
.sg-regional-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:280px;overflow:auto;margin-top:8px}
.sg-region-status{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid #23465f;background:#0a2135;color:#dcecf6;border-radius:8px;padding:7px 8px;cursor:pointer}
.sg-region-status.active{border-color:#2187ff;box-shadow:0 0 0 1px #2187ff33 inset}
.sg-region-status.custom{background:#11314b;border-color:#2f719e}
.sg-region-status span{min-width:0}.sg-region-status b{display:block;font-size:8px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-region-status small{display:block;margin-top:3px;font-size:6px;color:#7997ad}
.sg-region-status em{font-style:normal;font-size:6px;font-weight:900;color:#6d9fbe;white-space:nowrap}.sg-region-status.custom em{color:#80d1ff}
.sg-source{margin-top:8px;font-size:7px;color:#66859d;line-height:1.4}
@media(max-width:1000px){.sg-layout,.sg-results{grid-template-columns:1fr}.sg-map-card{max-width:none}.sg-map img{height:360px}.sg-controls{grid-template-columns:1fr 1fr}.sg-controls>div:last-child{grid-column:1/-1}}
@media(max-width:820px){.sg-regional-status{grid-template-columns:1fr 1fr;max-height:330px}.sg-head{display:block}.sg-head h1{font-size:22px}.sg-head .sg-btn{width:100%;margin-top:9px}.sg-map img{height:330px}.sg-regions{grid-template-columns:1fr 1fr}.sg-table{min-width:820px}.sg-table input{width:72px}.sg-members{grid-template-columns:1fr 1fr}.sg-controls{grid-template-columns:1fr}.sg-controls>div:last-child{grid-column:auto}.sg-actions{display:grid;grid-template-columns:1fr 1fr}.sg-two{grid-template-columns:1fr}.sg-results{display:block}.sg-results .sg-card{margin-bottom:10px}}`;
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
      data=raw.map(r=>{const cc=(typeof currentComune==="function"?currentComune(r.comune):r.comune);return {...r,comune:cc,geo:geoMap.get(norm(r.prov)+"|"+norm(cc))||null};});
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
    const normalize=(v)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
    const source=(typeof GEO!=="undefined"&&Array.isArray(GEO))?GEO:[];
    const seen=new Set();
    source.forEach(r=>seen.add(normalize(r.prov)+"|"+normalize(r.comune)));
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
  // Allineamento iniziale: la Home usa subito la geografia corrente di 1.501 comuni.
  try{
    if(typeof setElectionData==="function")setElectionData();
    if(typeof render==="function")render();
    refreshHomeForElection();
  }catch(err){console.error("Boot Home geography",err);}

})();



/* ===== FINAL FIX HOME PROVINCE CHART ===== */
(function(){
  function provinceRowsForHome(){
    try{
      const source=(typeof election!=="undefined"&&election==="europee")
        ?(typeof EURO_RAW!=="undefined"&&Array.isArray(EURO_RAW)?EURO_RAW:[])
        :(typeof RAW!=="undefined"&&Array.isArray(RAW)?RAW:[]);
      const sums=Object.create(null);
      source.forEach(r=>{
        const p=String(r?.prov||"").trim().toUpperCase();
        if(!p)return;
        sums[p]=(sums[p]||0)+(Number(r?.preferenze)||0);
      });
      return Object.entries(sums).sort((a,b)=>b[1]-a[1]);
    }catch(err){
      console.error("Home province chart data",err);
      return [];
    }
  }

  function drawHomeProvinceChart(){
    try{
      const canvas=document.getElementById("provChart");
      if(!canvas)return;
      const rows=provinceRowsForHome();
      const w=canvas.clientWidth||700;
      const h=canvas.clientHeight||300;
      const d=Math.max(2,window.devicePixelRatio||1);

      canvas.width=Math.max(1,Math.round(w*d));
      canvas.height=Math.max(1,Math.round(h*d));

      const ctx=canvas.getContext("2d");
      if(!ctx)return;
      ctx.setTransform(d,0,0,d,0,0);
      ctx.clearRect(0,0,w,h);

      if(!rows.length)return;

      const total=rows.reduce((sum,x)=>sum+x[1],0);
      const max=Math.max(...rows.map(x=>x[1]),1);
      const names={
        "MONZA E DELLA BRIANZA":"MONZA E BRIANZA"
      };
      const left=Math.min(225,Math.max(195,w*.32));
      const right=100;
      const top=10;
      const bottom=10;
      const rowH=Math.max(21,(h-top-bottom)/rows.length);
      const barMax=Math.max(45,w-left-right);
      const palette=["#2b8cff","#22c88a","#8b5cf6","#f0a500"];

      rows.forEach((item,i)=>{
        const name=item[0];
        const value=item[1];
        const y=top+i*rowH+rowH/2;
        const barW=barMax*(value/max);

        ctx.textBaseline="middle";
        ctx.textAlign="right";
        ctx.font="600 13px Arial";
        ctx.fillStyle="#d7e5f2";
        ctx.fillText(names[name]||name,left-12,y);

        ctx.fillStyle="rgba(16,44,69,.9)";
        ctx.fillRect(left,y-6,barMax,12);

        ctx.fillStyle=palette[i%palette.length];
        ctx.fillRect(left,y-6,Math.max(4,barW),12);

        ctx.textAlign="left";
        ctx.font="700 13px Arial";
        ctx.fillStyle="#f2f7fb";
        const pct=total?((value/total)*100).toFixed(1)+"%":"0.0%";
        ctx.fillText(value.toLocaleString("it-IT")+" · "+pct,Math.min(left+barW+10,w-96),y);
      });
    }catch(err){
      console.error("Home province chart draw",err);
    }
  }

  function syncHomeProvinceChart(){
    setTimeout(drawHomeProvinceChart,0);
    setTimeout(drawHomeProvinceChart,120);
  }

  const previousDashboardSetMacro=window.dashboardSetMacro;
  window.dashboardSetMacro=function(v){
    if(typeof previousDashboardSetMacro==="function"){
      previousDashboardSetMacro(v);
    }else{
      try{
        if(typeof election!=="undefined")election=v;
        if(typeof setElectionData==="function")setElectionData();
        if(typeof render==="function")render();
      }catch(err){
        console.error("Home macro chart fallback",err);
      }
    }
    syncHomeProvinceChart();
  };

  window.switchElection=window.dashboardSetMacro;
  window.drawHomeProvinceChart=drawHomeProvinceChart;

  document.addEventListener("click",function(ev){
    const tab=ev.target?.closest?.(".macro-tab");
    if(tab)syncHomeProvinceChart();
  },true);

  window.addEventListener("resize",function(){
    syncHomeProvinceChart();
  });

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",syncHomeProvinceChart,{once:true});
  }else{
    syncHomeProvinceChart();
  }
})();
