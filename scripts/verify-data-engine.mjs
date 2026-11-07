/** Public live acceptance, separate from deterministic fixtures. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='https://vezori.bruno-giacomelli1979.workers.dev';
const local=process.argv.includes('--published-only')?null:JSON.parse(readFileSync('out/engine-run.json','utf8'));
async function get(path){const r=await fetch(root+path,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(path+': HTTP '+r.status);return r.json();}
const manifestResponse=await fetch(root+'/data/engine/manifest.json?verify='+Date.now(),{signal:AbortSignal.timeout(45000)}),manifestBytes=Buffer.from(await manifestResponse.arrayBuffer());
assert(manifestResponse.ok);const manifest=JSON.parse(manifestBytes);
if(local)assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),local.manifestSha256,'Published batch differs from validated batch');
assert.equal(manifest.engineVersion,'1.0.0');
const health=await get('/api/health');if(process.env.EXPECTED_SHA)assert.equal(health.release,process.env.EXPECTED_SHA);
const status=await get('/api/data-engine/status'),evidence={at:new Date().toISOString(),release:health.release,status,records:[]};
for(const dataset of ['cvm','macro','funds','fii','treasury']){
 assert.equal(manifest.datasets[dataset].status,'available');assert(manifest.catalog[dataset].length>0);
 const entry=dataset==='cvm'?manifest.catalog.cvm.find(x=>x.id==='33000167000101'):manifest.catalog[dataset][0];assert(entry);
 const doc=await get('/api/data-engine/record?dataset='+dataset+'&id='+entry.id);
 assert.equal(doc.dataset,dataset);assert.equal(doc.id,entry.id);assert.equal(doc.integrity.verified,true);assert.equal(doc.integrity.sha256,entry.sha256);
 assert(doc.observations.length>0);assert(doc.coverage.completeSinceInception===false);
 assert(Object.keys(doc.sources).length>0);assert(doc.observations.every(r=>doc.sources[r.provenance.sourceId]));
 const response=await fetch(root+entry.path,{signal:AbortSignal.timeout(45000)}),bytes=Buffer.from(await response.arrayBuffer());assert(response.ok);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 const dates=doc.observations.map(r=>r.values.date||r.values.periodEnd).sort();
 evidence.records.push({dataset,id:entry.id,name:doc.name,first:dates[0],last:dates.at(-1),records:doc.observations.length,sha256:entry.sha256,sourceUrls:[...new Set(Object.values(doc.sources).map(s=>s.url))],license:doc.license});
 if(dataset==='cvm'){
  const current=doc.indicators.filter(x=>x.kind==='DFP'&&x.scope==='con'&&x.periodEnd==='2025-12-31').at(-1);assert(current);
  const inputs=Object.fromEntries(Object.values(current.inputs).map(key=>{const r=doc.observations.filter(x=>x.key===key).at(-1);return [r.values.statement+':'+r.values.accountCode,r];}));
  const revenue=inputs['DRE:3.01'],income=inputs['DRE:3.11'];assert(revenue&&income);
  const ratio=Number(income.sourceRow.VL_CONTA)/Number(revenue.sourceRow.VL_CONTA)*100;
  assert(Math.abs(ratio-current.metrics.netMarginPct)<1e-8,'Official-source net margin reconciliation failed');
  evidence.cvmReconciliation={symbol:'PETR3/PETR4',periodEnd:current.periodEnd,filingVersion:current.filingVersion,netMarginPct:current.metrics.netMarginPct,reconciledAgainst:'original selected CVM revenue/net-income rows, same filing and duration'};
 }
 console.log('DATA ENGINE LIVE:',dataset,entry.id,doc.observations.length,'records;',dates[0],'to',dates.at(-1),'; SHA-256 verified');
}
assert.equal(status.blocked.prices.status,'rights_required');
if(status.blocked.sec)assert.equal(status.blocked.sec.status,'identity_required');
let run;
for(let attempt=0;attempt<10;attempt++){
 run=await get('/api/data-engine/runs?verify='+Date.now());
 if(run.status==='available'&&(!local||run.summary.manifestSha256===local.manifestSha256))break;
 await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.equal(run.status,'available');if(local)assert.equal(run.summary.manifestSha256,local.manifestSha256);
evidence.executionReceipt={release:run.release,integrity:run.integrity,run:run.summary.run,scheduledExecutionObserved:run.scheduledExecutionObserved,continuousOperationProven:run.continuousOperationProven};
mkdirSync('out',{recursive:true});writeFileSync('out/data-engine-live-evidence.json',JSON.stringify(evidence,null,2));
console.log('Data Engine public storage/query and immutable KV receipt verified. Scheduled execution observed:',run.scheduledExecutionObserved);
