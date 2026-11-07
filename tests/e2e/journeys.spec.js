import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const buy={id:'test-buy',date:'2025-01-01',symbol:'PETR4',side:'buy',qty:10,unitPrice:20,fee:0,fx:1};
// Synthetic fixtures are isolated to browser tests and never bundled or deployed.
const dashboard={mode:'real_market_data',generatedAt:'2026-11-01T12:00:00Z',quotes:[{symbol:'PETR4',market:'BR',currency:'BRL',price:30,changePct:2,provider:'test fixture'}],fx:[],macro:[],errors:[],meta:{simulatedPrices:false},availability:{}};
test.beforeEach(async({page})=>{
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const payload=path==='/api/dashboard'?dashboard:path==='/api/catalog'?{mode:'real_market_catalog',items:[],hasNextPage:false,totalCount:0}:path==='/api/storage-status'?{status:'not_configured'}:{error:'Fonte indisponível no cenário de teste'};
  await route.fulfill({status:['/api/history','/api/observations'].includes(path)?422:200,contentType:'application/json',body:JSON.stringify(payload)});
 });
});
test('navegação, ausência de overflow, teclado e acessibilidade',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 const search=await page.locator('#home-search').boundingBox(),field=await page.locator('.home-search-field').boundingBox();
 expect(search.y).toBeGreaterThanOrEqual(field.y);
 expect(search.y+search.height).toBeLessThanOrEqual(field.y+field.height+1);
 for(const view of ['overview','market','compare','dashboard','strategies','about']){
  await page.locator('#menu [data-view="'+view+'"]').click();
  await expect(page.locator('#view-'+view)).toBeVisible();
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,12));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),JSON.stringify({view,overflow})).toBe(true);
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),view).toEqual([]);
 }
 await page.locator('#menu [data-view="overview"]').click();
 await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>document.activeElement.tagName)).not.toBe('BODY');
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(scan.violations).toEqual([]);
 await page.screenshot({path:info.outputPath('mercados.png'),fullPage:true});expect(errors).toEqual([]);
});
test('carteira: compra, venda inválida, provento, exportação e restauração',async({page})=>{
 await page.goto('/');await page.locator('[data-view="dashboard"]').click();
 await page.locator('#tx-qty').fill('10');await page.locator('#tx-price').fill('20');await page.locator('#tx-date').fill('2025-01-01');
 await page.locator('#transaction-form button[type="submit"]').click();
 await expect(page.locator('#transaction-feedback')).toContainText('salva');
 await expect(page.locator('#apex-total')).toContainText('300');
 await page.locator('#tx-side').selectOption('sell');await page.locator('#tx-qty').fill('11');await page.locator('#tx-price').fill('30');
 await page.locator('#transaction-form button[type="submit"]').click();await expect(page.locator('#transaction-feedback')).toContainText('excede');
 await page.locator('#tx-side').selectOption('income');await page.locator('#tx-price').fill('25');await page.locator('#transaction-form button[type="submit"]').click();
 await expect(page.locator('#apex-income')).toContainText('25');
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-csv').click();expect((await downloadPromise).suggestedFilename()).toBe('vezori-operacoes.csv');
 page.on('dialog',dialog=>dialog.accept());
 await page.locator('#import-data').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:2,transactions:[buy]}))});
 await expect(page.locator('#portfolio-msg')).toContainText('1 operações importadas');
 await page.reload();await page.locator('[data-view="dashboard"]').click();await expect(page.locator('#apex-total')).toContainText('300');
});
test('corrupção local e quota não são sobrescritas silenciosamente',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('vezori-portfolio-v3','{broken'));
 await page.goto('/');await page.locator('[data-view="dashboard"]').click();
 await expect(page.locator('#portfolio-msg')).toContainText('bloqueadas');
 await page.locator('#tx-qty').fill('1');await page.locator('#tx-price').fill('20');await page.locator('#transaction-form button[type="submit"]').click();
 await expect(page.locator('#transaction-feedback')).toContainText('bloqueada');
 expect(await page.evaluate(()=>localStorage.getItem('vezori-portfolio-v3'))).toBe('{broken');
});
test('laboratório: inflação, custo, imposto, invalidação e cenário zero',async({page},info)=>{
 await page.goto('/');await page.locator('[data-view="strategies"]').click();
 await page.locator('#lab-zero-rates').click();await page.locator('#lab-inflation').fill('5');await page.locator('#lab-fee').fill('1');await page.locator('#lab-tax').fill('15');
 await page.locator('#lab-run').click();await expect(page.locator('#lab-result-note')).toContainText('poder de compra');
 await expect(page.locator('#lab-result-summary')).toContainText('Patrimônio matemático');
 await page.screenshot({path:info.outputPath('laboratorio.png'),fullPage:true});
 await page.locator('#lab-monthly').fill('500');await expect(page.locator('#lab-result-summary')).toContainText('Configure');
});
test('busca, filtros e estado de histórico indisponível',async({page})=>{
 await page.goto('/');await page.locator('#home-search').fill('inexistente');await expect(page.locator('#home-groups')).toContainText('Nenhum ativo');
 await page.locator('[data-home-reset]').click();await page.locator('[data-home-filter="CRYPTO"]').click();await expect(page.locator('#home-groups')).toContainText('BTC');
 await page.locator('#global-search').fill('PETR4');await page.locator('#global-search-form').press('Enter');
 await expect(page.locator('#research-asset-history-status')).toContainText('indisponível');
});

test('gráficos v5 e comparação normalizada carregam dados somente das fixtures de teste',async({page})=>{
 await page.route('**/api/history?**',async route=>{
  const q=new URL(route.request().url()).searchParams;
  await route.fulfill({contentType:'application/json',body:JSON.stringify({symbol:q.get('symbol'),market:q.get('market'),currency:'BRL',interval:'1d',provider:'test fixture',priceBasis:'test price only',coverage:{completeSinceListing:false},points:Array.from({length:121},(_,i)=>({date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),close:100+i*.1+Math.sin(i)}))})});
 });
 await page.goto('/');
 await page.evaluate(()=>{
  const lib=window.LightweightCharts;window.__chartFits=[];
  window.LightweightCharts={...lib,createChart(host,options){
   const chart=lib.createChart(host,options),scale=chart.timeScale(),fit=scale.fitContent.bind(scale);
   scale.fitContent=()=>{fit();const evidence={width:host.getBoundingClientRect().width,range:null};window.__chartFits.push(evidence);requestAnimationFrame(()=>requestAnimationFrame(()=>{evidence.range=scale.getVisibleLogicalRange();}));};
   return chart;
  }};
 });
 await page.locator('#global-search').fill('BTC');await page.locator('#global-search-form').press('Enter');
 await expect(page.locator('#research-asset-lightweight')).toBeVisible();expect(await page.locator('#research-asset-lightweight canvas').count()).toBeGreaterThan(0);
 await expect(page.locator('#research-asset-chart-fallback')).toBeHidden();
 await expect(page.locator('#research-risk-metrics')).toContainText('VaR');
 await page.locator('[data-view="compare"]').click();
 await page.locator('#research-compare-add').selectOption('PETR4');await page.locator('#research-compare-add').selectOption('VALE3');await page.locator('#research-compare-run').click();
 await expect(page.locator('#research-compare-lightweight')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__chartFits.length>=2&&window.__chartFits.every(x=>x.range&&x.range.to-x.range.from>100))).toBe(true);
 const fits=await page.evaluate(()=>window.__chartFits);
 expect(fits.length).toBeGreaterThanOrEqual(2);
 for(const fit of fits){expect(fit.width).toBeGreaterThan(100);expect(fit.range.to-fit.range.from).toBeGreaterThan(100);}
});
test('falha de quota mantém operação anterior e não confirma o novo lançamento',async({page})=>{
 await page.addInitScript(backup=>{localStorage.setItem('vezori-portfolio-v3',backup);const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('vezori-portfolio'))throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,key,value);};},JSON.stringify({version:3,transactions:[buy]}));
 await page.goto('/');await page.locator('[data-view="dashboard"]').click();await page.locator('#tx-qty').fill('2');await page.locator('#tx-price').fill('20');await page.locator('#transaction-form button[type="submit"]').click();
 await expect(page.locator('#transaction-feedback')).toContainText('Quota');await expect(page.locator('#apex-total')).toContainText('300');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('vezori-portfolio-v3')).transactions.length)).toBe(1);
});
