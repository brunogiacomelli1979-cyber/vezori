import {sealRecord,verifyRecord} from './record-integrity.js';
/** VEZORI daily data snapshots — cloud KV optional, no faked prices or fills. */
export const SNAPSHOT_PREFIX='vezori:market:';
export function validateMarketSnapshot(d){
 if(!d||d.mode!=='real_market_data'||d.meta?.simulatedPrices!==false||!Array.isArray(d.quotes)||!Array.isArray(d.fx)||!Array.isArray(d.macro))return false;
 const priced=d.quotes.some(q=>typeof q.price==='number'&&Number.isFinite(q.price)&&q.price>0&&q.provider);
 return priced||d.fx.some(q=>Number.isFinite(q.rate)&&q.rate>0)||d.macro.some(q=>Number.isFinite(Number(q.value)));
}
export async function persistDailySnapshot(store,market,capturedAt=new Date()){
 if(!store||typeof store.get!=='function'||typeof store.put!=='function')return {status:'storage_not_configured'};
 if(!validateMarketSnapshot(market))return {status:'rejected_unusable_data'};
 const moment=new Date(capturedAt),ms=moment.getTime();
 if(!Number.isFinite(ms))throw Error('Data de coleta inválida');
 const day=moment.toISOString().slice(0,10);
 const latest=await store.get(SNAPSHOT_PREFIX+'latest','json');
 if(latest?.captureDate>day)return {status:'out_of_order',captureDate:day,latestCaptureDate:latest.captureDate};
 const saved=await store.get(SNAPSHOT_PREFIX+day,'json');
 if(saved){
  await verifyRecord(saved);
  if(saved.schemaVersion!==1||saved.captureDate!==day||!validateMarketSnapshot(saved.data))throw Error('Snapshot diario previamente gravado e invalido; nao sobrescrever');
  // Recover a partial put (day succeeded, latest failed) without ever replacing
  // the original observations with today's possibly different provider prices.
  if(!latest||latest.captureDate<day)await store.put(SNAPSHOT_PREFIX+'latest',JSON.stringify(saved));
  return {status:'already_recorded',captureDate:day};
 }
 if(latest?.captureDate===day)throw Error('Indice latest sem snapshot diario correspondente');
 const item=await sealRecord({
  schemaVersion:1,
  captureDate:day,
  capturedAt:moment.toISOString(),
  sourceGeneratedAt:market.generatedAt||null,
  data:market
 });
 const value=JSON.stringify(item);
 await store.put(SNAPSHOT_PREFIX+day,value);
 await store.put(SNAPSHOT_PREFIX+'latest',value);
 return {status:'stored',captureDate:day,priced:market.quotes.length,errors:market.errors?.length||0};
}
export async function latestDailySnapshot(store,asOf=new Date()){
 if(!store||typeof store.get!=='function')return null;
 const item=await store.get(SNAPSHOT_PREFIX+'latest','json');
 if(!item||item.schemaVersion!==1||!validateMarketSnapshot(item.data))return null;
 await verifyRecord(item);
 const now=new Date(asOf).getTime(),recorded=new Date(item.capturedAt).getTime();
 if(!Number.isFinite(now)||!Number.isFinite(recorded)||recorded>now+60000)return null;
 const ageHours=(now-recorded)/3600000;
 return {
  ...item.data,
  meta:{...item.data.meta,
   isDailySnapshot:true,
   snapshotCapturedAt:item.capturedAt,
   snapshotDate:item.captureDate,
   ageHours:Number(ageHours.toFixed(1)),
   stale:ageHours>72,
   refreshPolicy:'Consulta de snapshot capturado após fechamento; finais de semana/feriados podem aumentar a idade'},
 };
}
