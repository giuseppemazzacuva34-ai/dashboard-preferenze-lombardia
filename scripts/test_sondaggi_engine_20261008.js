const assert=require("assert");
const fs=require("fs");
const law=require("../sondaggi-law-20261008.js");
const engine=require("../sondaggi-election-engine-20261008.js");

const app=fs.readFileSync(require.resolve("../sondaggi-app.js"),"utf8");

function extractConst(name){
  const marker="const "+name+"=";
  const start=app.indexOf(marker);
  if(start<0)throw new Error("Costante non trovata: "+name);
  const eq=app.indexOf("=",start);
  let i=eq+1,depth=0,inStr=null,esc=false;
  for(;i<app.length;i++){
    const ch=app[i];
    if(inStr){
      if(esc){esc=false;continue;}
      if(ch==="\\"){esc=true;continue;}
      if(ch===inStr)inStr=null;
      continue;
    }
    if(ch==="'"||ch==="\""){inStr=ch;continue;}
    if(ch==="{"||ch==="[")depth++;
    if(ch==="}"||ch==="]"){
      depth--;
      if(depth===0){i++;break;}
    }
  }
  return Function("return ("+app.slice(eq+1,i)+")")();
}

const CAM=extractConst("CAM_COLLEGI");
const SEN=extractConst("SEN_COLLEGI");

function totalMap(map,index){
  return Object.values(map).flat().reduce((s,raw)=>{
    const p=String(raw).split("|");
    const special=String(p[3]||"").toUpperCase()==="SPECIAL"||String(p[0]).includes(" - U");
    return s+(special?0:Number(p[index]??0)||0);
  },0);
}

function specialMap(map){
  return Object.values(map).flat().filter(raw=>{
    const p=String(raw).split("|");
    return String(p[3]||"").toUpperCase()==="SPECIAL"||String(p[0]).includes(" - U");
  });
}

assert.strictEqual(totalMap(CAM,1),384,"Camera senza premio");
assert.strictEqual(totalMap(CAM,2),314,"Camera con premio, seggi ordinari");
assert.strictEqual(totalMap(CAM,1)-totalMap(CAM,2),70,"Camera seggi premio");
assert.strictEqual(totalMap(SEN,1),189,"Senato senza premio");
assert.strictEqual(totalMap(SEN,2),154,"Senato con premio");
assert.strictEqual(totalMap(SEN,1)-totalMap(SEN,2),35,"Senato seggi premio");
assert.strictEqual(specialMap(CAM).length,2,"mappa Camera: 1 VdA + 1 voce TAA aggregata da 7 seggi");
assert.strictEqual(specialMap(SEN).length,7,"mappa Senato: 1 VdA + 6 collegi TAA speciali");

const parties={
  FdI:{name:"Fratelli d'Italia",camera:26.8,senate:26.8},
  PD:{name:"Partito Democratico",camera:20.7,senate:20.7},
  M5S:{name:"Movimento 5 Stelle",camera:12.7,senate:12.7},
  FN:{name:"Futuro Nazionale",camera:7.5,senate:7.5},
  FI:{name:"Forza Italia",camera:7.1,senate:7.1},
  AVS:{name:"Alleanza Verdi Sinistra",camera:6.7,senate:6.7},
  LEGA:{name:"Lega",camera:5.7,senate:5.7},
  AZ:{name:"Azione",camera:3.2,senate:3.2},
  IV:{name:"Italia Viva",camera:1.5,senate:1.5},
  PIU:{name:"+Europa",camera:1.3,senate:1.3},
  NM:{name:"Noi Moderati",camera:1.1,senate:1.1},
  ALTRI:{name:"Altri",camera:4.8,senate:4.8}
};
const coalitions=[
  {id:"C-CD",name:"Centrodestra",members:["FdI","LEGA","FI","NM"]},
  {id:"C-CS",name:"Centrosinistra",members:["PD","M5S","AVS","PIU","IV"]}
];

const regionalValuesByRegion={};
Object.keys(SEN).filter(r=>r!=="Valle d'Aosta"&&r!=="Trentino-Alto Adige/Südtirol").forEach(r=>{
  regionalValuesByRegion[r]={};
  Object.keys(parties).forEach(k=>regionalValuesByRegion[r][k]=parties[k].senate);
});

function run(camVals=Object.fromEntries(Object.entries(parties).map(([k,v])=>[k,v.camera])),
            senVals=Object.fromEntries(Object.entries(parties).map(([k,v])=>[k,v.senate])),
            specialSeats={camera:{},senato:{}},
            senateRegionalOverride=null){
  return engine.simulate({
    law,
    parties,
    coalitions,
    camera:{nationalValues:camVals,collegeValues:{},collegeMap:CAM},
    senato:{nationalValues:senVals,
      regionalValuesByRegion:senateRegionalOverride||regionalValuesByRegion,
      collegeMap:SEN,premiumByRegion:law.rules.senatePremiumByRegion},
    specialSeats
  });
}

let r=run();
assert.strictEqual(r.bonus,null,"Nessun premio nello scenario base");
assert.strictEqual(Object.values(r.cam.ordinarySeatsByParty).reduce((a,v)=>a+v,0),384);
assert.strictEqual(Object.values(r.sen.ordinarySeatsByParty).reduce((a,v)=>a+v,0),189);
assert.strictEqual(r.cam.simulatedTotal,384);
assert.strictEqual(r.sen.simulatedTotal,189);
assert.strictEqual(r.cam.complete,true,"Camera senza premio quadrata");
assert.strictEqual(r.sen.complete,true,"Senato senza premio quadrato");
assert.strictEqual(Object.values(r.cam.circResults.nationalTotals).reduce((a,v)=>a+v,0),384);

const prizeVals={...Object.fromEntries(Object.entries(parties).map(([k,v])=>[k,v.camera]))};
prizeVals.FdI=43; prizeVals.PD=18; prizeVals.M5S=10; prizeVals.FN=6; prizeVals.FI=6; prizeVals.AVS=5; prizeVals.LEGA=4; prizeVals.AZ=3; prizeVals.IV=2; prizeVals.PIU=1; prizeVals.NM=1; prizeVals.ALTRI=1;
const prizeSen={...prizeVals};
r=run(prizeVals,prizeSen,{
  camera:{estero:{},valleDAosta:{FdI:1},trentinoAltoAdige:{FdI:7}},
  senato:{estero:{},valleDAosta:{FdI:1},trentinoAltoAdige:{FdI:6}}
});
assert(r.bonus,"Premio attivo");
assert.strictEqual(Object.values(r.cam.ordinarySeatsByParty).reduce((a,v)=>a+v,0),314);
assert.strictEqual(Object.values(r.cam.prizeSeatsByParty).reduce((a,v)=>a+v,0),70);
assert.strictEqual(Object.values(r.sen.ordinarySeatsByParty).reduce((a,v)=>a+v,0),154);
assert.strictEqual(Object.values(r.sen.prizeSeatsByParty).reduce((a,v)=>a+v,0),35);
assert(r.cam.winnerOrdinary<=142,"Camera cap ordinario con 8 speciali");
assert(r.sen.winnerOrdinary<=71,"Senato cap ordinario con 7 speciali");
assert.strictEqual(r.cam.simulatedTotal,384);
assert.strictEqual(r.sen.simulatedTotal,189);

const q=engine.quotientAllocate([{id:"A",votes:45},{id:"B",votes:35},{id:"C",votes:20}],10);
assert.strictEqual(Object.values(q.seats).reduce((a,v)=>a+v,0),10);
assert(Math.abs(engine.trunc6(1.23456789)-1.234567)<1e-12);
assert.strictEqual(law.premiumCandidate({A:43,B:0},{A:43,B:0},[]).id,"A");
assert.strictEqual(law.premiumCandidate({A:43,B:44},{A:44,B:43},[]),null);


Object.entries(r.cam.collegeResults?.ordinary||{}).forEach(([,cols])=>{
  Object.entries(cols||{}).forEach(([college,rec])=>{
    const assigned=Object.values(rec.alloc||{}).reduce((a,v)=>a+v,0);
    assert(assigned<=rec.seats,"Camera college "+college+": capacità superata");
  });
});

Object.entries(r.sen.regions||{}).forEach(([region,rr])=>{
  const target=rr.ordinarySeats;
  const got=Object.values(rr.listTargets||{}).reduce((a,v)=>a+v,0);
  assert.strictEqual(got,target,"Senato "+region+": lista/regione non quadrata");
  Object.entries(rr.collegeResults?.byList||{}).forEach(([list,cols])=>{
    const gotList=Object.values(cols||{}).reduce((a,v)=>a+v,0);
    assert.strictEqual(
      gotList,
      Math.floor(rr.listTargets?.[list]||0),
      "Senato "+region+"/"+list+": college non chiusi"
    );
  });
});

const capVals={...prizeVals};
capVals.FdI=55; capVals.LEGA=4; capVals.FI=6; capVals.NM=1;
const capRegionalValues={};
Object.keys(regionalValuesByRegion).forEach(region=>{
  capRegionalValues[region]={...capVals};
});
const capRun=run(capVals,{...capVals},{
  camera:{estero:{},valleDAosta:{FdI:1},trentinoAltoAdige:{FdI:7}},
  senato:{estero:{},valleDAosta:{FdI:1},trentinoAltoAdige:{FdI:6}}
},capRegionalValues);
assert(capRun.bonus,"Scenario cap: premio attivo");
assert(capRun.cam.capTriggered,"Scenario cap Camera non attivato");
assert.strictEqual(capRun.cam.winnerOrdinary,142,"Camera: cap ordinario con 8 seggi speciali");
assert.strictEqual(capRun.cam.simulatedTotal,384);
assert.strictEqual(
  Object.values(capRun.cam.prizeSeatsByParty).reduce((a,v)=>a+v,0),
  70
);
assert(capRun.sen.capTriggered,"Scenario cap Senato non attivato");
assert(capRun.sen.winnerOrdinary<=71,"Senato: cap ordinario con 7 seggi speciali");

console.log("TEST MOTORE ELETTORALE 08-10-2026: SUPERATO");
console.log("Mappe Camera/Senato quadrate, riparto nazionale, regioni, premio 70/35, cap 220/113, speciali e troncamento a 6 decimali verificati.");
