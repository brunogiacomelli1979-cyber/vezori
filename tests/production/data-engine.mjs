/** Production browser acceptance. Real official records and temporary real-price private file; no mocks. */
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const root='https://vezori.bruno-giacomelli1979.workers.dev',out=process.env.EVIDENCE_DIR||'out/engine-browser';
await mkdir(out,{recursive:true});
async function get(path){const response=await fetch(root+path,{signal:AbortSignal.timeout(45000)});assert(response.ok,path);return response.json();}
const health=await get('/api/health'),status=await get('/api/data-engine/status');
if(process.env.EXPECTED_SHA)assert.equal(health.release,process.env.EXPECTED_SHA);
const crypto=await get('/api/history?market=CRYPTO&symbol=BTC&range=1mo');assert(crypto.points.length>=2);
const privateCsv='date,market,symbol,currency,close,adjustment\n'+crypto.points.slice(-2).map(p=>[p.date,'CRYPTO','BTC',crypto.currency,p.close,'raw'].join(',')).join('\n');
const browser=await chromium.launch(),results=[];
try{
 for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push({method:r.method(),url:r.url()});});
  await page.goto(root,{waitUntil:'networkidle',timeout:60000});await page.locator('#menu [data-view="about"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('vezori-portfolio-v3')),null);
  for(const [dataset,q,field] of [['cvm','PETR4','valueBRL'],['macro','cdi','value'],['funds','00017024000153','navPerUnitBRL'],['fii','00332266000131','navPerUnitBRL'],['treasury','Tesouro Selic','buyPriceBRL']]){
   const catalog=await get('/api/data-engine/catalog?dataset='+dataset+'&q='+encodeURIComponent(q));assert(catalog.items.length);
   const doc=await get('/api/data-engine/record?dataset='+dataset+'&id='+catalog.items[0].id);assert(doc.integrity.verified);
   await page.locator('#engine-dataset').selectOption(dataset);await page.locator('#engine-search').fill(q);await page.locator('#engine-query button').click();
   await page.locator('[data-engine-id="'+catalog.items[0].id+'"]').waitFor();await page.locator('[data-engine-id="'+catalog.items[0].id+'"]').click();
   await page.waitForFunction(id=>document.querySelector('#engine-record-note')?.textContent.includes(id),doc.id);
   if(dataset==='cvm')await page.locator('#engine-year').selectOption('2025');
   const rows=doc.observations.filter(r=>(dataset!=='cvm'||r.values.scope==='con'&&r.values.periodEnd.startsWith('2025'))).sort((a,b)=>(b.values.date||b.values.periodEnd).localeCompare(a.values.date||a.values.periodEnd)||b.revisionOrdinal-a.revisionOrdinal);
   const row=rows.slice(0,50).find(r=>Number.isFinite(r.values[field]));assert(row);
   const value=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8}).format(row.values[field]);assert((await page.locator('#engine-record-data').innerText()).includes(value),'Displayed value differs from verified source '+dataset);
   const scan=await new AxeBuilder({page}).options({preload:false}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('#engine-record').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+dataset+'-'+width+'.png'});
   results.push({width,dataset,id:doc.id,sourceSha256:doc.integrity.sha256,field,displayedValue:value,axeViolations:0});
   console.log('LIVE UI:',width,dataset,'verified source value rendered');
  }
  await page.locator('details').filter({has:page.locator('#local-eod-form')}).locator('summary').click();await page.locator('#local-eod-source').fill('CoinGecko — teste privado temporário');
  await page.locator('#local-eod-file').setInputFiles({name:'real-private-acceptance.csv',mimeType:'text/csv',buffer:Buffer.from(privateCsv)});await page.locator('#local-eod-rights').check();await page.locator('#local-eod-form button').click();
  await page.waitForFunction(()=>document.querySelector('#local-eod-status')?.textContent.includes('registros privados importados'));
  await page.screenshot({path:out+'/private-'+width+'.png'});
  const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert(layout.scrollWidth<=layout.viewport+1,JSON.stringify(layout));
  await page.locator('#local-eod-open').click();await page.waitForFunction(()=>document.querySelector('#research-asset-history-status')?.textContent.includes('Arquivo local'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('vezori-portfolio-v3')),null);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  results.push({width,privateFile:'two real CoinGecko observations; disposable context, no upload',layout,portfolio:'untouched',writes,errors});
  await context.close();
 }
}finally{await browser.close();await writeFile(out+'/evidence.json',JSON.stringify({at:new Date().toISOString(),release:health.release,status,results},null,2));}
console.log('Real Data Engine browser acceptance passed in four viewports.');
