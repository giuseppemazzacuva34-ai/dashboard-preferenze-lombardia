(function(){
"use strict";
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
      ev.preventDefault();
      ev.stopPropagation();
      window.location.href="sondaggi.html";
    });
    side.appendChild(btn);
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensure,{once:true});
else ensure();
setTimeout(ensure,200);
setTimeout(ensure,1000);
})();
