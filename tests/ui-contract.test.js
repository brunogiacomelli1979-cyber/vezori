import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');

test('layout da VEZORI preserva os cinco modulos funcionais',()=>{
 for(const key of ['overview','market','portfolio','strategies','about']) {
  assert.match(html,new RegExp(`id="view-${key}"`));
  assert.match(html,new RegExp(`data-view="${key}"`));
 }
});

test('novo dashboard possui componentes com dados e acoes funcionais',()=>{
 for(const id of ['overview-kpis','overview-stocks','overview-strategies','overview-portfolio','overview-sim-chart','overview-sim-metrics','hero-count','global-search','global-search-form','api-status','refresh']){
  assert.ok(html.includes(`id="${id}"`),`Faltou ${id}`);
 }
 assert.match(app,/function overviewPortfolioPreview/);
 assert.match(app,/function overviewProjectionPreview/);
 assert.match(app,/function overviewStrategyPreview/);
 assert.match(app,/global-search-form.*addEventListener/);
});

test('formularios e graficos da carteira continuam vinculados ao motor existente',()=>{
 for(const id of ['transaction-form','portfolio-table','transactions-table','sim-form','sim-result','sim-chart','history-form','history-chart','lookup-form']){
  assert.ok(html.includes(`id="${id}"`),`Faltou ${id}`);
 }
 assert.match(app,/portfolio\(state\.transactions/);
 assert.match(app,/project\(initial,monthly,rate,years\)/);
 assert.match(app,/const p=portfolio\(state\.transactions/);
});

test('sem cartela ficticia, sem dados de mercado fixos no HTML e com layout responsivo',()=>{
 assert.ok(!/R\$\s*443\.037|R\$\s*46\.000|129\.286/.test(html));
 assert.match(css,/@media\(max-width:610px\)/);
 assert.match(css,/\.dashboard-grid/);
 assert.match(css,/\.portfolio-preview/);
 assert.match(css,/\.topbar/);
});

test('layout Apex integrado com dados reais e módulos anteriores',()=>{
 assert.match(html,/class="view active apex-dashboard"/);
 assert.match(html,/Visão consolidada/);
 assert.match(html,/apex\.css/);
 assert.match(app,/createApexDashboard\(\{state,save,portfolioView,navigate\}\)/);
 assert.match(app,/apexUI\?\.render\(\)/);
});
