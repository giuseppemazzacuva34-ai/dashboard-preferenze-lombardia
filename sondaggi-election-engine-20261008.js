/* SONDAGGI — MOTORE DI RIPARTO STATUTARIO 08/10/2026
 *
 * Motore puro per la simulazione della nuova legge elettorale approvata
 * definitivamente l'8 ottobre 2026.
 *
 * Principi:
 * - il motore non legge né modifica il core elettorale della dashboard;
 * - opera su cifre di voto/pseudo-voto fornite dall'app;
 * - applica quozienti interi, maggiori resti, compensazioni e troncamenti
 *   previsti dalla disciplina;
 * - il sorteggio previsto dalla legge è rappresentato con un pareggio
 *   marcato e risolto in modo deterministico solo per rendere riproducibile
 *   la simulazione. Non viene presentato come esito reale di un sorteggio.
 *
 * Nota metodologica:
 * una percentuale di sondaggio territoriale non è una cifra elettorale.
 * Per trasferire percentuali tra collegi diversi, l'app fornisce un peso
 * territoriale. In assenza di un peso esplicito usiamo la dotazione di seggi
 * ordinaria del collegio come proxy neutra; questo è un passaggio di
 * simulazione, non una regola della legge.
 */
(function(root){
  "use strict";

  const SCALE = 1000000;

  function num(v){
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  }

  function cleanPositive(v){
    return Math.max(0,num(v));
  }

  function trunc6(v){
    return Math.trunc(num(v)*1e6)/1e6;
  }

  function hashKey(key){
    const s=String(key??"");
    let h=2166136261;
    for(let i=0;i<s.length;i++){
      h^=s.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    h^=h>>>13;
    h=Math.imul(h,2246822519);
    h^=h>>>16;
    return h>>>0;
  }

  function tieOrder(a,b){
    const ha=hashKey(a.id), hb=hashKey(b.id);
    return ha-hb || String(a.id).localeCompare(String(b.id),"it");
  }

  function scaled(v){
    return Math.max(0,Math.round(cleanPositive(v)*SCALE));
  }

  function sumObject(obj,keys){
    return (keys||Object.keys(obj||{})).reduce((a,k)=>a+cleanPositive(obj?.[k]),0);
  }

  function parseCollegeMap(rawMap){
    const out=[];
    Object.entries(rawMap||{}).forEach(([region,items])=>{
      (items||[]).forEach(raw=>{
        const p=String(raw).split("|");
        const name=p[0];
        const noPrize=cleanPositive(p[1]);
        const withPrize=cleanPositive(p[2]??p[1]);
        const special=String(p[3]||"").toUpperCase()==="SPECIAL" ||
          String(name).includes(" - U");
        if(!name)return;
        out.push({
          region,
          name,
          noPrizeSeats:noPrize,
          withPrizeSeats:withPrize,
          prizeSeats:Math.max(0,noPrize-withPrize),
          special
        });
      });
    });
    return out;
  }

  function buildCameraCircumscriptions(rawMap){
    const colleges=parseCollegeMap(rawMap);
    const out={};
    colleges.forEach(c=>{
      if(c.special)return;
      const circ=c.name.replace(/\s-\sP\d+$/,"");
      out[circ]??={
        id:circ,
        name:circ,
        region:c.region,
        noPrizeSeats:0,
        withPrizeSeats:0,
        prizeSeats:0,
        colleges:[]
      };
      out[circ].noPrizeSeats+=c.noPrizeSeats;
      out[circ].withPrizeSeats+=c.withPrizeSeats;
      out[circ].prizeSeats+=c.prizeSeats;
      out[circ].colleges.push(c);
    });
    return out;
  }

  function defaultCollegeWeight(college,explicitWeights){
    const explicit=cleanPositive(explicitWeights?.[college.name]);
    return explicit>0?explicit:Math.max(1,cleanPositive(college.noPrizeSeats));
  }

  function collegeValue(collegeValues,collegeName,slug,fallback=0){
    const bucket=collegeValues?.[collegeName];
    const v=bucket?.[slug];
    return v==null?cleanPositive(fallback):cleanPositive(v);
  }

  function cameraCollegeFigures(collegeValues,parties,cameraMap,bonusActive){
    const rows=parseCollegeMap(cameraMap).filter(c=>!c.special);
    const figures={};
    const weights={};
    rows.forEach(c=>{
      const weight=defaultCollegeWeight(c);
      weights[c.name]=weight;
      figures[c.name]={};
      Object.keys(parties||{}).forEach(k=>{
        const fallback=parties?.[k]?.camera??0;
        figures[c.name][k]=collegeValue(collegeValues,c.name,k,fallback)*weight;
      });
    });
    return {figures,weights};
  }

  function stableSorted(items,compare){
    return items.slice().sort(compare||tieOrder);
  }

  /*
   * Metodo dei quozienti interi e maggiori resti:
   * q = parte intera(total/seggi)
   * base = parte intera(voto/q)
   * residuo = voto/q - base
   *
   * I dati di un sondaggio sono scalati per evitare quozienti nulli dovuti
   * alla piccola scala delle percentuali.
   */
  function quotientAllocate(items,seats,tieVoteFn){
    const clean=(items||[])
      .map(x=>({id:String(x.id),votes:scaled(x.votes),raw:cleanPositive(x.votes)}))
      .filter(x=>x.votes>0);
    const target=Math.max(0,Math.floor(num(seats)));
    const out={};
    const remainders={};
    const remainderWinners=new Set();
    if(!clean.length||!target)return {
      seats:out,remainders,remainderWinners:[...remainderWinners],quota:0,totalVotes:0,baseSeats:0,
      remainderSeats:0,sorteggi:0
    };

    const total=clean.reduce((a,x)=>a+x.votes,0);
    const quota=Math.floor(total/target);
    if(quota<=0){
      const norm=clean.reduce((a,x)=>a+x.raw,0);
      let remaining=target;
      const ranked=clean.map(x=>({
        id:x.id,
        raw:x.raw,
        rest:norm>0?(target*x.raw/norm):0
      })).map(x=>({
        ...x,
        base:Math.floor(x.rest),
        decimal:x.rest-Math.floor(x.rest)
      }));
      ranked.forEach(x=>{out[x.id]=x.base;remainders[x.id]=x.decimal;remaining-=x.base;});
      const max=stableSorted(ranked,(a,b)=>
        b.decimal-a.decimal ||
        cleanPositive(tieVoteFn?.(b.id,b))-(cleanPositive(tieVoteFn?.(a.id,a))) ||
        b.raw-a.raw ||
        tieOrder(a,b)
      );
      let sorteggi=0;
      for(const x of max){
        if(remaining<=0)break;
        out[x.id]=(out[x.id]||0)+1;
        remainderWinners.add(x.id);
        remaining--;
      }
      return {seats:out,remainders,remainderWinners:[...remainderWinners],quota:0,totalVotes:total,
        baseSeats:target-remaining,remainderSeats:remaining,sorteggi};
    }

    let baseSeats=0;
    clean.forEach(x=>{
      const exact=x.votes/quota;
      const base=Math.floor(exact);
      out[x.id]=base;
      remainders[x.id]=exact-base;
      baseSeats+=base;
    });

    let remaining=target-baseSeats;
    /*
     * In dati reali la parte intera non eccede il totale dei seggi. Se una
     * percentuale sintetica estrema producesse un overflow, la tratteniamo
     * a target e segnalamo l'evento nella traccia invece di generare seggi
     * impossibili.
     */
    if(remaining<0){
      const ranked=stableSorted(clean.map(x=>({
        ...x,base:out[x.id],rest:remainders[x.id]
      })),(a,b)=>
        a.rest-b.rest || a.raw-b.raw || tieOrder(a,b)
      );
      let overflow=-remaining;
      for(const x of ranked){
        if(!overflow)break;
        const take=Math.min(out[x.id]||0,overflow);
        out[x.id]-=take;
        overflow-=take;
      }
      baseSeats=Object.values(out).reduce((a,v)=>a+v,0);
      remaining=target-baseSeats;
    }

    let sorteggi=0;
    const ranked=stableSorted(clean.map(x=>({
      id:x.id,
      raw:x.raw,
      rest:remainders[x.id]||0
    })),(a,b)=>{
      const d=b.rest-a.rest;
      if(Math.abs(d)>1e-15)return d;
      const tv=cleanPositive(tieVoteFn?.(b.id,b))-cleanPositive(tieVoteFn?.(a.id,a));
      if(Math.abs(tv)>1e-15)return tv;
      if(a.raw!==b.raw)return b.raw-a.raw;
      sorteggi++;
      return tieOrder(a,b);
    });

    for(const x of ranked){
      if(remaining<=0)break;
      out[x.id]=(out[x.id]||0)+1;
      remainderWinners.add(x.id);
      remaining--;
    }

    return {
      seats:out,
      remainders,
      remainderWinners:[...remainderWinners],
      quota,
      totalVotes:total,
      baseSeats,
      remainderSeats:target-baseSeats,
      sorteggi
    };
  }

  function mapCoalitions(coalitions){
    const m={};
    (coalitions||[]).forEach(co=>{
      (co.members||[]).forEach(k=>{if(k&&!m[k])m[k]=co.id;});
    });
    return m;
  }

  function coalitionStats(co,values,chamber,law,regionalValues){
    const members=(co?.members||[]).filter(Boolean);
    const total=members.reduce((a,k)=>a+cleanPositive(values?.[k]),0);
    const gate=members.some(k=>cleanPositive(values?.[k])>=law.rules.national.thresholdMemberForCoalitionQualification);
    const qualifies=total>=law.rules.national.thresholdCoalition&&gate;
    if(!qualifies)return {
      qualifies:false,total,admitted:[],ripCandidate:null,
      allocationFigure:0,premiumFigure:0
    };

    const admitted=members.filter(k=>{
      if(chamber==="senato"){
        return cleanPositive(values?.[k])>=law.rules.national.thresholdList ||
          cleanPositive(regionalValues?.[k])>=law.rules.national.regionalSenateException;
      }
      return cleanPositive(values?.[k])>=law.rules.national.thresholdList;
    });

    const excluded=members.filter(k=>!admitted.includes(k))
      .sort((a,b)=>{
        const d=cleanPositive(values?.[b])-cleanPositive(values?.[a]);
        return d||String(a).localeCompare(String(b),"it");
      });

    const ripCandidate=excluded[0]||null;
    const splitKeys=[...admitted];
    if(ripCandidate)splitKeys.push(ripCandidate);

    const allocationFigure=splitKeys.reduce((a,k)=>{
      return a+cleanPositive(
        chamber==="senato" && regionalValues
          ?regionalValues[k]
          :values?.[k]
      );
    },0);

    const premiumFigure=admitted.reduce((a,k)=>{
      return a+cleanPositive(values?.[k]);
    },0);

    return {
      qualifies:true,
      total,
      admitted,
      ripCandidate,
      allocationFigure,
      premiumFigure
    };
  }

  function nationalUnits(values,chamber,coalitions,law){
    const cmap=mapCoalitions(coalitions);
    const units=[];
    const byCoalition={};
    const covered=new Set();

    (coalitions||[]).forEach(co=>{
      const stats=coalitionStats(co,values,chamber,law,null);
      if(!stats.qualifies)return;
      const members=[...stats.admitted];
      if(stats.ripCandidate&&!members.includes(stats.ripCandidate))
        members.push(stats.ripCandidate);
      if(!members.length)return;
      const u={
        id:"C:"+co.id,
        type:"coalition",
        coalitionId:co.id,
        name:co.name,
        members,
        allMembers:[...(co.members||[])],
        ripCandidate:stats.ripCandidate,
        votes:stats.allocationFigure
      };
      units.push(u);
      byCoalition[co.id]=stats;
      (co.members||[]).forEach(k=>covered.add(k));
    });

    /*
     * Le liste appartenenti a una coalizione non qualificata accedono dal 2%;
     * le liste non collegate restano soggette al 3%. Le liste di una
     * coalizione qualificata sono già rappresentate dall'unità coalizione.
     */
    Object.keys(values||{}).forEach(k=>{
      if(k==="ALTRI"||covered.has(k))return;
      const v=cleanPositive(values?.[k]);
      const coId=cmap[k];
      const threshold=coId
        ?law.rules.national.thresholdMemberForCoalitionQualification
        :law.rules.national.thresholdList;
      if(v<threshold)return;
      units.push({
        id:"P:"+k,
        type:"list",
        name:k,
        members:[k],
        allMembers:[k],
        votes:v,
        coalitionId:null,
        ripCandidate:null
      });
    });

    return {units,byCoalition,cmap};
  }

  function splitCoalitionNational(unit,seatCount,values){
    if(unit.type!=="coalition")return {[unit.members[0]]:seatCount};
    const items=(unit.members||[]).map(k=>({id:k,votes:values?.[k]||0}));
    return quotientAllocate(items,seatCount,(k)=>values?.[k]||0);
  }

  function nationalListTargets(unitSeats,units,values){
    const out={};
    const detail={};
    units.forEach(u=>{
      const count=Math.max(0,Math.floor(unitSeats?.[u.id]||0));
      if(!count)return;
      const split=splitCoalitionNational(u,count,values);
      detail[u.id]=split;
      Object.entries(split).forEach(([k,v])=>{out[k]=(out[k]||0)+v;});
    });
    return {listTargets:out,splitDetail:detail};
  }

  function cameraFigureByCirc(circ,cameraFigures,slug){
    return (Object.values(cameraFigures?.[circ]?.figures||{}).length===0)?0:
      Object.values(cameraFigures?.[circ]?.figures||{})
        .reduce((a,vals)=>a+cleanPositive(vals?.[slug]),0);
  }

  function buildCircValues(cameraMap,collegeValues,parties,explicitWeights){
    const circum=buildCameraCircumscriptions(cameraMap);
    const all=Object.fromEntries(Object.keys(circum).map(c=>[c,{figures:{},colleges:circum[c].colleges}]));
    circum && Object.entries(circum).forEach(([circ,rec])=>{
      rec.colleges.forEach(col=>{
        const weight=defaultCollegeWeight(col,explicitWeights);
        const bucket=collegeValues?.[col.name]||{};
        all[circ].figures[col.name]={};
        Object.keys(parties||{}).forEach(k=>{
          const fallback=parties?.[k]?.camera??0;
          all[circ].figures[col.name][k]=cleanPositive(bucket[k]??fallback)*weight;
        });
      });
    });
    return all;
  }

  function calcCircListFigures(circData,slug){
    return Object.values(circData?.figures||{}).reduce((a,x)=>a+cleanPositive(x?.[slug]),0);
  }

  function calcCircUnitFigure(unit,circData){
    return (unit.members||[]).reduce((a,k)=>a+calcCircListFigures(circData,k),0);
  }

  function nationalUnitById(units,id){
    return (units||[]).find(u=>u.id===id)||null;
  }

  function getCircSeats(circ,bonusActive){
    return bonusActive?circ.withPrizeSeats:circ.noPrizeSeats;
  }

  function groupCircAllocation({
    units,
    nationalTargets,
    circum,
    circData,
    bonusActive,
    majorityIds,
    minorityIds,
    majorityNationalQuotient,
    minorityNationalQuotient
  }){
    const byCirc={};
    const unitRemaindersByCirc={};
    const targetByUnit={...nationalTargets};

    Object.entries(circum).forEach(([circId,circ])=>{
      const seats=getCircSeats(circ,bonusActive);
      byCirc[circId]={};
      unitRemaindersByCirc[circId]={};
      if(!seats)return;

      const scored=(units||[])
        .filter(u=>(targetByUnit[u.id]||0)>0)
        .map(u=>{
          const figure=calcCircUnitFigure(u,circData[circId]);
          const majority=majorityIds.has(u.id);
          const q=majority?majorityNationalQuotient:minorityNationalQuotient;
          const index=q>0?trunc6(figure/q):0;
          return {id:u.id,figure,index,majority};
        })
        .filter(x=>x.index>0);

      const indexSum=scored.reduce((a,x)=>a+x.index,0);
      const provisional=scored.map(x=>{
        const exact=indexSum>0?(x.index*seats/indexSum):0;
        const base=Math.floor(exact);
        const rest=exact-base;
        return {...x,base,rest};
      });

      let used=provisional.reduce((a,x)=>a+x.base,0);
      provisional.forEach(x=>{
        byCirc[circId][x.id]=x.base;
        unitRemaindersByCirc[circId][x.id]=x.rest;
      });

      const ranked=stableSorted(provisional,(a,b)=>{
        const d=b.rest-a.rest;
        if(Math.abs(d)>1e-15)return d;
        const av=calcCircUnitFigure(nationalUnitById(units,a.id),circData[circId]);
        const bv=calcCircUnitFigure(nationalUnitById(units,b.id),circData[circId]);
        return bv-av||tieOrder(a,b);
      });

      for(const x of ranked){
        if(used>=seats)break;
        if((byCirc[circId][x.id]||0)>=targetByUnit[x.id])continue;
        byCirc[circId][x.id]=(byCirc[circId][x.id]||0)+1;
        used++;
      }
    });

    /*
     * Compensazione nazionale ↔ circoscrizioni:
     * per ogni unità eccedentaria si sottrae un seggio nel collegio con il
     * minore resto; se nello stesso collegio esiste un'unità deficitaria,
     * si trasferisce al maggiore resto non utilizzato.
     */
    const nationalTotals={};
    (units||[]).forEach(u=>{nationalTotals[u.id]=0;});
    Object.values(byCirc).forEach(m=>{
      Object.entries(m).forEach(([id,v])=>{
        nationalTotals[id]=(nationalTotals[id]||0)+Math.floor(num(v));
      });
    });

    const maxLoops=10000;
    let loops=0;
    while(loops++<maxLoops){
      const over=units.filter(u=>nationalTotals[u.id]>(targetByUnit[u.id]||0));
      const under=units.filter(u=>nationalTotals[u.id]<(targetByUnit[u.id]||0));
      if(!over.length||!under.length)break;
      let moved=false;

      const donors=stableSorted(over,(a,b)=>{
        const da=nationalTotals[a.id]-(targetByUnit[a.id]||0);
        const db=nationalTotals[b.id]-(targetByUnit[b.id]||0);
        return db-da||String(a.id).localeCompare(String(b.id),"it");
      });

      for(const donor of donors){
        const donorCircs=Object.keys(byCirc)
          .filter(c=>num(byCirc[c]?.[donor.id])>0)
          .sort((a,b)=>{
            const ra=unitRemaindersByCirc[a]?.[donor.id]??0;
            const rb=unitRemaindersByCirc[b]?.[donor.id]??0;
            return ra-rb||a.localeCompare(b,"it");
          });
        if(!donorCircs.length)continue;

        for(const circId of donorCircs){
          const receivers=under.filter(u=>num(byCirc[circId]?.[u.id])<
            (targetByUnit[u.id]||0))
            .sort((a,b)=>{
              const rb=unitRemaindersByCirc[circId]?.[b.id]??-1;
              const ra=unitRemaindersByCirc[circId]?.[a.id]??-1;
              return rb-ra||String(a.id).localeCompare(String(b.id),"it");
            });
          if(!receivers.length)continue;

          const receiver=receivers[0];
          byCirc[circId][donor.id]-=1;
          byCirc[circId][receiver.id]=(byCirc[circId][receiver.id]||0)+1;
          nationalTotals[donor.id]--;
          nationalTotals[receiver.id]++;
          moved=true;
          break;
        }
        if(moved)break;
      }
      if(!moved)break;
    }

    const deficits=Object.fromEntries(
      units.filter(u=>nationalTotals[u.id]!==(targetByUnit[u.id]||0))
        .map(u=>[u.id,(targetByUnit[u.id]||0)-nationalTotals[u.id]])
    );

    return {byCirc,unitRemaindersByCirc,nationalTotals,deficits};
  }

  function distributeSimpleListsToCircs({
    listTargets,
    units,
    unitCirc,
    circData,
    circum,
    bonusActive,
    parties,
    collegeValues
  }){
    const listByCirc={};
    const listRemainders={};

    Object.entries(unitCirc.byCirc).forEach(([circId,unitMap])=>{
      listByCirc[circId]={};
      listRemainders[circId]={};
      Object.entries(unitMap).forEach(([unitId,count])=>{
        const unit=nationalUnitById(units,unitId);
        if(!unit||!count)return;
        if(unit.type==="list"){
          const k=unit.members[0];
          listByCirc[circId][k]=(listByCirc[circId][k]||0)+count;
          return;
        }

        const items=(unit.members||[]).map(k=>({
          id:k,
          votes:calcCircListFigures(circData[circId],k)
        })).filter(x=>x.votes>0);
        const split=quotientAllocate(items,count,(k)=>parties?.[k]?.camera||0);
        Object.entries(split.seats).forEach(([k,v])=>{
          listByCirc[circId][k]=(listByCirc[circId][k]||0)+v;
        });
        Object.entries(split.remainders).forEach(([k,v])=>{
          listRemainders[circId][k]=v;
        });
      });
    });

    /*
     * Il riparto interno di coalizione va ricondotto ai totali nazionali
     * spettanti alle liste. Se una lista è deficitaria, il seggio viene
     * trasferito all'interno della stessa circoscrizione usando i resti non
     * utilizzati; quando ciò non è possibile si passa al resto non utilizzato
     * più alto della lista deficitaria.
     */
    const totals={};
    Object.keys(listTargets||{}).forEach(k=>{totals[k]=0;});
    Object.values(listByCirc).forEach(m=>{
      Object.entries(m).forEach(([k,v])=>{totals[k]=(totals[k]||0)+v;});
    });

    const targets={...listTargets};
    let loops=0;
    while(loops++<10000){
      const over=Object.keys(targets).filter(k=>(totals[k]||0)>=(targets[k]||0)+1);
      const under=Object.keys(targets).filter(k=>(totals[k]||0)<(targets[k]||0));
      if(!over.length||!under.length)break;
      let moved=false;
      for(const donor of over.sort()){
        const cands=Object.keys(listByCirc)
          .filter(c=>num(listByCirc[c]?.[donor])>0)
          .sort((a,b)=>(listRemainders[a]?.[donor]??0)-(listRemainders[b]?.[donor]??0)||a.localeCompare(b,"it"));
        for(const circId of cands){
          const donorUnit=units.find(u=>u.members?.includes(donor));
          const receivers=under.filter(k=>{
            const receiverUnit=units.find(u=>u.members?.includes(k));
            // La compensazione della ripartizione interna riguarda la sola
            // coalizione di appartenenza; una lista singola non può cedere
            // seggi a una coalizione diversa.
            if(!receiverUnit)return false;
            if(donorUnit?.type==="coalition")
              return receiverUnit.type==="coalition" &&
                receiverUnit.coalitionId===donorUnit.coalitionId;
            return receiverUnit.type!=="coalition" && receiverUnit.members?.[0]===donor;
          }).sort((a,b)=>
            (listRemainders[circId]?.[b]??-1)-(listRemainders[circId]?.[a]??-1)||
            String(a).localeCompare(String(b),"it")
          );
          if(!receivers.length)continue;
          const receiver=receivers[0];
          listByCirc[circId][donor]--;
          listByCirc[circId][receiver]=(listByCirc[circId][receiver]||0)+1;
          totals[donor]--;
          totals[receiver]++;
          moved=true;
          break;
        }
        if(moved)break;
      }
      if(!moved)break;
    }

    return {listByCirc,listRemainders,totals};
  }

  function allocateListsToColleges(listByCirc,circData,circum,parties,bonusActive){
    const collegeByList={};
    const detailed={};

    Object.entries(listByCirc||{}).forEach(([circId,listMap])=>{
      const rec=circum[circId];
      detailed[circId]={};
      if(!rec)return;

      Object.entries(listMap).forEach(([slug,targetSeats])=>{
        const target=Math.floor(num(targetSeats));
        if(!target)return;

        const relevant=rec.colleges.map(col=>({
          id:col.name,
          votes:cleanPositive(circData[circId]?.figures?.[col.name]?.[slug]||0),
          seats:bonusActive?col.withPrizeSeats:col.noPrizeSeats
        }));

        const circFigure=relevant.reduce((a,x)=>a+x.votes,0);
        const q=Math.floor(circFigure/target);
        const alloc={};
        const rem={};
        if(q>0){
          let used=0;
          relevant.forEach(x=>{
            if(!(x.seats>0))return;
            const exact=x.votes/q;
            const base=Math.floor(exact);
            alloc[x.id]=base;
            rem[x.id]=exact-base;
            used+=base;
          });

          const ranked=stableSorted(relevant.map(x=>({
            id:x.id,
            rest:rem[x.id]||0,
            votes:x.votes
          })),(a,b)=>
            (b.rest-a.rest) ||
            cleanPositive(parties?.[slug]?.camera)-cleanPositive(parties?.[slug]?.camera) ||
            (b.votes-a.votes) ||
            tieOrder(a,b)
          );

          for(const x of ranked){
            if(used>=target)break;
            if((alloc[x.id]||0)>=Number(relevant.find(y=>y.id===x.id)?.seats||0))continue;
            alloc[x.id]=(alloc[x.id]||0)+1;
            used++;
          }
        }else{
          const valid=relevant.filter(x=>x.votes>0&&x.seats>0);
          const total=valid.reduce((a,x)=>a+x.votes,0);
          if(total>0){
            let used=0;
            valid.forEach(x=>{
              const exact=target*x.votes/total;
              const base=Math.floor(exact);
              alloc[x.id]=base; rem[x.id]=exact-base; used+=base;
            });
            valid.sort((a,b)=>rem[b.id]-rem[a.id]||b.votes-a.votes||tieOrder({id:a.id},{id:b.id}));
            for(const x of valid){
              if(used>=target)break;
              alloc[x.id]=(alloc[x.id]||0)+1;
              used++;
            }
          }
        }

        /*
         * Compensazione interna al collegio:
         * somma dei collegi = seggi della lista in circoscrizione.
         */
        let totalAlloc=Object.values(alloc).reduce((a,v)=>a+v,0);
        if(totalAlloc!==target){
          const ranked=rec.colleges.slice().filter(c=>(bonusActive?c.withPrizeSeats:c.noPrizeSeats)>0)
            .map(c=>({id:c.name,votes:cleanPositive(circData[circId]?.figures?.[c.name]?.[slug]||0),rest:rem[c.name]??-1}))
            .sort((a,b)=>b.rest-a.rest||b.votes-a.votes||tieOrder(a,b));
          while(totalAlloc<target&&ranked.length){
            const x=ranked.shift();
            if((alloc[x.id]||0)<(bonusActive?rec.colleges.find(c=>c.name===x.id).withPrizeSeats:rec.colleges.find(c=>c.name===x.id).noPrizeSeats)){
              alloc[x.id]=(alloc[x.id]||0)+1; totalAlloc++;
            }
          }
          while(totalAlloc>target){
            const x=ranked.slice().reverse().find(y=>(alloc[y.id]||0)>0);
            if(!x)break;
            alloc[x.id]--; totalAlloc--;
          }
        }

        detailed[circId][slug]={seats:alloc,remainders:rem,target};
        collegeByList[slug]??={};
        Object.entries(alloc).forEach(([college,v])=>{
          collegeByList[slug][college]=(collegeByList[slug][college]||0)+v;
        });
      });
    });

    return {collegeByList,detailed};
  }

  function cameraResult({
    nationalValues,
    parties,
    coalitions,
    collegeValues,
    collegeWeights,
    cameraMap,
    specialSeats,
    law,
    premium
  }){
    const circum=buildCameraCircumscriptions(cameraMap);
    const circData=buildCircValues(cameraMap,collegeValues,parties,collegeWeights);
    const plan=nationalUnits(nationalValues,"camera",coalitions,law);
    const units=plan.units;

    if(!units.length){
      return {
        seats:{},ordinarySeatsByParty:{},prizeSeatsByParty:{},
        ordinarySeats:premium?314:384,premiumSeats:premium?70:0,
        eligible:[],units:[],circResults:{},
        complete:false,trace:{error:"Nessuna lista/coalizione eleggibile"}
      };
    }

    const specialWinnerSeats=(slugOrUnit)=>{
      const u=typeof slugOrUnit==="string"?nationalUnitById(units,slugOrUnit):slugOrUnit;
      if(!u)return 0;
      return (u.members||[]).reduce((a,k)=>
        a+cleanPositive(specialSeats?.camera?.valleDAosta?.[k])+
        cleanPositive(specialSeats?.camera?.trentinoAltoAdige?.[k]),0
      );
    };

    let initialNational=quotientAllocate(
      units.map(u=>({id:u.id,votes:u.votes})),
      premium?314:384,
      k=>units.find(u=>u.id===k)?.votes||0
    );

    let finalNational=initialNational;
    let capTriggered=false;
    let majorityIds=new Set();
    let minorityIds=new Set(units.map(u=>u.id));
    let majorityQ=0;
    let minorityQ=0;

    const winnerUnit=premium?nationalUnitById(units,premium.id):null;

    if(premium&&winnerUnit){
      const special=specialWinnerSeats(winnerUnit);
      const winnerInitial=initialNational.seats[winnerUnit.id]||0;
      if(winnerInitial+special>law.rules.camera.winnerOrdinaryCapWithPremium){
        capTriggered=true;
        const target=Math.max(0,law.rules.camera.winnerOrdinaryCapWithPremium-special);
        const others=units.filter(u=>u.id!==winnerUnit.id);
        const minoritySeats=Math.max(0,314-target);

        majorityQ=target>0?Math.floor(scaled(winnerUnit.votes)/target):0;
        minorityQ=minoritySeats>0
          ?Math.floor(others.reduce((a,u)=>a+scaled(u.votes),0)/minoritySeats)
          :0;

        const majoritySeats=target;
        finalNational={
          seats:{[winnerUnit.id]:majoritySeats},
          remainders:{[winnerUnit.id]:0},
          quota:majorityQ,
          totalVotes:scaled(winnerUnit.votes)
        };

        const minAlloc=quotientAllocate(
          others.map(u=>({id:u.id,votes:u.votes})),
          minoritySeats,
          k=>units.find(u=>u.id===k)?.votes||0
        );
        Object.assign(finalNational.seats,minAlloc.seats);
        Object.assign(finalNational.remainders,minAlloc.remainders);
        finalNational.minority=minAlloc;
        majorityIds=new Set([winnerUnit.id]);
        minorityIds=new Set(others.map(u=>u.id));
      }
    }

    if(!premium||!capTriggered){
      const q=finalNational.quota;
      majorityQ=q;
      minorityQ=q;
      majorityIds=new Set();
      minorityIds=new Set(units.map(u=>u.id));
    }

    const listTargets=nationalListTargets(finalNational.seats,units,nationalValues);

    let unitCirc;
    if(premium&&capTriggered){
      unitCirc=groupCircAllocation({
        units,
        nationalTargets:finalNational.seats,
        circum,
        circData,
        bonusActive:true,
        majorityIds,
        minorityIds,
        majorityNationalQuotient:majorityQ,
        minorityNationalQuotient:minorityQ
      });
    }else{
      /*
       * Nel riparto ordinario il quoziente nazionale di ciascuna unità è il
       * rapporto tra la sua cifra nazionale e i seggi ad essa spettanti.
       */
      const dynamicMajority=new Set();
      const unitQ={};
      units.forEach(u=>{
        const target=finalNational.seats[u.id]||0;
        unitQ[u.id]=target>0?scaled(u.votes)/target:0;
      });

      const calc={};
      const remByCirc={};
      const remainderWinnersByCirc={};
      Object.entries(circum).forEach(([circId,circ])=>{
        const seats=bonus?circ.withPrizeSeats:circ.noPrizeSeats;
        calc[circId]={};
        remByCirc[circId]={};
        remainderWinnersByCirc[circId]=[];
        if(!seats)return;
        const scored=units.filter(u=>(finalNational.seats[u.id]||0)>0)
          .map(u=>{
            const figure=calcCircUnitFigure(u,circData[circId]);
            const q=unitQ[u.id];
            const index=q>0?trunc6(scaled(figure)/q):0;
            return {id:u.id,figure,index};
          }).filter(x=>x.index>0);
        const sumIdx=scored.reduce((a,x)=>a+x.index,0);
        const provisional=scored.map(x=>{
          const exact=sumIdx>0?x.index*seats/sumIdx:0;
          return {...x,base:Math.floor(exact),rest:exact-Math.floor(exact)};
        });
        let used=0;
        provisional.forEach(x=>{
          calc[circId][x.id]=x.base;
          remByCirc[circId][x.id]=x.rest;
          used+=x.base;
        });
        const ranked=stableSorted(provisional,(a,b)=>
          b.rest-a.rest||b.figure-a.figure||tieOrder(a,b)
        );
        for(const x of ranked){
          if(used>=seats)break;
          if((calc[circId][x.id]||0)>=(finalNational.seats[x.id]||0))continue;
          calc[circId][x.id]=(calc[circId][x.id]||0)+1;
          remainderWinnersByCirc[circId].push(x.id);
          used++;
        }
      });
      unitCirc={byCirc:calc,unitRemaindersByCirc:remByCirc,remainderWinnersByCirc,nationalTotals:{}};
      units.forEach(u=>unitCirc.nationalTotals[u.id]=0);
      Object.values(calc).forEach(m=>Object.entries(m).forEach(([k,v])=>{
        unitCirc.nationalTotals[k]=(unitCirc.nationalTotals[k]||0)+v;
      }));
      /*
       * Compensazione come per la lettera h: sposta i seggi eccedentari
       * verso unità deficitarie nelle stesse circoscrizioni.
       */
      let loops=0;
      while(loops++<10000){
        const over=units.filter(u=>(unitCirc.nationalTotals[u.id]||0)>(finalNational.seats[u.id]||0));
        const under=units.filter(u=>(unitCirc.nationalTotals[u.id]||0)<(finalNational.seats[u.id]||0));
        if(!over.length||!under.length)break;
        let moved=false;
        for(const donor of over){
          const donorCircs=Object.keys(calc)
            .filter(c=>(calc[c]?.[donor.id]||0)>0)
            .sort((a,b)=>
              (remByCirc[a]?.[donor.id]??-1)-
              (remByCirc[b]?.[donor.id]??-1) ||
              a.localeCompare(b,"it")
            );
          for(const c of donorCircs){
            const receivers=under.slice().filter(u=>
              (calc[c]?.[u.id]||0)<(finalNational.seats[u.id]||0)
            ).sort((a,b)=>
              (remByCirc[c]?.[b.id]??-1)-
              (remByCirc[c]?.[a.id]??-1) ||
              String(a.id).localeCompare(String(b.id),"it")
            );
            if(!receivers.length)continue;
            const rec=receivers[0];
            calc[c][donor.id]--;
            calc[c][rec.id]=(calc[c][rec.id]||0)+1;
            unitCirc.nationalTotals[donor.id]--;
            unitCirc.nationalTotals[rec.id]++;
            moved=true;break;
          }
          if(moved)break;
        }
        if(!moved)break;
      }
    }

    const ordinaryListCirc=distributeSimpleListsToCircs({
      listTargets:listTargets.listTargets,
      units,
      unitCirc,
      circData,
      circum,
      bonusActive:!!premium,
      parties,
      collegeValues
    });

    const ordinaryColleges=allocateListsToColleges(
      ordinaryListCirc.listByCirc,
      circData,circum,parties,!!premium
    );

    const ordinaryByParty={};
    Object.values(ordinaryListCirc.listByCirc).forEach(m=>{
      Object.entries(m).forEach(([k,v])=>ordinaryByParty[k]=(ordinaryByParty[k]||0)+v);
    });

    const prizeByParty={};
    const prizeByCirc={};
    if(premium&&winnerUnit){
      Object.entries(circum).forEach(([circId,circ])=>{
        const n=Number(circ.prizeSeats)||0;
        if(!n)return;
        prizeByCirc[circId]={};
        const items=(winnerUnit.members||[]).map(k=>({
          id:k,
          votes:calcCircListFigures(circData[circId],k)
        })).filter(x=>x.votes>0);
        const split=quotientAllocate(items,n,k=>nationalValues?.[k]||0);
        prizeByCirc[circId]=split.seats;
        Object.entries(split.seats).forEach(([k,v])=>{
          prizeByParty[k]=(prizeByParty[k]||0)+v;
        });
      });
    }

    const seats={...ordinaryByParty};
    Object.entries(prizeByParty).forEach(([k,v])=>seats[k]=(seats[k]||0)+v);

    const ordinaryAssigned=Object.values(ordinaryByParty).reduce((a,v)=>a+v,0);
    const prizeAssigned=Object.values(prizeByParty).reduce((a,v)=>a+v,0);
    const ordinaryTarget=premium?314:384;
    const complete=ordinaryAssigned===ordinaryTarget && (!premium || prizeAssigned===70);

    const unitTargetTotal=Object.values(finalNational.seats).reduce((a,v)=>a+v,0);

    return {
      seats,
      ordinarySeatsByParty:ordinaryByParty,
      prizeSeatsByParty:prizeByParty,
      ordinarySeats:ordinaryTarget,
      premiumSeats:premium?70:0,
      bonusSeats:premium?70:0,
      prizeWinnerSeats:premium?70:0,
      prizeRedistributed:0,
      eligible:units.flatMap(u=>u.members),
      units,
      coalTotals:Object.fromEntries(
        units.filter(u=>u.type==="coalition").map(u=>[
          u.coalitionId,
          u.votes
        ])
      ),
      circResults:{
        byCirc:unitCirc.byCirc,
        nationalTotals:unitCirc.nationalTotals,
        listByCirc:ordinaryListCirc.listByCirc,
        colleges:ordinaryColleges.collegeByList,
        prizeByCirc
      },
      collegeResults:ordinaryColleges.detailed,
      complete,
      simulatedTotal:Object.values(seats).reduce((a,v)=>a+v,0),
      capTriggered,
      winnerOrdinary:premium&&winnerUnit?(finalNational.seats[winnerUnit.id]||0):0,
      ordinaryRedistributed:capTriggered?
        Math.max(0,(initialNational.seats[winnerUnit.id]||0)-((finalNational.seats[winnerUnit.id]||0))):0,
      trace:{
        nationalInitial:initialNational,
        nationalFinal:finalNational,
        listTargets,
        unitTargetTotal,
        territorialProxy:"college no-prize seat count when no explicit vote weight is provided"
      }
    };
  }

  function buildSenateRegionalUnits(region,regionalValues,nationalValues,coalitions,law){
    const cmap=mapCoalitions(coalitions);
    const units=[];
    const qualifiedCoalitions=new Map();

    (coalitions||[]).forEach(co=>{
      const ns=coalitionStats(co,nationalValues,"senato",law,regionalValues);
      if(ns.qualifies)qualifiedCoalitions.set(co.id,{co,stats:ns});
    });

    const covered=new Set();
    qualifiedCoalitions.forEach((rec,id)=>{
      const {co}=rec;
      const admitted=(co.members||[]).filter(k=>
        cleanPositive(nationalValues?.[k])>=law.rules.national.thresholdList ||
        cleanPositive(regionalValues?.[k])>=law.rules.national.regionalSenateException
      );
      const stats=rec.stats;
      if(stats.ripCandidate&&!admitted.includes(stats.ripCandidate))
        admitted.push(stats.ripCandidate);
      const votes=admitted.reduce((a,k)=>a+cleanPositive(regionalValues?.[k]),0);
      if(votes>0){
        units.push({
          id:"C:"+id,
          type:"coalition",
          coalitionId:id,
          name:co.name,
          members:admitted,
          allMembers:[...(co.members||[])],
          ripCandidate:stats.ripCandidate,
          votes
        });
        (co.members||[]).forEach(k=>covered.add(k));
      }
    });

    Object.keys(regionalValues||{}).forEach(k=>{
      if(k==="ALTRI"||covered.has(k))return;
      const nV=cleanPositive(nationalValues?.[k]);
      const rV=cleanPositive(regionalValues?.[k]);
      const coId=cmap[k];
      const qualified=coId&&qualifiedCoalitions.has(coId);
      if(qualified)return;
      const eligible=nV>=law.rules.national.thresholdList ||
        rV>=law.rules.national.regionalSenateException ||
        (!!coId && nV>=law.rules.national.thresholdMemberForCoalitionQualification);
      if(!eligible||rV<=0)return;
      units.push({
        id:"P:"+k,
        type:"list",
        name:k,
        members:[k],
        allMembers:[k],
        votes:rV,
        coalitionId:null,
        ripCandidate:null
      });
    });

    return {units,qualifiedCoalitions,cmap};
  }

  function splitRegionalCoalition(unit,count,regionalValues,nationalValues){
    if(unit.type!=="coalition")return {[unit.members[0]]:count};
    const split=quotientAllocate(
      (unit.members||[]).map(k=>({id:k,votes:regionalValues?.[k]||0})),
      count,
      k=>nationalValues?.[k]||regionalValues?.[k]||0
    );
    return split.seats;
  }

  function senateRegionResult({
    region,
    seats,
    regionalValues,
    nationalValues,
    coalitions,
    law,
    premium,
    winner
  }){
    const plan=buildSenateRegionalUnits(region,regionalValues,nationalValues,coalitions,law);
    const units=plan.units;
    const initial=quotientAllocate(
      units.map(u=>({id:u.id,votes:u.votes})),
      seats,
      k=>units.find(u=>u.id===k)?.votes||0
    );

    const targets={...initial.seats};
    const winnerId=winner?.id||null;

    return {
      region,
      seats,
      units,
      initial,
      targets,
      winnerId,
      premiumSeats:premium,
      splitByUnit:Object.fromEntries(units.map(u=>[
        u.id,
        splitRegionalCoalition(u,targets[u.id]||0,regionalValues,nationalValues)
      ]))
    };
  }

  function senateResult({
    nationalValues,
    parties,
    coalitions,
    regionalValuesByRegion,
    senateMap,
    senatePremiumByRegion,
    specialSeats,
    law,
    premium
  }){
    const regions=Object.keys(senatePremiumByRegion||{});
    const winner=premium||null;
    const regionResults={};

    regions.forEach(region=>{
      const items=(senateMap?.[region]||[]).map(raw=>{
        const p=String(raw).split("|");
        return {
          name:p[0],
          noPrizeSeats:cleanPositive(p[1]),
          withPrizeSeats:cleanPositive(p[2]??p[1]),
          special:String(p[3]||"").toUpperCase()==="SPECIAL" ||
            String(p[0]).includes(" - U")
        };
      }).filter(x=>!x.special);
      const totalNoPrize=items.reduce((a,x)=>a+x.noPrizeSeats,0);
      const premiumSeats=cleanPositive(senatePremiumByRegion?.[region]||0);
      const ordinarySeats=premium?Math.max(0,totalNoPrize-premiumSeats):totalNoPrize;
      const reg=regionalValuesByRegion?.[region]||Object.fromEntries(
        Object.keys(parties||{}).map(k=>[k,parties?.[k]?.senate||0])
      );
      regionResults[region]=senateRegionResult({
        region,
        seats:ordinarySeats,
        regionalValues:reg,
        nationalValues,
        coalitions,
        law,
        premium:premium?premiumSeats:0,
        winner
      });
      regionResults[region].collegeMap=items;
      regionResults[region].totalNoPrize=totalNoPrize;
      regionResults[region].ordinarySeats=ordinarySeats;
      regionResults[region].regionalValues=reg;
    });

    const winnerUnitId=winner?.id||null;
    let winnerOrdinary=regions.reduce((a,r)=>a+(regionResults[r].targets[winnerUnitId]||0),0);

    const winnerSpecial=(winner?.members||[]).reduce((a,k)=>
      a+cleanPositive(specialSeats?.senato?.valleDAosta?.[k])+
      cleanPositive(specialSeats?.senato?.trentinoAltoAdige?.[k]),0
    );

    let capTriggered=false;
    let excess=0;
    const ordinaryCap=law.rules.senate.winnerOrdinaryCapWithPremium-winnerSpecial;
    if(premium&&winnerUnitId&&winnerOrdinary+winnerSpecial>law.rules.senate.winnerCapExcludingEstero-law.rules.senate.premiumSeats){
      capTriggered=true;
      excess=Math.max(0,winnerOrdinary-ordinaryCap);

      /*
       * La legge considera i seggi ottenuti con i resti minori nelle regioni.
       * Usiamo il resto effettivo del vincitore nella ripartizione regionale;
       * a parità, il voto regionale più basso e poi il sorteggio deterministico.
       */
      const candidates=regions.map(region=>{
        const rr=regionResults[region];
        const rest=rr.initial.remainders?.[winnerUnitId]??-1;
        const votes=rr.units.find(u=>u.id===winnerUnitId)?.votes||0;
        return {region,rest,votes,seats:rr.targets[winnerUnitId]||0};
      }).filter(x=>x.seats>0&&x.rest>=0)
        .sort((a,b)=>a.rest-b.rest||a.votes-b.votes||a.region.localeCompare(b.region,"it"));

      for(const c of candidates){
        if(excess<=0)break;
        const rr=regionResults[c.region];
        if(!(rr.targets[winnerUnitId]>0))continue;
        rr.targets[winnerUnitId]--;
        excess--;
        const usedRemainders=new Set(rr.initial.remainderWinners||[]);
        const losing=rr.units.filter(u=>u.id!==winnerUnitId&&u.votes>0&&!usedRemainders.has(u.id))
          .sort((a,b)=>{
            const ra=rr.initial.remainders?.[a.id]??-1;
            const rb=rr.initial.remainders?.[b.id]??-1;
            return rb-ra||b.votes-a.votes||tieOrder(a,b);
          })[0] ||
          rr.units.filter(u=>u.id!==winnerUnitId&&u.votes>0)
            .sort((a,b)=>{
              const ra=rr.initial.remainders?.[a.id]??-1;
              const rb=rr.initial.remainders?.[b.id]??-1;
              return rb-ra||b.votes-a.votes||tieOrder(a,b);
            })[0];
        if(losing)rr.targets[losing.id]=(rr.targets[losing.id]||0)+1;
      }

      while(excess>0){
        const more=regions.map(region=>{
          const rr=regionResults[region];
          return {
            region,
            rest:rr.initial.remainders?.[winnerUnitId]??-1,
            votes:rr.units.find(u=>u.id===winnerUnitId)?.votes||0,
            seats:rr.targets[winnerUnitId]||0
          };
        }).filter(x=>x.seats>0)
          .sort((a,b)=>a.rest-b.rest||a.votes-b.votes||a.region.localeCompare(b.region,"it"));

        if(!more.length)break;
        const c=more[0],rr=regionResults[c.region];
        rr.targets[winnerUnitId]--;
        excess--;
        const usedRemainders=new Set(rr.initial.remainderWinners||[]);
        const losing=rr.units.filter(u=>u.id!==winnerUnitId&&u.votes>0&&!usedRemainders.has(u.id))
          .sort((a,b)=>{
            const ra=rr.initial.remainders?.[a.id]??-1;
            const rb=rr.initial.remainders?.[b.id]??-1;
            return rb-ra||b.votes-a.votes||tieOrder(a,b);
          })[0] ||
          rr.units.filter(u=>u.id!==winnerUnitId&&u.votes>0)
            .sort((a,b)=>{
              const ra=rr.initial.remainders?.[a.id]??-1;
              const rb=rr.initial.remainders?.[b.id]??-1;
              return rb-ra||b.votes-a.votes||tieOrder(a,b);
            })[0];
        if(losing)rr.targets[losing.id]=(rr.targets[losing.id]||0)+1;
        else break;
      }
    }

    const ordinaryByParty={},prizeByParty={},regionPartySeats={},regionUnitSeats={};

    regions.forEach(region=>{
      const rr=regionResults[region];
      regionPartySeats[region]={};
      regionUnitSeats[region]={};

      rr.units.forEach(u=>{
        const count=Math.max(0,Math.floor(rr.targets[u.id]||0));
        if(!count)return;
        regionUnitSeats[region][u.id]=count;
        const split=u.type==="coalition"
          ?splitRegionalCoalition(u,count,rr.regionalValues,nationalValues)
          :{[u.members[0]]:count};
        Object.entries(split).forEach(([k,v])=>{
          ordinaryByParty[k]=(ordinaryByParty[k]||0)+v;
          regionPartySeats[region][k]=(regionPartySeats[region][k]||0)+v;
        });
      });

      if(premium&&winner){
        const n=cleanPositive(rr.premiumSeats);
        if(n){
          const split=winner.type==="coalition"
            ?splitRegionalCoalition(winner,n,rr.regionalValues,nationalValues)
            :{[winner.members[0]]:n};
          Object.entries(split).forEach(([k,v])=>{
            prizeByParty[k]=(prizeByParty[k]||0)+v;
            regionPartySeats[region][k]=(regionPartySeats[region][k]||0)+v;
          });
        }
      }
    });

    const ordinaryTarget=premium?154:189;
    const prizeTarget=premium?35:0;
    const ordinaryAssigned=Object.values(ordinaryByParty).reduce((a,v)=>a+v,0);
    const prizeAssigned=Object.values(prizeByParty).reduce((a,v)=>a+v,0);
    const seats={...ordinaryByParty};
    Object.entries(prizeByParty).forEach(([k,v])=>seats[k]=(seats[k]||0)+v);

    return {
      seats,
      ordinarySeatsByParty:ordinaryByParty,
      prizeSeatsByParty:prizeByParty,
      ordinarySeats:ordinaryTarget,
      premiumSeats:prizeTarget,
      bonusSeats:prizeTarget,
      prizeWinnerSeats:prizeTarget,
      prizeRedistributed:0,
      ordinaryRedistributed:capTriggered?Math.max(0,winnerOrdinary-ordinaryCap):0,
      winnerOrdinary:regions.reduce((a,r)=>a+(regionResults[r].targets[winnerUnitId]||0),0),
      winnerPremiumSeats:premium?35:0,
      premiumWinnerSeats:premium?35:0,
      premiumRedistributed:0,
      simulatedTotal:Object.values(seats).reduce((a,v)=>a+v,0),
      eligible:regions.flatMap(r=>regionResults[r].units.flatMap(u=>u.members))
        .filter((v,i,a)=>a.indexOf(v)===i),
      units:regions.length?regionResults[regions[0]].units:[],
      regions:regionResults,
      regionPartySeats,
      regionUnitSeats,
      complete:ordinaryAssigned===ordinaryTarget&&prizeAssigned===prizeTarget,
      regionCount:regions.length,
      customizedRegions:0,
      trace:{
        ordinaryTarget,ordinaryAssigned,prizeTarget,prizeAssigned,
        capTriggered,winnerSpecial,ordinaryCap
      }
    };
  }

  function normalizeWinner(law,camValues,senValues,coalitions){
    return law.premiumCandidate?.(camValues,senValues,coalitions)||null;
  }

  function simulate(input){
    const law=input.law||root.SONDAGGI_LAW_20261008;
    if(!law)throw new Error("Motore legge 08/10/2026 non caricato.");
    const cameraValues=input.camera?.nationalValues||{};
    const senateValues=input.senato?.nationalValues||{};
    const winner=normalizeWinner(law,cameraValues,senateValues,input.coalitions||[]);

    const cam=cameraResult({
      nationalValues:cameraValues,
      parties:input.parties||{},
      coalitions:input.coalitions||[],
      collegeValues:input.camera?.collegeValues||{},
      collegeWeights:input.camera?.collegeWeights||{},
      cameraMap:input.camera?.collegeMap||{},
      specialSeats:input.specialSeats||{},
      law,
      premium:winner
    });

    const sen=senateResult({
      nationalValues:senateValues,
      parties:input.parties||{},
      coalitions:input.coalitions||[],
      regionalValuesByRegion:input.senato?.regionalValuesByRegion||{},
      senateMap:input.senato?.collegeMap||{},
      senatePremiumByRegion:input.senato?.premiumByRegion||law.rules.senatePremiumByRegion||{},
      specialSeats:input.specialSeats||{},
      law,
      premium:winner
    });

    return {
      bonus:winner,
      cam,
      sen,
      metadata:{
        lawVersion:"2026-10-08",
        lawStatus:law.rules?.status||"unknown",
        deterministicSorteggio:true,
        territorialWeightModel:"explicit camera college weight; otherwise ordinary no-prize college seats as neutral fallback"
      }
    };
  }

  root.SONDAGGI_ELECTION_ENGINE_20261008=Object.freeze({
    version:"2026-10-08-seat-engine-v1",
    SCALE,
    trunc6,
    quotientAllocate,
    parseCollegeMap,
    buildCameraCircumscriptions,
    nationalUnits,
    cameraResult,
    senateResult,
    simulate
  });

  if(typeof module!=="undefined" && module.exports){
    module.exports=root.SONDAGGI_ELECTION_ENGINE_20261008;
  }
})(typeof window!=="undefined"?window:globalThis);
