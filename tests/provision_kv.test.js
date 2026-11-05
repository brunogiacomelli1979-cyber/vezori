import test from 'node:test';
import assert from 'node:assert/strict';
import {namespaceIdFromList,namespaceIdFromCreate,applyKVBinding} from '../scripts/provision_kv.mjs';
const id='a'.repeat(32);
test('KV finds only exact VEZORI namespace',()=>{
 assert.equal(namespaceIdFromList(JSON.stringify([{title:'other',id},{title:'vezori-MARKET_SNAPSHOTS',id}])),id);
 assert.equal(namespaceIdFromList('[]'),null);
 assert.throws(()=>namespaceIdFromList('{}'),/Unexpected/);
});
test('KV create cannot use guessed or ambiguous IDs',()=>{
 assert.equal(namespaceIdFromCreate('✨ Success! {"binding":"MARKET_SNAPSHOTS","id":"'+id+'"}'),id);
 assert.throws(()=>namespaceIdFromCreate('success'),/reliably/);
});
test('KV binding modifies only its own VEZORI config',()=>{
 const input={name:'vezori',main:'src/worker.js',triggers:{crons:['30 2 * * 2-6']},assets:{directory:'./public'}};
 const result=applyKVBinding(input,id);
 assert.equal(result.kv_namespaces[0].binding,'MARKET_SNAPSHOTS');
 assert.equal(result.triggers.crons[0],'30 2 * * 2-6');
 assert.deepEqual(input.kv_namespaces,undefined);
 assert.throws(()=>applyKVBinding({...input,name:'controle-paletes-aeronauticos'},id),/Invalid/);
});
