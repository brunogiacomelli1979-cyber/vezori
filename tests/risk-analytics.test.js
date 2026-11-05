import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRiskHistory,analyzeAssetRisk,RISK_MIN_RETURNS_VOL,RISK_MIN_RETURNS_SHARPE} from '../public/risk-analytics.js';

const series=(market,points,currency=market==='US'?'USD':'BRL')=>({symbol:'TEST',market,currency,interval:'1d',provider:'provedor de teste',priceBasis:'sem ajustes',points});
const p=(date,close)=>({date,close});
const addDays=(start,count)=>new Date(Date.parse(start+'T00:00:00Z')+count*86400000).toISOString().slice(0,10);
const cryptoHistory=(count,rate=.001)=>series('CRYPTO',Array.from({length:count},(_,i)=>p(addDays('2026-08-01',i),100*(1+rate)**i)));

test('retorno e maior drawdown usam apenas preços observados',()=>{
 const r=analyzeAssetRisk(series('CRYPTO',[p('2026-10-01',100),p('2026-10-02',120),p('2026-10-03',90),p('2026-10-04',110)]));
 assert.equal(r.returnPct,10);
 assert.equal(r.maxDrawdownPct,25);
 assert.equal(r.volatilityAnnualPct,null);
 assert.equal(r.sharpeAnnual,null);
 assert.equal(r.returnObservations,3);
});
test('volatilidade usa desvio amostral e 365 dias para cripto',()=>{
 const r=analyzeAssetRisk(series('CRYPTO',Array.from({length:32},(_,i)=>p(addDays('2026-08-01',i),i%2?110:100))));
 assert.equal(r.returnObservations,31);
 const values=Array.from({length:31},(_,i)=>i%2===0?.1:100/110-1);
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 const std=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1));
 assert.ok(Math.abs(r.volatilityAnnualPct-std*Math.sqrt(365)*100)<1e-6);
 assert.equal(r.observationSessionsPerYear,365);
});
test('amostra pequena não gera volatilidade anualizada, mesmo com cotação',()=>{
 const r=analyzeAssetRisk(cryptoHistory(RISK_MIN_RETURNS_VOL));
 assert.equal(r.volatilityAnnualPct,null);
 assert.ok(r.returnPct>0);
});
test('Sharpe só com mínimo de 60 retornos, taxa expressa e variância não nula',()=>{
 const r=analyzeAssetRisk(series('CRYPTO',Array.from({length:65},(_,i)=>p(addDays('2026-08-01',i),100*(1.001)**i*(i%2?.999:1.001)))),{riskFreeAnnualPct:4,riskFreeCurrency:'BRL'});
 assert.equal(r.returnObservations,64);
 assert.ok(typeof r.sharpeAnnual==='number'&&Number.isFinite(r.sharpeAnnual));
 assert.equal(analyzeAssetRisk(cryptoHistory(65),{riskFreeAnnualPct:0,riskFreeCurrency:'BRL'}).sharpeAnnual,null);
 assert.throws(()=>analyzeAssetRisk(cryptoHistory(65),{riskFreeAnnualPct:-101,riskFreeCurrency:'BRL'}),/inválida/);
});
test('não fabrica preços nem aceita duplicatas contraditórias ou lacunas longas',()=>{
 assert.throws(()=>prepareRiskHistory(series('BR',[p('2026-10-01',10),p('2026-10-01',11)])),/conflitantes/);
 assert.throws(()=>prepareRiskHistory(series('BR',[p('2026-10-01',10),p('2026-11-01',11)])),/incompleta/);
 assert.throws(()=>prepareRiskHistory(series('CRYPTO',[p('2026-10-01',10),p('2026-10-04',11)])),/incompleta/);
 assert.throws(()=>prepareRiskHistory(series('BR',[p('2026-02-30',10),p('2026-03-01',11)])),/inválidos/);
 assert.throws(()=>prepareRiskHistory(series('BR',[p('2026-10-01',10),p('2026-10-02',null)])),/inválidos/);
});
test('série diária é ordenada e respeita método do provedor sem preencher finais de semana',()=>{
 const s=prepareRiskHistory(series('BR',[p('2026-11-03',12),p('2026-10-30',10),p('2026-11-02',11)]));
 assert.deepEqual(s.points.map(x=>x.date),['2026-10-30','2026-11-02','2026-11-03']);
 assert.equal(s.provider,'provedor de teste');
 assert.equal(RISK_MIN_RETURNS_SHARPE,60);
});

test('recusa Sharpe quando taxa de referência não declara a mesma moeda',()=>{
 assert.throws(()=>analyzeAssetRisk(cryptoHistory(65),{riskFreeAnnualPct:4}),/Moeda/);
 assert.throws(()=>analyzeAssetRisk(cryptoHistory(65),{riskFreeAnnualPct:4,riskFreeCurrency:'USD'}),/Moeda/);
});
test('lacuna de um dia em cripto não é tratada como retorno diário',()=>{
 assert.throws(()=>prepareRiskHistory(series('CRYPTO',[p('2026-10-01',10),p('2026-10-03',11)])),/incompleta/);
});
