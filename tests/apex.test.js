import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {portfolioTimeline,overviewMetrics} from '../public/apex-ui.js';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/apex-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/apex.css',import.meta.url),'utf8');

test('Apex design foi integrado na VEZORI sem substituir módulos e APIs',()=>{
 for(const id of ['view-overview','view-market','view-portfolio','view-strategies','view-about','apex-total','apex-allocation-chart','apex-assets-body','apex-trade-form','apex-timeframe','overview-kpis','overview-stocks','overview-strategies','overview-portfolio','overview-sim-chart','overview-sim-metrics','hero-count','hero-time','notice'])assert.ok(html.includes(`id="${id}"`),`Componente ausente: ${id}`);
 assert.match(html,/apex\.css/);
 assert.match(css,/#0b0f19/i);
 assert.match(css,/#10b981/i);
 assert.match(css,/Plus Jakarta Sans/);
 assert.match(js,/validateTransaction\(tx,state\.transactions\)/);
 assert.doesNotMatch(html,/284\.950|482\.736|Gabriel S\.|Apex Portfolio/);
 assert.doesNotMatch(js,/Math\.random\(\)\s*\*\s*0\.015|setInterval\(/);
});

test('historico do gráfico usa apenas compras reais e respeita período',()=>{
 const txs=[
  {id:'a',date:'2025-11-01',side:'buy',symbol:'PETR4',qty:10,unitPrice:20,fee:2,fx:1},
  {id:'b',date:'2026-10-15',side:'buy',symbol:'PETR4',qty:5,unitPrice:30,fee:0,fx:1},
  {id:'c',date:'2026-10-25',side:'sell',symbol:'PETR4',qty:1,unitPrice:50,fee:0,fx:1}
 ];
 const all=portfolioTimeline(txs,'ALL',new Date('2026-11-04T12:00:00Z'));
 assert.equal(all.at(-1).value,352);
 const month=portfolioTimeline(txs,'1M',new Date('2026-11-04T12:00:00Z'));
 assert.equal(month[0].value,202);
 assert.equal(month.at(-1).value,352);
 assert.equal(portfolioTimeline(txs.filter(x=>x.side!=='buy'),'ALL',new Date('2026-11-04T12:00:00Z')).length,0);
});

test('patrimônio e concentração respeitam ausência de cotação',()=>{
 const txs=[{id:'a',date:'2026-10-15',side:'buy',symbol:'PETR4',qty:2,unitPrice:10,fee:0,fx:1}];
 const missing=overviewMetrics(txs,[],[]);
 assert.equal(missing.portfolio.complete,false);
 assert.equal(missing.maxWeight,null);
 assert.equal(missing.gross,20);
 const valid=overviewMetrics(txs,[{symbol:'PETR4',currency:'BRL',price:12}],[]);
 assert.equal(valid.portfolio.marketBRL,24);
 assert.equal(valid.portfolio.unrealizedBRL,4);
 assert.equal(valid.maxWeight,1);
});