/** Optional Cloudflare KV provisioning from the existing GitHub Actions Cloudflare token.
 * The operation is idempotent and account-scoped. In CI --required mode,
 * missing permissions or KV binding fail the deployment rather than silently
 * publishing a Worker without archival storage.
 * Only the VEZORI Worker config is mutated in the ephemeral CI workspace.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const KV_BINDING='MARKET_SNAPSHOTS';
export const KV_TITLE='vezori-MARKET_SNAPSHOTS';
export const KNOWN_TITLES=new Set([KV_TITLE,'VEZORI_MARKET_SNAPSHOTS']);
// Describe CLI failures using fixed categories only. Never echo stderr, API tokens,
// account IDs or the full upstream command in a public Actions log.
export function classifyKVFailure(error){
 const detail=String(error?.stderr||error?.message||'');
 if(/10000|9109|unauthorized|forbidden|permission|authentication|insufficient.*scope|HTTP 403|code: 403/i.test(detail))return 'authorization_or_scope';
 if(/unknown command|command not found|not recognized|could not determine executable/i.test(detail))return 'wrangler_command';
 if(/network|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed/i.test(detail))return 'network';
 return 'unclassified';
}

export function namespaceIdFromList(raw){
 const data=JSON.parse(raw);
 if(!Array.isArray(data))throw Error('Unexpected Cloudflare KV namespace list response');
 const matched=data.filter(item=>KNOWN_TITLES.has(item?.title)&&/^[a-f0-9]{32}$/.test(String(item.id||'')));
 if(matched.length>1)throw Error('Multiple identically named KV namespaces; manual review required');
 return matched[0]?.id||null;
}
export function namespaceIdFromCreate(raw){
 const matches=[...String(raw).matchAll(/"id"\s*:\s*"([a-f0-9]{32})"/g)];
 if(matches.length!==1)throw Error('Cannot reliably identify newly created KV namespace');
 return matches[0][1];
}
export function applyKVBinding(config,id){
 if(!config||config.name!=='vezori'||config.main!=='src/worker.js'||!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid VEZORI configuration or KV ID');
 const others=(config.kv_namespaces||[]).filter(x=>x.binding!==KV_BINDING);
 return {...config,kv_namespaces:[...others,{binding:KV_BINDING,id}]};
}

/** REST avoids parsing human-oriented Wrangler output and enumerates every page. */
export async function provisionKV({fetcher=fetch,configPath='wrangler.jsonc',env=process.env}={}){
 if(!env.CLOUDFLARE_API_TOKEN||!env.CLOUDFLARE_ACCOUNT_ID)return {status:'no_cloudflare_auth'};
 if(!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID))throw Error('invalid_account_id_format: configure the 32-hex Cloudflare Account ID in the existing Actions secret');
 const config=JSON.parse(readFileSync(configPath,'utf8'));
 if(config.name!=='vezori'||config.main!=='src/worker.js')throw Error('This provisioning is restricted to the VEZORI Worker');
 const bindings=(config.kv_namespaces||[]).filter(x=>x.binding===KV_BINDING);
 if(bindings.length>1)throw Error('Ambiguous KV binding: multiple MARKET_SNAPSHOTS entries');
 if(bindings.length&& !/^[a-f0-9]{32}$/.test(String(bindings[0].id||'')))throw Error('KV binding exists with an invalid namespace ID');
 const root='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)+'/storage/kv/namespaces';
 async function request(url,method='GET',body){
  const response=await fetcher(url,{method,headers:{authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  let data;try{data=await response.json();}catch{throw Error('cloudflare_invalid_json');}
  if(!response.ok||data.success!==true){
   const category=[401,403].includes(response.status)?'authorization_or_scope':response.status===429?'rate_limited':'cloudflare_api_failure';
   // Only numeric status/code are logged. Never print provider messages or credentials.
   const codes=(data.errors||[]).map(x=>Number(x.code)).filter(Number.isFinite).join(',');
   throw Error(category+' HTTP '+response.status+' codes '+codes);
  }
  return data;
 }
 const namespaces=[];
 for(let page=1;page<=100;page++){
  const data=await request(root+'?per_page=100&page='+page);
  if(!Array.isArray(data.result))throw Error('Unexpected Cloudflare KV namespace list response');
  namespaces.push(...data.result);
  if(page>=(data.result_info?.total_pages||1))break;
  if(page===100)throw Error('Namespace pagination exceeds safe bound');
 }
 let id;
 if(bindings.length){
  const match=namespaces.find(x=>x.id===bindings[0].id&&KNOWN_TITLES.has(x.title));
  if(!match)throw Error('Configured namespace not verified as VEZORI-owned');
  id=match.id;
 }else{
  id=namespaceIdFromList(JSON.stringify(namespaces));
  if(!id){
   const created=await request(root,'POST',{title:KV_TITLE});
   id=created.result?.id;
   if(!/^[a-f0-9]{32}$/.test(String(id||'')))throw Error('Cannot reliably identify newly created KV namespace');
  }
 }
 writeFileSync(configPath,JSON.stringify(applyKVBinding(config,id),null,2)+'\n','utf8');
 return {status:'configured',binding:KV_BINDING,source:bindings.length?'config':'api'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const required=process.argv.includes('--required');
 try{
  const result=await provisionKV();
  console.log('VEZORI KV:',result.status,result.status==='configured'?result.binding:'');
  if(required&&result.status!=='configured'){
   console.error('::error::VEZORI deploy blocked: MARKET_SNAPSHOTS is not configured. Check Cloudflare KV permissions or bind a namespace.');
   process.exitCode=1;
  }
 }catch(err){
  console.error('::error::VEZORI KV provisioning failed: '+String(err.message).replace(/https?:\/\/\S+/g,'[endpoint]').slice(0,140));
  if(required)process.exitCode=1;
 }
}
