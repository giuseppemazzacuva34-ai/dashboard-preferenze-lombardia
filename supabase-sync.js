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

loadShared();
})();