import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePriceZones} from '../public/temporal-study.js';
const fixture=()=>({symbol:'TEST',market:'CRYPTO',currency:'BRL',interval:'1d',provider:'synthetic test only',priceBasis:'unadjusted',points:Array.from({length:180},(_,i)=>({date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),close:100+10*Math.sin(i/8)}))});
test('walk-forward nunca usa execução no mesmo candle e respeita a fronteira temporal',()=>{
 const s=fixture(),r=evaluatePriceZones(s);
 assert.equal(r.outOfSampleObservations,130);assert.ok(r.trades.length>0);
 assert.ok(r.trades.every(t=>t.executionDate>t.signalDate));
 const changed=structuredClone(s);changed.points.at(-1).close=1000;
 const tail=evaluatePriceZones(changed);
 assert.deepEqual(r.decisions,tail.decisions); // final unseen execution cannot change past decisions
 assert.equal(r.parameterOptimized,false);assert.equal(r.survivorshipControlled,false);
 assert.ok(evaluatePriceZones(s,{costBps:100,slippageBps:100}).returnPct<=evaluatePriceZones(s,{costBps:0,slippageBps:0}).returnPct);
});
