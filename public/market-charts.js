import {validDate} from './finance.js';
/**
 * VEZORI Market Charts — pure price preparation and optional TradingView adapter.
 * Never invent dates, interpolate points, or substitute unknown prices.
 */
export function marketChartSeries(labels,datasets){
 if(!Array.isArray(labels)||!Array.isArray(datasets)||!datasets.length)throw Error('Séries ausentes');
 return datasets.map(ds=>{
  if(!ds||!Array.isArray(ds.values)||ds.values.length!==labels.length)throw Error('Série e datas incompatíveis');
  const points=new Map();
  labels.forEach((date,i)=>{
   const value=ds.values[i];
   if(validDate(String(date))&&typeof value==='number'&&Number.isFinite(value)&&value>0){
    if(points.has(String(date))&&points.get(String(date)).value!==value)throw Error('Fechamentos conflitantes no gráfico');
    points.set(String(date),{time:String(date),value});
   }
  });
  const data=[...points.values()].sort((a,b)=>a.time.localeCompare(b.time));
  if(data.length<2)throw Error('Série histórica insuficiente');
  return {symbol:String(ds.symbol||'Ativo'),data};
 });
}
const palette=['#10b981','#60a5fa','#f59e0b','#a78bfa','#f472b6'];
/** Returns a destroy() compatible adapter or null if the optional CDN did not load. */
export function mountMarketChart(host,labels,datasets,lib){
 if(!host||!lib?.createChart||!lib?.LineSeries)return null;
 const normalized=marketChartSeries(labels,datasets);
 let chart;
 try{
  chart=lib.createChart(host,{
   autoSize:true,
   layout:{background:{type:'solid',color:'#111827'},textColor:'#aab9c9',fontFamily:'Plus Jakarta Sans, sans-serif'},
   grid:{vertLines:{color:'rgba(148,163,184,.075)'},horzLines:{color:'rgba(148,163,184,.10)'}},
   rightPriceScale:{borderColor:'#344052',scaleMargins:{top:.14,bottom:.12}},
   timeScale:{borderColor:'#344052',timeVisible:false},
   crosshair:{vertLine:{color:'#7a92a8',labelBackgroundColor:'#253447'},horzLine:{color:'#7a92a8',labelBackgroundColor:'#253447'}},
   handleScroll:true,handleScale:true
  });
  normalized.forEach((series,i)=>{
   const line=chart.addSeries(lib.LineSeries,{title:series.symbol,color:palette[i%palette.length],lineWidth:2,lastValueVisible:true,priceLineVisible:false});
   line.setData(series.data);
  });
  chart.timeScale().fitContent();
  return {destroy:()=>chart.remove(),engine:'lightweight'};
 }catch(error){try{chart?.remove();}catch{}return null;}
}
