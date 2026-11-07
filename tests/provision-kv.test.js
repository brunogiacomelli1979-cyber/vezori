import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {provisionKV,KV_TITLE} from '../scripts/provision_kv.mjs';
const id='0123456789abcdef0123456789abcdef';
const env={CLOUDFLARE_API_TOKEN:'test-only-token',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32)};
const config={name:'vezori',main:'src/worker.js'};
function fixture(){const dir=mkdtempSync(join(tmpdir(),'vezori-kv-'));const file=join(dir,'wrangler.jsonc');writeFileSync(file,JSON.stringify(config));return {file,close:()=>rmSync(dir,{recursive:true,force:true})};}
const response=(result,extra={})=>new Response(JSON.stringify({success:true,result,...extra}));
test('REST pagina namespaces, reutiliza o título exato e não cria duplicatas',async()=>{
 const f=fixture(),calls=[];
 try{
  const result=await provisionKV({configPath:f.file,env,fetcher:async(url,options)=>{calls.push({url,options});return response(url.includes('page=2')?[{id,title:KV_TITLE}]:[],{result_info:{total_pages:2}});}});
  assert.equal(result.status,'configured');assert.equal(calls.length,2);assert.ok(calls.every(x=>x.options.method==='GET'));
  assert.equal(JSON.parse(readFileSync(f.file)).kv_namespaces[0].id,id);
 }finally{f.close();}
});
test('cria uma vez com título estável e confirma vínculo existente na reexecução',async()=>{
 const f=fixture();let exists=false,creates=0;
 const fetcher=async(url,options)=>{if(options.method==='POST'){creates++;assert.deepEqual(JSON.parse(options.body),{title:KV_TITLE});exists=true;return response({id});}return response(exists?[{id,title:KV_TITLE}]:[]);};
 try{await provisionKV({configPath:f.file,env,fetcher});await provisionKV({configPath:f.file,env,fetcher});assert.equal(creates,1);}finally{f.close();}
});
test('403 falha sem vazar resposta ou modificar configuração',async()=>{
 const f=fixture();
 try{await assert.rejects(()=>provisionKV({configPath:f.file,env,fetcher:async()=>new Response(JSON.stringify({success:false,errors:[{code:10000,message:env.CLOUDFLARE_API_TOKEN}]}),{status:403})}),err=>err.message.includes('authorization_or_scope')&&!err.message.includes(env.CLOUDFLARE_API_TOKEN));assert.deepEqual(JSON.parse(readFileSync(f.file)),config);}finally{f.close();}
});
test('binding de outro namespace, ambiguidade e falta de autenticação não prosseguem',async()=>{
 const f=fixture();
 try{
  assert.equal((await provisionKV({env:{}})).status,'no_cloudflare_auth');
  writeFileSync(f.file,JSON.stringify({...config,kv_namespaces:[{binding:'MARKET_SNAPSHOTS',id}]}));
  await assert.rejects(()=>provisionKV({configPath:f.file,env,fetcher:async()=>response([{id,title:'another-worker'}])}),/VEZORI-owned/);
  writeFileSync(f.file,JSON.stringify(config));
  await assert.rejects(()=>provisionKV({configPath:f.file,env,fetcher:async()=>response([{id,title:KV_TITLE},{id:'a'.repeat(32),title:'VEZORI_MARKET_SNAPSHOTS'}])}),/Multiple/);
 }finally{f.close();}
});
test('CLI required falha sem credenciais',()=>{
 const child=spawnSync(process.execPath,['scripts/provision_kv.mjs','--required'],{env:{...process.env,CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_ACCOUNT_ID:''},encoding:'utf8'});
 assert.equal(child.status,1);assert.match(child.stderr,/deploy blocked/i);
});
