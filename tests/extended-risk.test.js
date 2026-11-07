import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeExtendedRisk,analyzeBenchmarkRisk} from '../public/risk-metrics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function series(n=121){return {symbol:'TEST',market:'CRYPTO',currency:'BRL',interval:'1d',priceBasis:'test price only',provider:'test fixture',points:Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10),close:100*(i%2?1.02:1)}))};}
test('VaR empírico e CVaR usam a cauda observada, sem distribuição inventada',()=>{
 const r=analyzeExtendedRisk(series());near(r.historicalVaR95DailyPct,100*(1-1/1.02));near(r.historicalCVaR95DailyPct,r.historicalVaR95DailyPct);
 assert.equal(r.sortino,null);assert.equal(r.annualizedPriceReturnPct,null);
 assert.equal(analyzeExtendedRisk(series(60)).historicalVaR95DailyPct,null);
});
test('Sortino exige meta e moeda; benchmark idêntico tem beta 1 e TE zero',()=>{
 const s=series(),r=analyzeExtendedRisk(s,{targetAnnualPct:0,targetCurrency:'BRL'});assert.ok(Number.isFinite(r.sortino));
 assert.throws(()=>analyzeExtendedRisk(s,{targetAnnualPct:5,targetCurrency:'USD'}),/moeda/);
 const b=analyzeBenchmarkRisk(s,{...s,symbol:'BENCH'});near(b.beta,1);near(b.trackingErrorAnnualPct,0);assert.equal(b.informationRatio,null);
 assert.throws(()=>analyzeBenchmarkRisk(s,{...s,currency:'USD'}),/moeda/);
 assert.throws(()=>analyzeBenchmarkRisk(s,{...s,points:s.points.slice(1)}),/Datas/);
});
test('CAGR usa dias civis e Calmar recusa drawdown zero',()=>{
 const s=series(367);s.points=s.points.map((p,i)=>({...p,close:100*1.1**(i/365.25)}));
 const r=analyzeExtendedRisk(s);near(r.annualizedPriceReturnPct,10);assert.equal(r.calmar,null);
});
