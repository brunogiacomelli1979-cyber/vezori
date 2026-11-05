import test from 'node:test';
import assert from 'node:assert/strict';
import {appendDailyObservations,readDailyObservations,observationKey} from '../src/daily-observations.js';
const kv=()=>{const m=new Map();return {m,async get(k){return m.has(k)?JSON.parse(m.get(k)):null;},async put(k,v){m.set(k,v)}};};
const market=(price=100,marketType='CRYPTO')=>({quotes:[{symbol:marketType==='CRYPTO'?'BTC':'PETR4',market:marketType,currency:'BRL',price,provider:'test feed',providerAsOf:'2026-11-05T02:20:00Z'}]});
test('arquiva por mes e reconstrói série sem inventar datas',async()=>{
 const s=kv();
 await appendDailyObservations(s,market(100),new Date('2026-10-31T02:30:00Z'));
 await appendDailyObservations(s,market(101),new Date('2026-11-01T02:30:00Z'));
 const h=await readDailyObservations(s,{market:'CRYPTO',symbol:'BTC',months:2,asOf:new Date('2026-11-05')});
 assert.deepEqual(h.points.map(p=>p.price),[100,101]);
 assert.deepEqual(h.points.map(p=>p.date),['2026-10-31','2026-11-01']);
 assert.equal(h.coverage.completeSinceListing,false);
 assert.equal(h.priceBasis,'cotação capturada uma vez ao dia, não fechamento oficial');
 assert.ok(s.m.has(observationKey('CRYPTO','BTC','2026-10')));
 assert.ok(s.m.has(observationKey('CRYPTO','BTC','2026-11')));
});
test('idempotência: captura repetida não substitui o preço do dia',async()=>{
 const s=kv(),at=new Date('2026-11-05T02:30:00Z');
 assert.equal((await appendDailyObservations(s,market(100),at)).stored,1);
 assert.equal((await appendDailyObservations(s,market(222),at)).stored,0);
 const h=await readDailyObservations(s,{market:'CRYPTO',symbol:'BTC',months:1,asOf:at});
 assert.equal(h.points.length,1);assert.equal(h.points[0].price,100);
});
test('não cruza ativos nem cria cotações para dados inválidos',async()=>{
 const s=kv(),bad=market(0);bad.quotes.push({...market(55,'BR').quotes[0]});
 const out=await appendDailyObservations(s,bad,new Date('2026-11-05T02:30:00Z'));
 assert.equal(out.stored,1);assert.equal(out.skipped,1);
 const btc=await readDailyObservations(s,{market:'CRYPTO',symbol:'BTC',asOf:new Date('2026-11-05')});
 assert.equal(btc.points.length,0);
 const petr=await readDailyObservations(s,{market:'BR',symbol:'PETR4',asOf:new Date('2026-11-05')});
 assert.equal(petr.points.length,1);
});
test('desabilitado sem KV e período máximo de 24 meses',async()=>{
 assert.equal((await readDailyObservations(null,{market:'BR',symbol:'PETR4'})).status,'storage_not_configured');
 await assert.rejects(()=>readDailyObservations(kv(),{market:'BR',symbol:'PETR4',months:25}),/Período inválido/);
});

test('cursor permite solicitar páginas históricas anteriores sem truncamento silencioso',async()=>{
 const s=kv();
 await appendDailyObservations(s,market(78),new Date('2025-02-14T02:30:00Z'));
 await appendDailyObservations(s,market(90),new Date('2026-11-05T02:30:00Z'));
 const recent=await readDailyObservations(s,{market:'CRYPTO',symbol:'BTC',months:12,asOf:new Date('2026-11-05')});
 assert.equal(recent.points.length,1);
 const older=await readDailyObservations(s,{market:'CRYPTO',symbol:'BTC',months:24,asOf:new Date('2025-12-31')});
 assert.equal(older.points.length,1);
 assert.equal(older.points[0].date,'2025-02-14');
 assert.match(recent.previousPageMonth,/^\\d{4}-\\d{2}$/);
});
