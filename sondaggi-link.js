(function(){
"use strict";

function loadScript(id,src){
  try{
    if(document.getElementById(id)) return;
    const s=document.createElement("script");
    s.id=id;
    s.src=src;
    s.async=false;
    (document.head||document.documentElement).appendChild(s);
  }catch(err){
    console.error("Sondaggi script load",id,err);
  }
}

function loadLawEngine(){
  loadScript("sondaggi-law-20261008","sondaggi-law-20261008.js?v=20261009-legal");
}

function loadIntegrityGuard(){
  loadScript("dashboard-runtime-integrity","dashboard-runtime-integrity.js?v=20261009-1");
}

function ensure(){
  const side=document.querySelector(".app-sidebar");
  if(!side)return;
  let btn=side.querySelector("#sideSondaggi");
  if(!btn){
    btn=document.createElement("button");
    btn.type="button";
    btn.id="sideSondaggi";
    btn.className="side-tab";
    btn.innerHTML="<span>📊</span><b> Sondaggi</b>";
    btn.title="Apri la pagina dedicata ai sondaggi";
    btn.addEventListener("click",function(ev){
      if(window.self!==window.top)return;
      ev.preventDefault();
      ev.stopPropagation();
      window.location.href="sondaggi.html?v=20261009-1343";
    });
    side.appendChild(btn);
  }
}

loadLawEngine();
loadIntegrityGuard();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensure,{once:true});
else ensure();
setTimeout(ensure,200);
setTimeout(ensure,1000);
})();
