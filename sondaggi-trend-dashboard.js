(function(){
"use strict";
const SRC="sondaggi-trend-2018-2022.js?v=20261012-trend7";
let loading=false,done=false;
function mount(){try{window.SONDAGGI_TREND_2018_2022?.mount?.();}catch(err){console.error("Trend dashboard mount",err);}}
function load(){
  if(window.SONDAGGI_TREND_2018_2022){done=true;mount();return;}
  if(loading)return;
  loading=true;
  let s=document.getElementById("sondaggi-trend-dashboard-loader");
  if(!s){s=document.createElement("script");s.id="sondaggi-trend-dashboard-loader";s.async=false;s.src=SRC;(document.head||document.documentElement).appendChild(s);}
  const finish=()=>{done=true;loading=false;mount();};
  s.addEventListener("load",finish,{once:true});
  s.addEventListener("error",()=>{loading=false;console.error("Impossibile caricare il modulo Trend storico.");},{once:true});
}
function ensure(){load();setTimeout(mount,50);setTimeout(mount,250);setTimeout(mount,750);}
function start(){ensure();let tries=0;const poll=setInterval(()=>{ensure();if(++tries>80)clearInterval(poll);},250);
 try{new MutationObserver(()=>{if(!document.getElementById("sg-trend-module"))ensure();}).observe(document.documentElement,{subtree:true,childList:true});}catch(_){}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
