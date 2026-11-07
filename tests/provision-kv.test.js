import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {namespaceIdFromList,namespaceIdFromCreate,applyKVBinding,provisionKV} from '../scripts/provision_kv.mjs';

const ID='0123456789abcdef0123456789abcdef';
const CONFIG={name:'vezori',main:'src/worker.js',compatibility_date:'2026-11-04'};
function configFile(){
 const directory=mkdtempSync(join(tmpdir(),'vezori-kv-test-'));
 const path=join(directory,'wrangler.jsonc');
 writeFileSync(path,JSON.stringify(CONFIG));
 return {path,cleanup:()=>rmSync(directory,{recursive:true,force:true})};
}
function withAuth(fn){
 const previous={token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID};
 process.env.CLOUDFLARE_API_TOKEN='fake-for-test';
 process.env.CLOUDFLARE_ACCOUNT_ID='fake-for-test';
 try{return fn();}
 finally{
  if(previous.token===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=previous.token;
  if(previous.account===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=previous.account;
 }
}
test('identifica namespace já existente pelo nome atual ou legado',()=>{
 assert.equal(namespaceIdFromList(JSON.stringify([{id:ID,title:'vezori-MARKET_SNAPSHOTS'}])),ID);
 assert.equal(namespaceIdFromList(JSON.stringify([{id:ID,title:'VEZORI_MARKET_SNAPSHOTS'}])),ID);
 assert.equal(namespaceIdFromList('[]'),null);
 assert.throws(()=>namespaceIdFromList(JSON.stringify([{id:ID,title:'VEZORI_MARKET_SNAPSHOTS'},{id:'a'.repeat(32),title:'vezori-MARKET_SNAPSHOTS'}])),/Multiple/);
});
test('valida namespace criado e preserva demais bindings',()=>{
 assert.equal(namespaceIdFromCreate('Success!\\n{"id":"'+ID+'"}'),ID);
 assert.throws(()=>namespaceIdFromCreate('Success!'),/identify/);
 const result=applyKVBinding({...CONFIG,kv_namespaces:[{binding:'OTHER',id:'b'.repeat(32)}]},ID);
 assert.deepEqual(result.kv_namespaces,[{binding:'OTHER',id:'b'.repeat(32)},{binding:'MARKET_SNAPSHOTS',id:ID}]);
 assert.throws(()=>applyKVBinding(CONFIG,'wrong-id'),/Invalid/);
});
test('configuração vinculada não dispara criação de namespace',()=>{
 const file=configFile();
 try{
  writeFileSync(file.path,JSON.stringify({...CONFIG,kv_namespaces:[{binding:'MARKET_SNAPSHOTS',id:ID}]}));
  withAuth(()=>{
   const result=provisionKV({configPath:file.path,run:()=>{throw Error('Não deveria chamar Wrangler')}});
   assert.equal(result.status,'configured');
   assert.equal(result.source,'config');
  });
 }finally{file.cleanup();}
});
test('namespace encontrado é vinculado com segurança',()=>{
 const file=configFile();
 try{
  withAuth(()=>{
   const result=provisionKV({configPath:file.path,run:(cmd,args)=>{
    assert.equal(cmd,'npx');assert.deepEqual(args,['wrangler','kv','namespace','list']);
    return JSON.stringify([{id:ID,title:'vezori-MARKET_SNAPSHOTS'}]);
   }});
   assert.equal(result.status,'configured');
  });
  const parsed=JSON.parse(readFileSync(file.path,'utf8'));
  assert.equal(parsed.kv_namespaces[0].id,ID);
 }finally{file.cleanup();}
});
test('falta de permissões impede criação e não inventa binding',()=>{
 const file=configFile();
 try{
  withAuth(()=>{
   const result=provisionKV({configPath:file.path,run:()=>{throw Error('No permission')}});
   assert.equal(result.status,'permission_or_access_missing');
  });
  assert.equal(JSON.parse(readFileSync(file.path,'utf8')).kv_namespaces,undefined);
 }finally{file.cleanup();}
});
test('CLI --required termina com erro quando não há credenciais',()=>{
 const child=spawnSync(process.execPath,['scripts/provision_kv.mjs','--required'],{
  env:{...process.env,CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_ACCOUNT_ID:''},encoding:'utf8'
 });
 assert.equal(child.status,1);
 assert.match(child.stderr,/Deploy blocked/);
});
