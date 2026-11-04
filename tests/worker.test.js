import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{BR_SYMBOLS,buildDashboard,brazilQuote,historyQuote,cryptoQuotes,mercadoBitcoinQuotes} from '../src/worker.js';
function fakeFetch(url,options={}){
 const uri=new URL(url);let obj;
 if(uri.hostname==='brapi.dev'){
  const symbol=uri.searchParams.get('symbols');
  if(uri.pathname.includes('/historical'))obj={results:[{symbol,data:{historicalDataPrice:[{date:1793450000,close:25,adjustedClose:25.5},{date:1793536400,close:26,adjustedClose:26.5}]}}]};
  else obj={results:[{symbol,data:{shortName:'Empresa '+symbol,currency:'BRL',regularMarketPrice:40.25,regularMarketChangePercent:1.3,regularMarketTime:'2026-11-04T11:00:00Z'}}]};
 }else if(uri.hostname==='api.mercadobitcoin.net'){
  obj=[
   {pair:'BTC-BRL',last:'390000.00',date:1793800000000000000},
   {pair:'ETH-BRL',last:'18000.00',date:1793800000000000000},
   {pair:'SOL-BRL',last:'990.00',date:1793800000000000000}
  ];
 }else if(uri.hostname==='api.frankfurter.dev')obj={base:uri.pathname.includes('usd')?'USD':'EUR',quote:'BRL',rate:uri.pathname.includes('usd')?5.4:6.3,date:'2026-11-03'};
 else if(uri.hostname==='api.bcb.gov.br')obj=[{data:'04/11/2026',valor:'13.75'}];
 else if(uri.hostname==='api.coingecko.com'){
  assert.equal(options.headers['x-cg-demo-api-key'],'demo-secret');
  if(uri.pathname.includes('market_chart'))obj={prices:[[1793450000000,390000],[1793536400000,400000]]};
  else obj={bitcoin:{brl:390000,usd:72000,brl_24h_change:2,last_updated_at:1793800000},ethereum:{brl:18000,usd:3300,brl_24h_change:-1,last_updated_at:1793800000},solana:{brl:990,usd:190,brl_24h_change:0.5,last_updated_at:1793800000}};
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
 assert.equal(d.availability.mercadobitcoin,'available');
 assert.equal(d.fx.length,2);assert.equal(d.macro[0].value,13.75);
 assert.equal(d.availability.coingecko,'key_required');assert.equal(d.availability.twelvedata,'key_required');assert.equal(d.meta.simulatedPrices,false);
});
test('com chaves: CoinGecko e Twelve Data entram na carteira de mercado sem vazar segredos',async()=>{
 const d=await buildDashboard({COINGECKO_API_KEY:'demo-secret',TWELVEDATA_API_KEY:'td-secret'},fakeFetch);
 assert.equal(d.quotes.length,10);assert.equal(d.quotes.find(q=>q.symbol==='BTC').price,390000);
 assert.equal(d.quotes.find(q=>q.symbol==='VOO').price,615.56);
 assert.equal(JSON.stringify(d).includes('demo-secret'),false);assert.equal(JSON.stringify(d).includes('td-secret'),false);
});
test('falha de provedor não produz números substitutos',async()=>{
 const failure=(url,options)=>String(url).includes('VALE3')?Promise.resolve(new Response('limite',{status:429})):fakeFetch(url,options);
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
test('criptomoedas: cotação exige chave e respeita formato da API',async()=>{
 await assert.rejects(()=>cryptoQuotes(null,fakeFetch),/não configurada/);
 const d=await cryptoQuotes('demo-secret',fakeFetch);assert.equal(d.length,3);
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

test('Mercado Bitcoin publica ultimo preco em BRL e timestamp sem inventar percentual',async()=>{
 const rows=await mercadoBitcoinQuotes(fakeFetch);
 assert.equal(rows.length,3);
 assert.equal(rows.find(r=>r.symbol==='BTC').price,390000);
 assert.equal(rows.find(r=>r.symbol==='ETH').provider,'Mercado Bitcoin');
 assert.equal(rows.find(r=>r.symbol==='BTC').changePct,null);
 assert.match(rows[0].providerAsOf,/^2026-/);
});
test('quando a fonte publica de cripto falha, nao aparece preco de fallback ficticio',async()=>{
 const failing=(url,opts)=>String(url).includes('mercadobitcoin.net')?Promise.resolve(new Response('error',{status:429})):fakeFetch(url,opts);
 const d=await buildDashboard({},failing);
 assert.equal(d.quotes.some(q=>q.market==='CRYPTO'),false);
 assert.equal(d.availability.mercadobitcoin,'partial_failure');
 assert.equal(d.errors.some(e=>e.source==='mercadobitcoin'),true);
});
