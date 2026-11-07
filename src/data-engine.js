/** Read only validated static data; no arbitrary URLs, market rights, or user uploads. */
import {verifyRecord} from './record-integrity.js';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','access-control-allow-origin':'*'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const datasets=new Set(['cvm','macro','funds','fii','treasury','sec']);
async function asset(env,request,path){
 if(!env.ASSETS?.fetch)throw Error('Data assets binding unavailable');
 const response=await env.ASSETS.fetch(new Request(new URL(path,request.url)));
 if(!response.ok)throw Error('Dataset not published');
 return response;
}
export async function engineManifest(env,request){
 const response=await asset(env,request,'/data/engine/manifest.json');
 const data=await response.json();
 if(data.schemaVersion!==1||data.engineVersion!=='1.0.0'||!data.catalog||!data.datasets)throw Error('Data Engine manifest not published/invalid');
 return data;
}
export async function engineDocument(env,request,entry){
 if(!/^\/data\/engine\/objects\/[a-f0-9]{64}\.json$/.test(entry.path)||!entry.path.includes(entry.sha256)||entry.bytes>24*1024*1024)throw Error('Invalid dataset pointer');
 const response=await asset(env,request,entry.path),bytes=await response.arrayBuffer();
 if(bytes.byteLength!==entry.bytes)throw Error('Dataset size mismatch');
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(sha!==entry.sha256)throw Error('Dataset SHA-256 mismatch');
 const doc=JSON.parse(new TextDecoder().decode(bytes));
 if(doc.schemaVersion!==1||doc.id!==entry.id||!Array.isArray(doc.observations)||!doc.observations.length)throw Error('Dataset identity/schema mismatch');
 return doc;
}
export async function dataEngineRoute(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/data-engine/'))return null;
 try{
  if(path==='/api/data-engine/runs'){
   const run=await env.MARKET_SNAPSHOTS?.get('vezori:engine:latest','json');
   if(!run)return reply({status:'not_recorded',continuousOperationProven:false});
   await verifyRecord(run);
   return reply({status:'available',...run,scheduledExecutionObserved:run.summary?.run?.event==='schedule'&&run.summary?.sources?.length>0,continuousOperationProven:false});
  }
  const manifest=await engineManifest(env,request);
  if(path==='/api/data-engine/status'){
   const coverage=Object.fromEntries(Object.entries(manifest.catalog).map(([key,rows])=>[key,{instruments:rows.length,observations:rows.reduce((s,x)=>s+x.observations,0),first:rows.map(x=>x.first).filter(Boolean).sort()[0]||null,last:rows.map(x=>x.last).filter(Boolean).sort().at(-1)||null}]));
   return reply({status:'available',engineVersion:manifest.engineVersion,generatedAt:manifest.generatedAt,run:manifest.run,datasets:manifest.datasets,blocked:manifest.blocked,storage:manifest.storage,coverage,manifestUrl:'/data/engine/manifest.json',recoveryBundleUrl:'/data/engine/bundle.json.gz',rightsNotice:manifest.rightsNotice,continuousOperationProven:false,note:'A successful controlled run does not prove an observed scheduled execution. Per-source checkedAt and actual coverage are distinct from bundle publication time.'});
  }
  const dataset=url.searchParams.get('dataset');
  if(!datasets.has(dataset))return reply({error:'Dataset inválido'},400);
  if(path==='/api/data-engine/catalog'){
   let q=(url.searchParams.get('q')||'').trim().toLocaleLowerCase('pt-BR');const limit=Number(url.searchParams.get('limit')||25),offset=Number(url.searchParams.get('offset')||0);
   if(/^[0-9.\-/\s]+$/.test(q))q=q.replace(/[.\-/\s]/g,'');
   if(q.length>80||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>20000)return reply({error:'Filtro/página inválidos'},400);
   const rows=(manifest.catalog[dataset]||[]).filter(x=>!q||`${x.id} ${x.name} ${x.cvmCode||''} ${(x.symbols||[]).join(' ')}`.toLocaleLowerCase('pt-BR').includes(q));
   return reply({status:rows.length?'available':'no_coverage',dataset,items:rows.slice(offset,offset+limit),total:rows.length,offset,limit,hasNextPage:offset+limit<rows.length,sourceStatus:manifest.datasets[dataset]||manifest.blocked[dataset]||null});
  }
  if(path==='/api/data-engine/record'){
   const id=url.searchParams.get('id')||'';
   if(!/^[A-Za-z0-9_-]{1,90}$/.test(id))return reply({error:'Identificador inválido'},400);
   const entry=(manifest.catalog[dataset]||[]).find(x=>x.id===id);
   if(!entry)return reply({status:'not_covered',dataset,id,reason:manifest.blocked[dataset]||null},404);
   const doc=await engineDocument(env,request,entry);
   if(doc.dataset!==dataset)throw Error('Dataset family mismatch');
   return reply({...doc,integrity:{algorithm:'SHA-256',sha256:entry.sha256,verified:true},downloadUrl:entry.path});
  }
  return reply({error:'Data Engine route not found'},404);
 }catch{return reply({status:'unavailable',error:'Data Engine indisponível ou integridade inválida; nenhum dado substituto foi criado.'},503);}
}
