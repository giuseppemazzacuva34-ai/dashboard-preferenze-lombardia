/* ESTERO ELETTI — componente separata dal riparto nazionale
 * Legge elettorale C.2822-B approvata definitivamente l'8 ottobre 2026.
 * Camera: 8 seggi nella circoscrizione Estero, 2 ripartizioni.
 * Senato: 4 seggi sull'intera circoscrizione Estero.
 * I seggi Estero NON entrano nei massimali 220/113.
 */
(function(){
  "use strict";

  const KEY="lombardia_sondaggi_estero_v1";
  const CAM_SEATS=8;
  const SEN_SEATS=4;
  const CAM_RIP=[
    "Europa, compresi i territori asiatici della Federazione russa e della Turchia",
    "Americhe, Africa, Asia, Oceania e Antartide"
  ];

  function fresh(){
    return {
      camera:Array.from({length:CAM_SEATS},(_,i)=>({
        seat:i+1,nome:"",lista:"",
        ripartizione:""
      })),
      senato:Array.from({length:SEN_SEATS},(_,i)=>({
        seat:i+1,nome:"",lista:""
      }))
    };
  }

  function load(){
    try{
      const x=JSON.parse(localStorage.getItem(KEY)||"null");
      if(!x||typeof x!=="object") return fresh();
      const d=fresh();
      ["camera","senato"].forEach(ch=>{
        if(Array.isArray(x[ch])){
          d[ch]=d[ch].map((row,i)=>({
            ...row,
            ...(x[ch][i]||{}),
            seat:i+1
          }));
        }
      });
      return d;
    }catch(_){ return fresh(); }
  }

  let state=load();
  let scheduled=false;

  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){}
    updateSummary();
  }

  function esc(v){
    return String(v??"")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function norm(v){return String(v??"").trim();}
  function validCount(ch){
    return state[ch].filter(x=>norm(x.nome)).length;
  }

  function partyTotals(ch){
    const map={};
    state[ch].forEach(x=>{
      const p=norm(x.lista);
      if(p)map[p]=(map[p]||0)+1;
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"it"));
  }

  function updateSummary(){
    const host=document.getElementById("sg7EsteroSummary");
    if(!host)return;
    const ct=validCount("camera"), st=validCount("senato");
    const cp=partyTotals("camera"), sp=partyTotals("senato");
    host.innerHTML=
      '<div class="sg7e-summary-grid">'+
        '<div><b>Camera</b><strong>'+ct+' / '+CAM_SEATS+'</strong><span>8 seggi Estero</span></div>'+
        '<div><b>Senato</b><strong>'+st+' / '+SEN_SEATS+'</strong><span>4 seggi Estero</span></div>'+
      '</div>'+
      '<div class="sg7e-note">Questi '+CAM_SEATS+' seggi alla Camera e '+SEN_SEATS+' al Senato sono conteggiati separatamente: non vengono sottratti al limite di 220/113 del vincitore.</div>'+
      ((cp.length||sp.length)?(
        '<div class="sg7e-party-title">Seggi Estero per lista</div>'+
        '<div class="sg7e-party-grid">'+
          '<div><b>Camera</b>'+(cp.length?cp.map(x=>'<span>'+esc(x[0])+' <strong>'+x[1]+'</strong></span>').join(""):'<em>Nessun eletto inserito</em>')+'</div>'+
          '<div><b>Senato</b>'+(sp.length?sp.map(x=>'<span>'+esc(x[0])+' <strong>'+x[1]+'</strong></span>').join(""):'<em>Nessun eletto inserito</em>')+'</div>'+
        '</div>'
      ):"");

  }

  function rowCamera(row,i){
    return '<tr>'+
      '<td class="num">'+(i+1)+'</td>'+
      '<td><input data-ch="camera" data-i="'+i+'" data-k="nome" value="'+esc(row.nome)+'" placeholder="Nome e cognome"></td>'+
      '<td><input data-ch="camera" data-i="'+i+'" data-k="lista" value="'+esc(row.lista)+'" placeholder="Lista / partito"></td>'+
      '<td><select data-ch="camera" data-i="'+i+'" data-k="ripartizione">'+
        '<option value="">Da assegnare</option>'+
        CAM_RIP.map(r=>'<option value="'+esc(r)+'"'+(row.ripartizione===r?' selected':'')+'>'+esc(r)+'</option>').join("")+
      '</select></td>'+
    '</tr>';
  }

  function rowSenate(row,i){
    return '<tr>'+
      '<td class="num">'+(i+1)+'</td>'+
      '<td><input data-ch="senato" data-i="'+i+'" data-k="nome" value="'+esc(row.nome)+'" placeholder="Nome e cognome"></td>'+
      '<td><input data-ch="senato" data-i="'+i+'" data-k="lista" value="'+esc(row.lista)+'" placeholder="Lista / partito"></td>'+
    '</tr>';
  }

  function render(){
    const sg=document.getElementById("sg7");
    const content=document.getElementById("sg7content");
    if(!sg||!content)return false;

    let box=document.getElementById("sg7EsteroBox");
    if(box)return true;

    box=document.createElement("details");
    box.id="sg7EsteroBox";
    box.open=false;
    box.className="sg7e-box";
    box.innerHTML=
      '<summary><span>ELETTI CIRCOSCRIZIONE ESTERO</span><small>8 Camera · 4 Senato · separati dal riparto nazionale</small></summary>'+
      '<div class="sg7e-body">'+
        '<div class="sg7e-top">'+
          '<div><b>Gestione manuale degli eletti</b><p>Inserisci i nomi risultanti dall’analisi della circoscrizione Estero. Il modulo non usa questi dati per calcolare il premio o il limite 220/113.</p></div>'+
          '<div class="sg7e-actions"><button type="button" id="sg7EsteroReset">Azzera eletti</button></div>'+
        '</div>'+
        '<div id="sg7EsteroSummary"></div>'+
        '<section><h4>Camera dei deputati — 8 eletti</h4>'+
          '<div class="sg7e-table-wrap"><table><thead><tr><th>#</th><th>Nome e cognome</th><th>Lista / partito</th><th>Ripartizione</th></tr></thead><tbody id="sg7EsteroCamRows">'+state.camera.map(rowCamera).join("")+'</tbody></table></div>'+
        '</section>'+
        '<section><h4>Senato della Repubblica — 4 eletti</h4>'+
          '<div class="sg7e-table-wrap"><table><thead><tr><th>#</th><th>Nome e cognome</th><th>Lista / partito</th></tr></thead><tbody id="sg7EsteroSenRows">'+state.senato.map(rowSenate).join("")+'</tbody></table></div>'+
        '</section>'+
      '</div>';

    const anchor=content;
    anchor.parentElement.appendChild(box);

    const style=document.createElement("style");
    style.textContent=
      '.sg7e-box{margin:16px 0 20px;border:1px solid rgba(145,180,205,.28);border-radius:16px;background:linear-gradient(180deg,rgba(7,25,42,.98),rgba(5,19,32,.98));color:#e8f1f7;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.18)}'+
      '.sg7e-box>summary{cursor:pointer;list-style:none;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:800;letter-spacing:.02em}'+
      '.sg7e-box>summary::-webkit-details-marker{display:none}.sg7e-box>summary span{font-size:14px}.sg7e-box>summary small{font-size:11px;font-weight:600;color:#86a5b8;text-align:right}'+
      '.sg7e-body{padding:0 18px 18px}.sg7e-top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:2px 0 10px}.sg7e-top p{margin:5px 0 0;color:#91a8b7;font-size:12px;line-height:1.45}.sg7e-actions button{border:1px solid rgba(255,255,255,.18);background:#0d263b;color:#dceaf3;border-radius:9px;padding:8px 11px;font-weight:700;cursor:pointer}.sg7e-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:8px 0 10px}.sg7e-summary-grid>div,.sg7e-party-grid>div{border:1px solid rgba(145,180,205,.18);background:rgba(255,255,255,.025);border-radius:12px;padding:11px 12px}.sg7e-summary-grid b,.sg7e-party-title{display:block;color:#91a8b7;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.sg7e-summary-grid strong{display:block;font-size:22px;margin:2px 0}.sg7e-summary-grid span{color:#91a8b7;font-size:11px}.sg7e-note{font-size:11px;color:#a9c0ce;background:rgba(37,122,86,.11);border:1px solid rgba(37,122,86,.25);border-radius:10px;padding:9px 11px;margin-bottom:12px}.sg7e-party-title{margin:12px 0 7px}.sg7e-party-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}.sg7e-party-grid b{display:block;margin-bottom:5px;color:#a9c0ce;font-size:12px}.sg7e-party-grid span{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid rgba(255,255,255,.05);font-size:12px}.sg7e-party-grid em{color:#718b9b;font-size:11px}.sg7e-box section{margin-top:14px}.sg7e-box h4{margin:0 0 8px;font-size:13px}.sg7e-table-wrap{overflow:auto;border:1px solid rgba(145,180,205,.14);border-radius:10px}.sg7e-box table{width:100%;border-collapse:collapse;min-width:700px}.sg7e-box th,.sg7e-box td{padding:8px 9px;border-bottom:1px solid rgba(145,180,205,.1);font-size:11px;vertical-align:middle}.sg7e-box th{text-align:left;color:#87a1b1;font-size:10px;text-transform:uppercase;letter-spacing:.05em;background:rgba(255,255,255,.025)}.sg7e-box td.num{width:28px;text-align:center;color:#86a5b8}.sg7e-box input,.sg7e-box select{width:100%;box-sizing:border-box;border:1px solid rgba(145,180,205,.2);background:#081827;color:#e9f2f7;border-radius:7px;padding:7px 8px;min-height:32px}.sg7e-box input::placeholder{color:#587284}@media(max-width:760px){.sg7e-top,.sg7e-summary-grid,.sg7e-party-grid{grid-template-columns:1fr;display:grid}.sg7e-box>summary{align-items:flex-start;flex-direction:column}.sg7e-box>summary small{text-align:left}}';
    document.head.appendChild(style);

    box.querySelectorAll("input,select").forEach(el=>{
      el.addEventListener("change",()=>{
        const ch=el.dataset.ch, i=Number(el.dataset.i), k=el.dataset.k;
        if(state[ch]&&state[ch][i]){
          state[ch][i][k]=el.value;
          save();
        }
      });
    });

    box.querySelector("#sg7EsteroReset")?.addEventListener("click",()=>{
      if(!confirm("Azzerare tutti gli eletti della circoscrizione Estero?"))return;
      state=fresh(); save();
      const cam=document.getElementById("sg7EsteroCamRows");
      const sen=document.getElementById("sg7EsteroSenRows");
      if(cam)cam.innerHTML=state.camera.map(rowCamera).join("");
      if(sen)sen.innerHTML=state.senato.map(rowSenate).join("");
      bindRows(box);
      updateSummary();
    });

    updateSummary();
    return true;
  }

  function bindRows(box){
    box.querySelectorAll("input,select").forEach(el=>{
      if(el.dataset.bound)return;
      el.dataset.bound="1";
      el.addEventListener("change",()=>{
        const ch=el.dataset.ch, i=Number(el.dataset.i), k=el.dataset.k;
        if(state[ch]&&state[ch][i]){
          state[ch][i][k]=el.value;
          save();
        }
      });
    });
  }

  function ensure(){
    const sg=document.getElementById("sg7");
    if(!sg)return;
    if(render()){
      const box=document.getElementById("sg7EsteroBox");
      if(box)bindRows(box);
      updateSummary();
    }
  }

  function boot(){
    ensure();
    setTimeout(ensure,150);
    setTimeout(ensure,500);
    setTimeout(ensure,1200);
  }

  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;ensure();});
  });

  function start(){
    const sg=document.getElementById("sg7");
    const content=document.getElementById("sg7content");
    if(sg&&content){
      observer.observe(content,{childList:true,subtree:true});
      boot();
      return true;
    }
    return false;
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{
      let tries=0;
      const t=setInterval(()=>{if(start()||++tries>120)clearInterval(t);},100);
    },{once:true});
  }else{
    let tries=0;
    const t=setInterval(()=>{if(start()||++tries>120)clearInterval(t);},100);
  }
})();
