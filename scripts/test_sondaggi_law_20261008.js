const assert=require("assert");
const law=require("../sondaggi-law-20261008.js");

const R=law.rules;

assert.strictEqual(R.approvedDate,"2026-10-08");
assert.strictEqual(R.national.thresholdList,3);
assert.strictEqual(R.national.thresholdCoalition,10);
assert.strictEqual(R.national.thresholdMemberForCoalitionQualification,3);
assert.strictEqual(R.national.regionalSenateException,20);
assert.strictEqual(R.national.premiumThreshold,42);

assert.deepStrictEqual(
  [R.camera.totalSeats,R.camera.esteroSeats,R.camera.ordinarySeats,R.camera.premiumSeats,R.camera.ordinarySeatsWithPremium,R.camera.winnerCapExcludingEstero,R.camera.winnerOrdinaryCapWithPremium],
  [400,8,384,70,314,220,150]
);
assert.deepStrictEqual(
  [R.senate.totalSeats,R.senate.esteroSeats,R.senate.ordinarySeats,R.senate.premiumSeats,R.senate.ordinarySeatsWithPremium,R.senate.winnerCapExcludingEstero,R.senate.winnerOrdinaryCapWithPremium],
  [200,4,189,35,154,113,78]
);

const premiumByRegion=Object.values(R.senatePremiumByRegion).reduce((a,v)=>a+v,0);
assert.strictEqual(premiumByRegion,35);

assert.strictEqual(law.listNationallyEligible(2.99),false);
assert.strictEqual(law.listNationallyEligible(3),true);
assert.strictEqual(law.listAllocationEligible(2.99,"camera",true),false);
assert.strictEqual(law.listAllocationEligible(3,"camera",true),true);
assert.strictEqual(law.listAllocationEligible(1.99,"camera",false),false);
assert.strictEqual(law.listAllocationEligible(1.99,"senato",true,20),true);
assert.strictEqual(law.listRegionallyEligibleForSenate(2.99,19.99),false);
assert.strictEqual(law.listRegionallyEligibleForSenate(2.99,20),true);

let q=law.coalitionQualification(["A","B"],{A:5,B:3},"camera");
assert.strictEqual(q.qualifies,true);
q=law.coalitionQualification(["A","B"],{A:7,B:3},"camera");
assert.strictEqual(q.qualifies,true);
q=law.coalitionQualification(["A","B"],{A:9.9,B:0.1},"camera");
assert.strictEqual(q.qualifies,false);
q=law.coalitionQualification(["A","B"],{A:8,B:2.99},"camera");
assert.strictEqual(q.qualifies,false);
q=law.coalitionQualification(["A","B"],{A:10,B:0},"camera");
assert.strictEqual(q.qualifies,true);

const score2=law.coalitionScores(["A","B"],{A:7.5,B:2.5},"camera");
assert.strictEqual(score2.qualifies,true);
assert.strictEqual(score2.admitted.length,1);
assert.strictEqual(score2.ripCandidate,"B");
assert.strictEqual(score2.allocationFigure,10);
assert.strictEqual(score2.premiumFigure,10);

let cs=law.coalitionScores(["A","B","C"],{A:6.5,B:3,C:0.5},"camera");
assert.strictEqual(cs.qualifies,true);

cs=law.coalitionScores(["A","B","C"],{A:6.5,B:3,C:0.5},"camera");
assert.strictEqual(cs.qualifies,true);
assert.deepStrictEqual(cs.admitted,["A","B"]);
assert.strictEqual(cs.ripCandidate,"C");
assert.strictEqual(cs.premiumFigure,10);
assert.strictEqual(cs.allocationFigure,10);

const coalitions=[
  {id:"C1",name:"Coalizione A",members:["A","B"]},
  {id:"C2",name:"Coalizione B",members:["C","D"]}
];
const winner=law.premiumCandidate(
  {A:25,B:20,C:43,D:0,E:42},
  {A:25,B:20,C:43,D:0,E:42},
  coalitions
);
// C1 is the national winner with 45%; C2 and E remain below it.
assert.strictEqual(winner.id,"C1");
assert.strictEqual(winner.camera,45);
assert.strictEqual(winner.senato,45);

const noWinner=law.premiumCandidate(
  {A:50,B:0},
  {A:41.9,B:0},
  [{id:"C1",name:"C1",members:["A"]}]
);
assert.strictEqual(noWinner,null);

const differentWinners=law.premiumCandidate(
  {A:43,B:0,C:44,D:0},
  {A:44,B:0,C:43,D:0},
  []
);
assert.strictEqual(differentWinners,null);

const alloc=law.largestRemainder(
  [{id:"A",votes:45},{id:"B",votes:35},{id:"C",votes:20}],
  10
);
assert.strictEqual(Object.values(alloc).reduce((a,v)=>a+v,0),10);
assert.deepStrictEqual(alloc,{A:5,B:3,C:2});
assert.strictEqual(law.quadratura(alloc,10),true);

assert.strictEqual(law.premiumPool("camera",false),384);
assert.strictEqual(law.premiumPool("camera",true),314);
assert.strictEqual(law.premiumPool("senate",false),189);
assert.strictEqual(law.premiumPool("senate",true),154);

console.log("TEST LEGGE ELETTORALE 08-10-2026: SUPERATO");
console.log("Regole, soglie, premio, seggi speciali, quota proporzionale e casistiche base verificati.");
