/** Non-destructive isolated probe; never writes to price/portfolio keys. */
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.name!=='vezori')throw Error('Worker scope mismatch');
const id=config.kv_namespaces?.find(x=>x.binding==='MARKET_SNAPSHOTS')?.id;
if(!id||!process.env.CLOUDFLARE_API_TOKEN||!process.env.CLOUDFLARE_ACCOUNT_ID)throw Error('KV verification requires configured auth and binding');
const key='vezori:diagnostics:v1:'+randomUUID();
const root='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)+'/storage/kv/namespaces/'+id+'/values/'+encodeURIComponent(key);
const body=JSON.stringify({kind:'storage_probe',release:process.env.GITHUB_SHA||null,at:new Date().toISOString()});
const headers={authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN};
const put=await fetch(root+'?expiration_ttl=86400',{method:'PUT',headers:{...headers,'content-type':'text/plain'},body,signal:AbortSignal.timeout(20000)});
if(!put.ok||(await put.json()).success!==true)throw Error('KV diagnostic write failed: HTTP '+put.status);
for(let attempt=0;attempt<12;attempt++){
 const response=await fetch(root,{headers,signal:AbortSignal.timeout(20000)});
 if(response.ok&&await response.text()===body){
  // A second read verifies persisted bytes, separate from the successful PUT response.
  const again=await fetch(root,{headers,signal:AbortSignal.timeout(20000)});
  if(!again.ok||await again.text()!==body)throw Error('KV persistence re-read mismatch');
  console.log('KV diagnostic: write/read/re-read verified; isolated probe expires in 24h; no market keys changed');
  process.exit(0);
 }
 await new Promise(resolve=>setTimeout(resolve,5000));
}
throw Error('KV diagnostic not visible within bounded consistency window');
