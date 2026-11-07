import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketChartSeries,mountMarketChart} from '../public/market-charts.js';
test('prepara somente observações reais válidas em ordem cronológica',()=>{
 const d=marketChartSeries(['2026-11-03','2026-11-01','2026-11-02'],[{symbol:'PETR4',values:[32,30,31]}]);
 assert.deepEqual(d[0].data,[{time:'2026-11-01',value:30},{time:'2026-11-02',value:31},{time:'2026-11-03',value:32}]);
});
test('não interpolar lacunas, não aceitar valor inventado ou datas inválidas',()=>{
 const d=marketChartSeries(['2026-11-01','2026-11-02','2026-11-03','fake'],
  [{symbol:'VOO',values:[100,null,103,110]}]);
 assert.deepEqual(d[0].data,[{time:'2026-11-01',value:100},{time:'2026-11-03',value:103}]);
 assert.throws(()=>marketChartSeries(['2026-11-01'],[{symbol:'X',values:[100,200]}]),/incompatíveis/);
 assert.throws(()=>marketChartSeries(['2026-11-01'],[{symbol:'X',values:[100]}]),/insuficiente/);
});
test('monta séries na API TradingView v5 e libera recursos',()=>{
 let removed=false,received=[];
 const fakeLib={LineSeries:{line:true},createChart:()=>({
  addSeries(type,opts){assert.equal(type,fakeLib.LineSeries);return {setData(d){received.push([opts.title,d]);}};},
  timeScale(){return {fitContent(){}};},remove(){removed=true;}
 })};
 const c=mountMarketChart({},['2026-11-01','2026-11-02'],[{symbol:'PETR4',values:[10,12]}],fakeLib);
 assert.equal(c.engine,'lightweight');assert.equal(received.length,1);c.destroy();assert.equal(removed,true);
 assert.equal(mountMarketChart({},['2026-11-01','2026-11-02'],[{symbol:'PETR4',values:[10,12]}],null),null);
});
test('ficha e comparador conservam transparência sobre autoria do gráfico',()=>{
 const h=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(h,/research-asset-lightweight/);assert.match(h,/research-compare-lightweight/);
 assert.match(h,/\/vendor\/lightweight-charts\.js/);assert.equal(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).dependencies['lightweight-charts'],'5.2.1');assert.match(h,/tradingview\.com/);
 assert.match(h,/Valores provenientes das APIs indicadas/);
});
