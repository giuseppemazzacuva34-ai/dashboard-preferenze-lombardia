(function(){
"use strict";

function esc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function installSondaggiModule(){
  if(!window.SONDAGGI_LAW_20261008){
    const id="sondaggi-law-20261008";
    let s=document.getElementById(id);
    if(!s){
      s=document.createElement("script");
      s.id=id;
      s.src="sondaggi-law-20261008.js?v=20261009-legal";
      s.async=false;
      s.addEventListener("load",()=>installSondaggiModule(),{once:true});
      s.addEventListener("error",()=>console.error("Sondaggi: impossibile caricare il motore della legge elettorale 2026."),{once:true});
      (document.head||document.documentElement).appendChild(s);
    }else if(!s.dataset.sondaggiRetry){
      s.dataset.sondaggiRetry="1";
      s.addEventListener("load",()=>installSondaggiModule(),{once:true});
    }
    return;
  }
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
    ["PD","Partito Democratico",20.7],
    ["M5S","Movimento 5 Stelle",12.7],
    ["FN","Futuro Nazionale",7.5],
    ["FI","Forza Italia",7.1],
    ["AVS","Alleanza Verdi Sinistra",6.7],
    ["LEGA","Lega",5.7],
    ["AZ","Azione",3.2],
    ["IV","Italia Viva",2.4],
    ["PIU","+Europa",1.3],
    ["NM","Noi Moderati",1.1],
    ["ALTRI","Altri",4.8]
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

  const SPECIAL_SEATS={
    camera:{estero:8,valleDAosta:1,trentinoAltoAdige:7,total:16,proportional:384},
    senato:{estero:4,valleDAosta:1,trentinoAltoAdige:6,total:11,proportional:189}
  };

  const SPECIAL_CATS=["estero","valleDAosta","trentinoAltoAdige"];

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
      capilista:{camera:{},senato:{}},
      capilistaSelectedParty:"",
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

      base.capilista=saved.capilista&&typeof saved.capilista==="object"
        ?saved.capilista
        :{camera:{},senato:{}};
      if(!base.capilista.camera)base.capilista.camera={};
      if(!base.capilista.senato)base.capilista.senato={};
      base.capilistaSelectedParty=String(saved.capilistaSelectedParty||"");

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

  function ensureNav(){}

  function ensurePanel(){
    const host=document.getElementById("tab-sondaggi");
    return host||null;
  }

  function openPanel(){
    const host=ensurePanel();
    if(host){host.style.display="block";render();}
  }

  function closePanel(){
    const host=ensurePanel();
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
    const nationalValues=Object.fromEntries(Object.keys(S.parties).map(k=>[
      k,num(chamber==="camera"?S.parties[k].camera:S.parties[k].senate)
    ]));
    const regionalValues=chamber==="senato" && regionContext
      ?Object.fromEntries(Object.keys(S.parties).map(k=>[k,num(values[k])]))
      :null;
    const sourceValues=chamber==="senato"&&regionContext?nationalValues:values;

    const stats=window.SONDAGGI_LAW_20261008?.coalitionScores
      ?window.SONDAGGI_LAW_20261008.coalitionScores(
        members,sourceValues,chamber,regionalValues
      )
      :{qualifies:false,allMembers:[...(members||[])],admitted:[],ripCandidate:null,allocationFigure:0,premiumFigure:0};

    return {
      total:Number(stats.allocationFigure)||0,
      premiumTotal:Number(stats.premiumFigure)||0,
      admitted:[...(stats.admitted||[])],
      ripCandidate:stats.ripCandidate||null,
      qualifies:!!stats.qualifies,
      allMembers:[...(stats.allMembers||members||[])]
    };
  }
  function allocationUnits(values,chamber,regionContext=null){
    const cmap=coalitionMap();
    const units=[];
    const admittedByCoalition=new Map();
    const coalStats=[];
    const qualifiedCoalitions=new Set();

    S.coalitions.forEach(co=>{
      const allMembers=(co.members||[]).filter(k=>values[k]!=null && !AGGREGATE_POLL_PARTIES.has(k));
      if(!allMembers.length)return;

      const stats=coalitionFigure(allMembers,values,chamber,regionContext);
      if(!stats.qualifies)return;

      const admitted=[...stats.admitted];
      const rip=stats.ripCandidate;
      if(rip&&!admitted.includes(rip))admitted.push(rip);

      qualifiedCoalitions.add(co.id);
      admittedByCoalition.set(co.id,admitted);
      units.push({
        id:"C:"+co.id,
        type:"coalition",
        coalitionId:co.id,
        members:admitted,
        allMembers:[...allMembers],
        ripCandidate:rip||null,
        votes:stats.total,
        name:co.name
      });
      coalStats.push({
        id:co.id,
        members:allMembers,
        figure:stats.total,
        admitted
      });
    });

    Object.keys(values).forEach(k=>{
      if(AGGREGATE_POLL_PARTIES.has(k))return;

      const coalId=cmap[k];
      const inQualifiedCoalition=coalId&&qualifiedCoalitions.has(coalId);
      if(inQualifiedCoalition)return;

      const regionalValue=regionContext?Number(values[k]||0):undefined;
      const nationalValue=num(S.parties[k]?.[chamber==="camera"?"camera":"senate"]);

      let eligible=false;
      if(coalId){
        // Coalizione sotto l'8%: la lista collegata accede al riparto
        // già dal 2%, secondo il testo approvato.
        eligible=window.SONDAGGI_LAW_20261008.listAllocationEligible(
          nationalValue,
          chamber,
          true,
          regionalValue
        );
      }else{
        eligible=chamber==="senato"
          ?window.SONDAGGI_LAW_20261008.listRegionallyEligibleForSenate(
            nationalValue,
            regionalValue
          )
          :window.SONDAGGI_LAW_20261008.listNationallyEligible(nationalValue);
      }

      if(!eligible)return;

      const v=Number(values[k]||0);
      if(v<=0)return;

      units.push({
        id:"P:"+k,
        type:"list",
        members:[k],
        allMembers:[k],
        votes:v,
        name:k
      });
    });

    return {units,admittedByCoalition,coalStats};
  }
  const POLL_VOTE_SCALE=1000000;
  const AGGREGATE_POLL_PARTIES=new Set(["ALTRI"]);

  function pollVoteUnits(v){
    const n=Number(v)||0;
    return Math.max(0,Math.round(n*POLL_VOTE_SCALE));
  }

  function pollStableLot(key){
    const str=String(key??"");
    let h=2166136261;
    for(let i=0;i<str.length;i++){
      h^=str.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    h^=h>>>13;
    h=Math.imul(h,2246822519);
    h^=h>>>16;
    return (h>>>0)/4294967296;
  }

  function hamilton(items,seats){
    const clean=(items||[]).filter(x=>(Number(x.votes)||0)>0);
    const out={};
    if(!clean.length||seats<=0)return out;

    const totalUnits=clean.reduce((sum,x)=>sum+pollVoteUnits(x.votes),0);
    if(totalUnits<=0)return out;

    const quotaUnits=Math.floor(totalUnits/seats);
    if(quotaUnits<=0){
      const total=clean.reduce((sum,x)=>sum+(Number(x.votes)||0),0);
      if(total<=0)return out;
      clean.forEach(x=>{out[x.id]=Math.floor(seats*(Number(x.votes)||0)/total);});
      let used=Object.values(out).reduce((sum,v)=>sum+v,0);
      clean.map(x=>{
        const q=seats*(Number(x.votes)||0)/total;
        return {id:x.id,rest:q-Math.floor(q),votes:Number(x.votes)||0};
      }).sort((a,b)=>b.rest-a.rest||b.votes-a.votes||pollStableLot(a.id)-pollStableLot(b.id))
        .slice(0,Math.max(0,seats-used)).forEach(x=>{out[x.id]=(out[x.id]||0)+1;});
      return out;
    }

    clean.forEach(x=>{
      const units=pollVoteUnits(x.votes);
      const q=units/quotaUnits;
      out[x.id]=Math.floor(q);
    });

    let used=Object.values(out).reduce((sum,v)=>sum+v,0);

    clean.map(x=>{
      const units=pollVoteUnits(x.votes);
      const q=units/quotaUnits;
      return {
        id:x.id,
        rest:q-Math.floor(q),
        votes:units
      };
    }).sort((a,b)=>
      b.rest-a.rest ||
      b.votes-a.votes ||
      pollStableLot(a.id)-pollStableLot(b.id) ||
      String(a.id).localeCompare(String(b.id),"it")
    )
      .slice(0,Math.max(0,seats-used))
      .forEach(x=>{out[x.id]=(out[x.id]||0)+1;});

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
    const law=window.SONDAGGI_LAW_20261008;
    if(!law?.premiumCandidate)return null;
    const winner=law.premiumCandidate(cam,sen,S.coalitions);
    if(!winner)return null;
    return {
      id:winner.id,
      type:winner.type,
      members:[...(winner.members||[winner.id])],
      name:winner.name,
      cam:Number(winner.camera)||0,
      sen:Number(winner.senato)||0
    };
  }
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

  function hamiltonDetailed(items,seats,nationalTieValues={}){
    const clean=(items||[]).filter(x=>(Number(x.votes)||0)>0);
    const out={},remainders={},remainderWinners=new Set();
    if(!clean.length||seats<=0)return {seats:out,remainders,remainderWinners,total:0,quota:0};

    const totalUnits=clean.reduce((sum,x)=>sum+pollVoteUnits(x.votes),0);
    if(totalUnits<=0)return {seats:out,remainders,remainderWinners,total:0,quota:0};

    const quotaUnits=Math.floor(totalUnits/seats);
    if(quotaUnits<=0)return {seats:out,remainders,remainderWinners,total:totalUnits,quota:0};

    const total=totalUnits;
    clean.forEach(x=>{
      const exact=pollVoteUnits(x.votes)/quotaUnits;
      out[x.id]=Math.floor(exact);
      remainders[x.id]=exact-Math.floor(exact);
    });

    const used=Object.values(out).reduce((sum,v)=>sum+v,0);
    clean.map(x=>({
      id:x.id,
      rest:remainders[x.id]||0,
      national:pollVoteUnits(nationalTieValues?.[x.id]??x.votes),
      votes:pollVoteUnits(x.votes)
    }))
      .sort((a,b)=>
        b.rest-a.rest ||
        b.national-a.national ||
        b.votes-a.votes ||
        pollStableLot(a.id)-pollStableLot(b.id) ||
        String(a.id).localeCompare(String(b.id),"it")
      )
      .slice(0,Math.max(0,seats-used))
      .forEach(x=>{
        out[x.id]=(out[x.id]||0)+1;
        remainderWinners.add(x.id);
      });

    return {seats:out,remainders,remainderWinners,total,quota:quotaUnits};
  }
  function regionalSenateUnits(region,regionalValues,nationalPlan){
    const units=[];
    const nationalCoalitions=new Set(
      nationalPlan.units.filter(u=>u.type==="coalition").map(u=>u.coalitionId)
    );
    const used=new Set();

    nationalPlan.units.forEach(nu=>{
      if(nu.type==="coalition"){
        const allMembers=(nu.allMembers||nu.members||[]).filter(k=>regionalValues[k]!=null);
        const admittedSet=new Set();

        allMembers.forEach(k=>{
          const nationalValue=num(S.parties[k]?.senate||0);
          if(nationalValue>=3 || regionalValues[k]>=20)admittedSet.add(k);
        });
        if(nu.ripCandidate&&allMembers.includes(nu.ripCandidate))admittedSet.add(nu.ripCandidate);

        const splitMembers=[...admittedSet];
        // La cifra regionale della coalizione comprende le liste ammesse
        // e, per ogni coalizione qualificata, la lista 2-ter recuperata.
        const figure=splitMembers.reduce(
          (sum,k)=>sum+(Number(regionalValues[k])||0),0
        );

        if(figure>0){
          units.push({
            id:nu.id,
            type:"coalition",
            coalitionId:nu.coalitionId,
            name:nu.name,
            members:splitMembers,
            allMembers,
            ripCandidate:nu.ripCandidate||null,
            votes:figure
          });
        }
        allMembers.forEach(k=>used.add(k));
      }else{
        const k=nu.members?.[0],v=regionalValues[k]||0;
        const nationalValue=num(S.parties[k]?.senate||0);
        const coalId=coalitionMap()[k];
        const coalitionObj=coalId?coalitionFor(coalId):null;
        const coalFailed=!!coalitionObj && !nationalCoalitions.has(coalId);

        const eligible=coalFailed
          ?window.SONDAGGI_LAW_20261008.listAllocationEligible(
            nationalValue,"senato",true,v
          )
          :window.SONDAGGI_LAW_20261008.listRegionallyEligibleForSenate(
            nationalValue,v
          );

        if(k&&v>0&&eligible){
          units.push({
            id:nu.id,
            type:"list",
            members:[k],
            allMembers:[k],
            votes:v,
            name:nu.name
          });
          used.add(k);
        }
      }
    });

    // Una lista esterna a una coalizione qualificata può concorrere
    // autonomamente se supera la soglia nazionale o quella regionale del 20%.
    const cmap=coalitionMap();
    Object.keys(regionalValues).forEach(k=>{
      const v=regionalValues[k]||0;
      if(v<0.000001||used.has(k))return;
      const coalId=cmap[k];
      if(coalId&&nationalCoalitions.has(coalId))return;

      const coalitionObj=coalId?coalitionFor(coalId):null;
      const eligible=coalitionObj
        ?window.SONDAGGI_LAW_20261008.listAllocationEligible(
          num(S.parties[k]?.senate||0),
          "senato",
          true,
          v
        )
        :window.SONDAGGI_LAW_20261008.listRegionallyEligibleForSenate(
          num(S.parties[k]?.senate||0),
          v
        );

      if(eligible){
        units.push({
          id:"P:"+k,
          type:"list",
          members:[k],
          allMembers:[k],
          votes:v,
          name:k
        });
        used.add(k);
      }
    });

    return units;
  }
  function splitRegionalUnit(unit,count,regionalValues){
    if(!unit||count<=0)return {};
    if(unit.type!=="coalition")return {[unit.members[0]]:count};
    return hamilton((unit.members||[]).map(k=>({id:k,votes:regionalValues[k]||0})),count);
  }

  function simulateSenateRegions(usePrize){
    const nationalValues=Object.fromEntries(
      Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)])
    );
    const nationalPlan=allocationUnits(nationalValues,"senato");
    const bonus=bonusTarget();
    const winnerId=bonus?.id||null;
    const nationalTieValues=Object.fromEntries(
      nationalPlan.units.map(u=>[u.id,Number(u.votes)||0])
    );
    const regionResults={};

    SENATE_PROP_REGIONS.forEach(region=>{
      const vals=senateRegionalValues(region);
      const info=senateRegionSeatInfo(region);
      const seats=usePrize?info.withPrize:info.total;
      const units=regionalSenateUnits(region,vals,nationalPlan);
      const detailed=hamiltonDetailed(
        units.map(u=>({id:u.id,votes:u.votes})),
        seats,
        nationalTieValues
      );
      const totalRegionVotes=Object.values(vals).reduce(
        (sum,v)=>sum+(Number(v)||0),0
      );

      regionResults[region]={
        region,
        seats,
        totalRegionSeats:info.total,
        premiumSeats:usePrize?info.premium:0,
        units,
        unitSeats:{...detailed.seats},
        remainders:{...detailed.remainders},
        remainderWinners:new Set(detailed.remainderWinners),
        regionalTotalVotes:totalRegionVotes,
        premiumWinner:usePrize?info.premium:0,
        premiumResidual:0
      };
    });

    const winnerUnit=winnerId
      ?(nationalPlan.units.find(u=>u.id===winnerId)||null)
      :null;
    const winnerTerritorial=winnerId
      ?specialUnitNonEsteroSeats("senato",winnerUnit)
      :0;

    let winnerOrdinary=SENATE_PROP_REGIONS.reduce(
      (sum,r)=>sum+(regionResults[r].unitSeats[winnerId]||0),0
    );
    const winnerPremium=usePrize?35:0;
    let ordinaryRedistributed=0;

    if(usePrize&&winnerId){
      // I 35 seggi-premio sono distribuiti alle regioni nei quantitativi
      // stabiliti dalla legge: non sono oggetto di graduatoria.
      SENATE_PROP_REGIONS.forEach(region=>{
        const rr=regionResults[region];
        rr.premiumWinner=rr.premiumSeats;
        rr.premiumResidual=0;
      });

      // 78 seggi ordinari massimi del vincitore + 35 di premio = 113.
      // VDA e Trentino-Alto Adige rientrano nel tetto; Estero è escluso.
      let excess=Math.max(0,winnerOrdinary+winnerTerritorial-78);
      const assignCompensation=(region)=>{
        if(excess<=0)return false;
        const rr=regionResults[region];
        if((rr.unitSeats[winnerId]||0)<=0)return false;

        rr.unitSeats[winnerId]-=1;
        ordinaryRedistributed++;
        excess--;

        const alternatives=rr.units.filter(
          u=>u.id!==winnerId&&(Number(u.votes)||0)>0
        );
        if(!alternatives.length)return true;

        const unused=alternatives
          .filter(u=>!rr.remainderWinners.has(u.id))
          .sort((a,b)=>
            (rr.remainders[b.id]||0)-(rr.remainders[a.id]||0) ||
            (nationalTieValues[b.id]||0)-(nationalTieValues[a.id]||0) ||
            (b.votes||0)-(a.votes||0) ||
            pollStableLot(a.id)-pollStableLot(b.id) ||
            String(a.id).localeCompare(String(b.id),"it")
          );

        let chosen=unused[0]||null;
        if(!chosen){
          chosen=alternatives.slice().sort((a,b)=>
            (b.votes||0)-(a.votes||0) ||
            (nationalTieValues[b.id]||0)-(nationalTieValues[a.id]||0) ||
            pollStableLot(a.id)-pollStableLot(b.id) ||
            String(a.id).localeCompare(String(b.id),"it")
          )[0]||null;
        }

        if(chosen){
          rr.unitSeats[chosen.id]=(rr.unitSeats[chosen.id]||0)+1;
          rr.remainderWinners.add(chosen.id);
        }
        return true;
      };

      // Primo passaggio: un solo seggio per regione, in ordine crescente
      // dei resti non utilizzati del vincitore.
      const firstPass=SENATE_PROP_REGIONS.map(region=>{
        const rr=regionResults[region];
        const unit=rr.units.find(u=>u.id===winnerId);
        return {
          region,
          rest:rr.remainders[winnerId]??-1,
          votes:unit?.votes||0,
          seats:rr.unitSeats[winnerId]||0
        };
      })
        .filter(x=>x.rest>=0&&x.seats>0)
        .sort((a,b)=>
          a.rest-b.rest ||
          a.votes-b.votes ||
          a.region.localeCompare(b.region,"it")
        );

      for(const slot of firstPass){
        if(excess<=0)break;
        assignCompensation(slot.region);
      }

      // Secondo passaggio: ancora un seggio per regione, ordinando per
      // percentuale regionale del vincitore, dalla più bassa alla più alta.
      // Sono escluse le regioni già toccate e quelle in cui resterebbe un solo
      // seggio al vincitore. Se necessario, il processo riparte sui territori
      // ancora disponibili.
      while(excess>0){
        // Il secondo meccanismo procede per tornate: in ogni tornata
        // un seggio per regione, partendo dalla percentuale regionale
        // più bassa. Le regioni possono quindi essere selezionate di nuovo
        // nella tornata successiva, purché al vincitore resti più di un seggio.
        const roundUsed=new Set();
        const candidates=SENATE_PROP_REGIONS
          .map(region=>{
            const rr=regionResults[region];
            const unit=rr.units.find(u=>u.id===winnerId);
            const count=rr.unitSeats[winnerId]||0;
            const pct=rr.regionalTotalVotes>0
              ?((unit?.votes||0)/rr.regionalTotalVotes)*100
              :0;
            return {region,count,pct};
          })
          .filter(x=>x.count>1)
          .sort((a,b)=>
            a.pct-b.pct ||
            a.region.localeCompare(b.region,"it")
          );

        if(!candidates.length)break;
        for(const slot of candidates){
          if(excess<=0)break;
          if(roundUsed.has(slot.region))continue;
          const rr=regionResults[slot.region];
          if((rr.unitSeats[winnerId]||0)<=1)continue;
          if(assignCompensation(slot.region))roundUsed.add(slot.region);
        }
        if(!roundUsed.size)break;
      }
    }

    const partySeats={},ordinaryPartySeats={},prizePartySeats={},regionPartySeats={},regionUnitSeats={};

    SENATE_PROP_REGIONS.forEach(region=>{
      const rr=regionResults[region];
      const vals=senateRegionalValues(region);
      regionPartySeats[region]={};
      regionUnitSeats[region]={};

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
          const win=rr.units.find(u=>u.id===winnerId)||winnerUnit;
          if(win){
            const localMembers=(win.members||[]).filter(k=>vals[k]!=null);
            const localTotal=localMembers.reduce(
              (sum,k)=>sum+(Number(vals[k])||0),0
            );
            let split={};
            if(localTotal>0){
              split=splitRegionalUnit(
                {...win,members:localMembers},
                winCount,
                vals
              );
            }else{
              split=splitRegionalUnit(
                win,
                winCount,
                nationalValues
              );
            }
            Object.entries(split).forEach(([k,v])=>{
              partySeats[k]=(partySeats[k]||0)+v;
              prizePartySeats[k]=(prizePartySeats[k]||0)+v;
              regionPartySeats[region][k]=(regionPartySeats[region][k]||0)+v;
            });
          }
        }
      }
    });

    winnerOrdinary=SENATE_PROP_REGIONS.reduce(
      (sum,r)=>sum+(regionResults[r].unitSeats[winnerId]||0),0
    );

    const simulatedTotal=Object.values(partySeats).reduce(
      (sum,v)=>sum+v,0
    );

    return {
      seats:partySeats,
      ordinarySeatsByParty:ordinaryPartySeats,
      prizeSeatsByParty:prizePartySeats,
      regions:regionResults,
      regionPartySeats,
      regionUnitSeats,
      nationalPlan,
      complete:SENATE_PROP_REGIONS.every(
        r=>Object.keys(senateRegionalValues(r)).length===Object.keys(S.parties).length
      ),
      regionCount:SENATE_PROP_REGIONS.length,
      customizedRegions:SENATE_PROP_REGIONS.filter(isRegionalCustom).length,
      ordinarySeats:usePrize?154:189,
      premiumSeats:usePrize?35:0,
      winnerOrdinary,
      winnerPremiumSeats:usePrize?winnerPremium:0,
      premiumWinnerSeats:usePrize?winnerPremium:0,
      premiumRedistributed:0,
      ordinaryRedistributed,
      simulatedTotal
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

  function specialUnitNonEsteroSeats(chamber,unit){
    if(!unit)return 0;
    return (unit.members||[]).reduce(
      (sum,k)=>sum+specialNonEsteroPartySeats(chamber,k),0
    );
  }

  function specialNonEsteroPartySeats(chamber,slug){
    return specialPartyTotal(chamber,slug,false);
  }

  function cameraCircoscrizioni(bonusActive){
    const out={};
    Object.entries(CAM_COLLEGI).forEach(([region,items])=>{
      (items||[]).forEach(raw=>{
        const parts=String(raw).split("|");
        const name=parts[0];
        const special=String(parts[3]||"").toUpperCase()==="SPECIAL";
        if(special)return;

        const circ=name.replace(/\s-\sP\d+$/,"");
        out[circ]??={
          name:circ,
          region,
          noBonusSeats:0,
          bonusSeats:0,
          prizeSeats:0,
          colleges:[]
        };
        const noBonus=Number(parts[1])||0;
        const bonus=Number(parts[2]??parts[1])||0;
        out[circ].noBonusSeats+=noBonus;
        out[circ].bonusSeats+=bonus;
        out[circ].prizeSeats+=Math.max(0,noBonus-bonus);
        out[circ].colleges.push({
          name,
          noBonusSeats:noBonus,
          bonusSeats:bonus
        });
      });
    });
    return out;
  }

  function cameraCircFigure(circ,slug,bonusActive){
    const rec=cameraCircoscrizioni(bonusActive)[circ];
    if(!rec)return 0;
    return rec.colleges.reduce((sum,col)=>{
      const seats=bonusActive?col.bonusSeats:col.noBonusSeats;
      const bucket=S.collegeValues?.camera?.[col.name]||{};
      const pct=num(bucket[slug]??S.parties[slug]?.camera??0);
      return sum+pct*seats;
    },0);
  }

  function cameraUnitCircFigure(circ,unit,bonusActive){
    if(!unit)return 0;
    return (unit.members||[]).reduce(
      (sum,k)=>sum+cameraCircFigure(circ,k,bonusActive),0
    );
  }

  function distributeCameraCircoscrizioni(plan,targetByUnit,bonusActive,winnerId){
    const circs=cameraCircoscrizioni(bonusActive);
    const units=plan.units.filter(
      u=>(Number(targetByUnit[u.id])||0)>0
    );
    const totalSeats=Object.values(circs).reduce(
      (sum,r)=>sum+Number(bonusActive?r.bonusSeats:r.noBonusSeats),0
    );
    const nationalFigures=Object.fromEntries(
      plan.units.map(u=>[u.id,Number(u.votes)||0])
    );
    const byCirc={},remainderByCirc={};

    const winnerTarget=winnerId?Number(targetByUnit[winnerId]||0):0;
    const winnerQuotaUnits=winnerId&&winnerTarget>0
      ?Math.floor(pollVoteUnits(nationalFigures[winnerId])/winnerTarget)
      :0;

    const otherUnits=units.filter(u=>u.id!==winnerId);
    const otherSeats=otherUnits.reduce(
      (sum,u)=>sum+Number(targetByUnit[u.id]||0),0
    );
    const otherFigureUnits=otherUnits.reduce(
      (sum,u)=>sum+pollVoteUnits(nationalFigures[u.id]),0
    );
    const minorityQuotaUnits=otherSeats>0?Math.floor(otherFigureUnits/otherSeats):0;

    Object.entries(circs).forEach(([circ,rec])=>{
      const seats=Number(bonusActive?rec.bonusSeats:rec.noBonusSeats)||0;
      byCirc[circ]={};
      remainderByCirc[circ]={};
      if(!seats)return;

      const preliminary=units.map(u=>{
        const figure=cameraUnitCircFigure(circ,u,bonusActive);
        const figureUnits=pollVoteUnits(figure);
        const quotaUnits=u.id===winnerId?winnerQuotaUnits:minorityQuotaUnits;
        const index=quotaUnits>0
          ?Math.floor((figureUnits/quotaUnits)*1e6)/1e6
          :0;
        return {id:u.id,index,figure};
      });
      const indexSum=preliminary.reduce((sum,x)=>sum+(Number(x.index)||0),0);
      const scored=preliminary.map(x=>{
        const exact=indexSum>0
          ?(Number(x.index)||0)*seats/indexSum
          :0;
        const base=Math.floor(exact);
        return {
          id:x.id,
          base,
          rest:exact-base,
          figure:x.figure
        };
      });

      const used=scored.reduce((sum,x)=>sum+x.base,0);
      scored.forEach(x=>{
        byCirc[circ][x.id]=x.base;
        remainderByCirc[circ][x.id]=x.rest;
      });

      scored.sort((a,b)=>
        b.rest-a.rest ||
        (nationalFigures[b.id]||0)-(nationalFigures[a.id]||0) ||
        (b.figure||0)-(a.figure||0) ||
        pollStableLot(a.id)-pollStableLot(b.id) ||
        String(a.id).localeCompare(String(b.id),"it")
      )
        .slice(0,Math.max(0,seats-used))
        .forEach(x=>{
          byCirc[circ][x.id]=(byCirc[circ][x.id]||0)+1;
        });
    });

    const nationalTotals=Object.fromEntries(units.map(u=>[u.id,0]));
    Object.values(byCirc).forEach(m=>{
      Object.entries(m).forEach(([id,v])=>{
        nationalTotals[id]=(nationalTotals[id]||0)+Number(v||0);
      });
    });

    // Compensazione: si spostano seggi dentro la stessa circoscrizione
    // da un'unità sovra-assegnata a una sotto-assegnata, in modo da
    // ristabilire esattamente i totali nazionali.
    const maxLoops=Math.max(1000,totalSeats*units.length*2);
    let loops=0;
    while(loops<maxLoops){
      loops++;
      const over=units.filter(u=>
        nationalTotals[u.id]>Number(targetByUnit[u.id]||0)
      );
      const under=units.filter(u=>
        nationalTotals[u.id]<Number(targetByUnit[u.id]||0)
      );
      if(!over.length||!under.length)break;

      let moved=false;
      const donorList=over.slice().sort((a,b)=>
        (nationalTotals[b.id]-Number(targetByUnit[b.id]||0))-
        (nationalTotals[a.id]-Number(targetByUnit[a.id]||0)) ||
        String(a.id).localeCompare(String(b.id),"it")
      );

      for(const donor of donorList){
        const donorCircs=Object.keys(byCirc)
          .filter(circ=>Number(byCirc[circ]?.[donor.id]||0)>0)
          .sort((a,b)=>
            (remainderByCirc[a]?.[donor.id]||0)-
            (remainderByCirc[b]?.[donor.id]||0) ||
            a.localeCompare(b,"it")
          );
        if(!donorCircs.length)continue;

        const circ=donorCircs[0];
        const receiver=under.slice().sort((a,b)=>
          (remainderByCirc[circ]?.[b.id]||0)-
          (remainderByCirc[circ]?.[a.id]||0) ||
          (nationalFigures[b.id]||0)-(nationalFigures[a.id]||0) ||
          String(a.id).localeCompare(String(b.id),"it")
        )[0];
        if(!receiver)continue;

        byCirc[circ][donor.id]-=1;
        byCirc[circ][receiver.id]=(byCirc[circ][receiver.id]||0)+1;
        nationalTotals[donor.id]--;
        nationalTotals[receiver.id]++;
        moved=true;
        break;
      }

      if(!moved)break;
    }

    return {
      byCirc,
      remainderByCirc,
      nationalTotals,
      totalSeats,
      circoscrizioni:Object.keys(circs).length
    };
  }
  function nationalResults(){
    const camVals=Object.fromEntries(
      Object.keys(S.parties).map(k=>[k,num(S.parties[k].camera)])
    );
    const senVals=Object.fromEntries(
      Object.keys(S.parties).map(k=>[k,num(S.parties[k].senate)])
    );
    const bonus=bonusTarget();

    const cam={
      seats:{},
      ordinarySeatsByParty:{},
      prizeSeatsByParty:{},
      eligible:[],
      coalTotals:{}
    };
    const sen={
      seats:{},
      ordinarySeatsByParty:{},
      prizeSeatsByParty:{},
      eligible:[],
      coalTotals:{}
    };

    const camPlan=allocationUnits(camVals,"camera");

    let camTargetByUnit={};
    let camPrizeByUnit={};

    if(!bonus){
      camTargetByUnit=hamilton(
        camPlan.units.map(u=>({id:u.id,votes:u.votes})),
        384
      );
    }else{
      const base=hamilton(
        camPlan.units.map(u=>({id:u.id,votes:u.votes})),
        314
      );
      const winnerUnit=camPlan.units.find(u=>u.id===bonus.id)||null;
      const winnerSpecial=winnerUnit
        ?(winnerUnit.members||[]).reduce(
          (sum,k)=>sum+specialNonEsteroPartySeats("camera",k),0
        )
        :0;
      const baseWinner=Number(base[bonus.id]||0);

      // Senza superamento del tetto: 314 ordinari + 70 premio.
      const overflow=Math.max(0,baseWinner+winnerSpecial-150);

      if(overflow>0&&winnerUnit){
        const winnerTarget=Math.max(0,150-winnerSpecial);
        camTargetByUnit[bonus.id]=winnerTarget;

        const others=camPlan.units.filter(u=>u.id!==bonus.id);
        const otherTargetSeats=Math.max(0,314-winnerTarget);
        const otherAlloc=hamilton(
          others.map(u=>({id:u.id,votes:u.votes})),
          otherTargetSeats
        );
        Object.assign(camTargetByUnit,otherAlloc);
        cam.ordinaryRedistributed=overflow;
      }else{
        camTargetByUnit=base;
        cam.ordinaryRedistributed=0;
      }

      camPrizeByUnit[bonus.id]=70;
    }

    const camCirc=distributeCameraCircoscrizioni(
      camPlan,
      camTargetByUnit,
      !!bonus,
      bonus?.id||null
    );

    camPlan.units.forEach(u=>{
      const count=Number(camTargetByUnit[u.id]||0);
      if(count>0){
        const split=u.type==="coalition"
          ?splitCoalitionSeats(u,count,camVals)
          :{[u.members[0]]:count};
        Object.entries(split).forEach(([k,v])=>{
          cam.ordinarySeatsByParty[k]=(cam.ordinarySeatsByParty[k]||0)+v;
        });
      }
    });

    if(bonus){
      const winnerUnit=camPlan.units.find(u=>u.id===bonus.id)||null;
      if(winnerUnit){
        const split=winnerUnit.type==="coalition"
          ?splitCoalitionSeats(winnerUnit,70,camVals)
          :{[winnerUnit.members[0]]:70};
        Object.entries(split).forEach(([k,v])=>{
          cam.prizeSeatsByParty[k]=(cam.prizeSeatsByParty[k]||0)+v;
        });
      }
    }

    Object.assign(cam.seats,cam.ordinarySeatsByParty);
    Object.entries(cam.prizeSeatsByParty).forEach(([k,v])=>{
      cam.seats[k]=(cam.seats[k]||0)+v;
    });

    cam.premiumSeats=bonus?70:0;
    cam.bonusSeats=bonus?70:0;
    cam.prizeWinnerSeats=bonus?70:0;
    cam.prizeRedistributed=0;
    cam.ordinarySeats=bonus?314:384;
    cam.circResults=camCirc;

    cam.eligible=camPlan.units.flatMap(u=>u.members);
    cam.units=camPlan.units;
    cam.coalTotals=Object.fromEntries(
      camPlan.coalStats.map(c=>[c.id,c.figure])
    );

    const senPlan=allocationUnits(senVals,"senato");
    Object.assign(
      sen,
      simulateSenateRegions(!!bonus)
    );
    sen.eligible=senPlan.units.flatMap(u=>u.members);
    sen.units=senPlan.units;
    sen.coalTotals=Object.fromEntries(
      senPlan.coalStats.map(c=>[c.id,c.figure])
    );

    if(!bonus){
      sen.premiumSeats=0;
      sen.bonusSeats=0;
      sen.prizeWinnerSeats=0;
      sen.prizeRedistributed=0;
      sen.ordinarySeats=189;
    }else{
      sen.premiumSeats=35;
      sen.bonusSeats=35;
      sen.prizeWinnerSeats=35;
      sen.prizeRedistributed=0;
      sen.ordinarySeats=154;
    }

    return {
      cam,
      sen,
      bonus,
      special:{
        camera:{...SPECIAL_SEATS.camera},
        senato:{...SPECIAL_SEATS.senato}
      }
    };
  }
  function capilistaRecord(chamber,college,slug){
    const row=S.capilista?.[chamber]?.[college]?.[slug];
    return row&&typeof row==="object"
      ?{name:String(row.name||""),gender:String(row.gender||"")}
      :{name:"",gender:""};
  }
  function setCapilista(slug,name,gender){
    const college=selectedCollege()?.name||"";
    if(!college||!slug||!S.parties[slug])return;
    S.capilista??={camera:{},senato:{}};
    S.capilista[S.chamber]??={};
    S.capilista[S.chamber][college]??={};
    const cleanName=String(name||"").trim();
    const cleanGender=gender==="M"||gender==="F"?gender:"";
    if(!cleanName)delete S.capilista[S.chamber][college][slug];
    else S.capilista[S.chamber][college][slug]={name:cleanName,gender:cleanGender};
    S.capilistaSelectedParty=slug;
    save();
    render();
  }
  function clearCapilista(slug){
    const college=selectedCollege()?.name||"";
    if(!college||!slug)return;
    const bucket=S.capilista?.[S.chamber]?.[college];
    if(bucket)delete bucket[slug];
    save();
    render();
  }
  function capilistaGenderSequence(gender){
    if(gender!=="M"&&gender!=="F")return Array.from({length:7},()=>"?");
    const other=gender==="M"?"F":"M";
    return Array.from({length:7},(_,i)=>i%2===0?gender:other);
  }

  function normalizeCapName(v){
    return String(v||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toUpperCase().replace(/\s+/g," ").replace(/[^A-Z0-9 '’-]/g,"");
  }

  function capilistaRegistry(chamber,filters={}){
    const out=[];
    const source=chamber==="camera"?CAM_COLLEGI:SEN_COLLEGI;
    const partyFilter=String(filters.party||"");
    const regionFilter=String(filters.region||"");
    const genderFilter=String(filters.gender||"");
    const statusFilter=String(filters.status||"");

    Object.entries(source).forEach(([region,items])=>{
      if(regionFilter&&regionFilter!==region)return;
      (items||[]).forEach(raw=>{
        const parts=String(raw).split("|");
        const college=parts[0];
        if(String(parts[3]||"").toUpperCase()==="SPECIAL")return;
        Object.keys(S.parties).forEach(slug=>{
          if(partyFilter&&partyFilter!==slug)return;
          const row=capilistaRecord(chamber,college,slug);
          if(genderFilter&&genderFilter!==row.gender)return;
          out.push({
            chamber,region,college,slug,
            party:S.parties[slug]?.name||slug,
            name:row.name,
            gender:row.gender,
            normalizedName:normalizeCapName(row.name)
          });
        });
      });
    });

    const counts={};
    out.forEach(r=>{
      if(!r.normalizedName)return;
      const key=r.slug+"|"+r.normalizedName;
      counts[key]=(counts[key]||0)+1;
    });

    out.forEach(r=>{
      const n=r.normalizedName?counts[r.slug+"|"+r.normalizedName]:0;
      r.repeatCount=n;
      r.status=!r.name
        ?"MANCANTE"
        :!r.gender
          ?"SESSO MANCANTE"
          :n>5
            ?"VIOLAZIONE > 5"
            :n===5
              ?"LIMITE 5/5"
              :"OK";
    });

    return out.filter(r=>!statusFilter||r.status===statusFilter);
  }

  function capilistaRegistrySummary(chamber){
    const rows=capilistaRegistry(chamber);
    return {
      total:rows.length,
      filled:rows.filter(r=>r.name).length,
      missing:rows.filter(r=>!r.name).length,
      missingGender:rows.filter(r=>r.name&&!r.gender).length,
      violations:new Set(rows.filter(r=>r.repeatCount>5).map(r=>r.slug+"|"+r.normalizedName)).size,
      atLimit:new Set(rows.filter(r=>r.repeatCount===5).map(r=>r.slug+"|"+r.normalizedName)).size
    };
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

    function capilistaEditor(){
      const college=selectedCollege();
      if(!college)return "";
      const partyKeys=Object.keys(S.parties);
      const selected=(S.capilistaSelectedParty&&S.parties[S.capilistaSelectedParty])
        ?S.capilistaSelectedParty:(partyKeys[0]||"");
      S.capilistaSelectedParty=selected;
      const cur=capilistaRecord(S.chamber,college.name,selected);
      const summary=partyKeys.map(slug=>{
        const row=capilistaRecord(S.chamber,college.name,slug);
        return {slug,name:S.parties[slug]?.name||slug,cap:row.name,gender:row.gender};
      });
      const assigned=summary.filter(x=>x.cap).length;
      const male=summary.filter(x=>x.gender==="M").length;
      const female=summary.filter(x=>x.gender==="F").length;
      const seq=capilistaGenderSequence(cur.gender);
      return '<div class="sg-card-title"><b>GESTIONE CAPILISTA</b><span>'+esc2(college.name)+'</span></div>'+
        '<div class="sg-note">Ogni lista presenta 7 candidati nel collegio, capolista compreso. L’ordine deve essere alternato per genere; il sesso del capolista determina la sequenza. La pluricandidatura nello stesso contrassegno sarà controllata nella gestione dedicata.</div>'+
        '<div class="sg-capilista-kpis"><span><b>'+assigned+'/'+partyKeys.length+'</b><small>inseriti</small></span><span><b>'+male+'</b><small>uomini</small></span><span><b>'+female+'</b><small>donne</small></span></div>'+
        '<div class="sg-cap-party-buttons">'+partyKeys.map(k=>'<button type="button" data-cap-party="'+esc2(k)+'" class="'+(k===selected?'active':'')+'">'+esc2(k)+'</button>').join('')+'</div>'+
        '<div class="sg-capilista-editor">'+
          '<div><label>Lista</label><strong>'+esc2(S.parties[selected]?.name||selected)+'</strong></div>'+
          '<div><label>Nome e cognome capolista</label><input id="sgCapName" type="text" value="'+esc2(cur.name)+'" placeholder="Nome e cognome"></div>'+
          '<div><label>Sesso</label><select id="sgCapGender"><option value="">Seleziona</option><option value="M" '+(cur.gender==="M"?"selected":"")+'>Maschio</option><option value="F" '+(cur.gender==="F"?"selected":"")+'>Femmina</option></select></div>'+
          '<div class="sg-cap-sequence"><label>Sequenza dei 7 candidati</label><div>'+seq.map((g,i)=>'<span class="'+(g===cur.gender&&cur.gender?'same':'')+'"><b>'+String(i+1)+'</b>'+g+'</span>').join('')+'</div></div>'+
          '<div class="sg-actions"><button type="button" class="sg-btn primary" id="sgSaveCap">SALVA CAPOLISTA</button><button type="button" class="sg-btn" id="sgClearCap">CANCELLA</button></div>'+
        '</div>'+
        '<div class="sg-table-wrap"><table class="sg-table sg-cap-table"><thead><tr><th>Lista</th><th>Capolista</th><th>Sesso</th><th>Stato</th></tr></thead><tbody>'+
          summary.map(x=>'<tr><td><b>'+esc2(x.name)+'</b><small>'+esc2(x.slug)+'</small></td><td>'+esc2(x.cap||"—")+'</td><td>'+ (x.gender==="M"?"Maschio":x.gender==="F"?"Femmina":"—") +'</td><td>'+ (x.cap?(x.gender?"OK":"SESSO DA COMPLETARE"):"NON INSERITO") +'</td></tr>').join('')+
        '</tbody></table></div>';
    }

    function capilistaRegistryEditor(){
      const chamber=S.chamber;
      S.capilistaRegistryFilters??={camera:{},senato:{}};
      S.capilistaRegistryFilters[chamber]??={party:"",region:"",gender:"",status:""};
      const filters=S.capilistaRegistryFilters[chamber];
      const summary=capilistaRegistrySummary(chamber);
      const rows=capilistaRegistry(chamber,filters);
      const source=chamber==="camera"?CAM_COLLEGI:SEN_COLLEGI;
      const regions=Object.keys(source);
      const displayRows=rows.slice(0,700);

      return '<div class="sg-card sg-cap-registry">'+
        '<div class="sg-card-title"><b>REGISTRO NAZIONALE CAPILISTA</b><span>'+esc2(chamber==="camera"?"Camera":"Senato")+'</span></div>'+
        '<div class="sg-note">Registro di tutti i collegi plurinominali della camera selezionata. La legge prevede 7 candidati per lista e il limite massimo di 5 collegi per lo stesso candidato con lo stesso contrassegno.</div>'+
        '<div class="sg-cap-reg-kpis">'+
          '<span><b>'+summary.filled+'</b><small>capilista inseriti</small></span>'+
          '<span><b>'+summary.missing+'</b><small>mancanti</small></span>'+
          '<span><b>'+summary.missingGender+'</b><small>sesso mancante</small></span>'+
          '<span class="'+(summary.violations?"bad":"")+'"><b>'+summary.violations+'</b><small>violazioni >5</small></span>'+
          '<span class="'+(summary.atLimit?"warn":"")+'"><b>'+summary.atLimit+'</b><small>al limite 5/5</small></span>'+
        '</div>'+
        '<div class="sg-cap-reg-filters">'+
          '<div><label>Lista</label><select data-cap-filter="party"><option value="">Tutte le liste</option>'+Object.keys(S.parties).map(k=>'<option value="'+esc2(k)+'" '+(filters.party===k?"selected":"")+'>'+esc2(S.parties[k]?.name||k)+'</option>').join('')+'</select></div>'+
          '<div><label>Regione</label><select data-cap-filter="region"><option value="">Tutte le regioni</option>'+regions.map(x=>'<option value="'+esc2(x)+'" '+(filters.region===x?"selected":"")+'>'+esc2(x)+'</option>').join('')+'</select></div>'+
          '<div><label>Sesso</label><select data-cap-filter="gender"><option value="">Tutti</option><option value="M" '+(filters.gender==="M"?"selected":"")+'>Maschio</option><option value="F" '+(filters.gender==="F"?"selected":"")+'>Femmina</option></select></div>'+
          '<div><label>Stato</label><select data-cap-filter="status"><option value="">Tutti</option><option value="OK" '+(filters.status==="OK"?"selected":"")+'>OK</option><option value="MANCANTE" '+(filters.status==="MANCANTE"?"selected":"")+'>Mancante</option><option value="SESSO MANCANTE" '+(filters.status==="SESSO MANCANTE"?"selected":"")+'>Sesso mancante</option><option value="LIMITE 5/5" '+(filters.status==="LIMITE 5/5"?"selected":"")+'>Limite 5/5</option><option value="VIOLAZIONE > 5" '+(filters.status==="VIOLAZIONE > 5"?"selected":"")+'>Violazione &gt;5</option></select></div>'+
        '</div>'+
        '<div class="sg-cap-reg-count">'+fmt0(rows.length)+' record visualizzati</div>'+
        '<div class="sg-table-wrap"><table class="sg-table sg-cap-reg-table"><thead><tr><th>Regione</th><th>Collegio</th><th>Lista</th><th>Capolista</th><th>Sesso</th><th>Collegi</th><th>Stato</th></tr></thead><tbody>'+
          (displayRows.map(r=>'<tr><td>'+esc2(r.region)+'</td><td>'+esc2(r.college)+'</td><td><b>'+esc2(r.slug)+'</b></td><td>'+esc2(r.name||"—")+'</td><td>'+(r.gender==="M"?"Maschio":r.gender==="F"?"Femmina":"—")+'</td><td><b>'+fmt0(r.repeatCount)+'</b>/5</td><td><span class="sg-cap-status '+(r.status==="VIOLAZIONE > 5"?"bad":r.status==="LIMITE 5/5"?"warn":"")+'">'+esc2(r.status)+'</span></td></tr>').join('')||'<tr><td colspan="7">Nessun record con questi filtri.</td></tr>')+
        '</tbody></table></div>'+
        (rows.length>700?'<div class="sg-note">Visualizzati i primi 700 record. Usa i filtri per restringere il registro.</div>':'')+
      '</div>';
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
        '<div class="sg-law">LEGGE ELETTORALE · TESTO APPROVATO DEFINITIVAMENTE 8 OTTOBRE 2026 · sistema proporzionale su collegi plurinominali, con collegi uninominali speciali nelle circoscrizioni previste dalla legge · soglia 3% liste · soglia 8% coalizioni con almeno una lista al 2% · deroga del 20% regionale al Senato · premio 70 Camera / 35 Senato se lo stesso soggetto è primo in entrambe le Camere e raggiunge il 42% in entrambe. Testo definitivamente approvato, in attesa di pubblicazione.</div>'+
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
          '<div class="sg-card sg-capilista-wrap">'+capilistaEditor()+'</div>'+
          '<div class="sg-card sg-cap-reg-wrap">'+capilistaRegistryEditor()+'</div>'+
          '<div class="sg-card"><div class="sg-card-title"><b>Distribuzione dei seggi modellati</b><span>quote ordinarie + premio; esclusi i seggi speciali non inseriti</span></div><div class="sg-two"><div><h3>Camera · pool nazionale 384</h3><table class="sg-table"><thead><tr><th>Partito</th><th>%</th><th>Seggi modellati</th></tr></thead><tbody>'+resultRows(national.cam,"camera")+'</tbody></table></div><div><h3>Senato · pool nazionale 189</h3><table class="sg-table"><thead><tr><th>Partito</th><th>%</th><th>Seggi modellati</th></tr></thead><tbody>'+resultRows(national.sen,"senato")+'</tbody></table><div class="sg-note">'+(national.sen.complete?'✅ Senato: riparto regione per regione su '+national.sen.regionCount+' regioni proporzionali.':'⚠️ Dati regionali Senato incompleti: risultato provvisorio.')+'</div></div></div></div>'+
          (national.bonus?'<div class="sg-bonus">PREMIO ATTIVO · '+esc2(coalitionFor(national.bonus.id)?.name||national.bonus.members.map(k=>S.parties[k]?.name||k).join(" + "))+' · pool 70 Camera / 35 Senato</div>':'<div class="sg-note">Il premio non scatta: la stessa lista o coalizione deve essere prima e raggiungere almeno il 42% in entrambe le Camere.</div>')+
        '</div>'+
          '<div class="sg-card"><div class="sg-card-title"><b>Distribuzione nel collegio</b><span>'+esc2(c?.name||"")+' · '+fmt0(c?.seats||0)+' seggi</span></div><table class="sg-table"><thead><tr><th>Partito</th><th>% collegio</th><th>Seggi</th></tr></thead><tbody>'+collegeRows+'</tbody></table><div class="sg-note">Il collegio usa le percentuali locali che inserisci. Le assegnazioni nazionali della riforma restano nella simulazione sopra.</div></div>'+
        '</div>'+
        '<div class="sg-source">Partiti e valori iniziali: Supermedia YouTrend/Agi, rilevazione 1 ottobre 2026. Regole del simulatore: testo elettorale approvato definitivamente l’8 ottobre 2026. Camera: 384 seggi proporzionali senza premio; 314 seggi ordinari + 70 di premio quando ricorrono le condizioni di legge. Senato: 189 seggi proporzionali senza premio; 154 ordinari + 35 di premio con premio. Il Senato è ripartito regione per regione nelle 18 regioni proporzionali, con deroga del 20% regionale. Valle d’Aosta e Trentino-Alto Adige/Südtirol sono trattati separatamente secondo la disciplina speciale.</div>'+
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

    host.querySelectorAll("[data-cap-party]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        S.capilistaSelectedParty=btn.getAttribute("data-cap-party")||"";
        render();
      });
    });
    document.getElementById("sgSaveCap")?.addEventListener("click",()=>{
      setCapilista(
        S.capilistaSelectedParty||Object.keys(S.parties)[0]||"",
        document.getElementById("sgCapName")?.value||"",
        document.getElementById("sgCapGender")?.value||""
      );
    });
    document.getElementById("sgClearCap")?.addEventListener("click",()=>{
      clearCapilista(S.capilistaSelectedParty||Object.keys(S.parties)[0]||"");
    });

    host.querySelectorAll("[data-cap-filter]").forEach(sel=>{
      sel.addEventListener("change",()=>{
        S.capilistaRegistryFilters??={camera:{},senato:{}};
        S.capilistaRegistryFilters[S.chamber]??={party:"",region:"",gender:"",status:""};
        const key=sel.getAttribute("data-cap-filter");
        S.capilistaRegistryFilters[S.chamber][key]=sel.value||"";
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
.sg-parliament{min-width:860px}.sg-parliament th{text-align:right}.sg-parliament th:first-child{text-align:left}.sg-parliament td:not(:first-child){text-align:right}.sg-parliament td:first-child small{display:block;color:#6f8ca2;font-size:6px;margin-top:2px}.sg-pending-row td{background:#173249;color:#9eb5c5;border-top:1px solid #2d526e}.sg-parliament-kpi{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;align-items:center;background:#102b42;border:1px solid #254b67;border-radius:8px;padding:8px;margin:7px 0}.sg-parliament-kpi b{font-size:20px;color:#fff}.sg-parliament-kpi span{font-size:7px;text-transform:uppercase;font-weight:900;color:#7fa3bd}.sg-parliament-kpi em{grid-column:1/-1;font-size:7px;color:#9eb9ca;font-style:normal}.sg-special-editor{background:#0b1e31;border:1px solid #203d55;border-radius:10px;padding:11px;margin-top:0}.sg-special-editor+.sg-special-editor{margin-top:10px}.sg-special-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}.sg-special-totals span{display:block;background:#102a40;border:1px solid #274a64;border-radius:7px;padding:7px}.sg-special-totals b{display:block;color:#fff;font-size:11px}.sg-special-totals small{display:block;margin-top:2px;color:#7898ae;font-size:6px;text-transform:uppercase}.sg-special-table{min-width:840px}.sg-cap-reg-wrap{margin-top:10px}.sg-cap-reg-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:8px 0}.sg-cap-reg-kpis span{background:#102a40;border:1px solid #274a64;border-radius:7px;padding:7px}.sg-cap-reg-kpis b{display:block;color:#fff;font-size:14px}.sg-cap-reg-kpis small{display:block;color:#7898ae;font-size:6px;text-transform:uppercase}.sg-cap-reg-kpis .bad{border-color:#a94444;background:#3a1b25}.sg-cap-reg-kpis .warn{border-color:#9b7a27;background:#362d12}.sg-cap-reg-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;background:#0a1d30;border:1px solid #203d55;border-radius:9px;padding:9px}.sg-cap-reg-filters label{display:block;color:#7f9ab0;font-size:6px;text-transform:uppercase;margin-bottom:4px}.sg-cap-reg-filters select{width:100%;box-sizing:border-box;padding:7px 8px;background:#0e2941;color:#fff;border:1px solid #2a4b65;border-radius:7px}.sg-cap-reg-count{font-size:7px;color:#7996aa;margin:8px 0 4px}.sg-cap-reg-table{min-width:930px}.sg-cap-status{display:inline-block;padding:3px 5px;border-radius:5px;background:#163b28;color:#b9e8ca;font-weight:900;font-size:6px}.sg-cap-status.bad{background:#4b1d27;color:#ffd1d9}.sg-cap-status.warn{background:#4d3e12;color:#ffe7a2}@media(max-width:820px){.sg-cap-reg-kpis{grid-template-columns:1fr 1fr 1fr}.sg-cap-reg-kpis span:nth-child(4),.sg-cap-reg-kpis span:nth-child(5){grid-column:span 1}.sg-cap-reg-filters{grid-template-columns:1fr}.sg-cap-reg-table{min-width:930px}}.sg-capilista-wrap{margin-top:10px}.sg-capilista-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}.sg-capilista-kpis span{background:#102a40;border:1px solid #274a64;border-radius:7px;padding:7px}.sg-capilista-kpis b{display:block;color:#fff;font-size:14px}.sg-capilista-kpis small{display:block;color:#7898ae;font-size:6px;text-transform:uppercase}.sg-cap-party-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.sg-cap-party-buttons button{border:1px solid #315875;background:#0a2135;color:#cfe2ef;border-radius:8px;padding:7px 9px;font-size:8px;font-weight:900;cursor:pointer}.sg-cap-party-buttons button.active{border-color:#2187ff;background:#17466c;color:#fff}.sg-capilista-editor{display:grid;grid-template-columns:1.1fr 2fr 1fr;gap:8px;align-items:end;background:#0a1d30;border:1px solid #203d55;border-radius:9px;padding:9px}.sg-capilista-editor label{display:block;color:#7f9ab0;font-size:6px;text-transform:uppercase;margin-bottom:4px}.sg-capilista-editor strong{display:block;color:#fff;font-size:10px;padding:7px 0}.sg-capilista-editor input,.sg-capilista-editor select{width:100%;box-sizing:border-box;padding:7px 8px;background:#0e2941;color:#fff;border:1px solid #2a4b65;border-radius:7px}.sg-cap-sequence{grid-column:1/-1}.sg-cap-sequence>div{display:flex;gap:5px;flex-wrap:wrap}.sg-cap-sequence span{min-width:28px;padding:5px 6px;border:1px solid #294b64;border-radius:6px;background:#102a40;color:#c6d9e5;text-align:center;font-size:7px}.sg-cap-sequence span.same{border-color:#2187ff;background:#17466c;color:#fff}.sg-cap-sequence b{display:block;font-size:6px;color:#7898ae;margin-bottom:2px}.sg-cap-table{min-width:760px}.sg-cap-table td small{display:block;color:#6f8ca2;font-size:6px;margin-top:2px}.sg-cap-table td:nth-child(3),.sg-cap-table td:nth-child(4){text-align:center}@media(max-width:820px){.sg-capilista-editor{grid-template-columns:1fr}.sg-cap-sequence{grid-column:auto}.sg-cap-party-buttons{display:grid;grid-template-columns:repeat(3,1fr)}.sg-cap-party-buttons button{min-height:34px}.sg-capilista-kpis{grid-template-columns:1fr 1fr 1fr}}.sg-special-table input{width:54px;box-sizing:border-box;padding:6px 5px}.sg-special-table td,.sg-special-table th{text-align:center}.sg-special-table td:first-child,.sg-special-table th:first-child{text-align:left}.sg-special-table td:first-child small{display:block;color:#6f8ca2;font-size:6px;margin-top:2px}
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

  // Avvio autonomo della pagina dedicata: il pannello deve essere renderizzato
  // anche senza la sidebar della dashboard principale.
  try{ render(); }catch(err){
    console.error("Avvio Sondaggi dedicati",err);
    const host=document.getElementById("tab-sondaggi");
    if(host)host.innerHTML='<div style="padding:24px;color:#ffb4b4;background:#321522;border:1px solid #7a3044;border-radius:10px"><b>Errore caricamento Sondaggi</b><div style="margin-top:8px;font-size:12px">'+esc2(err?.message||err)+'</div></div>';
  }
}

installSondaggiModule();
})();
