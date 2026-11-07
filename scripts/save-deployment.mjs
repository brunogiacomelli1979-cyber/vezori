import {mkdir,writeFile} from 'node:fs/promises';
const {CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token}=process.env;
if(!account||!token)throw Error('Rollback snapshot requires deployment auth');
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/vezori/deployments',{
 headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
const data=await response.json();
if(!response.ok||data.success!==true||!data.result?.deployments?.length)throw Error('Previous VEZORI deployment could not be recorded: HTTP '+response.status);
const prior=data.result.deployments[0];
await mkdir('out',{recursive:true});
await writeFile('out/rollback.json',JSON.stringify({worker:'vezori',recordedAt:new Date().toISOString(),deploymentId:prior.id,versions:prior.versions,command:'npx wrangler rollback <version_id> --name vezori',note:'Rollback changes code/assets/bindings, never deletes KV records. Recheck binding after restore.'},null,2));
console.log('Previous VEZORI deployment recorded for rollback; no credentials included');
