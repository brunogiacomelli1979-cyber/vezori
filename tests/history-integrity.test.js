import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHistoryPoints} from '../src/history-contract.js';
import {sealRecord,verifyRecord} from '../src/record-integrity.js';
import {historyQuote} from '../src/worker.js';
import {simulateStudy} from '../public/lab.js';
test('histórico rejeita datas impossíveis, futuras e duplicatas conflitantes',()=>{
 for(const points of [[{date:'2026-02-30',close:10}],[{date:'2099-01-01',close:10}],[{date:'2025-01-01',close:10},{date:'2025-01-01',close:11}]])assert.throws(()=>normalizeHistoryPoints(points));
 assert.equal(normalizeHistoryPoints([{date:'2025-01-01',close:10},{date:'2025-01-01',close:10}]).length,1);
});
test('não mistura adjustedClose e close e recusa identidade divergente',async()=>{
 const data={results:[{symbol:'PETR4',data:{historicalDataPrice:[{date:'2025-01-01',close:100,adjustedClose:50},{date:'2025-01-02',close:102}]}}]};
 const fetcher=async()=>new Response(JSON.stringify(data));
 const series=await historyQuote('BR','PETR4','1mo',{},fetcher);
 assert.deepEqual(series.points.map(p=>p.close),[100,102]);assert.equal(series.adjustment,'unadjusted');
 data.results[0].symbol='VALE3';await assert.rejects(()=>historyQuote('BR','PETR4','1mo',{},fetcher),/Identidade/);
});
test('SHA preserva legado, detecta corrupção e não certifica autenticidade',async()=>{
 const item=await sealRecord({schemaVersion:1,points:[{price:10}]});
 assert.equal(await verifyRecord(item),'verified');
 item.points[0].price=20;await assert.rejects(()=>verifyRecord(item),/SHA-256/);
 assert.equal(await verifyRecord({schemaVersion:1}),'legacy_unsigned');
});
test('custos, liquidação tributada hipotética e inflação reconciliam fórmula de um ano',()=>{
 const r=simulateStudy([{symbol:'PETR4',weight:100,rate:10}],{initial:1000,monthly:0,years:1,feeAnnualPct:2,taxGainPct:20,inflationAnnualPct:5});
 const nominal=1000*1.1*.98,gain=nominal-1000,net=nominal-gain*.2;
 assert.ok(Math.abs(r.total-net)<1e-8);assert.ok(Math.abs(r.realTotal-net/1.05)<1e-8);
 assert.ok(Math.abs(r.years[0].amount-net)<1e-8);
});
