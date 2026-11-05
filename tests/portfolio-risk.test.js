import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeHistoricalBasket,returnCorrelation} from '../public/portfolio-risk.js';
const at=(d,i)=>new Date(Date.parse(d+'T00:00:00Z')+86400000*i).toISOString().slice(0,10);
const crypto=(symbol,amount=100,sign=1,len=43)=>({symbol,market:'CRYPTO',currency:'BRL',provider:'CoinGecko',priceBasis:'preço de mercado diário',interval:'1d',
 points:Array.from({length:len},(_,i)=>({date:at('2026-09-01',i),close:amount*(1+.01*sign)**i*(i%2?1.002:.998)}))});
const sel=(a,b,wa=30,wb=20)=>[{symbol:a.symbol,weight:wa,series:a},{symbol:b.symbol,weight:wb,series:b}];

test('cesta de dois ativos idênticos tem mesmo retorno e risco individual, pesos transparentes',async()=>{
 const x=crypto('BTC'),y={...crypto('ETH'),points:x.points.map(p=>({...p,close:p.close*2}))};
 const result=analyzeHistoricalBasket(sel(x,y,30,20));
 const {analyzeAssetRisk}=await import('../public/risk-analytics.js');
 const base=analyzeAssetRisk(x);
 assert.equal(result.currency,'BRL');assert.equal(result.market,'CRYPTO');
 assert.ok(Math.abs(result.returnPct-base.returnPct)<1e-6);
 assert.ok(Math.abs(result.maxDrawdownPct-base.maxDrawdownPct)<1e-6);
 assert.ok(Math.abs(result.volatilityAnnualPct-base.volatilityAnnualPct)<1e-6);
 assert.equal(result.selectedOriginalWeightPct,50);
 assert.deepEqual(result.weights.map(x=>x.normalizedWeightPct),[60,40]);
 assert.ok(Math.abs(result.correlations[0].coefficient-1)<1e-10);
});

test('cesta agrega retornos ponderados com rebalanceamento matemático diário',()=>{
 const x=crypto('BTC',100,1),y=crypto('ETH',200,-1);
 const result=analyzeHistoricalBasket(sel(x,y,50,50));
 const first=.5*(x.points[1].close/x.points[0].close-1)+.5*(y.points[1].close/y.points[0].close-1);
 let index=100*(1+first);
 for(let i=2;i<x.points.length;i++){
  const a=x.points[i].close/x.points[i-1].close-1,b=y.points[i].close/y.points[i-1].close-1;
  index*=1+.5*a+.5*b;
 }
 assert.ok(Math.abs(result.returnPct-(index/100-1)*100)<1e-6);
 assert.ok(Number.isFinite(result.volatilityAnnualPct));
 assert.equal(result.returnObservations,42);
});

test('recusa mistura de moeda, mercados, metodologia e pesos inválidos',()=>{
 const x=crypto('BTC'),y=crypto('ETH');
 assert.throws(()=>analyzeHistoricalBasket(sel(x,{...y,currency:'USD'})),/Moedas/);
 assert.throws(()=>analyzeHistoricalBasket(sel(x,{...y,market:'BR'})),/Calendários/);
 assert.throws(()=>analyzeHistoricalBasket(sel(x,{...y,priceBasis:'outro ajuste'})),/Bases/);
 assert.throws(()=>analyzeHistoricalBasket(sel(x,y,75,40)),/excede/);
 assert.throws(()=>analyzeHistoricalBasket(sel(x,{...y,symbol:'BTC'})),/duplicado/);
 assert.throws(()=>analyzeHistoricalBasket([sel(x,y)[0]]),/entre dois e cinco/);
});

test('não preenche datas ausentes dentro do intervalo coincidente',()=>{
 const x=crypto('BTC'),y=crypto('ETH');
 const missing=y.points.filter((_,i)=>i!==20);
 assert.throws(()=>analyzeHistoricalBasket(sel(x,{...y,points:missing})),/ausente|incompleta/);
});

test('não exige cobertura anterior idêntica fora da janela compartilhada',()=>{
 const x=crypto('BTC'),y=crypto('ETH');
 const result=analyzeHistoricalBasket(sel(x,{...y,points:y.points.slice(3)}));
 assert.equal(result.observations,40);
 assert.equal(result.from,y.points[3].date);
});

test('não transforma observações insuficientes em volatilidade anual',()=>{
 const x=crypto('BTC'),y=crypto('ETH');
 assert.throws(()=>analyzeHistoricalBasket(sel(x,{...y,points:y.points.slice(-29)})),/pelo menos 31/);
});

test('correlação não fabrica indicador com retornos constantes',()=>{
 assert.equal(returnCorrelation([0,0,0],[.1,.2,.3]),null);
 assert.ok(Math.abs(returnCorrelation([1,2,3],[3,2,1])+1)<1e-10);
 assert.throws(()=>returnCorrelation([1],[1]),/comparáveis/);
});
