import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {alignNormalizedSeries,summarizeHistory,explorationRows} from '../public/research.js';

const point=(date,close)=>({date,close});
const s=(symbol,pts)=>({symbol,points:pts});

test('normalização intersecta datas, não interpola faltantes e parte de 100',()=>{
 const normalized=alignNormalizedSeries([
  s('PETR4',[point('2026-10-01',10),point('2026-10-02',11),point('2026-10-03',12)]),
  s('BTC',[point('2026-10-02',100),point('2026-10-03',90),point('2026-10-04',120)])
 ]);
 assert.deepEqual(normalized.dates,['2026-10-02','2026-10-03']);
 assert.equal(normalized.datasets[0].values[0],100);
 assert.ok(Math.abs(normalized.datasets[0].values[1]-12/11*100)<1e-9);
 assert.deepEqual(normalized.datasets[1].values,[100,90]);
});
test('séries sem datas em comum exibem indisponibilidade sem gerar curva',()=>{
 const result=alignNormalizedSeries([s('PETR4',[point('2026-01-01',10),point('2026-01-02',12)]),s('BTC',[point('2026-02-01',100),point('2026-02-02',99)])]);
 assert.deepEqual(result.dates,[]);assert.equal(result.datasets.length,0);assert.match(result.message,/datas em comum/);
});
test('séries precisam ter 2 a 5 ativos e rejeitam valores inválidos',()=>{
 assert.throws(()=>alignNormalizedSeries([s('BTC',[])]),/2 a 5/);
 assert.throws(()=>alignNormalizedSeries(new Array(6).fill(s('BTC',[]))),/2 a 5/);
 assert.equal(summarizeHistory(s('PETR4',[point('2026-01-01',-2),point('2026-01-02',0)])),null);
});
test('resumo histórico deriva mínimos máximos e retorno sem preço fictício',()=>{
 const summary=summarizeHistory(s('PETR4',[point('2026-10-02',25),point('2026-10-01',20),point('2026-10-03',30)]));
 assert.equal(summary.returnPct,50);assert.equal(summary.min,20);assert.equal(summary.max,30);assert.equal(summary.first,'2026-10-01');
});
test('explorador filtra e mostra ausência de cotação de forma explícita',()=>{
 const data={quotes:[{symbol:'PETR4',price:20,market:'BR',currency:'BRL',changePct:1.1},{symbol:'BTC',price:400000,market:'CRYPTO',currency:'BRL',changePct:-2}]};
 const rows=explorationRows(data,{market:'BR',search:'PETR',sort:'variation'});
 assert.deepEqual(rows.map(r=>r.symbol),['PETR4']);assert.equal(rows[0].quote.price,20);
 const missing=explorationRows(data,{market:'BR'}).find(r=>r.symbol==='VALE3');assert.equal(missing.quote,null);
});
test('UI oferece três novas jornadas e preserva cinco telas legadas',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 for(const view of ['market','asset','compare','overview','dashboard','strategies','about'])assert.match(html,new RegExp(`id="view-${view}"`));
 for(const id of ['research-explore-body','research-asset-chart','research-compare-table','research-compare-chart','research-explore-open-compare'])assert.ok(html.includes(`id="${id}"`));
 assert.match(app,/createResearchTools/);assert.match(app,/researchTools\?\.onNavigate/);
 assert.doesNotMatch(html,/Carteira demonstrativa|R\$\s*482\.736|R\$\s*443\.037/);
});
test('ficha exibe métricas de risco somente após histórico verificável',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const research=readFileSync(new URL('../public/research.js',import.meta.url),'utf8');
 assert.match(html,/id="research-risk-metrics"/);
 assert.match(html,/id="research-risk-status"/);
 assert.match(research,/analyzeAssetRisk\(\{\.\.\.series,\s*points:\s*series\.points\.slice\(-1000\)\}\)/);
 assert.match(html,/pelo menos 30 retornos diários/);
});


test('a ficha brasileira recolhe gráfico vazio, mostra origem e ajuda para ativar histórico',()=>{
 const h=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/research.js',import.meta.url),'utf8');
 for(const id of ['research-history-nextstep','research-history-cta','research-history-alternative','research-fundamental-document','research-fundamental-method'])
  assert.match(h,new RegExp('id="'+id+'"'));
 assert.match(js,/classList\.add\('is-missing'\)/);
 assert.match(js,/BRAPI_API_KEY/);
 assert.match(js,/PETR4 \(ação diferente\)/);
 assert.match(js,/d\.status!=='verified_accounts'|data\.status!=='verified_accounts'/);
});
