import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dataEngineRoute} from '../src/data-engine.js';
import {parseLocalEod,importLocalEod,loadLocalEod,localEodHistory,decodeLocalCsv,verifyLocalEodFiles,LOCAL_EOD_KEY} from '../public/local-eod.js';
// Deterministic synthetic price scenarios remain exclusively in tests.
const csv='date,market,symbol,currency,close,adjustment\n2026-11-04,BR,PETR4,BRL,20,raw\n2026-11-05,BR,PETR4,BRL,21,raw\n';
function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};}
test('local CSV preserves dates/basis and rejects conflicts, unknown adjustment and nonfinite prices',()=>{
 const result=parseLocalEod(csv,{sourceName:'Legitimate private test source'});assert.equal(result.rows.length,2);assert.equal(result.policy,'local_only');
 for(const text of [csv.replace('2026-11-04','2026-02-30'),csv.replace(',20,',',NaN,'),csv.replace(',raw',',unknown'),csv+'2026-11-05,BR,PETR4,BRL,30,raw\n',csv.replace(',21,raw',',21,total_return')])assert.throws(()=>parseLocalEod(text,{sourceName:'test'}));
});
test('local file import is versioned and does not use portfolio storage or grant public rights',async()=>{
 const store=memory();store.setItem('vezori-portfolio-v3','personal bytes');
 const result=await importLocalEod(store,csv,'Private CSV');assert.match(result.fileSha256,/^[a-f0-9]{64}$/);
 await importLocalEod(store,csv,'Private CSV');assert.equal(loadLocalEod(store).files.length,1);assert.equal(store.getItem('vezori-portfolio-v3'),'personal bytes');
 const series=localEodHistory(store,{symbol:'PETR4',market:'BR',currency:'BRL',range:'max'});
 assert.equal(series.localOnly,true);assert.equal(series.coverage.completeSinceListing,false);assert.equal(series.priceBasis,'user_declared_raw');
 assert.equal(localEodHistory(store,{symbol:'AAPL',market:'US',currency:'USD'}),null);
 assert.throws(()=>localEodHistory(store,{symbol:'PETR4',market:'BR',currency:'USD'}),/Moeda/);
});
test('corrupt EOD and storage quota failures preserve prior bytes',async()=>{
 const store=memory();await importLocalEod(store,csv,'Private CSV');const prior=store.getItem(LOCAL_EOD_KEY);
 const quota={getItem:store.getItem,setItem(){throw Error('QuotaExceededError');}};
 await assert.rejects(()=>importLocalEod(quota,csv.replace(',21,',',22,'),'Private CSV'),/Quota/);assert.equal(store.getItem(LOCAL_EOD_KEY),prior);
 store.setItem(LOCAL_EOD_KEY,'{broken');assert.throws(()=>loadLocalEod(store),/corrompido/);assert.equal(store.getItem(LOCAL_EOD_KEY),'{broken');
});
async function fixture(){
 const doc={schemaVersion:1,dataset:'macro',id:'test_rate',name:'Test rate',observations:[{key:'2025-01-01',values:{date:'2025-01-01',value:1}}]};
 const bytes=new TextEncoder().encode(JSON.stringify(doc)),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const entry={id:doc.id,name:doc.name,path:'/data/engine/objects/'+sha+'.json',sha256:sha,bytes:bytes.length,observations:1,first:'2025-01-01',last:'2025-01-01'};
 const manifest={schemaVersion:1,engineVersion:'1.0.0',catalog:{macro:[entry]},datasets:{macro:{status:'available'}},blocked:{prices:{status:'rights_required'}},storage:{instruments:1}};
 return {doc,entry,manifest,env:{ASSETS:{fetch:async request=>new Response(JSON.stringify(new URL(request.url).pathname.endsWith('/manifest.json')?manifest:doc))}}};
}
test('data routes paginate, validate identity and prove stored payload integrity',async()=>{
 const f=await fixture(),root='https://vezori.example/api/data-engine/';
 const catalog=await dataEngineRoute(new Request(root+'catalog?dataset=macro&limit=1'),f.env);assert.equal((await catalog.json()).total,1);
 const response=await dataEngineRoute(new Request(root+'record?dataset=macro&id=test_rate'),f.env);assert.equal(response.status,200);assert.equal((await response.json()).integrity.verified,true);
 f.doc.id='OTHER';assert.equal((await dataEngineRoute(new Request(root+'record?dataset=macro&id=test_rate'),f.env)).status,503);
});
test('bad pagination, missing records and absent assets are explicit',async()=>{
 const f=await fixture(),root='https://vezori.example/api/data-engine/';
 assert.equal((await dataEngineRoute(new Request(root+'catalog?dataset=macro&limit=10000'),f.env)).status,400);
 assert.equal((await dataEngineRoute(new Request(root+'record?dataset=macro&id=../secret'),f.env)).status,400);
 assert.equal((await dataEngineRoute(new Request(root+'record?dataset=macro&id=unknown'),f.env)).status,404);
 assert.equal((await dataEngineRoute(new Request(root+'status'),{})).status,503);
 const run=await dataEngineRoute(new Request(root+'runs'),{});assert.equal((await run.json()).continuousOperationProven,false);
});
test('maturity-date search is not mistaken for formatted CNPJ',async()=>{
 const f=await fixture();f.manifest.catalog.treasury=[{...f.entry,name:'Title (test fixture) · 2027-03-01',id:'td_test'}];
 const response=await dataEngineRoute(new Request('https://vezori.example/api/data-engine/catalog?dataset=treasury&q=2027-03-01'),f.env);
 assert.equal((await response.json()).total,1);
});
test('UTF-8 bytes and BOM are preserved and a tampered backup hash is rejected',async()=>{
 const bytes=new TextEncoder().encode('\uFEFF'+csv),text=decodeLocalCsv(bytes);assert.equal(text.charCodeAt(0),0xFEFF);
 assert.throws(()=>decodeLocalCsv(new Uint8Array([0xFF])),/UTF-8/);
 const store=memory();await importLocalEod(store,text,'Private CSV');const data=loadLocalEod(store);await verifyLocalEodFiles(data);
 data.files[0].fileSha256='a'.repeat(64);data.activeHash='a'.repeat(64);await assert.rejects(()=>verifyLocalEodFiles(data),/Hash/);
});
