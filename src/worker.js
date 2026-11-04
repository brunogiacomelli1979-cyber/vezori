/** VEZORI Market API | Cloudflare Workers | production-safe upstream validation. */
export const BR_SYMBOLS=['PETR4','VALE3','ITUB4','MGLU3'];
export const US_SYMBOLS=['VOO','QQQ','AAPL'];
export const CRYPTO_BY_SYMBOL=Object.freeze({BTC:'bitcoin',ETH:'ethereum',SOL:'solana'});
const TTL_DASHBOARD=300,TTL_QUOTE=300,TTL_HISTORY=1800;
const headers={
  'content-type':'application/json; charset=utf-8',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY'
};
const numeric=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const now=()=>new Date().toISOString();
const errorMessage=err=>{
  const msg=String(err?.message||'Falha de provedor');
  // Upstream URLs, request parameters and credentials never propagate to clients.
  if(/HTTP \d+/.test(msg))return msg.slice(0,64);
  return msg.replace(/https?:\/\/\S+/g,'[endpoint]').replace(/(?:api[_-]?key|token|secret)[^ ]*/ig,'[credencial]').slice(0,120);
};
const respond=(data,status=200,ttl=0)=>new Response(JSON.stringify(data),{status,headers:{...headers,'cache-control':ttl?`public, max-age=60, s-maxage=${ttl}`:'no-store'}});
async function readJson(url,extraHeaders={},fetcher=fetch){
 const result=await fetcher(url,{headers:{accept:'application/json',...extraHeaders},signal:AbortSignal.timeout(8500)});
 if(!result.ok)throw new Error(`HTTP ${result.status} do provedor`);
 const data=await result.json();
 if(data===null||typeof data!=='object')throw new Error('Resposta inválida do provedor');
 if(data.status==='error'||(typeof data.code==='number'&&data.code>=400))throw new Error('Provedor rejeitou a solicitação');
 return data;
}
function brHeaders(env){return env.BRAPI_API_KEY?{authorization:`Bearer ${env.BRAPI_API_KEY}`}:{}};
export async function brazilQuote(symbol,env={},fetcher=fetch){
 if(!/^[A-Z0-9]{4,8}$/.test(symbol))throw new Error('Ticker brasileiro inválido');
 if(!env.BRAPI_API_KEY&&!BR_SYMBOLS.includes(symbol))throw new Error('Ativo exige chave brapi');
 const body=await readJson(`https://brapi.dev/api/v2/stocks/quote?symbols=${symbol}`,brHeaders(env),fetcher);
 const item=body.results?.[0],row=item?.data||item;
 const price=numeric(row?.regularMarketPrice);
 if(!positive(price))throw new Error('Preço brasileiro indisponível');
 return {symbol:String(item.symbol||symbol),name:String(row.shortName||row.longName||symbol).slice(0,90),market:'BR',currency:row.currency||'BRL',price,changePct:numeric(row.regularMarketChangePercent),provider:'brapi',providerAsOf:row.regularMarketTime||null,retrievedAt:now()};
}
export async function currencyRate(base,quote,fetcher=fetch){
 if(!['BRL','USD','EUR'].includes(base)||!['BRL','USD','EUR'].includes(quote)||base===quote)throw new Error('Par cambial inválido');
 const data=await readJson(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}`,{},fetcher);
 const rate=numeric(data.rate);
 if(!positive(rate))throw new Error('Câmbio indisponível');
 return {pair:`${base}/${quote}`,rate,date:data.date||null,provider:'Frankfurter',frequency:'referência diária'};
}
export async function selic(fetcher=fetch){
 const data=await readJson('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',{},fetcher);
 const last=Array.isArray(data)?data.at(-1):null,value=numeric(last?.valor);
 if(value===null)throw new Error('Meta Selic indisponível');
 return {code:'SELIC_META',name:'Meta Selic',value,unit:'% a.a.',date:last.data||null,provider:'BCB / SGS 432'};
}
export async function cryptoQuotes(key,fetcher=fetch){
 if(!key)throw new Error('Chave CoinGecko Demo não configurada');
 const ids=Object.values(CRYPTO_BY_SYMBOL).join(',');
 const url=`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl%2Cusd&include_24hr_change=true&include_last_updated_at=true`;
 const data=await readJson(url,{'x-cg-demo-api-key':key},fetcher);
 return Object.entries(CRYPTO_BY_SYMBOL).flatMap(([symbol,id])=>{
  const row=data[id],price=numeric(row?.brl);
  if(!positive(price))return [];
  return [{symbol,name:id[0].toUpperCase()+id.slice(1),market:'CRYPTO',currency:'BRL',price,priceUSD:numeric(row.usd),changePct:numeric(row.brl_24h_change),provider:'CoinGecko',providerAsOf:positive(numeric(row.last_updated_at))?new Date(row.last_updated_at*1000).toISOString():null,retrievedAt:now()}];
 });
}
export async function usQuote(symbol,key,fetcher=fetch){
 if(!/^[A-Z]{1,5}(?:\.[A-Z])?$/.test(symbol))throw new Error('Ticker internacional inválido');
 if(!key)throw new Error('Chave Twelve Data não configurada');
 const url=new URL('https://api.twelvedata.com/quote');url.searchParams.set('symbol',symbol);url.searchParams.set('apikey',key);
 const data=await readJson(url.toString(),{},fetcher),price=numeric(data.close??data.price);
 if(!positive(price))throw new Error('Cotação internacional indisponível');
 return {symbol,name:String(data.name||symbol).slice(0,90),market:'US',currency:data.currency||'USD',price,changePct:numeric(data.percent_change),provider:'Twelve Data',providerAsOf:data.datetime||null,retrievedAt:now()};
}
export async function historyQuote(market,symbol,range,env={},fetcher=fetch){
 if(!['1mo','3mo'].includes(range))throw new Error('Período não permitido');
 if(market==='BR'){
  if(!/^[A-Z0-9]{4,8}$/.test(symbol))throw new Error('Ticker inválido');
  if(!env.BRAPI_API_KEY&&!BR_SYMBOLS.includes(symbol))throw new Error('Histórico exige chave brapi');
  const raw=await readJson(`https://brapi.dev/api/v2/stocks/historical?symbols=${symbol}&range=${range}&interval=1d`,brHeaders(env),fetcher);
  const data=raw.results?.[0]?.data,items=data?.historicalDataPrice;
  if(!Array.isArray(items)||!items.length)throw new Error('Série histórica indisponível no plano atual');
  const points=items.map(p=>({date:typeof p.date==='number'?new Date(p.date*1000).toISOString().slice(0,10):String(p.date||'').slice(0,10),close:numeric(p.adjustedClose??p.close)})).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&positive(p.close)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!points.length)throw new Error('Série histórica vazia');
  return {symbol,market,currency:'BRL',points,priceBasis:'fechamento ajustado quando disponível',provider:'brapi',range,interval:'1d'};
 }
 if(market==='US'){
  if(!env.TWELVEDATA_API_KEY)throw new Error('Histórico internacional exige chave Twelve Data');
  if(!/^[A-Z]{1,5}(?:\.[A-Z])?$/.test(symbol))throw new Error('Ticker inválido');
  const days=range==='1mo'?25:70;
  const url=new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol',symbol);url.searchParams.set('interval','1day');url.searchParams.set('outputsize',String(days));url.searchParams.set('apikey',env.TWELVEDATA_API_KEY);
  const raw=await readJson(url.toString(),{},fetcher);
  const points=(raw.values||[]).map(p=>({date:String(p.datetime||'').slice(0,10),close:numeric(p.close)})).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&positive(p.close)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!points.length)throw new Error('Série internacional indisponível no plano atual');
  return {symbol,market,currency:raw.meta?.currency||'USD',points,priceBasis:'fechamento sem ajuste garantido de proventos',provider:'Twelve Data',range,interval:'1d'};
 }
 if(market==='CRYPTO'){
  if(!env.COINGECKO_API_KEY)throw new Error('Histórico cripto exige chave CoinGecko Demo');
  const id=CRYPTO_BY_SYMBOL[symbol];if(!id)throw new Error('Criptomoeda não cadastrada');
  const days=range==='1mo'?30:90;
  const raw=await readJson(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=brl&days=${days}&interval=daily`,{'x-cg-demo-api-key':env.COINGECKO_API_KEY},fetcher);
  const points=(raw.prices||[]).map(p=>({date:new Date(Number(p[0])).toISOString().slice(0,10),close:numeric(p[1])})).filter(p=>positive(p.close)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!points.length)throw new Error('Histórico cripto indisponível');
  return {symbol,market,currency:'BRL',points,priceBasis:'preço de mercado diário',provider:'CoinGecko',range,interval:'1d'};
 }
 throw new Error('Mercado não suportado');
}
export async function buildDashboard(env={},fetcher=fetch){
 const out={mode:'real_market_data',generatedAt:now(),quotes:[],fx:[],macro:[],availability:{brapi:'available',frankfurter:'available',bcb:'available',coingecko:env.COINGECKO_API_KEY?'available':'key_required',twelvedata:env.TWELVEDATA_API_KEY?'available':'key_required'},errors:[],meta:{simulatedPrices:false,refreshSeconds:300,reference:'Preços de última cotação; podem ter atraso e não são dados tick-by-tick'}};
 const tasks=[];
 const add=(source,kind,run)=>tasks.push({source,kind,run});
 for(const symbol of BR_SYMBOLS)add('brapi','quotes',()=>brazilQuote(symbol,env,fetcher));
 for(const base of ['USD','EUR'])add('frankfurter','fx',()=>currencyRate(base,'BRL',fetcher));
 add('bcb','macro',()=>selic(fetcher));
 if(env.COINGECKO_API_KEY)add('coingecko','quotes',()=>cryptoQuotes(env.COINGECKO_API_KEY,fetcher));
 if(env.TWELVEDATA_API_KEY)for(const symbol of US_SYMBOLS)add('twelvedata','quotes',()=>usQuote(symbol,env.TWELVEDATA_API_KEY,fetcher));
 // Concurrency bounded to stay within Cloudflare's six outbound simultaneous connections.
 for(let i=0;i<tasks.length;i+=4){
  const batch=tasks.slice(i,i+4),results=await Promise.allSettled(batch.map(t=>t.run()));
  results.forEach((result,j)=>{
   const t=batch[j];
   if(result.status==='fulfilled')out[t.kind].push(...(Array.isArray(result.value)?result.value:[result.value]));
   else {out.errors.push({source:t.source,message:errorMessage(result.reason)});out.availability[t.source]='partial_failure';}
  });
 }
 const order=[...BR_SYMBOLS,...Object.keys(CRYPTO_BY_SYMBOL),...US_SYMBOLS];
 out.quotes.sort((a,b)=>order.indexOf(a.symbol)-order.indexOf(b.symbol));
 return out;
}
async function cacheResult(request,ctx,key,ttl,runner){
 const cache=typeof caches!=='undefined'?caches.default:null;
 const cacheRequest=new Request(new URL(key,request.url).toString());
 if(cache){try{const match=await cache.match(cacheRequest);if(match)return match;}catch{}}
 const result=await runner();
 if(result.status===200&&cache&&ctx?.waitUntil){try{ctx.waitUntil(cache.put(cacheRequest,result.clone()));}catch{}}
 return result;
}
const fail=(message,status)=>respond({error:message,simulatedPrices:false},status);
export default {
 async fetch(request,env={},ctx={}){
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/'))return env.ASSETS?.fetch?env.ASSETS.fetch(request):new Response('VEZORI: inicialize via Cloudflare Wrangler.',{status:404});
  if(request.method!=='GET')return fail('Método não permitido',405);
  if(path==='/api/health')return respond({service:'VEZORI',status:'ok',timestamp:now(),sourcesConfigured:{brapi:!!env.BRAPI_API_KEY,coingecko:!!env.COINGECKO_API_KEY,twelvedata:!!env.TWELVEDATA_API_KEY}});
  if(path==='/api/dashboard')return cacheResult(request,ctx,'/api/dashboard',TTL_DASHBOARD,async()=>respond(await buildDashboard(env),200,TTL_DASHBOARD));
  if(path==='/api/quote'){
   const market=String(url.searchParams.get('market')||'').toUpperCase(),symbol=String(url.searchParams.get('symbol')||'').toUpperCase();
   if(!['BR','US','CRYPTO'].includes(market)||!(/^[A-Z0-9.]{1,8}$/.test(symbol)))return fail('Parâmetros inválidos',400);
   return cacheResult(request,ctx,`/api/quote?market=${market}&symbol=${symbol}`,TTL_QUOTE,async()=>{
    try{
     let q;
     if(market==='BR')q=await brazilQuote(symbol,env);
     else if(market==='US')q=await usQuote(symbol,env.TWELVEDATA_API_KEY);
     else {if(!Object.hasOwn(CRYPTO_BY_SYMBOL,symbol))throw new Error('Criptomoeda indisponível');q=(await cryptoQuotes(env.COINGECKO_API_KEY)).find(row=>row.symbol===symbol);}
     if(!q)throw new Error('Cotação não disponível');return respond({quote:q},200,TTL_QUOTE);
    }catch(err){return fail(errorMessage(err),422);}
   });
  }
  if(path==='/api/history'){
   const market=String(url.searchParams.get('market')||'').toUpperCase(),symbol=String(url.searchParams.get('symbol')||'').toUpperCase(),range=String(url.searchParams.get('range')||'1mo');
   if(!['BR','US','CRYPTO'].includes(market)||!(/^[A-Z0-9.]{1,8}$/.test(symbol))||!['1mo','3mo'].includes(range))return fail('Parâmetros inválidos',400);
   return cacheResult(request,ctx,`/api/history?market=${market}&symbol=${symbol}&range=${range}`,TTL_HISTORY,async()=>{
    try{return respond(await historyQuote(market,symbol,range,env),200,TTL_HISTORY);}catch(err){return fail(errorMessage(err),422);}
   });
  }
  return fail('Rota não encontrada',404);
 }
};
