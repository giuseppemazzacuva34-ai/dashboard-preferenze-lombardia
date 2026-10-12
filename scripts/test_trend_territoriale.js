#!/usr/bin/env node
"use strict";
const fs=require("fs");
const path=require("path");
const f=path.join(__dirname,"..","data","trend-territoriale-core.json");
const d=JSON.parse(fs.readFileSync(f,"utf8"));
const failures=[];
function assert(ok,msg){if(!ok)failures.push(msg);}
assert(/^2026-10-12-/.test(d.version),"versione dataset mancante");
assert(Object.keys(d.camera.seats||{}).length>=49,"collegi Camera insufficienti");
assert(Object.keys(d.senato.seats||{}).length>=26,"collegi Senato insufficienti");
assert(new Set(Object.values(d.camera.seats||{}).map(x=>x.region)).size===20,"regioni Camera != 20");
assert(new Set(Object.values(d.senato.seats||{}).map(x=>x.region)).size===20,"regioni Senato != 20");
for(const ch of ["camera","senato"]){
  for(const election of ["collegi","europee2019","europee2024"]){
    for(const [college,row] of Object.entries(d[ch][election]||{})){
      assert(typeof row.region==="string"&&row.region.length>0, ch+"/"+election+"/"+college+" senza regione");
      assert(Number(row.totalVotes)>=0,ch+"/"+election+"/"+college+" totalVotes non valido");
      for(const [p,v] of Object.entries(row.shares||{})){
        assert(v===null || (Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100), ch+"/"+election+"/"+college+"/"+p+" quota fuori range");
      }
    }
  }
}
const lomb=[...Object.entries(d.camera.seats).filter(([,v])=>v.region==="Lombardia")];
assert(lomb.length===7,"Lombardia Camera != 7 collegi");
assert(lomb.reduce((a,[,v])=>a+v.withPrizeSeats,0)===55,"Lombardia Camera seggi con premio errati");
assert(lomb.reduce((a,[,v])=>a+v.noPrizeSeats,0)===67,"Lombardia Camera seggi ordinari+premio errati");
const sample=d.camera.collegi["LOMBARDIA 4 - P01"];
assert(sample&&sample.shares.FdI>0,"campione FdI Lombardia 4 mancante");
assert(sample.shares.AVS!==undefined,"campione AVS non riconciliato");
assert(sample.shares.PIU!==undefined,"campione +Europa non riconciliato");
const nat=d.nationalShares?.camera?.europee2024||{};
assert(Number(nat.FdI)>20&&Number(nat.FdI)<40,"quota nazionale FdI Europee 2024 fuori fascia di controllo");
if(failures.length){console.error("FAIL\n"+failures.join("\n"));process.exit(1);}
console.log(JSON.stringify({ok:true,version:d.version,cameraCollegi:Object.keys(d.camera.seats).length,senatoCollegi:Object.keys(d.senato.seats).length,lombardiaCamera:lomb.length,checks:"territorial data integrity"}));
