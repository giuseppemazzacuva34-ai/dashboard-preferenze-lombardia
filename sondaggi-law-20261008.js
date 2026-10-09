/* SONDAGGI — REGOLAMENTO ELETTORALE APPROVATO DEFINITIVAMENTE 08/10/2026
 * Fonte normativa di riferimento del simulatore:
 * ddl C.2822-B / S.1971, testo approvato dal Senato il 15/09/2026
 * e approvato definitivamente dalla Camera il 08/10/2026, comprensivo dell'errata corrige.
 *
 * Il modulo è isolato dal core della dashboard.
 * Non contiene dati di preferenze, comuni o province.
 */
(function(root){
  "use strict";

  const RULES = Object.freeze({
    approvedDate: "2026-10-08",
    status: "approvato_definitivamente_non_ancora_pubblicato",
    candidate: Object.freeze({
      maxSameListPlurinominalColleges: 5,
      cameraCandidatesPerPlurinominalList: 7,
      senateCandidatesPerPlurinominalList: 6,
      maxPreferences: 3,
      capolistaGetsNoPreference: true,
      multiplePreferencesMustAlternateSex: true
    }),
    national: Object.freeze({
      thresholdList: 3,
      thresholdCoalition: 8,
      thresholdMemberForCoalitionQualification: 2,
      regionalSenateException: 20,
      premiumThreshold: 42
    }),
    camera: Object.freeze({
      totalSeats: 400,
      esteroSeats: 8,
      valleDAostaSeats: 1,
      trentinoAltoAdigeSeats: 7,
      ordinarySeats: 384,
      premiumSeats: 70,
      ordinarySeatsWithPremium: 314,
      winnerCapExcludingEstero: 220,
      winnerOrdinaryCapWithPremium: 150
    }),
    senate: Object.freeze({
      totalSeats: 200,
      esteroSeats: 4,
      valleDAostaSeats: 1,
      trentinoAltoAdigeSeats: 6,
      ordinarySeats: 189,
      premiumSeats: 35,
      ordinarySeatsWithPremium: 154,
      winnerCapExcludingEstero: 113,
      winnerOrdinaryCapWithPremium: 78
    }),
    senatePremiumByRegion: Object.freeze({
      "Piemonte":3,
      "Lombardia":6,
      "Veneto":3,
      "Friuli-Venezia Giulia":1,
      "Liguria":1,
      "Emilia-Romagna":3,
      "Toscana":2,
      "Umbria":1,
      "Marche":1,
      "Lazio":3,
      "Abruzzo":1,
      "Molise":0,
      "Campania":3,
      "Puglia":2,
      "Basilicata":0,
      "Calabria":1,
      "Sicilia":3,
      "Sardegna":1
    })
  });

  function n(v){
    const x=Number(v);
    return Number.isFinite(x)?Math.max(0,x):0;
  }

  function sum(values, keys){
    return (keys||Object.keys(values||{})).reduce((a,k)=>a+n(values?.[k]),0);
  }

  function listNationallyEligible(value){
    return n(value)>=RULES.national.thresholdList;
  }

  function listRegionallyEligibleForSenate(nationalValue, regionalValue){
    return listNationallyEligible(nationalValue) ||
      n(regionalValue)>=RULES.national.regionalSenateException;
  }

  function coalitionQualification(members, nationalValues, chamber){
    const keys=(members||[]).filter(Boolean);
    const totalAll=sum(nationalValues,keys);
    const qualifiedGate=keys.some(k=>n(nationalValues?.[k])>=RULES.national.thresholdMemberForCoalitionQualification);
    return {
      totalAll,
      qualifies: totalAll>=RULES.national.thresholdCoalition && qualifiedGate,
      memberGate: RULES.national.thresholdMemberForCoalitionQualification
    };
  }

  // Le liste della coalizione che entrano nel riparto ordinario:
  // 3% nazionale; al Senato anche la deroga del 20% in almeno una regione.
  // Per ogni coalizione ammessa si recupera inoltre la lista con la cifra
  // elettorale nazionale maggiore tra quelle escluse dal 2-bis (meccanismo 2-ter).
  function coalitionMembersForAllocation(members, nationalValues, chamber, regionalValues){
    const keys=(members||[]).filter(Boolean);
    const admitted=[];
    for(const k of keys){
      const v=nationalValues?.[k];
      const regional=regionalValues?.[k];
      const ok=chamber==="senato"
        ? listRegionallyEligibleForSenate(v,regional)
        : listNationallyEligible(v);
      if(ok) admitted.push(k);
    }

    const excluded=keys.filter(k=>!admitted.includes(k));
    excluded.sort((a,b)=>
      n(nationalValues?.[b])-n(nationalValues?.[a]) ||
      String(a).localeCompare(String(b),"it")
    );
    const ripCandidate=excluded[0]||null;

    return {admitted,ripCandidate,excluded};
  }

  function coalitionScores(members,nationalValues,chamber,regionalValues){
    const q=coalitionQualification(members,nationalValues,chamber);
    if(!q.qualifies){
      return {
        qualifies:false,
        allMembers:[...(members||[])],
        admitted:[],
        ripCandidate:null,
        allocationFigure:0,
        premiumFigure:0
      };
    }

    const {admitted,ripCandidate}=coalitionMembersForAllocation(
      members,nationalValues,chamber,regionalValues
    );

    // Per il requisito del premio e per individuare il soggetto primo,
    // il punteggio della coalizione è quello delle liste che superano
    // le condizioni di ammissione al riparto; il 2-ter è gestito come
    // recupero della lista, non come ampliamento della soglia del premio.
    const premiumFigure=chamber==="senato" && regionalValues
      ? admitted.reduce((a,k)=>a+n(regionalValues[k]),0)
      : admitted.reduce((a,k)=>a+n(nationalValues[k]),0);

    const allocationFigure=premiumFigure+(ripCandidate?n(
      chamber==="senato" && regionalValues
        ? regionalValues[ripCandidate]
        : nationalValues[ripCandidate]
    ):0);

    return {
      qualifies:true,
      allMembers:[...(members||[])],
      admitted,
      ripCandidate,
      allocationFigure,
      premiumFigure
    };
  }

  function subjectScore(subject, values, chamber, regionalValues){
    if(!subject) return 0;
    if(subject.type==="list") return n(values?.[subject.id]);
    return coalitionScores(
      subject.members||[], values, chamber, regionalValues
    ).premiumFigure;
  }

  function premiumCandidate(chamberValues, senateValues, coalitions){
    const subjects=[];
    const qualifiedMembers=new Set();

    for(const co of coalitions||[]){
      const cam=coalitionScores(co.members||[],chamberValues,"camera");
      const sen=coalitionScores(co.members||[],senateValues,"senato");
      if(cam.qualifies) (co.members||[]).forEach(k=>qualifiedMembers.add("camera:"+k));
      if(sen.qualifies) (co.members||[]).forEach(k=>qualifiedMembers.add("senato:"+k));

      if(!cam.qualifies || !sen.qualifies)continue;

      subjects.push({
        type:"coalition",
        id:co.id,
        members:[...(co.members||[])],
        name:co.name,
        camera:n(cam.premiumFigure),
        senato:n(sen.premiumFigure)
      });
    }

    // Una lista che appartiene a una coalizione qualificata in almeno una
    // Camera non può essere contemporaneamente trattata come soggetto
    // autonomo per il premio bicamerale.
    Object.keys(chamberValues||{}).forEach(k=>{
      if(k==="ALTRI")return;
      if(qualifiedMembers.has("camera:"+k) || qualifiedMembers.has("senato:"+k))return;
      subjects.push({
        type:"list",
        id:k,
        members:[k],
        name:k,
        camera:n(chamberValues[k]),
        senato:n(senateValues?.[k])
      });
    });

    if(!subjects.length)return null;

    const maxCamera=Math.max(...subjects.map(x=>x.camera));
    const maxSenato=Math.max(...subjects.map(x=>x.senato));

    // Il premio richiede che il medesimo soggetto sia il più votato
    // in entrambe le Camere e raggiunga almeno il 42% in entrambe.
    const sameWinner=subjects.filter(x=>
      x.camera===maxCamera &&
      x.senato===maxSenato &&
      x.camera>=RULES.national.premiumThreshold &&
      x.senato>=RULES.national.premiumThreshold
    );

    if(!sameWinner.length)return null;
    return sameWinner.slice().sort((a,b)=>
      b.camera+b.senato-a.camera-a.senato ||
      String(a.id).localeCompare(String(b.id),"it")
    )[0];
  }
  function largestRemainder(items,seats){
    const clean=(items||[]).map(x=>({id:String(x.id),votes:n(x.votes)}))
      .filter(x=>x.votes>0);
    const out={};
    const total=clean.reduce((a,x)=>a+x.votes,0);
    const target=Math.max(0,Math.floor(Number(seats)||0));
    if(!clean.length||!target||!total)return out;

    const exact=clean.map(x=>{
      const q=x.votes/total*target;
      return {id:x.id,base:Math.floor(q),rest:q-Math.floor(q)};
    });
    exact.forEach(x=>{out[x.id]=x.base;});
    let remaining=target-exact.reduce((a,x)=>a+x.base,0);
    exact.sort((a,b)=>b.rest-a.rest||String(a.id).localeCompare(String(b.id),"it"));
    for(const x of exact){
      if(remaining<=0)break;
      out[x.id]=(out[x.id]||0)+1;
      remaining--;
    }
    return out;
  }

  function quadratura(map,total){
    return Object.values(map||{}).reduce((a,v)=>a+Math.floor(Number(v)||0),0)===total;
  }

  function premiumPool(chamber,active){
    const r=RULES[chamber];
    return active ? r.ordinarySeatsWithPremium : r.ordinarySeats;
  }

  root.SONDAGGI_LAW_20261008 = Object.freeze({
    version:"2026-10-08",
    rules:RULES,
    listNationallyEligible,
    listRegionallyEligibleForSenate,
    coalitionQualification,
    coalitionMembersForAllocation,
    coalitionScores,
    subjectScore,
    premiumCandidate,
    largestRemainder,
    quadratura,
    premiumPool
  });

  if(typeof module!=="undefined" && module.exports){
    module.exports=root.SONDAGGI_LAW_20261008;
  }
})(typeof window!=="undefined"?window:globalThis);
