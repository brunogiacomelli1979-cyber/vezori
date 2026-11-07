import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// Browser-only synthetic fixtures. Real official extracts are independently tested in Python.
test.beforeEach(async({page})=>{
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body={error:'test fixture unavailable'};
  if(path==='/api/dashboard')body={mode:'real_market_data',generatedAt:'2026-11-01',quotes:[],fx:[],macro:[],errors:[],availability:{},meta:{simulatedPrices:false}};
  if(path==='/api/catalog')body={items:[],hasNextPage:false};
  if(path==='/api/storage-status')body={status:'not_configured'};
  if(path==='/api/data-engine/status')body={status:'available',engineVersion:'1.0.0',generatedAt:'test fixture',storage:{instruments:1,observations:1},coverage:{cvm:{instruments:1},fii:{instruments:0},funds:{instruments:0},treasury:{instruments:0},macro:{instruments:0}},blocked:{prices:{status:'rights_required'}}};
  if(path==='/api/data-engine/catalog')body={items:[{id:'00000000000000',name:'Issuer (test fixture)',first:'2025-12-31',last:'2025-12-31',observations:1}],hasNextPage:false};
  if(path==='/api/data-engine/record')body={dataset:'cvm',id:'00000000000000',name:'Issuer (test fixture)',provider:'test fixture',currency:'BRL',license:'test fixture',observations:[{revisionOrdinal:1,values:{periodEnd:'2025-12-31',kind:'DFP',scope:'con',label:'Account (test fixture)',valueBRL:1}}],integrity:{verified:true}};
  await route.fulfill({status:path==='/api/history'?422:200,contentType:'application/json',body:JSON.stringify(body)});
 });
});
test('início mostra acervo oficial real e leva diretamente à consulta',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#home-engine-status')).toContainText('1 instrumento');
 await expect(page.locator('#home-engine-coverage')).toContainText('Companhias CVM');
 await page.locator('#home-engine-open').click();
 await expect(page.locator('#view-about')).toHaveClass(/active/);
 await expect(page.locator('#engine-search')).toBeFocused();
});
test('base oficial: catálogo, filtros, leitura e download auditável sem mudar a navegação',async({page})=>{
 await page.goto('/');await page.locator('#menu [data-view="about"]').click();await page.locator('#engine-query button').click();
 await expect(page.locator('#engine-catalog')).toContainText('Issuer (test fixture)');await page.locator('[data-engine-id]').click();
 await expect(page.locator('#engine-record-data')).toContainText('Account (test fixture)');await page.locator('#engine-year').selectOption('2025');
 const file=page.waitForEvent('download');await page.locator('#engine-download').click();expect((await file).suggestedFilename()).toBe('vezori-cvm-00000000000000.json');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(scan.violations.map(x=>x.id)).toEqual([]);
});
test('CSV privado alimenta gráfico sem upload, sem liberar API pública ou tocar na carteira',async({page})=>{
 const historyRequests=[];page.on('request',request=>{if(request.url().includes('/api/history'))historyRequests.push(request.url());expect(request.method()).toBe('GET');});
 await page.goto('/');await page.locator('#menu [data-view="about"]').click();await page.locator('details').filter({has:page.locator('#local-eod-form')}).locator('summary').click();
 await page.locator('#local-eod-source').fill('Private browser fixture');
 await page.locator('#local-eod-file').setInputFiles({name:'private.csv',mimeType:'text/csv',buffer:Buffer.from('date,market,symbol,currency,close,adjustment\n2026-11-04,BR,PRIVATE11,BRL,20,raw\n2026-11-05,BR,PRIVATE11,BRL,21,raw\n')});
 await page.locator('#local-eod-rights').check();await page.locator('#local-eod-form button').click();await expect(page.locator('#local-eod-status')).toContainText('2 registros privados importados');
 await page.locator('#local-eod-open').click();await expect(page.locator('#research-asset-name')).toContainText('PRIVATE11');await expect(page.locator('#research-asset-history-status')).toContainText('Arquivo local');
 await expect(page.locator('#research-asset-lightweight')).toBeVisible();expect(historyRequests).toEqual([]);
 expect(await page.evaluate(()=>localStorage.getItem('vezori-portfolio-v3'))).toBeNull();
 await page.reload();await page.locator('#global-search').fill('PRIVATE11');await page.locator('#global-search-form').press('Enter');await expect(page.locator('#research-asset-history-status')).toContainText('Arquivo local');
});
