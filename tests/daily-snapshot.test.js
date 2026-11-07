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

test('recupera falha parcial no latest sem trocar cotação original',async()=>{
 const storage=kv(),first=mockMarket();
 let fail=true;
 const fragile={
  get:storage.get.bind(storage),
  async put(key,value){
   if(key===SNAPSHOT_PREFIX+'latest'&&fail){fail=false;throw Error('Falha transitória');}
   return storage.put(key,value);
  }
 };
 const at=new Date('2026-11-05T02:30:00Z');
 await assert.rejects(()=>persistDailySnapshot(fragile,first,at),/transitória/);
 assert.ok(storage.values.has(SNAPSHOT_PREFIX+'2026-11-05'));
 const changed=mockMarket();changed.quotes[0].price=999;
 const repaired=await persistDailySnapshot(fragile,changed,at);
 assert.equal(repaired.status,'already_recorded');
 const current=await latestDailySnapshot(storage,new Date('2026-11-05T08:30:00Z'));
 assert.equal(current.quotes[0].price,40);
});
test('não escreve evento mais antigo por cima do snapshot latest',async()=>{
 const storage=kv();
 await persistDailySnapshot(storage,mockMarket(),new Date('2026-11-06T02:30:00Z'));
 const older=await persistDailySnapshot(storage,mockMarket(),new Date('2026-11-05T02:30:00Z'));
 assert.equal(older.status,'out_of_order');
 assert.equal(storage.values.size,2);
 const current=await latestDailySnapshot(storage,new Date('2026-11-07T02:30:00Z'));
 assert.equal(current.meta.snapshotDate,'2026-11-06');
});
