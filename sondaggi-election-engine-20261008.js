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

  function nationalUnitIdForSubject(subject){
    if(!subject)return null;
    return subject.type==="coalition"?"C:"+subject.id:"P:"+subject.id;
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
    nationalValues={},parties={},coalitions=[],
    collegeValues={},collegeWeights={},cameraMap={},specialSeats={},
    law,premium
  }){
    const circum=buildCameraCircumscriptions(cameraMap);
    const cv=buildCameraCircData(cameraMap,collegeValues,parties,collegeWeights);
    const circData=cv.data;
    const mapCheck=validateMap(cameraMap,384,70);
    const plan=buildNationalUnits(nationalValues,"camera",coalitions,law);
    const units=plan.units;
    const ordinaryTarget=premium?314:384;

    if(!units.length){
      return {
        seats:{},ordinarySeatsByParty:{},prizeSeatsByParty:{},
        ordinarySeats:ordinaryTarget,premiumSeats:premium?70:0,
        bonusSeats:premium?70:0,prizeWinnerSeats:premium?70:0,
        eligible:[],units:[],circResults:{},collegeResults:{},
        complete:false,simulatedTotal:0,
        trace:{errors:["Nessuna unità elettorale eleggibile."],mapCheck}
      };
    }

    const initial=quotientAllocate(
      units.map(u=>({id:u.id,votes:u.votes})),
      ordinaryTarget,
      k=>units.find(u=>u.id===k)?.votes||0
    );

    const winnerUnit=premium?nationalUnitById(units,subjectUnitId(premium)):null;
    let final=initial;
    let capTriggered=false;
    let specialWinner=0;
    let ordinaryWinnerCap=null;

    if(premium&&winnerUnit){
      specialWinner=specialSeatsTotal(specialSeats,"camera",winnerUnit);
      const totalWinner=(initial.seats[winnerUnit.id]||0)+70+specialWinner;
      if(totalWinner>law.rules.camera.winnerCapExcludingEstero){
        capTriggered=true;
        ordinaryWinnerCap=Math.max(
          0,law.rules.camera.winnerOrdinaryCapWithPremium-specialWinner
        );
        const others=units.filter(u=>u.id!==winnerUnit.id);
        const minoritySeats=Math.max(0,314-ordinaryWinnerCap);
        const majorityQ=ordinaryWinnerCap>0
          ?Math.floor(micro(winnerUnit.votes)/ordinaryWinnerCap):0;
        const minorityQ=minoritySeats>0
          ?Math.floor(others.reduce((a,u)=>a+micro(u.votes),0)/minoritySeats):0;
        const minAlloc=quotientAllocate(
          others.map(u=>({id:u.id,votes:u.votes})),
          minoritySeats,
          k=>units.find(u=>u.id===k)?.votes||0
        );
        final={
          seats:{[winnerUnit.id]:ordinaryWinnerCap},
          remainders:{[winnerUnit.id]:0},
          quota:0,
          majorityQ:majorityQ/SCALE,
          minorityQ:minorityQ/SCALE,
          majorityTarget:ordinaryWinnerCap,
          minorityTarget:minoritySeats,
          initial,
          minority:minAlloc,
          sorteggi:(initial.sorteggi||0)+(minAlloc.sorteggi||0)
        };
        Object.assign(final.seats,minAlloc.seats);
        Object.assign(final.remainders,minAlloc.remainders);
      }
    }

    const ordinaryCirc=capTriggered
      ?groupCircAllocation({
          units,
          nationalTargets:final.seats,
          circum,
          circData,
          bonusActive:true,
          majorityIds:new Set([winnerUnit.id]),
          minorityIds:new Set(units.filter(u=>u.id!==winnerUnit.id).map(u=>u.id)),
          majorityNationalQuotient:final.majorityQ||0,
          minorityNationalQuotient:final.minorityQ||0
        })
      :allocateStandardCircumscription({
          units,
          nationalTargets:final.seats,
          circum,
          circData,
          ordinarySeats:c=>c.noPrizeSeats
        });

    const errors=[];
    const warnings=[];
    if(!mapCheck.valid)errors.push(
      "Mappa Camera non quadrata: ordinari="+mapCheck.ordinary+
      ", totale con premio="+mapCheck.withPremium+
      ", premio="+mapCheck.prize
    );
    if(sumSeats(ordinaryCirc.byCirc)!==384-errors.length*0){
      const territorialSeats=sumSeats(ordinaryCirc.byCirc);
      if(territorialSeats!==ordinaryTarget)
        errors.push("Riparto territoriale Camera: "+territorialSeats+" != "+ordinaryTarget);
    }

    const listByCirc={};
    const splitRemainders={};
    Object.entries(ordinaryCirc.byCirc||{}).forEach(([circId,unitMap])=>{
      listByCirc[circId]={};
      splitRemainders[circId]={};
      Object.entries(unitMap||{}).forEach(([unitId,count])=>{
        const unit=nationalUnitById(units,unitId);
        const nSeats=Math.floor(pos(count));
        if(!unit||!nSeats)return;
        if(unit.type==="list"){
          const k=unit.members[0];
          listByCirc[circId][k]=(listByCirc[circId][k]||0)+nSeats;
        }else{
          const split=quotientAllocate(
            unit.members.map(k=>({
              id:k,
              votes:calcCircListFigure(circData[circId],k)
            })),
            nSeats,
            k=>pos(nationalValues[k])
          );
          Object.entries(split.seats).forEach(([k,v])=>{
            listByCirc[circId][k]=(listByCirc[circId][k]||0)+v;
          });
          splitRemainders[circId][unitId]=split;
        }
      });
    });

    function allocateColleges(listMap,circId){
      const circ=circum[circId];
      const remaining={...listMap};
      const assigned={};
      const remByList={};
      const detail={};
      Object.keys(listMap||{}).forEach(k=>{assigned[k]=0;remByList[k]=[];});
      circ.colleges.slice().sort((a,b)=>a.name.localeCompare(b.name,"it")).forEach(col=>{
        const seats=Math.floor(pos(col.noPrizeSeats));
        if(!seats)return;
        const rows=Object.keys(remaining).filter(k=>(remaining[k]||0)>0).map(k=>({
          id:k,
          figure:pos(circData[circId]?.figures?.[col.name]?.[k]),
          circFigure:calcCircListFigure(circData[circId],k),
          cap:Math.floor(pos(remaining[k]))
        })).filter(x=>x.figure>0);
        if(!rows.length)return;

        const totalFigure=rows.reduce((a,x)=>a+x.figure,0);
        const q=Math.floor(totalFigure/seats);
        const alloc={},rem={};
        let used=0;
        rows.forEach(x=>{
          const raw=q>0?x.figure/q:seats*x.figure/totalFigure;
          const base=Math.min(Math.floor(raw),x.cap);
          alloc[x.id]=base;
          rem[x.id]=raw-Math.floor(raw);
          used+=base;
        });

        const ranked=rows.slice().sort((a,b)=>{
          const d=(rem[b.id]||0)-(rem[a.id]||0);
          if(Math.abs(d)>1e-15)return d;
          const dv=b.circFigure-a.circFigure;
          if(Math.abs(dv)>1e-12)return dv;
          return tieOrder(a,b);
        });
        for(const x of ranked){
          if(used>=seats)break;
          if((alloc[x.id]||0)>=(x.cap||0))continue;
          alloc[x.id]=(alloc[x.id]||0)+1;
          used++;
        }

        detail[col.name]={seats,quota:q/SCALE,alloc,remainder:rem,totalFigure};
        Object.entries(alloc).forEach(([k,v])=>{
          remaining[k]=(remaining[k]||0)-v;
          assigned[k]=(assigned[k]||0)+v;
          remByList[k].push({
            college:col.name,
            rest:rem[k]||0,
            figure:pos(circData[circId]?.figures?.[col.name]?.[k])
          });
        });
      });

      /*
       * Chiusura delle liste: trasferiamo un seggio alla lista deficitaria
       * nel collegio dove la lista eccedentaria ha il minor resto e la lista
       * deficitaria il maggior resto/valore. Il numero di seggi del collegio
       * resta invariato.
       */
      let guard=0;
      while(guard++<10000){
        const over=Object.keys(listMap).filter(k=>(assigned[k]||0)>Math.floor(pos(listMap[k])));
        const under=Object.keys(listMap).filter(k=>(assigned[k]||0)<Math.floor(pos(listMap[k])));
        if(!over.length||!under.length)break;

        let moved=false;
        for(const donor of over.sort()){
          const donorCols=(remByList[donor]||[])
            .filter(x=>(detail[x.college]?.alloc?.[donor]||0)>0)
            .sort((a,b)=>a.rest-b.rest||a.figure-b.figure||a.college.localeCompare(b.college,"it"));
          for(const underList of under){
            const recvCols=(remByList[underList]||[])
              .slice().sort((a,b)=>b.rest-a.rest||b.figure-a.figure||a.college.localeCompare(b.college,"it"));
            for(const d of donorCols){
              for(const r of recvCols){
                if(d.college!==r.college)continue;
                const col=detail[d.college];
                if(!col)continue;
                col.alloc[donor]=(col.alloc[donor]||0)-1;
                col.alloc[underList]=(col.alloc[underList]||0)+1;
                assigned[donor]--;
                assigned[underList]++;
                moved=true;
                break;
              }
              if(moved)break;
            }
            if(moved)break;
          }
          if(moved)break;
        }
        if(!moved)break;
      }

      const bad=Object.keys(listMap).filter(k=>
        (assigned[k]||0)!==Math.floor(pos(listMap[k]))
      );
      if(bad.length)warnings.push(
        "Camera "+circId+": chiusura collegi non completata per "+bad.join(",")
      );

      return {assigned,detail};
    }

    const collegeByList={};
    const collegeDetail={};
    Object.keys(listByCirc).forEach(circId=>{
      const clean={};
      Object.entries(listByCirc[circId]).forEach(([k,v])=>{
        if(k!=="__group")clean[k]=v;
      });
      const r=allocateColleges(clean,circId);
      collegeDetail[circId]=r.detail;
      Object.entries(r.assigned).forEach(([k,v])=>{
        collegeByList[k]??={};
        Object.entries(r.detail).forEach(([college,rec])=>{
          const n=rec.alloc?.[k]||0;
          if(n)collegeByList[k][college]=(collegeByList[k][college]||0)+n;
        });
      });
    });

    const ordinaryByParty={};
    Object.values(listByCirc).forEach(m=>Object.entries(m).forEach(([k,v])=>{
      if(k!=="__group")ordinaryByParty[k]=(ordinaryByParty[k]||0)+Math.floor(pos(v));
    }));

    const prizeByCirc={},prizeByParty={},prizeCollegeByList={},prizeCollegeDetail={};
    if(premium&&winnerUnit){
      Object.entries(circum).forEach(([circId,circ])=>{
        const n=Math.floor(pos(circ.prizeSeats));
        if(!n)return;
        const members=winnerUnit.members||[winnerUnit.id];
        const split=winnerUnit.type==="coalition"
          ?quotientAllocate(
              members.map(k=>({
                id:k,
                votes:calcCircListFigure(circData[circId],k)
              })),
              n,
              k=>pos(nationalValues[k])
            )
          :{seats:{[members[0]]:n},remainders:{}};
        prizeByCirc[circId]=split.seats;
        Object.entries(split.seats).forEach(([k,v])=>{
          prizeByParty[k]=(prizeByParty[k]||0)+v;
          const cols=circ.colleges.filter(col=>col.prizeSeats>0).map(col=>({
            id:col.name,
            figure:pos(circData[circId]?.figures?.[col.name]?.[k]),
            cap:col.prizeSeats
          }));
          const total=cols.reduce((a,x)=>a+x.figure,0);
          const alloc={},rem={};
          let used=0;
          if(total>0){
            cols.forEach(x=>{
              const raw=v*x.figure/total;
              alloc[x.id]=Math.min(Math.floor(raw),x.cap);
              rem[x.id]=raw-Math.floor(raw);
              used+=alloc[x.id];
            });
            cols.slice().sort((a,b)=>
              (rem[b.id]||0)-(rem[a.id]||0)||b.figure-a.figure||tieOrder(a,b)
            ).forEach(x=>{
              if(used>=v)return;
              if((alloc[x.id]||0)>=x.cap)return;
              alloc[x.id]=(alloc[x.id]||0)+1;used++;
            });
          }
          prizeCollegeByList[k]??={};
          Object.entries(alloc).forEach(([college,nSeats])=>{
            if(nSeats)prizeCollegeByList[k][college]=(prizeCollegeByList[k][college]||0)+nSeats;
          });
          prizeCollegeDetail[circId]??={};
          prizeCollegeDetail[circId][k]={target:v,seats:alloc,remainders:rem};
        });
      });
    }

    const seats={...ordinaryByParty};
    Object.entries(prizeByParty).forEach(([k,v])=>seats[k]=(seats[k]||0)+v);

    const ordinaryAssigned=sumSeats(ordinaryByParty);
    const prizeAssigned=sumSeats(prizeByParty);
    const simulatedTotal=sumSeats(seats);
    const ordinaryExpected=ordinaryTarget;
    const finalExpected=384;

    if(ordinaryAssigned!==ordinaryExpected)
      errors.push("Seggi ordinari Camera "+ordinaryAssigned+" != "+ordinaryExpected);
    if(premium&&prizeAssigned!==70)
      errors.push("Premio Camera "+prizeAssigned+" != 70");
    if(!premium&&prizeAssigned!==0)
      errors.push("Premio Camera non attivo ma sono presenti seggi premio.");
    if(premium&&simulatedTotal!==finalExpected)
      errors.push("Totale Camera con premio "+simulatedTotal+" != 384");
    if(!premium&&simulatedTotal!==384)
      errors.push("Totale Camera senza premio "+simulatedTotal+" != 384");

    return {
      seats,
      ordinarySeatsByParty:ordinaryByParty,
      prizeSeatsByParty:prizeByParty,
      ordinarySeats:ordinaryTarget,
      premiumSeats:premium?70:0,
      bonusSeats:premium?70:0,
      prizeWinnerSeats:premium?70:0,
      prizeRedistributed:0,
      eligible:units.flatMap(u=>u.members).filter((v,i,a)=>a.indexOf(v)===i),
      units,
      coalTotals:Object.fromEntries(units.filter(u=>u.type==="coalition").map(u=>[u.coalitionId,u.votes])),
      circResults:{
        byCirc:ordinaryCirc.byCirc,
        nationalTotals:ordinaryCirc.nationalTotals,
        listByCirc,
        colleges:collegeByList,
        prizeByCirc,
        prizeColleges:prizeCollegeByList
      },
      collegeResults:{ordinary:collegeDetail,prize:prizeCollegeDetail},
      complete:errors.length===0,
      simulatedTotal,
      capTriggered,
      winnerOrdinary:winnerUnit?(final.seats[winnerUnit.id]||0):0,
      ordinaryRedistributed:capTriggered?
        Math.max(0,(initial.seats[winnerUnit.id]||0)-(final.seats[winnerUnit.id]||0)):0,
      trace:{
        nationalInitial:initial,
        nationalFinal:final,
        ordinaryAssigned,
        prizeAssigned,
        specialWinner,
        ordinaryWinnerCap,
        capTriggered,
        mapCheck,
        errors,
        warnings,
        territorialModel:"peso esplicito per collegio; in assenza del peso, seggi ordinari del collegio come proxy di simulazione"
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

  function senateResult(input){
    const {
      nationalValues={},parties={},coalitions=[],
      regionalValuesByRegion={},collegeValues={},collegeWeights={},
      senateMap={},senatePremiumByRegion={},specialSeats={},law,premium
    }=input;

    const regions=Object.keys(senatePremiumByRegion||{});
    const regionResults={};
    const ordinaryByParty={},prizeByParty={},regionPartySeats={},regionUnitSeats={};
    const errors=[],warnings=[];

    const mapCheck=validateMap(
      senateMap,
      law.rules.senate.ordinarySeats,
      law.rules.senate.premiumSeats
    );

    regions.forEach(region=>{
      const rows=parseCollegeMap({[region]:senateMap[region]||[]});
      const colleges=rows.filter(x=>!x.special);
      const totalNoPrize=colleges.reduce((a,x)=>a+x.noPrizeSeats,0);
      const prizeSeatsRegion=Math.floor(pos(senatePremiumByRegion[region]||0));
      const ordinarySeats=totalNoPrize-(premium?prizeSeatsRegion:0);
      const regionalValues=regionalValuesByRegion[region]||
        Object.fromEntries(Object.keys(parties).map(k=>[k,parties?.[k]?.senate||0]));

      const plan=senateRegionalUnits(
        region,regionalValues,nationalValues,coalitions,law
      );
      const units=plan.units;
      const initial=quotientAllocate(
        units.map(u=>({id:u.id,votes:u.votes})),
        ordinarySeats,
        k=>units.find(u=>u.id===k)?.votes||0
      );

      regionResults[region]={
        region,colleges,units,initial,targets:{...initial.seats},
        ordinarySeats,prizeSeats:premium?prizeSeatsRegion:0,
        regionalValues
      };
    });

    const winner=premium||null;
    const winnerUnitId=subjectUnitId(winner);
    const winnerSpecial=winner
      ?senateSpecialSeats(specialSeats,winner)
      :0;
    const initialWinner=regions.reduce((a,r)=>
      a+(regionResults[r].targets[winnerUnitId]||0),0
    );

    let capTriggered=false;
    let ordinaryWinnerCap=null;
    let excess=0;

    if(premium&&winnerUnitId){
      const totalWinner=initialWinner+35+winnerSpecial;
      if(totalWinner>law.rules.senate.winnerCapExcludingEstero){
        capTriggered=true;
        ordinaryWinnerCap=Math.max(
          0,law.rules.senate.winnerOrdinaryCapWithPremium-winnerSpecial
        );
        excess=Math.max(0,initialWinner-ordinaryWinnerCap);

        const removalOrder=regions.map(region=>{
          const rr=regionResults[region];
          return {
            region,
            rest:rr.initial.remainders[winnerUnitId]??-1,
            votes:rr.units.find(u=>u.id===winnerUnitId)?.votes||0,
            seats:rr.targets[winnerUnitId]||0
          };
        }).filter(x=>x.seats>0)
          .sort((a,b)=>a.rest-b.rest||a.votes-b.votes||a.region.localeCompare(b.region,"it"));

        for(const item of removalOrder){
          if(excess<=0)break;
          const rr=regionResults[item.region];
          if(!(rr.targets[winnerUnitId]>0))continue;
          rr.targets[winnerUnitId]--;
          excess--;

          const usedRemainders=new Set(rr.initial.remainderWinners||[]);
          const candidates=rr.units
            .filter(u=>u.id!==winnerUnitId&&u.votes>0)
            .sort((a,b)=>{
              const aUnused=usedRemainders.has(a.id)?1:0;
              const bUnused=usedRemainders.has(b.id)?1:0;
              const ar=rr.initial.remainders[a.id]??-1;
              const br=rr.initial.remainders[b.id]??-1;
              return aUnused-bUnused||br-ar||b.votes-a.votes||tieOrder(a,b);
            });
          if(candidates.length){
            const receiver=candidates[0];
            rr.targets[receiver.id]=(rr.targets[receiver.id]||0)+1;
          }else{
            errors.push("Senato "+item.region+": impossibile riallocare un seggio sottratto al vincitore.");
          }
        }
      }
    }

    function splitRegionUnits(rr){
      const listTargets={};
      const splitByUnit={};
      Object.entries(rr.targets).forEach(([unitId,count])=>{
        const unit=nationalUnitById(rr.units,unitId);
        const nSeats=Math.floor(pos(count));
        if(!unit||!nSeats)return;
        if(unit.type==="list"){
          splitByUnit[unitId]={[unit.members[0]]:nSeats};
        }else{
          splitByUnit[unitId]=quotientAllocate(
            unit.members.map(k=>({
              id:k,
              votes:pos(rr.regionalValues[k])
            })),
            nSeats,
            k=>pos(nationalValues[k])
          ).seats;
        }
        Object.values(splitByUnit[unitId]).forEach((v,idx)=>{
          const keys=Object.keys(splitByUnit[unitId]);
          const k=keys[idx];
          listTargets[k]=(listTargets[k]||0)+Math.floor(pos(v));
        });
      });
      return {splitByUnit,listTargets};
    }

    function buildCollegeData(rr,listTargets){
      const out={};
      rr.colleges.forEach(col=>{
        out[col.name]={};
        Object.keys(listTargets).forEach(k=>{
          const explicit=collegeValues?.[rr.region]?.[col.name]?.[k] ??
            collegeValues?.[col.name]?.[k];
          const weight=pos(
            collegeWeights?.[rr.region]?.[col.name] ??
            collegeWeights?.[col.name] ??
            col.noPrizeSeats
          );
          const base=explicit==null?pos(rr.regionalValues[k]):pos(explicit);
          out[col.name][k]=base*weight;
        });
      });
      return out;
    }

    function standardCollegeAllocate(rr,listTargets,data){
      const remaining={...listTargets};
      const assigned={};
      const detail={};
      const remByList={};
      Object.keys(listTargets).forEach(k=>{
        assigned[k]=0;remByList[k]=[];
      });

      rr.colleges.slice().sort((a,b)=>a.name.localeCompare(b.name,"it")).forEach(col=>{
        const seats=Math.floor(pos(col.noPrizeSeats));
        if(!seats)return;
        const rows=Object.keys(remaining).filter(k=>(remaining[k]||0)>0).map(k=>({
          id:k,figure:pos(data[col.name]?.[k]),
          regionalFigure:Object.values(data).reduce((a,r)=>a+pos(r?.[k]),0),
          cap:Math.floor(pos(remaining[k]))
        })).filter(x=>x.figure>0);
        if(!rows.length)return;

        const total=rows.reduce((a,x)=>a+x.figure,0);
        const q=Math.floor(total/seats);
        const alloc={},rem={};
        let used=0;
        rows.forEach(x=>{
          const raw=q>0?x.figure/q:seats*x.figure/total;
          const base=Math.min(Math.floor(raw),x.cap);
          alloc[x.id]=base;rem[x.id]=raw-Math.floor(raw);used+=base;
        });

        rows.slice().sort((a,b)=>{
          const d=(rem[b.id]||0)-(rem[a.id]||0);
          if(Math.abs(d)>1e-15)return d;
          return b.regionalFigure-a.regionalFigure||tieOrder(a,b);
        }).forEach(x=>{
          if(used>=seats)return;
          if((alloc[x.id]||0)>=x.cap)return;
          alloc[x.id]=(alloc[x.id]||0)+1;used++;
        });

        detail[col.name]={seats,quota:q/SCALE,alloc,remainder:rem,totalFigure:total};
        Object.entries(alloc).forEach(([k,v])=>{
          remaining[k]-=v;assigned[k]=(assigned[k]||0)+v;
          remByList[k].push({college:col.name,rest:rem[k]||0,figure:data[col.name]?.[k]||0});
        });
      });

      let guard=0;
      while(guard++<10000){
        const over=Object.keys(listTargets).filter(k=>(assigned[k]||0)>Math.floor(pos(listTargets[k])));
        const under=Object.keys(listTargets).filter(k=>(assigned[k]||0)<Math.floor(pos(listTargets[k])));
        if(!over.length||!under.length)break;
        let moved=false;

        for(const donor of over){
          const dcols=(remByList[donor]||[])
            .filter(x=>(detail[x.college]?.alloc?.[donor]||0)>0)
            .sort((a,b)=>a.rest-b.rest||a.figure-b.figure||a.college.localeCompare(b.college,"it"));
          for(const receiver of under){
            const rcols=(remByList[receiver]||[])
              .slice().sort((a,b)=>b.rest-a.rest||b.figure-a.figure||a.college.localeCompare(b.college,"it"));
            for(const d of dcols){
              for(const r of rcols){
                if(d.college!==r.college)continue;
                detail[d.college].alloc[donor]=(detail[d.college].alloc[donor]||0)-1;
                detail[d.college].alloc[receiver]=(detail[d.college].alloc[receiver]||0)+1;
                assigned[donor]--;assigned[receiver]++;moved=true;break;
              }
              if(moved)break;
            }
            if(moved)break;
          }
          if(moved)break;
        }
        if(!moved)break;
      }

      const bad=Object.keys(listTargets).filter(k=>
        (assigned[k]||0)!==Math.floor(pos(listTargets[k]))
      );
      if(bad.length)warnings.push(
        "Senato "+rr.region+": chiusura collegi non completata per "+bad.join(",")
      );

      const byList={};
      Object.keys(listTargets).forEach(k=>{
        Object.entries(detail).forEach(([college,rec])=>{
          const n=rec.alloc?.[k]||0;
          if(n){
            byList[k]??={};
            byList[k][college]=n;
          }
        });
      });
      return {byList,detail};
    }

    function groupedCollegeAllocate(rr,listTargets,data){
      const groupByList={};
      Object.keys(listTargets).forEach(k=>{
        const u=rr.units.find(x=>x.members?.includes(k));
        groupByList[k]=(winnerUnitId&&u?.id===winnerUnitId)?"majority":"minority";
      });

      const groupTargets={
        majority:Object.keys(listTargets).filter(k=>groupByList[k]==="majority")
          .reduce((a,k)=>a+Math.floor(pos(listTargets[k])),0),
        minority:Object.keys(listTargets).filter(k=>groupByList[k]==="minority")
          .reduce((a,k)=>a+Math.floor(pos(listTargets[k])),0)
      };

      const groupFigure=group=>{
        return Object.keys(listTargets).filter(k=>groupByList[k]===group)
          .reduce((a,k)=>a+Object.values(data).reduce((s,row)=>s+pos(row?.[k]),0),0);
      };
      const qMaj=groupTargets.majority>0?Math.floor(groupFigure("majority")/groupTargets.majority):0;
      const qMin=groupTargets.minority>0?Math.floor(groupFigure("minority")/groupTargets.minority):0;

      const remainingGroups={...groupTargets};
      const rawGroupByCollege={};
      rr.colleges.slice().sort((a,b)=>a.name.localeCompare(b.name,"it")).forEach(col=>{
        const seats=Math.floor(pos(col.noPrizeSeats));
        if(!seats)return;
        const mf=["majority","minority"].map(g=>({
          g,
          figure:Object.keys(listTargets).filter(k=>groupByList[k]===g)
            .reduce((a,k)=>a+pos(data[col.name]?.[k]),0),
          q:g==="majority"?qMaj:qMin
        }));
        const idx=mf.map(x=>({
          g:x.g,
          index:x.q>0?trunc6(x.figure/x.q):0,
          figure:x.figure
        })).filter(x=>x.index>0);
        const sumIdx=idx.reduce((a,x)=>a+x.index,0);
        const alloc={majority:0,minority:0};
        if(sumIdx>0){
          const ex=idx.map(x=>({
            ...x,
            raw:seats*x.index/sumIdx
          }));
          ex.forEach(x=>{
            alloc[x.g]=Math.min(Math.floor(x.raw),remainingGroups[x.g]||0);
          });
          let used=alloc.majority+alloc.minority;
          ex.sort((a,b)=>{
            const d=(b.raw-Math.floor(b.raw))-(a.raw-Math.floor(a.raw));
            return Math.abs(d)>1e-15?d:b.figure-a.figure;
          }).forEach(x=>{
            if(used>=seats)return;
            if(alloc[x.g]>=(remainingGroups[x.g]||0))return;
            alloc[x.g]++;used++;
          });
        }
        alloc.majority=Math.min(alloc.majority,remainingGroups.majority);
        alloc.minority=Math.min(alloc.minority,remainingGroups.minority);
        remainingGroups.majority-=alloc.majority;
        remainingGroups.minority-=alloc.minority;
        rawGroupByCollege[col.name]=alloc;
      });

      const byList={},detail={};
      Object.entries(rawGroupByCollege).forEach(([college,groups])=>{
        detail[college]={...groups};
        for(const group of ["majority","minority"]){
          const nSeats=groups[group]||0;
          if(!nSeats)continue;
          const lists=Object.keys(listTargets).filter(k=>groupByList[k]===group);
          const split=quotientAllocate(
            lists.map(k=>({id:k,votes:pos(data[college]?.[k])})),
            nSeats,
            k=>Object.values(data).reduce((a,row)=>a+pos(row?.[k]),0)
          );
          Object.entries(split.seats).forEach(([k,v])=>{
            byList[k]??={};
            byList[k][college]=(byList[k][college]||0)+v;
          });
        }
      });

      return {byList,detail,warnings:[]};
    }

    function prizeColleges(rr,data){
      const out={},detail={};
      if(!premium||!winner)return {byList:out,detail};
      const nSeats=Math.floor(pos(rr.prizeSeats));
      if(!nSeats)return {byList:out,detail};

      const members=winner.members||[winner.id];
      const split=winner.type==="coalition"
        ?quotientAllocate(
          members.map(k=>({
            id:k,
            votes:Object.values(data).reduce((a,row)=>a+pos(row?.[k]),0)
          })),
          nSeats,
          k=>pos(nationalValues[k])
        )
        :{seats:{[members[0]]:nSeats}};
      Object.entries(split.seats||{}).forEach(([k,target])=>{
        const cols=rr.colleges.filter(c=>c.prizeSeats>0).map(c=>({
          id:c.name,figure:pos(data[c.name]?.[k]),cap:c.prizeSeats
        }));
        const total=cols.reduce((a,x)=>a+x.figure,0);
        const alloc={},rem={};
        let used=0;
        if(total>0){
          cols.forEach(x=>{
            const raw=target*x.figure/total;
            alloc[x.id]=Math.min(Math.floor(raw),x.cap);
            rem[x.id]=raw-Math.floor(raw);used+=alloc[x.id];
          });
          cols.slice().sort((a,b)=>
            (rem[b.id]||0)-(rem[a.id]||0)||b.figure-a.figure||tieOrder(a,b)
          ).forEach(x=>{
            if(used>=target)return;
            if((alloc[x.id]||0)>=x.cap)return;
            alloc[x.id]=(alloc[x.id]||0)+1;used++;
          });
        }
        out[k]=alloc;
        detail[k]={target,seats:alloc,remainders:rem};
        const got=sumSeats(alloc);
        prizeByParty[k]=(prizeByParty[k]||0)+got;
      });
      return {byList:out,detail};
    }

    regions.forEach(region=>{
      const rr=regionResults[region];
      const split=splitRegionUnits(rr);
      rr.splitByUnit=split.splitByUnit;
      rr.listTargets=split.listTargets;
      const data=buildCollegeData(rr,split.listTargets);
      rr.collegeData=data;

      const college=capTriggered
        ?groupedCollegeAllocate(rr,split.listTargets,data)
        :standardCollegeAllocate(rr,split.listTargets,data);
      rr.collegeResults=college;

      const regionParty={};
      Object.entries(split.listTargets).forEach(([k,v])=>{
        ordinaryByParty[k]=(ordinaryByParty[k]||0)+Math.floor(pos(v));
        regionParty[k]=(regionParty[k]||0)+Math.floor(pos(v));
      });
      regionPartySeats[region]=regionParty;
      regionUnitSeats[region]={...rr.targets};

      const prize=prizeColleges(rr,data);
      rr.prizeCollegeResults=prize;
    });

    const prizeTarget=premium?35:0;
    const ordinaryTarget=premium?154:189;
    const ordinaryAssigned=sumSeats(ordinaryByParty);
    const prizeAssigned=sumSeats(prizeByParty);
    const seats={...ordinaryByParty};
    Object.entries(prizeByParty).forEach(([k,v])=>seats[k]=(seats[k]||0)+v);

    if(ordinaryAssigned!==ordinaryTarget)
      errors.push("Seggi ordinari Senato "+ordinaryAssigned+" != "+ordinaryTarget);
    if(prizeAssigned!==prizeTarget)
      errors.push("Premio Senato "+prizeAssigned+" != "+prizeTarget);
    regions.forEach(region=>{
      const rr=regionResults[region];
      if(sumSeats(rr.targets)!==rr.ordinarySeats)
        errors.push(
          "Senato "+region+": "+sumSeats(rr.targets)+" != "+rr.ordinarySeats
        );
    });
    if(!mapCheck.valid)
      errors.push(
        "Mappa Senato non quadrata: ordinari="+mapCheck.ordinary+
        ", totale con premio="+mapCheck.withPremium+
        ", premio="+mapCheck.prize
      );

    const simulatedTotal=sumSeats(seats);
    warnings.push(
      "Pesi territoriali Senato: valori per collegio se forniti; altrimenti seggi ordinari come proxy neutro."
    );

    return {
      seats,
      ordinarySeatsByParty:ordinaryByParty,
      prizeSeatsByParty:prizeByParty,
      ordinarySeats:ordinaryTarget,
      premiumSeats:prizeTarget,
      bonusSeats:prizeTarget,
      prizeWinnerSeats:prizeTarget,
      prizeRedistributed:0,
      ordinaryRedistributed:capTriggered?Math.max(0,initialWinner-(
        regions.reduce((a,r)=>a+(regionResults[r].targets[winnerUnitId]||0),0))):0,
      winnerOrdinary:regions.reduce((a,r)=>a+(regionResults[r].targets[winnerUnitId]||0),0),
      winnerPremiumSeats:premium?35:0,
      premiumWinnerSeats:premium?35:0,
      premiumRedistributed:0,
      simulatedTotal,
      eligible:regions.flatMap(r=>regionResults[r].units.flatMap(u=>u.members))
        .filter((v,i,a)=>a.indexOf(v)===i),
      units:regions.length?regionResults[regions[0]].units:[],
      regions:regionResults,
      regionPartySeats,
      regionUnitSeats,
      complete:errors.length===0 && simulatedTotal===189,
      regionCount:regions.length,
      customizedRegions:0,
      trace:{
        ordinaryTarget,ordinaryAssigned,prizeTarget,prizeAssigned,
        capTriggered,winnerSpecial,ordinaryWinnerCap,
        mapCheck,errors,warnings
      }
    };
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
