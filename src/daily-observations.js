/** VEZORI — arquivo incremental das observações diárias.
 * Observação de cotação não é fechamento oficial, candle OHLC nem retorno total.
 * Nenhum dado é interpolado ou corrigido retrospectivamente.
 */
export const OBSERVATION_PREFIX='vezori:observations:v1:';
const okDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'));
const okPrice=p=>typeof p==='number'&&Number.isFinite(p)&&p>0;
const okQuote=q=>q&&['BR','US','CRYPTO'].includes(q.market)&&/^[A-Z0-9.]{1,12}$/.test(q.symbol||'')&&/^[A-Z]{3}$/.test(q.currency||'')&&okPrice(q.price)&&typeof q.provider==='string'&&q.provider.length>0;
export const observationKey=(market,symbol,month)=>OBSERVATION_PREFIX+market+':'+symbol+':'+month;
function normalize(q,date,capturedAt){
 return {date,price:q.price,currency:q.currency,provider:q.provider,
  providerAsOf:q.providerAsOf||null,capturedAt,kind:'indicative_daily_quote_snapshot'};
}
function validMonth(v){return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);}
export async function appendDailyObservations(store,market,capturedAt=new Date()){
 if(!store||typeof store.get!=='function'||typeof store.put!=='function')return {status:'storage_not_configured'};
 const instant=new Date(capturedAt);
 if(!Number.isFinite(instant.getTime()))throw Error('Captura com data inválida');
 const day=instant.toISOString().slice(0,10),month=day.slice(0,7);
 if(!Array.isArray(market?.quotes))throw Error('Cotações inválidas');
 let stored=0,skipped=0;
 for(const q of market.quotes){
  if(!okQuote(q)){skipped++;continue;}
  const k=observationKey(q.market,q.symbol,month),previous=await store.get(k,'json');
  // A series can never combine assets or currencies from different objects.
  if(previous&&(previous.schemaVersion!==1||previous.market!==q.market||previous.symbol!==q.symbol||previous.currency!==q.currency||!Array.isArray(previous.points)))throw Error('Arquivo histórico inconsistente');
  const pts=previous?.points||[];
  if(pts.some(p=>p.date===day)){skipped++;continue;}
  const next=[...pts,normalize(q,day,instant.toISOString())].sort((a,b)=>a.date.localeCompare(b.date));
  await store.put(k,JSON.stringify({schemaVersion:1,market:q.market,symbol:q.symbol,currency:q.currency,month,points:next}));
  stored++;
 }
 return {status:'archived',captureDate:day,stored,skipped};
}
/** Range bounded to limit KV reads and keep public queries cheap.
 * Does not assert completeness or synthesize observations for missing dates.
 */
export async function readDailyObservations(store,{market,symbol,months=12,asOf=new Date()}={}){
 if(!store||typeof store.get!=='function')return {status:'storage_not_configured',points:[]};
 if(!['BR','US','CRYPTO'].includes(market)||!/^[A-Z0-9.]{1,12}$/.test(symbol||''))throw Error('Ativo inválido');
 if(!Number.isInteger(months)||months<1||months>24)throw Error('Período inválido');
 const end=new Date(asOf);if(!Number.isFinite(end.getTime()))throw Error('Data inválida');
 const points=[];let currency=null;
 for(let i=months-1;i>=0;i--){
  const month=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-i,1)).toISOString().slice(0,7);
  if(!validMonth(month))throw Error('Mês inválido');
  const data=await store.get(observationKey(market,symbol,month),'json');
  if(!data)continue;
  if(data.schemaVersion!==1||data.market!==market||data.symbol!==symbol||data.month!==month||!Array.isArray(data.points)||data.currency!==currency&&currency!==null)throw Error('Arquivo histórico inconsistente');
  currency=data.currency;
  for(const p of data.points){
   if(!okDate(p.date)||p.date.slice(0,7)!==month||p.date>end.toISOString().slice(0,10)||!okPrice(p.price))throw Error('Observação inválida');
   points.push({...p});
  }
 }
 const seen=new Set();
 for(const p of points){if(seen.has(p.date))throw Error('Observação duplicada');seen.add(p.date);}
 const previous=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-months,1)).toISOString().slice(0,7);
 return {status:points.length?'available':'no_observations',market,symbol,currency,
  interval:'daily_capture',priceBasis:'cotação capturada uma vez ao dia, não fechamento oficial',
  points,previousPageMonth:previous,coverage:{actualFirst:points[0]?.date||null,actualLast:points.at(-1)?.date||null,
   observations:points.length,completeSinceListing:false,reason:'Arquivo incremental; não inclui dados anteriores à habilitação do armazenamento nem dias sem cotação válida'}};
}
