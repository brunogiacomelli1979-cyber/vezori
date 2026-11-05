import test from 'node:test';
import assert from 'node:assert/strict';
import {persistDailySnapshot,latestDailySnapshot,validateMarketSnapshot,SNAPSHOT_PREFIX} from '../src/daily-snapshot.js';
const mockMarket=()=>({mode:'real_market_data',generatedAt:'2026-11-05T02:30:00Z',
 meta:{simulatedPrices:false},quotes:[{symbol:'PETR4',price:40,provider:'brapi'}],fx:[],macro:[],errors:[]});
const kv=()=>{const values=new Map();return {values,async get(k){return values.has(k)?JSON.parse(values.get(k)):null;},async put(k,v){values.set(k,v);}};};
test('dois registros diários ficam persistidos e a coleta é idempotente',async()=>{
 const store=kv();
 const d=new Date('2026-11-05T02:30:00Z');
 const first=await persistDailySnapshot(store,mockMarket(),d);
 assert.equal(first.status,'stored');
 assert.equal(store.values.size,2);
 const again=await persistDailySnapshot(store,mockMarket(),d);
 assert.equal(again.status,'already_recorded');
 assert.ok(store.values.has(SNAPSHOT_PREFIX+'2026-11-05'));
 const snapshot=await latestDailySnapshot(store,new Date('2026-11-05T08:30:00Z'));
 assert.equal(snapshot.meta.ageHours,6);
 assert.equal(snapshot.meta.stale,false);
 assert.equal(snapshot.quotes[0].price,40);
});
test('ausência de KV ou dados sem origem não cria snapshot fantasma',async()=>{
 assert.equal((await persistDailySnapshot(null,mockMarket())).status,'storage_not_configured');
 const store=kv(),bad=mockMarket();bad.quotes=[];bad.fx=[];bad.macro=[];
 assert.equal(validateMarketSnapshot(bad),false);
 assert.equal((await persistDailySnapshot(store,bad)).status,'rejected_unusable_data');
 assert.equal(store.values.size,0);
});
test('dados antigos são identificados com aviso de idade, sem mudar valor',async()=>{
 const store=kv();await persistDailySnapshot(store,mockMarket(),new Date('2026-11-05T02:30:00Z'));
 const snapshot=await latestDailySnapshot(store,new Date('2026-11-09T02:30:00Z'));
 assert.equal(snapshot.meta.stale,true);
 assert.equal(snapshot.quotes[0].price,40);
});
