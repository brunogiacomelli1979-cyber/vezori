import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {publicDashboard,archiveDashboard} from '../src/data-rights.js';
const data={quotes:[{market:'BR'},{market:'CRYPTO'},{market:'US'}],fx:[{pair:'USD/BRL',rate:5}],macro:[{provider:'BCB / SGS 432',value:10}],availability:{},meta:{}};
test('chave e acesso sandbox não autorizam redistribuição nem arquivo',()=>{
 assert.equal(publicDashboard(data,{BRAPI_API_KEY:'test-only'}).quotes.length,2);
 assert.equal(archiveDashboard(data).quotes.length,0);assert.equal(archiveDashboard(data).fx.length,0);assert.equal(archiveDashboard(data).macro.length,1);
 assert.equal(archiveDashboard(data,{BR_ARCHIVE_AUTHORIZED:'true'}).quotes.length,1);
 assert.equal(publicDashboard(data,{BR_PUBLIC_DISPLAY_AUTHORIZED:'true'}).quotes.length,3);
});
test('rotas públicas B3 falham explicitamente sem autorização documentada',async()=>{
 for(const route of ['/api/catalog','/api/quote?market=BR&symbol=PETR4','/api/history?market=BR&symbol=PETR4']){
  const response=await worker.fetch(new Request('https://vezori.test'+route),{},{});
  assert.equal(response.status,422);assert.match((await response.json()).error,/autorização/i);
 }
});
