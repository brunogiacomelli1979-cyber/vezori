import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestPriceZones} from '../public/price-zones.js';
const fixture=(market='BR',n=65)=>{
 const start=new Date('2026-07-01T00:00:00Z');
 const points=[];
 for(let i=0;i<n*2&&points.length<n;i++){
  const date=new Date(start.getTime()+i*86400000);
  if(market!=='CRYPTO'&&[0,6].includes(date.getUTCDay()))continue;
  points.push({date:date.toISOString().slice(0,10),close:100+Math.sin(points.length/6)*7+points.length*.22});
 }
 return {market,symbol:market==='CRYPTO'?'BTC':'PETR4',currency:'BRL',interval:'1d',provider:'fixture de teste',priceBasis:'teste',points};
};
test('faixas consistentes e reprodutiveis com serie historica',()=>{
 const s=fixture(),a=suggestPriceZones(s),b=suggestPriceZones(s);
 assert.deepEqual(a,b);
 assert.equal(a.status,'indicative_historical_zones');
 assert.ok(a.buy[0]>0&&a.buy[0]<=a.buy[1]);
 assert.ok(a.sell[0]>0&&a.sell[0]<=a.sell[1]);
 assert.ok(a.riskLimit<a.buy[0]);
 assert.ok(a.observations>=50);
});
test('não inventa faixas quando há menos de 50 fechamentos',()=>assert.throws(()=>suggestPriceZones(fixture('CRYPTO',32)),/50 fechamentos/));
test('não aceita datas duplicadas com preços divergentes',()=>{
 const s=fixture();s.points.push({...s.points[0],close:1011});
 assert.throws(()=>suggestPriceZones(s),/conflitantes/);
});
test('não aceita descontinuidade longa',()=>{
 const s=fixture('CRYPTO');s.points[40].date='2027-01-01';
 assert.throws(()=>suggestPriceZones(s),/lacunas|conflitantes/);
});
test('não aceita retorno sem volatilidade',()=>{
 const s=fixture();s.points=s.points.map(p=>({...p,close:100}));
 assert.throws(()=>suggestPriceZones(s),/Variação histórica insuficiente/);
});
