/** Optional Cloudflare KV provisioning from the existing GitHub Actions Cloudflare token.
 * The operation is idempotent and account-scoped. In CI --required mode,
 * missing permissions or KV binding fail the deployment rather than silently
 * publishing a Worker without archival storage.
 * Only the VEZORI Worker config is mutated in the ephemeral CI workspace.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const KV_BINDING='MARKET_SNAPSHOTS';
export const KV_TITLE='vezori-MARKET_SNAPSHOTS';
export const KNOWN_TITLES=new Set([KV_TITLE,'VEZORI_MARKET_SNAPSHOTS']);

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

export function provisionKV({run=execFileSync,configPath='wrangler.jsonc'}={}){
 if(!process.env.CLOUDFLARE_API_TOKEN||!process.env.CLOUDFLARE_ACCOUNT_ID){
  return {status:'no_cloudflare_auth'};
 }
 const config=JSON.parse(readFileSync(configPath,'utf8'));
 if(config.name!=='vezori'||config.main!=='src/worker.js')throw Error('This provisioning is restricted to the VEZORI Worker');
 const existing=(config.kv_namespaces||[]).filter(x=>x.binding===KV_BINDING);
 if(existing.length>1)throw Error('Ambiguous KV binding: multiple MARKET_SNAPSHOTS entries');
 if(existing.length===1){
  if(!/^[a-f0-9]{32}$/.test(String(existing[0].id||'')))throw Error('KV binding exists with an invalid namespace ID');
  return {status:'configured',binding:KV_BINDING,source:'config'};
 }
 function wrangler(...args){
  return run('npx',['wrangler','kv','namespace',...args],{encoding:'utf8',timeout:45000,stdio:['ignore','pipe','pipe']});
 }
 let id;
 try{id=namespaceIdFromList(wrangler('list'));}
 catch(error){
  console.log('::warning::Unable to list KV namespaces. Deployment needs KV Storage Read or a valid binding in wrangler.jsonc.');
  return {status:'permission_or_access_missing'};
 }
 if(!id){
  try{id=namespaceIdFromCreate(wrangler('create',KV_BINDING));}
  catch(error){
   console.log('::warning::Cannot create KV namespace. Grant Workers KV Storage Write or bind an existing namespace.');
   return {status:'permission_or_access_missing'};
  }
 }
 const updated=applyKVBinding(config,id);
 writeFileSync(configPath,JSON.stringify(updated,null,2)+'\n','utf8');
 return {status:'configured',binding:KV_BINDING,namespaceId:id};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const required=process.argv.includes('--required');
 try{
  const result=provisionKV();
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
