(function(){
"use strict";
function fixHomeComuneCounter(){
  try{
    const wrong=/^(1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504)$/;
    const replaceWrong=(el)=>{
      if(!el)return;
      const t=String(el.textContent||"").trim();
      if(wrong.test(t)){el.textContent="1.501";return;}
      if(/\bCOMUNI\b/i.test(String(el.textContent||""))){
        el.textContent=String(el.textContent||"").replace(/1502|1503|1504|1\.502|1\.503|1\.504|1,502|1,503|1,504/g,"1.501");
      }
    };

    replaceWrong(document.getElementById("k-comuni"));

    const selectors=[
      "#homeQuick .quick-item",
      "#homeQuick .quick-item small",
      ".home-kpi",
      ".home-kpi strong",
      ".home-kpi small"
    ];
    document.querySelectorAll(selectors.join(",")).forEach(el=>{
      if(/\bCOMUNI\b/i.test(String(el.textContent||"")) ||
         el.matches?.("#homeQuick .quick-item small")){
        replaceWrong(el);
      }
    });
  }catch(err){console.error("Home comune counter fix",err);}
}
function boot(){
  fixHomeComuneCounter();
  setTimeout(fixHomeComuneCounter,150);
  setTimeout(fixHomeComuneCounter,500);
  setTimeout(fixHomeComuneCounter,1200);
}
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",boot,{once:true});
}else{
  boot();
}
window.addEventListener("load",boot);
})();
