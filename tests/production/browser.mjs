// Isolated production acceptance tests: no API interception or personal browser profile.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const root='https://vezori.bruno-giacomelli1979.workers.dev';
const out=process.env.EVIDENCE_DIR||'out/production';
await mkdir(out,{recursive:true});
const browser=await chromium.launch(),results=[];
try{
 for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const csp=[];page.on('console',msg=>{if(msg.type()==='error'&&/content security|violates.*policy/i.test(msg.text()))csp.push(msg.text());});
  await page.goto(root,{waitUntil:'networkidle',timeout:60000});
  for(const view of ['overview','market','compare','dashboard','strategies','about']){
   await page.locator('#menu [data-view="'+view+'"]').click();
   assert(await page.locator('#view-'+view).isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+view+' '+width);
   // Do not let axe re-fetch external font CSS through fetch (blocked by connect-src).
   // Browser-computed styles and all WCAG rules, including contrast, remain enabled.
   const scan=await new AxeBuilder({page}).options({preload:false}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   assert.deepEqual(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],view+' '+width);
   await page.screenshot({path:out+'/'+view+'-'+width+'.png',fullPage:false});
  }
  // This manual test entry is confined to this disposable browser's localStorage.
  // It is not a quote, market dataset, financial order, or the owner's portfolio.
  await page.locator('#menu [data-view="dashboard"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('vezori-portfolio-v3')),null);
  await page.locator('#tx-qty').fill('1');await page.locator('#tx-price').fill('10');await page.locator('#tx-date').fill('2026-11-06');
  await page.locator('#transaction-form button[type="submit"]').click();
  assert.match(await page.locator('#transaction-feedback').innerText(),/salva/);
  const saved=await page.evaluate(()=>localStorage.getItem('vezori-portfolio-v3'));
  assert.equal(JSON.parse(saved).transactions.length,1);
  await page.reload({waitUntil:'networkidle'});await page.locator('#menu [data-view="dashboard"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('vezori-portfolio-v3')),saved);
  await page.locator('#menu [data-view="strategies"]').click();
  await page.locator('#lab-zero-rates').click();await page.locator('#lab-inflation').fill('5');await page.locator('#lab-fee').fill('1');await page.locator('#lab-tax').fill('15');
  await page.locator('#lab-run').click();assert.match(await page.locator('#lab-result-note').innerText(),/poder de compra/);
  assert.deepEqual(errors,[]);assert.deepEqual(csp,[]);
  results.push({width,height,views:6,axeViolations:0,pageErrors:errors,cspErrors:csp,localPortfolio:'write/reload verified in disposable context',lab:'cost/inflation/tax calculation rendered'});
  await context.close();
 }
}finally{await browser.close();}
await writeFile(out+'/acceptance.json',JSON.stringify({root,at:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results));
