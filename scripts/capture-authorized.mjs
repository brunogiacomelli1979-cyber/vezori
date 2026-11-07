/** Controlled capture of official BCB data only; no provider quote licence assumed. */
import {readFileSync} from 'node:fs';
import {selic} from '../src/worker.js';
import {persistDailySnapshot,SNAPSHOT_PREFIX} from '../src/daily-snapshot.js';
import {verifyRecord} from '../src/record-integrity.js';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.name!=='vezori')throw Error('Worker scope mismatch');
const id=config.kv_namespaces?.find(x=>x.binding==='MARKET_SNAPSHOTS')?.id;
if(!id||!process.env.CLOUDFLARE_API_TOKEN||!process.env.CLOUDFLARE_ACCOUNT_ID)throw Error('Controlled capture requires configured binding/auth');
const root='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)+'/storage/kv/namespaces/'+id+'/values/';
const headers={authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN};
const store={
 async get(key){
  if(!key.startsWith(SNAPSHOT_PREFIX))throw Error('Capture key outside VEZORI scope');
  const response=await fetch(root+encodeURIComponent(key),{headers,signal:AbortSignal.timeout(20000)});
  if(response.status===404)return null;if(!response.ok)throw Error('Capture read failed: HTTP '+response.status);
  return response.json();
 },
 async put(key,value){
  if(!key.startsWith(SNAPSHOT_PREFIX))throw Error('Capture key outside VEZORI scope');
  const response=await fetch(root+encodeURIComponent(key),{method:'PUT',headers:{...headers,'content-type':'text/plain'},body:value,signal:AbortSignal.timeout(20000)});
  if(!response.ok||(await response.json()).success!==true)throw Error('Capture write failed: HTTP '+response.status);
 }
};
const at=new Date(),day=at.toISOString().slice(0,10),previous=await store.get(SNAPSHOT_PREFIX+day);
const macro=await selic();
const market={mode:'real_market_data',generatedAt:at.toISOString(),quotes:[],fx:[],macro:[macro],errors:[],availability:{bcb:'available'},meta:{simulatedPrices:false,captureKind:'official_macro_only',licensing:'BCB reproduction with source/integrity; no third-party quotes retained'}};
const result=await persistDailySnapshot(store,market,at);
if(!['stored','already_recorded'].includes(result.status))throw Error('Controlled capture not persisted: '+result.status);
const recorded=await store.get(SNAPSHOT_PREFIX+day);
await verifyRecord(recorded);
if(previous&&JSON.stringify(previous)!==JSON.stringify(recorded))throw Error('Existing daily observation was overwritten');
if(!recorded.data.macro.some(m=>m.provider==='BCB / SGS 432'))throw Error('Official macro provenance missing');
console.log('Authorized capture:',result.status,day,'BCB source and record integrity verified; existing daily records preserved');
