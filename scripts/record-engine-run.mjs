/** Store a sealed, immutable execution receipt in the existing VEZORI KV, after deployment. */
import {readFileSync} from 'node:fs';
import {sealRecord,verifyRecord} from '../src/record-integrity.js';
const summary=JSON.parse(readFileSync('out/engine-run.json','utf8'));
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const namespace=config.kv_namespaces?.find(x=>x.binding==='MARKET_SNAPSHOTS')?.id;
const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,GITHUB_SHA:sha}=process.env;
if(config.name!=='vezori'||!/^[a-f0-9]{32}$/i.test(account||'')||!namespace||!token||!sha)throw Error('Execution receipt requires scoped VEZORI KV configuration');
if(summary.engineVersion!=='1.0.0'||!summary.manifestSha256||!Array.isArray(summary.sources))throw Error('Execution summary invalid');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/storage/kv/namespaces/'+namespace+'/values/';
const headers={authorization:'Bearer '+token};
const key='vezori:engine:runs:'+summary.run.id+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
async function read(key){const response=await fetch(root+encodeURIComponent(key),{headers,signal:AbortSignal.timeout(20000)});if(response.status===404)return null;if(!response.ok)throw Error('Execution receipt read HTTP '+response.status);return response.json();}
async function put(key,value){const response=await fetch(root+encodeURIComponent(key),{method:'PUT',headers:{...headers,'content-type':'text/plain'},body:JSON.stringify(value),signal:AbortSignal.timeout(20000)});if(!response.ok||(await response.json()).success!==true)throw Error('Execution receipt write HTTP '+response.status);}
const prior=await read(key);
if(prior){await verifyRecord(prior);if(prior.summary.manifestSha256!==summary.manifestSha256||prior.release!==sha)throw Error('An existing execution receipt differs; it will not be overwritten');}
const item=prior||await sealRecord({schemaVersion:1,release:sha,recordedAt:new Date().toISOString(),summary});
if(!prior)await put(key,item);
let stored;
for(let attempt=0;attempt<10;attempt++){stored=await read(key);if(stored?.integrity?.sha256===item.integrity.sha256)break;await new Promise(resolve=>setTimeout(resolve,5000));}
await verifyRecord(stored);if(stored?.integrity?.sha256!==item.integrity.sha256)throw Error('Execution receipt not readable after bounded wait');
const latest=await read('vezori:engine:latest');if(latest)await verifyRecord(latest);
if(!latest||latest.summary.generatedAt<=summary.generatedAt)await put('vezori:engine:latest',item);
console.log('Data Engine receipt: stored/read/verified; immutable run '+summary.run.id+'; '+summary.sources.length+' source receipts; event '+summary.run.event+'. No market price rights were enabled.');
