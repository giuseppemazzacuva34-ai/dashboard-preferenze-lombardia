(function(){
"use strict";
const SG_DASH_VERSION="20261012-dashboard-loader-v4";

function loadScript(id,src){
  try{
    if(document.getElementById(id))return;
    const s=document.createElement("script");
    s.id=id;s.src=src;s.async=false;
    (document.head||document.documentElement).appendChild(s);
  }catch(err){console.error("Sondaggi script load",id,err);}
}
function loadMobileStyles(){
  try{
    if(document.getElementById("dashboard-mobile-css"))return;
    const link=document.createElement("link");
    link.id="dashboard-mobile-css";
    link.rel="stylesheet";
    link.href="dashboard-mobile.css?v=20261011-1";
    (document.head||document.documentElement).appendChild(link);
  }catch(err){console.error("Dashboard mobile styles",err);}
}
function loadLawEngine(){
  loadScript("sondaggi-law-20261008","sondaggi-law-20261008.js?v=20261009-legal");
}
function loadSondaggiApp(){
  loadScript("sondaggi-app-20261012","sondaggi-app.js?v=20261012-isolated-tests");
}
function loadIntegrityGuard(){
  loadScript("dashboard-runtime-integrity","dashboard-runtime-integrity.js?v=20261009-1");
}
loadMobileStyles();
loadLawEngine();
loadSondaggiApp();
loadIntegrityGuard();
})();