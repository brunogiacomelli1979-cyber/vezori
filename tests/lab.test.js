import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAB_PRESETS,LAB_BUCKETS,LAB_EXTRA,suggestedPortfolio,validateStudy,simulateStudy,demoAnnualRate} from '../public/lab.js';

const scenario={initial:10000,monthly:300,years:10};

test('cinco estratégias têm universos distintos e pesos sugeridos íntegros',()=>{
 assert.equal(LAB_PRESETS.length,5);
 const seen=new Set();
 LAB_PRESETS.forEach((preset,i)=>{
  const rows=suggestedPortfolio(i);
  assert.equal(rows.reduce((s,row)=>s+row.weight,0),100);
  assert.ok(rows.every(row=>row.rate===demoAnnualRate(row.symbol,LAB_BUCKETS[row.symbol]||LAB_EXTRA[row.symbol])));
  assert.ok(rows.every(row=>row.symbol in LAB_BUCKETS||row.symbol in LAB_EXTRA||['VOO','QQQ','AAPL','ITUB4','VALE3','PETR4','MGLU3','BTC','ETH','SOL'].includes(row.symbol)));
  seen.add(rows.map(x=>x.symbol).join(','));
 });
 assert.equal(seen.size,5);
 assert.throws(()=>suggestedPortfolio(9),/Estratégia inválida/);
});

test('capital e aportes com 0% retornam exatamente o capital aplicado',()=>{
 const result=simulateStudy(suggestedPortfolio(0).map(row=>({...row,rate:0})),scenario);
 const expected=10000+300*120;
 assert.ok(Math.abs(result.total-expected)<1e-6);
 assert.ok(Math.abs(result.invested-expected)<1e-6);
 assert.ok(Math.abs(result.gain)<1e-6);
 assert.equal(result.years.length,10);
 assert.equal(result.holdings.length,3);
});

test('taxas anuais distintas projetam separadamente, com aportes a pesos de origem',()=>{
 const result=simulateStudy([{symbol:'VOO',weight:50,rate:0},{symbol:'RF_SIM',weight:50,rate:12}],{initial:1200,monthly:0,years:1});
 assert.ok(Math.abs(result.holdings[0].amount-600)<1e-6);
 assert.ok(Math.abs(result.holdings[1].amount-672)<1e-6);
 assert.ok(Math.abs(result.total-1272)<1e-6);
 assert.ok(Math.abs(result.invested-1200)<1e-6);
 assert.ok(Math.abs(result.gain-72)<1e-6);
 assert.ok(result.holdings[1].finalWeight>50); // no automatic rebalancing
});

test('rate negativa, aportes e anos preservam método sem gerar preços',()=>{
 const result=simulateStudy([{symbol:'BTC',weight:100,rate:-50}],{initial:1000,monthly:0,years:1});
 assert.ok(Math.abs(result.total-500)<1e-6);
 assert.ok(Math.abs(result.gain+500)<1e-6);
 assert.equal(result.years[0].capital,1000);
});

test('pesos diferentes de 100% e duplicatas não podem ser simulados',()=>{
 assert.throws(()=>simulateStudy([{symbol:'VOO',weight:60,rate:5}],scenario),/100%/);
 assert.throws(()=>simulateStudy([{symbol:'VOO',weight:50,rate:5},{symbol:'VOO',weight:50,rate:5}],scenario),/duplicados/);
 assert.throws(()=>simulateStudy([{symbol:'VOO',weight:0,rate:5},{symbol:'QQQ',weight:100,rate:5}],scenario),/peso maior que zero/);
});

test('entradas financeiras inválidas são rejeitadas',()=>{
 const rows=suggestedPortfolio(4);
 assert.throws(()=>validateStudy(rows,{initial:0,monthly:0,years:10}),/positivo/);
 assert.throws(()=>validateStudy(rows,{initial:-100,monthly:300,years:10}),/Capital inicial/);
 assert.throws(()=>validateStudy(rows,{initial:1000,monthly:300,years:41}),/1 a 40/);
 assert.throws(()=>validateStudy(rows,{initial:1000,monthly:Infinity,years:10}),/Aporte mensal/);
 assert.throws(()=>validateStudy([{symbol:'VOO',weight:100,rate:150}],scenario),/entre -90% e 100%/);
 assert.throws(()=>validateStudy([{symbol:'VOO',weight:100,rate:NaN}],scenario),/entre -90% e 100%/);
});

test('taxas de exemplo são explicitamente didáticas, não cotação',()=>{
 assert.equal(demoAnnualRate('BTC'),12);
 assert.equal(demoAnnualRate('RF_SIM',LAB_BUCKETS.RF_SIM),5);
 assert.equal(demoAnnualRate('CAIXA_SIM',LAB_BUCKETS.CAIXA_SIM),0);
 assert.equal(demoAnnualRate('VOO'),7);
});

test('componentes da etapa do laboratório preservam transparência',()=>{
 const module=readFileSync(new URL('../public/lab.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/lab.css',import.meta.url),'utf8');
 for(const id of ['lab-builder','lab-model','lab-rows','lab-alternatives','lab-weights','lab-add','lab-run','lab-result-summary','lab-result-chart','lab-result-holdings'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/sem ordens reais/i);
 assert.match(html,/não representa recomendação/i);
 assert.match(module,/não determinam o resultado matemático/);
 assert.match(css,/lab-studio-grid/);
});
test('ETFs reais opcionais e classes genéricas são diferenciados',()=>{
 for(const s of ['BND','SGOV','GLD','DBC'])assert.equal(LAB_EXTRA[s].hypothetical,false);
 assert.equal(LAB_BUCKETS.RF_SIM.hypothetical,true);
 assert.equal(demoAnnualRate('BND',LAB_EXTRA.BND),5);
 assert.equal(demoAnnualRate('GLD',LAB_EXTRA.GLD),4);
 assert.ok(LAB_PRESETS[2].alternatives.includes('GLD'));
});

test('juros anuais efetivos e aporte no fim de cada mês batem com fórmula financeira independente',()=>{
 const annual=.08,r=(1+annual)**(1/12)-1,months=120;
 const expected=10000*(1+r)**months+300*((1+r)**months-1)/r;
 const result=simulateStudy([{symbol:'VOO',weight:100,rate:8}],{initial:10000,monthly:300,years:10});
 assert.ok(Math.abs(result.total-expected)<1e-5);
 assert.equal(result.invested,46000);
 assert.ok(result.gain>0);
});
test('carteira nova oferece taxas explicitamente ilustrativas com variação positiva',()=>{
 const sample=suggestedPortfolio(2);
 assert.equal(sample.reduce((sum,r)=>sum+r.weight,0),100);
 assert.ok(sample.some(r=>r.rate>0));
 const result=simulateStudy(sample,{initial:10000,monthly:300,years:10});
 assert.ok(result.total>result.invested);
});

test('captura do usuário: taxa anual confundida com peso aciona alerta de concentração',async()=>{
 const {inspectStudyAssumptions}=await import('../public/lab.js');
 const rows=[{symbol:'VOO',weight:20,rate:20},{symbol:'BOVA11',weight:10,rate:10},{symbol:'RF_SIM',weight:55,rate:55.5},{symbol:'OURO_SIM',weight:7.5,rate:7.5},{symbol:'COM_SIM',weight:7.5,rate:7.5}];
 const result=simulateStudy(rows,{initial:10000,monthly:300,years:10});
 assert.ok(Math.abs(result.total-866502.6819665792)<.01);
 const flags=inspectStudyAssumptions(rows,result);
 assert.equal(flags.possibleMixup,true);
 assert.equal(flags.requiresConfirmation,true);
 assert.equal(flags.dominant.symbol,'RF_SIM');
 assert.ok(flags.dominant.finalWeight>93);
 assert.equal(inspectStudyAssumptions(suggestedPortfolio(2)).requiresConfirmation,false);
});

test('laboratório oferece análise histórica separada das taxas hipotéticas',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const module=readFileSync(new URL('../public/lab.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 for(const id of ['lab-risk-study','lab-risk-assets','lab-risk-period','lab-risk-run','lab-risk-rows','lab-risk-status'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/não fazemos projeções/);
 assert.match(module,/analyzeAssetRisk\(series\)/);
 assert.match(app,/createLabBuilder\(\{state,getJson\}\)/);
});
