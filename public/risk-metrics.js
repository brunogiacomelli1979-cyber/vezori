/** Explicit price-return metrics. No fill, forecast, or implicit risk-free rate. */
import {prepareRiskHistory} from './risk-analytics.js';
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const variance=a=>a.reduce((s,x)=>s+(x-avg(a))**2,0)/(a.length-1);
const returns=points=>points.slice(1).map((p,i)=>p.close/points[i].close-1);
export function analyzeExtendedRisk(series,{targetAnnualPct=null,targetCurrency=null}={}){
 const p=prepareRiskHistory(series),r=returns(p.points),n=r.length,N=p.market==='CRYPTO'?365:252;
 const elapsed=(Date.parse(p.points.at(-1).date)-Date.parse(p.points[0].date))/86400000;
 const cagr=elapsed>=365?(p.points.at(-1).close/p.points[0].close)**(365.25/elapsed)-1:null;
 let peak=p.points[0].close,drawdown=0;
 for(const point of p.points){peak=Math.max(peak,point.close);drawdown=Math.max(drawdown,1-point.close/peak);}
 let sortino=null;
 if(targetAnnualPct!==null){
  if(targetCurrency!==p.currency||!Number.isFinite(targetAnnualPct)||targetAnnualPct<=-100||targetAnnualPct>100)throw Error('Meta explícita válida e moeda coincidente são necessárias');
  const target=(1+targetAnnualPct/100)**(1/N)-1,excess=r.map(x=>x-target);
  const downside=Math.sqrt(excess.reduce((s,x)=>s+Math.min(x,0)**2,0)/n);
  if(n>=60&&downside>1e-12)sortino=avg(excess)/downside*Math.sqrt(N);
 }
 let var95=null,cvar95=null;
 if(n>=100){
  const ordered=[...r].sort((a,b)=>a-b),at=(n-1)*.05,lo=Math.floor(at);
  const cutoff=ordered[lo]+(ordered[Math.ceil(at)]-ordered[lo])*(at-lo);
  const tail=ordered.filter(x=>x<=cutoff);
  var95=Math.max(0,-cutoff)*100;cvar95=Math.max(0,-avg(tail))*100;
 }
 return {currency:p.currency,firstDate:p.points[0].date,lastDate:p.points.at(-1).date,returnObservations:n,
  annualizedPriceReturnPct:cagr===null?null:cagr*100,calmar:cagr===null||drawdown<=1e-12?null:cagr/drawdown,
  sortino,sortinoTargetAnnualPct:targetAnnualPct,historicalVaR95DailyPct:var95,historicalCVaR95DailyPct:cvar95,
  method:'Retornos simples de preço; CAGR por dias civis (mínimo 365); Sortino exige meta explícita e 60 retornos; VaR/CVaR empíricos de 1 dia a 95%, quantil linear, mínimo 100 retornos. Perdas expressas como magnitude positiva; zero se a cauda só contém ganhos.'};
}
export function analyzeBenchmarkRisk(asset,benchmark){
 const a=prepareRiskHistory(asset),b=prepareRiskHistory(benchmark);
 if(a.market!==b.market||a.currency!==b.currency||a.priceBasis!==b.priceBasis)throw Error('Benchmark exige mesmo mercado, moeda e base de ajustes');
 if(a.points.length!==b.points.length||a.points.some((p,i)=>p.date!==b.points[i].date))throw Error('Datas devem coincidir integralmente; não preencher lacunas');
 const ra=returns(a.points),rb=returns(b.points);if(ra.length<30)throw Error('Exige 30 retornos coincidentes');
 const ma=avg(ra),mb=avg(rb),v=variance(rb),active=ra.map((x,i)=>x-rb[i]),tracking=Math.sqrt(variance(active));
 const N=a.market==='CRYPTO'?365:252;
 return {beta:v>1e-20?ra.reduce((s,x,i)=>s+(x-ma)*(rb[i]-mb),0)/(ra.length-1)/v:null,
  trackingErrorAnnualPct:tracking*Math.sqrt(N)*100,informationRatio:tracking>1e-12?avg(active)/tracking*Math.sqrt(N):null,
  currency:a.currency,returnObservations:ra.length,benchmark:benchmark.symbol};
}
