(function(){
"use strict";

function loadIntegrityGuard(){
  try{
    if(document.getElementById("dashboard-runtime-integrity")) return;
    const s=document.createElement("script");
    s.id="dashboard-runtime-integrity";
    s.src="dashboard-runtime-integrity.js?v=20261009-1";
    s.async=false;
    (document.head||document.documentElement).appendChild(s);
  }catch(err){
    console.error("Dashboard integrity guard load",err);
  }
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
      // Nella dashboard normale apriamo la pagina autonoma.
      // Dentro la pagina autonoma (iframe same-origin) lasciamo invece
      // funzionare il navigatore nativo della dashboard, che apre il modulo
      // Sondaggi completo già presente nell'applicazione.
      if(window.self!==window.top)return;
      ev.preventDefault();
      ev.stopPropagation();
      window.location.href="sondaggi.html?v=20261009-1343";
    });
    side.appendChild(btn);
  }
}

loadIntegrityGuard();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensure,{once:true});
else ensure();
setTimeout(ensure,200);
setTimeout(ensure,1000);
})();
