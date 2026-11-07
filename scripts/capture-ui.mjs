import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.argv[2]||'https://vezori.bruno-giacomelli1979.workers.dev';
const out=process.argv[3]||'../evidence/before';
await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const results=[];
try{
 for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root,{waitUntil:'networkidle',timeout:60000});
  for(const [name,view] of [['mercados','overview'],['carteira','dashboard'],['laboratorio','strategies'],['fontes','about']]){
   await page.locator('#menu [data-view="'+view+'"]').click();
   await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true});
   const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   results.push({name,width,height,...layout,errors:[...errors]});
  }
  await context.close();
 }
}finally{await browser.close();}
await writeFile(out+'/inspection.json',JSON.stringify({root,at:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results));
