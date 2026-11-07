import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{BR_SYMBOLS,buildDashboard,brazilQuote,brazilQuotes,historyQuote,cryptoQuotes,listB3Catalog,dailySnapshotCacheSeconds,collectScheduledMarket} from '../src/worker.js';
function fakeFetch(url,options={}){
 const uri=new URL(url);let obj;
 if(uri.hostname==='brapi.dev'){
  if(uri.pathname==='/api/quote/list'){
   obj={stocks:[{stock:'HGLG11',name:'CSHG Logística',close:165.2,change:-0.5,type:'fund',subType:'fii'},
    {stock:'BOVA11',name:'ETF Ibovespa',close:122,change:1.2,type:'fund',subType:'etf'}],
    totalCount:1240,hasNextPage:true,currentPage:1};
   return Promise.resolve(new Response(JSON.stringify(obj),{status:200,headers:{'content-type':'application/json'}}));
  }
  const symbols=(uri.searchParams.get('symbols')||'').split(',');
  if(uri.pathname.includes('/historical'))obj={results:[{symbol:symbols[0],data:{historicalDataPrice:[{date:1793450000,close:25,adjustedClose:25.5},{date:1793536400,close:26,adjustedClose:26.5}]}}]};
  else obj={results:symbols.map(symbol=>({requestedSymbol:symbol,symbol,data:{shortName:'Empresa '+symbol,currency:'BRL',regularMarketPrice:40.25,regularMarketChangePercent:1.3,regularMarketTime:'2026-11-04T11:00:00Z'}}))};
 }else if(uri.hostname==='api.frankfurter.dev')obj={base:uri.pathname.includes('usd')?'USD':'EUR',quote:'BRL',rate:uri.pathname.includes('usd')?5.4:6.3,date:'2026-11-03'};
 else if(uri.hostname==='api.bcb.gov.br')obj=[{data:'04/11/2026',valor:'13.75'}];
 else if(uri.hostname==='api.coingecko.com'){
  assert.ok(!options.headers['x-cg-demo-api-key']||options.headers['x-cg-demo-api-key']==='demo-secret');
  if(uri.pathname.includes('market_chart'))obj={prices:[[1793450000000,390000],[1793536400000,400000]]};
  else obj={bitcoin:{brl:390000,usd:72000,brl_24h_change:2,last_updated_at:1793800000},ethereum:{brl:18000,usd:3300,brl_24h_change:-1,last_updated_at:1793800000},solana:{brl:990,usd:190,brl_24h_change:0.5,last_updated_at:1793800000}};
 }else if(uri.hostname==='data.sec.gov'){
  assert.match(options.headers['User-Agent']||'',/@/);
  obj={cik:320193,entityName:'Apple Inc.',facts:{'us-gaap':{
    RevenueFromContractWithCustomerExcludingAssessedTax:{units:{USD:[{val:400,start:'2025-09-28',end:'2026-09-26',filed:'2026-11-03',form:'10-K',fp:'FY',accn:'0000320193-26-000026'}]}},
    NetIncomeLoss:{units:{USD:[{val:100,start:'2025-09-28',end:'2026-09-26',filed:'2026-11-03',form:'10-K',fp:'FY',accn:'0000320193-26-000026'}]}}
  }}};
 }else if(uri.hostname==='api.twelvedata.com'){
  assert.equal(uri.searchParams.get('apikey'),'td-secret');
  if(uri.pathname.includes('time_series'))obj={meta:{currency:'USD'},values:[{datetime:'2026-11-03',close:'615.00'},{datetime:'2026-11-04',close:'615.56'}]};
  else obj={symbol:uri.searchParams.get('symbol'),currency:'USD',name:'Empresa USA',close:'615.56',percent_change:'-0.44',datetime:'2026-11-03'};
 }else throw Error('URL desconhecida: '+uri.hostname);
 return Promise.resolve(new Response(JSON.stringify(obj),{status:200,headers:{'content-type':'application/json'}}));
}
test('sem chaves: fontes públicas retornam ações BR, FX e Selic, sem fabricar outras',async()=>{
 const d=await buildDashboard({},fakeFetch);
 assert.equal(d.quotes.length,7);assert.deepEqual(d.quotes.filter(x=>x.market==='BR').map(x=>x.symbol),BR_SYMBOLS);
 assert.equal(d.quotes.find(x=>x.symbol==='BTC').price,390000);
 assert.equal(d.availability.coingecko,'public_no_key');
 assert.equal(d.fx.length,2);assert.equal(d.macro[0].value,13.75);
 assert.equal(d.availability.coingecko,'public_no_key');assert.equal(d.availability.twelvedata,'key_required');assert.equal(d.meta.simulatedPrices,false);
});
test('com chaves: CoinGecko e Twelve Data entram na carteira de mercado sem vazar segredos',async()=>{
 const d=await buildDashboard({COINGECKO_API_KEY:'demo-secret',TWELVEDATA_API_KEY:'td-secret',US_PUBLIC_DISPLAY_AUTHORIZED:'true'},fakeFetch);
 assert.equal(d.quotes.length,10);assert.equal(d.quotes.find(q=>q.symbol==='BTC').price,390000);
 assert.equal(d.quotes.find(q=>q.symbol==='VOO').price,615.56);
 assert.equal(JSON.stringify(d).includes('demo-secret'),false);assert.equal(JSON.stringify(d).includes('td-secret'),false);
});
test('falha de provedor não produz números substitutos',async()=>{
 const failure=async(url,options)=>{
  const result=await fakeFetch(url,options);
  if(String(url).includes('brapi.dev')&&String(url).includes('/quote')){
   const json=await result.json();json.results=json.results.filter(row=>row.symbol!=='VALE3');
   return new Response(JSON.stringify(json),{status:200});
  }
  return result;
 };
 const d=await buildDashboard({},failure);assert.equal(d.quotes.length,6);
 assert.equal(d.availability.brapi,'partial_failure');assert.equal(d.quotes.some(q=>q.symbol==='VALE3'),false);
});
test('símbolos BR arbitrários exigem token e não permitem URL arbitrária',async()=>{
 await assert.rejects(()=>brazilQuote('HACKER',{},fakeFetch),/exige chave/);
 await assert.rejects(()=>brazilQuote('../etc',{},fakeFetch),/inválido/);
});
test('histórico brasileiro usa fechamento ajustado e preserva fonte',async()=>{
 const d=await historyQuote('BR','PETR4','1mo',{},fakeFetch);
 assert.equal(d.points.length,2);assert.equal(d.points[0].close,25.5);assert.equal(d.points[1].close,26.5);
});
test('histórico dos EUA só com chave e tem preços reais vindos do mock',async()=>{
 await assert.rejects(()=>historyQuote('US','VOO','1mo',{},fakeFetch),/exige chave/);
 const d=await historyQuote('US','VOO','1mo',{TWELVEDATA_API_KEY:'td-secret'},fakeFetch);assert.equal(d.points.at(-1).close,615.56);
});
test('criptomoedas: API publica sem chave e Demo com chave preservam fonte',async()=>{
 const free=await cryptoQuotes(null,fakeFetch);assert.equal(free.length,3);
 assert.equal(free[0].provider,'CoinGecko Public');
 const demo=await cryptoQuotes('demo-secret',fakeFetch);assert.equal(demo.length,3);
 assert.equal(demo[0].provider,'CoinGecko Demo');
});
test('saúde informa apenas configuração e rotas desconhecidas são 404',async()=>{
 const env={COINGECKO_API_KEY:'not-exposed',ASSETS:{fetch:()=>new Response('asset')}};
 const a=await worker.fetch(new Request('https://vezori.workers.dev/api/health'),env);
 assert.equal(a.status,200);assert.equal((await a.json()).sourcesConfigured.coingecko,true);
 const b=await worker.fetch(new Request('https://vezori.workers.dev/api/any'),env);assert.equal(b.status,404);
 const c=await worker.fetch(new Request('https://vezori.workers.dev/index.html'),env);assert.equal(await c.text(),'asset');
});
test('rota api/quote valida input e não expõe mensagens de upstream',async()=>{
 const r=await worker.fetch(new Request('https://vezori.workers.dev/api/quote?market=BR&symbol=https://evil.com'));
 assert.equal(r.status,400);
});
test('rota dashboard executa serviço real sem depender da interface',async()=>{
 const original=globalThis.fetch;globalThis.fetch=fakeFetch;
 try{
  const res=await worker.fetch(new Request('https://vezori.workers.dev/api/dashboard'),{},{});
  assert.equal(res.status,200);const body=await res.json();
  assert.equal(body.mode,'real_market_data');assert.equal(body.quotes.length,7);
  assert.equal(body.quotes.find(x=>x.symbol==='PETR4').price,40.25);
 }finally{globalThis.fetch=original;}
});
test('rota history retorna série validada e sem preços inventados',async()=>{
 const original=globalThis.fetch;globalThis.fetch=fakeFetch;
 try{
  const res=await worker.fetch(new Request('https://vezori.workers.dev/api/history?market=BR&symbol=PETR4&range=1mo'),{},{});
  assert.equal(res.status,200);const body=await res.json();
  assert.equal(body.provider,'brapi');assert.equal(body.points.length,2);
  assert.equal(body.points[0].close,25.5);
 }finally{globalThis.fetch=original;}
});

test('consultas brasileiras em lote emitem so uma requisicao para quatro ativos',async()=>{
 const calls=[];
 const spy=(url,opts)=>{calls.push(String(url));return fakeFetch(url,opts)};
 const rows=await brazilQuotes(BR_SYMBOLS,{},spy);
 assert.equal(rows.length,4);
 assert.equal(calls.length,1);
 assert.match(calls[0],/PETR4%2CVALE3%2CITUB4%2CMGLU3/);
});
test('HTTP 429 na brapi nao fabrica cotacao, mas preserva outras fontes',async()=>{
 const fail=(url,opts)=>String(url).includes('brapi.dev')?Promise.resolve(new Response('rate limit',{status:429})):fakeFetch(url,opts);
 const d=await buildDashboard({},fail);
 assert.equal(d.quotes.filter(q=>q.market==='BR').length,0);
 assert.equal(d.quotes.filter(q=>q.market==='CRYPTO').length,3);
 assert.equal(d.availability.brapi,'partial_failure');
 assert.equal(d.fx.length,2);
});

test('falha da API pública CoinGecko remove preços cripto sem afetar ações e câmbio',async()=>{
 const failing=(url,opts)=>String(url).includes('coingecko.com')?Promise.resolve(new Response('rate limit',{status:429})):fakeFetch(url,opts);
 const result=await buildDashboard({},failing);
 assert.equal(result.quotes.filter(q=>q.market==='CRYPTO').length,0);
 assert.equal(result.quotes.filter(q=>q.market==='BR').length,4);
 assert.equal(result.availability.coingecko,'partial_failure');
 assert.equal(result.errors.some(e=>e.source==='coingecko'),true);
});

test('listagem pública B3 aceita FIIs e ETFs e não inventa horário de preço',async()=>{
 const list=await listB3Catalog({limit:10,page:1},fakeFetch);
 assert.equal(list.mode,'real_market_catalog');
 assert.equal(list.items.length,2);
 assert.equal(list.items[0].symbol,'HGLG11');
 assert.equal(list.items[0].category,'fii');
 assert.equal(list.items[0].price,165.2);
 assert.equal(list.items[0].providerAsOf,null);
 assert.equal(list.hasNextPage,true);
});
test('catálogo rejeita consultas excessivas e parâmetros malformados',async()=>{
 await assert.rejects(()=>listB3Catalog({limit:200},fakeFetch),/Paginação/);
 await assert.rejects(()=>listB3Catalog({page:-2},fakeFetch),/Paginação/);
 await assert.rejects(()=>listB3Catalog({search:'url&evil=true'},fakeFetch),/Busca inválida/);
});

test('cache diário respeita o próximo corte 02:30 UTC e não promete tempo real',()=>{
 const before=dailySnapshotCacheSeconds(new Date('2026-11-05T01:30:00Z'));
 const after=dailySnapshotCacheSeconds(new Date('2026-11-05T03:30:00Z'));
 assert.equal(before,3600);
 assert.equal(after,23*3600);
 assert.ok(after>before);
});
test('chave pessoal americana sem direito de exposição pública não libera preços no site',async()=>{
 const d=await buildDashboard({TWELVEDATA_API_KEY:'td-secret'},fakeFetch);
 assert.equal(d.availability.twelvedata,'display_rights_required');
 assert.equal(d.quotes.some(x=>x.market==='US'),false);
 assert.equal(d.meta.simulatedPrices,false);
});

test('endpoint SEC aplica identificação e não inventa fundamentos quando ausente',async()=>{
 const url='https://vezori.example/api/fundamentals?market=US&symbol=AAPL';
 const missing=await worker.fetch(new Request(url),{},{});
 assert.equal(missing.status,200);
 assert.equal((await missing.json()).status,'not_configured');
 const invalid=await worker.fetch(new Request('https://vezori.example/api/fundamentals?market=US&symbol=VOO'),{},{});
 assert.equal(invalid.status,404);
});

test('captura cron grava snapshot uma vez por dia somente com KV configurado',async()=>{
 const values=new Map();
 const store={async get(k){return values.has(k)?JSON.parse(values.get(k)):null;},async put(k,v){values.set(k,v);}};
 const day=new Date('2026-11-05T02:30:00Z');
 const first=await collectScheduledMarket({MARKET_SNAPSHOTS:store},fakeFetch,day);
 assert.equal(first.status,'stored');
 assert.equal(first.priced,7);
 assert.equal(first.observations.status,'archived');
 assert.equal(first.observations.stored,7);
 assert.equal(values.size,9); // dois snapshots + sete arquivos mensais por ativo
 assert.equal((await collectScheduledMarket({MARKET_SNAPSHOTS:store},fakeFetch,day)).status,'already_recorded');
 assert.equal(values.size,9);
 assert.equal((await collectScheduledMarket({},fakeFetch,day)).status,'storage_not_configured');
});


test('dossiê CVM brasileiro preserva ticker e hash de origem',async()=>{
 const url='https://vezori.example/api/fundamentals?market=BR&symbol=PETR3';
 const d={status:'verified_accounts',symbol:'PETR3',currency:'BRL',sourceUrl:'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_2025.zip',
 sourceSha256:'a'.repeat(64),accounts:[{statement:'DRE',accountCode:'3.01',label:'Receita',valueBRL:100000,periodEnd:'2025-12-31'}]};
 const env={ASSETS:{async fetch(request){assert.match(request.url,/PETR3\.json$/);return new Response(JSON.stringify(d),{status:200});}}};
 const response=await worker.fetch(new Request(url),env,{});
 assert.equal(response.status,200);assert.equal((await response.json()).symbol,'PETR3');
 assert.equal((await (await worker.fetch(new Request(url),{},{})).json()).status,'not_published');
 const bad=await worker.fetch(new Request(url),{ASSETS:{async fetch(){return new Response(JSON.stringify({...d,symbol:'ITUB4'}));}}},{});
 assert.equal(bad.status,503);
});


test('a integração brapi distingue cobertura gratuita sem chave de plano com chave',async()=>{
 const basic=await buildDashboard({},fakeFetch);
 assert.equal(basic.availability.brapi,'sandbox_only');
 const withKey=await buildDashboard({BRAPI_API_KEY:'test-key'},fakeFetch);
 assert.equal(withKey.availability.brapi,'available');
});

test('consulta historico B3 max preserva a janela efetiva e nao afirma historia completa',async()=>{
 const h=await historyQuote('BR','PETR4','max',{},fakeFetch);
 assert.equal(h.range,'max');
 assert.equal(h.coverage.completeSinceListing,false);
 assert.equal(h.coverage.actualFirst,h.points[0].date);
 assert.equal(h.coverage.actualLast,h.points.at(-1).date);
});
test('CoinGecko Demo limita max e agrega multiplas cotacoes intradiarias por UTC sem fabricar fechamento',async()=>{
 await assert.rejects(()=>historyQuote('CRYPTO','BTC','max',{COINGECKO_API_KEY:'demo-secret'},fakeFetch),/365 dias/);
 const mock=async(url,options)=>{
  assert.ok(String(url).includes('days=90'));
  assert.ok(!String(url).includes('interval=daily'));
  const base=Date.parse('2026-10-30T00:00:00.000Z');
  return new Response(JSON.stringify({prices:[[base,90],[base+43200000,100],[base+86400000,110]]}),{status:200});
 };
 const h=await historyQuote('CRYPTO','BTC','3mo',{COINGECKO_API_KEY:'demo-secret'},mock);
 assert.equal(h.points.length,2);
 assert.equal(h.points[0].close,100);
 assert.equal(h.coverage.completeSinceListing,false);
});
test('historico americano respeita limite de cinco mil pontos do fornecedor',async()=>{
 let requested;
 const fetcher=async(url)=>{requested=new URL(url).searchParams.get('outputsize');return new Response(JSON.stringify({meta:{currency:'USD'},values:[{datetime:'2026-11-04',close:'12.45'}]}),{status:200})};
 const h=await historyQuote('US','VOO','max',{TWELVEDATA_API_KEY:'demo'},fetcher);
 assert.equal(requested,'5000');
 assert.equal(h.coverage.completeSinceListing,false);
});

test('reexecutar coleta repara observações perdidas sem trocar a cotação original',async()=>{
 const raw=new Map();let drop=true;
 const store={
  async get(k){return raw.has(k)?JSON.parse(raw.get(k)):null;},
  async put(k,v){
   if(k.startsWith('vezori:observations:')&&drop){drop=false;throw Error('Falha temporária no KV');}
   raw.set(k,v);
  }
 };
 const day=new Date('2026-11-05T02:30:00Z');
 const first=await collectScheduledMarket({MARKET_SNAPSHOTS:store},fakeFetch,day);
 assert.equal(first.status,'stored');
 assert.equal(first.observations.status,'archive_failed');
 assert.equal(raw.has('vezori:market:2026-11-05'),true);
 const next=await collectScheduledMarket({MARKET_SNAPSHOTS:store},fakeFetch,day);
 assert.equal(next.status,'already_recorded');
 assert.equal(next.observations.status,'archived');
 assert.equal(next.observations.stored,7);
});
test('observações exige parâmetros válidos e não inventa dados sem KV',async()=>{
 const invalid=await worker.fetch(new Request('https://vezori.example/api/observations?market=BR&symbol=PETR4&months=999'),{},{});
 assert.equal(invalid.status,400);
 const ok=await worker.fetch(new Request('https://vezori.example/api/observations?market=BR&symbol=PETR4&months=12'),{},{});
 assert.equal(ok.status,200);
 assert.equal((await ok.json()).status,'storage_not_configured');
});

test('diagnóstico de armazenamento diferencia KV ausente, vazio e ativo',async()=>{
 const none=await worker.fetch(new Request('https://vezori.example/api/storage-status'),{},{});
 assert.equal(none.status,200);
 assert.equal((await none.json()).status,'not_configured');
 const map=new Map(),store={async get(k){return map.has(k)?JSON.parse(map.get(k)):null;},async put(k,v){map.set(k,v)}};
 const empty=await worker.fetch(new Request('https://vezori.example/api/storage-status'),{MARKET_SNAPSHOTS:store},{});
 assert.equal((await empty.json()).status,'configured_empty');
 await collectScheduledMarket({MARKET_SNAPSHOTS:store},fakeFetch,new Date('2026-11-05T02:30:00Z'));
 const active=await worker.fetch(new Request('https://vezori.example/api/storage-status'),{MARKET_SNAPSHOTS:store},{});
 assert.equal(active.status,200);
 const body=await active.json();
 assert.equal(body.status,'active');
 assert.equal(body.latestSnapshot.date,'2026-11-05');
});

test('rota paginada de observacoes aceita through no formato YYYY-MM',async()=>{
 const map=new Map();
 const store={
  async get(k){return map.has(k)?JSON.parse(map.get(k)):null;},
  async put(k,v){map.set(k,v);}
 };
 const response=await worker.fetch(new Request('https://vezori.example/api/observations?market=BR&symbol=PETR4&months=12&through=2026-10'),{MARKET_SNAPSHOTS:store},{});
 assert.equal(response.status,200);
 const d=await response.json();
 assert.equal(d.status,'no_observations');
 assert.equal(d.previousPageMonth,'2025-10');
});
test('rota paginada de observacoes rejeita through malformado e data futura',async()=>{
 const env={MARKET_SNAPSHOTS:{async get(){return null;}}};
 const malformed=await worker.fetch(new Request('https://vezori.example/api/observations?market=BR&symbol=PETR4&months=12&through=2026-1'),env,{});
 assert.equal(malformed.status,400);
 const future=await worker.fetch(new Request('https://vezori.example/api/observations?market=BR&symbol=PETR4&months=12&through=2099-01'),env,{});
 assert.equal(future.status,400);
});
