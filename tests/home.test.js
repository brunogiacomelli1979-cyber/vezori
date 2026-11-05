import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homeCatalog} from '../public/home.js';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/home.css',import.meta.url),'utf8');

test('todos os ativos catalogados aparecem sem exigir ticker nem carteira',()=>{
 const rows=homeCatalog({quotes:[]});
 assert.equal(rows.length,13);
 assert.equal(new Set(rows.map(x=>x.symbol)).size,10);
 assert.ok(rows.some(x=>x.market==='BR'));
 assert.ok(rows.some(x=>x.market==='US'));
 assert.ok(rows.some(x=>x.market==='CRYPTO'));
 assert.ok(rows.every(x=>x.quote===null));
});
test('catálogo utiliza apenas cotações válidas, com correspondência de moeda',()=>{
 const rows=homeCatalog({quotes:[{symbol:'PETR4',price:25,currency:'BRL',changePct:2,provider:'brapi'},
 {symbol:'AAPL',price:300,currency:'BRL',provider:'errado'},
 {symbol:'BTC',price:0,currency:'BRL',provider:'nulo'}]});
 assert.equal(rows.find(x=>x.symbol==='PETR4').quote.price,25);
 assert.equal(rows.find(x=>x.symbol==='AAPL').quote,null);
 assert.equal(rows.find(x=>x.symbol==='BTC').quote,null);
});
test('busca por nome funciona, e filtros mantêm preços indisponíveis visíveis',()=>{
 const petro=homeCatalog({quotes:[]},{search:'Petrobras'});
 assert.deepEqual(petro.map(x=>x.symbol),['PETR4']);
 const eu=homeCatalog({quotes:[]},{market:'US'});
 assert.deepEqual(eu.map(x=>x.symbol),['AAPL','MSFT','O','PLD','QQQ','VOO']);
 assert.equal(homeCatalog({quotes:[]},{search:'inexistente'}).length,0);
});
test('classificação por variação separa valores sem cotação',()=>{
 const market={quotes:[{symbol:'PETR4',price:10,currency:'BRL',changePct:-4},
 {symbol:'ITUB4',price:20,currency:'BRL',changePct:3}]};
 const up=homeCatalog(market,{market:'BR',sort:'up'});
 const down=homeCatalog(market,{market:'BR',sort:'down'});
 assert.equal(up[0].symbol,'ITUB4');
 assert.equal(down[0].symbol,'PETR4');
 assert.deepEqual(up.slice(-2).map(x=>x.quote),[null,null]);
});
test('home com jornada de seleção direta, sem ficha solta no menu',()=>{
 assert.match(html,/id="view-overview" class="view active market-home"/);
 assert.match(html,/id="home-groups"/);
 assert.match(html,/id="home-filters"/);
 assert.match(html,/id="home-search"/);
 assert.match(html,/data-view="dashboard"/);
 assert.doesNotMatch(html,/class="nav" data-view="asset"/);
 assert.match(app,/createMarketHome/);
 assert.match(css,/home-asset-row/);
});

test('catálogo remoto amplia a cobertura de B3 sem criar cotação faltante',()=>{
 const rows=homeCatalog({quotes:[{symbol:'PETR4',currency:'BRL',price:22,changePct:1}],
 catalog:[{symbol:'HGLG11',name:'Fundo logístico',market:'BR',currency:'BRL',category:'fii',price:151.32,changePct:2,provider:'brapi'},
 {symbol:'BOVA11',name:'ETF Ibovespa',market:'BR',currency:'BRL',category:'etf',price:null,provider:'brapi'}]});
 assert.equal(rows.length,15);
 assert.equal(rows.find(r=>r.symbol==='HGLG11').quote.price,151.32);
 assert.equal(rows.find(r=>r.symbol==='BOVA11').quote,null);
 assert.equal(rows.find(r=>r.symbol==='PETR4').quote.price,22);
});

test('rankings iniciais consideram apenas variações verificáveis do recorte B3',async()=>{
 const {rankedMarketMovers}=await import('../public/home.js');
 const data={quotes:[{symbol:'PETR4',currency:'BRL',price:10,changePct:-3},{symbol:'VALE3',currency:'BRL',price:15,changePct:4},{symbol:'BTC',currency:'BRL',price:250000,changePct:70}],
  catalog:[{symbol:'BBAS3',market:'BR',currency:'BRL',name:'Banco do Brasil',price:20,changePct:6},{symbol:'AAPL34',market:'BR',currency:'BRL',name:'Apple BDR',price:40,changePct:-5}]};
 assert.deepEqual(rankedMarketMovers(data,'up',5).map(x=>x.symbol),['BBAS3','VALE3']);
 assert.deepEqual(rankedMarketMovers(data,'down',5).map(x=>x.symbol),['AAPL34','PETR4']);
 assert.throws(()=>rankedMarketMovers(data,'x'),/Ranking inválido/);
});
test('FIIs, ETFs e BDRs podem ser filtrados sem ticker conhecido',()=>{
 const data={catalog:[{symbol:'HGLG11',name:'Fundo X',market:'BR',currency:'BRL',category:'fii',price:100},
  {symbol:'BOVA11',name:'Índice Y',market:'BR',currency:'BRL',category:'etf',price:120},
  {symbol:'AAPL34',name:'BDR Apple',market:'BR',currency:'BRL',category:'bdr',price:25}]};
 assert.deepEqual(homeCatalog(data,{market:'FUNDS'}).map(x=>x.symbol),['BOVA11','HGLG11']);
 assert.deepEqual(homeCatalog(data,{market:'BDR'}).map(x=>x.symbol),['AAPL34']);
});
test('home oferece rankings curtos e acesso completo sob demanda',()=>{
 assert.match(html,/id="home-rankings"/);
 assert.match(html,/data-home-filter="FUNDS"/);
 assert.match(html,/data-home-filter="BDR"/);
 assert.match(css,/market-rank-grid/);
});
