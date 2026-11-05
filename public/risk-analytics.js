/** VEZORI — historical risk research using provider prices only.
 * Not a portfolio backtest. Not total return. Never fabricates missing closes.
 */
export const RISK_MIN_RETURNS_VOL=30;
export const RISK_MIN_RETURNS_SHARPE=60;

const validDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
};
const finitePrice=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const businessDays=(market)=>market==='CRYPTO'?365:252;
const differenceDays=(first,last)=>(Date.parse(last+'T00:00:00Z')-Date.parse(first+'T00:00:00Z'))/86400000;
const rounded=(n)=>Number(n.toFixed(8));

/** Reject duplicates with conflicting closes; keep chronology without interpolating gaps. */
export function prepareRiskHistory(series){
 if(!series||!['BR','US','CRYPTO'].includes(series.market)||series.interval!=='1d'||!Array.isArray(series.points))throw Error('Série diária de mercado não reconhecida');
 if(!/^[A-Z]{3}$/.test(series.currency||''))throw Error('Moeda não identificada');
 if(series.points.length<2||series.points.length>1000)throw Error('Histórico insuficiente ou excessivo');
 const unique=new Map();
 for(const point of series.points){
  if(!validDate(point?.date)||!finitePrice(point?.close))throw Error('Preço ou data inválidos no histórico');
  if(unique.has(point.date)&&Math.abs(unique.get(point.date)-point.close)>1e-8)throw Error('Fechamentos conflitantes para a mesma data');
  unique.set(point.date,point.close);
 }
 const points=[...unique].sort(([a],[b])=>a.localeCompare(b)).map(([date,close])=>({date,close}));
 if(points.length<2)throw Error('Histórico com menos de duas datas distintas');
 // A long outage means we cannot treat one price change as a daily observation.
 for(let i=1;i<points.length;i++){
  const elapsed=differenceDays(points[i-1].date,points[i].date);
  if(elapsed<1||elapsed>(series.market==='CRYPTO'?2:8))throw Error('Intervalo entre observações incompatível com retorno diário; série incompleta');
 }
 return {points,market:series.market,currency:series.currency,provider:String(series.provider||'Fonte não identificada'),priceBasis:String(series.priceBasis||'Base de preços não identificada')};
}

function sampleStdev(values){
 if(values.length<2)return null;
 const mean=values.reduce((sum,v)=>sum+v,0)/values.length;
 const variance=values.reduce((sum,v)=>sum+(v-mean)**2,0)/(values.length-1);
 return Math.sqrt(Math.max(variance,0));
}

/** Risk measured from price-only daily returns; annualized volatility is an estimate. */
export function analyzeAssetRisk(series,{riskFreeAnnualPct=null}={}){
 const prepared=prepareRiskHistory(series);
 const {points,market}=prepared;
 const daily=[];
 let peak=points[0].close,maxDrawdownPct=0;
 for(let i=1;i<points.length;i++){
  const v=points[i].close,previous=points[i-1].close;
  daily.push(v/previous-1);
  peak=Math.max(peak,v);
  maxDrawdownPct=Math.max(maxDrawdownPct,(peak-v)/peak*100);
 }
 const count=daily.length,sessionsPerYear=businessDays(market);
 const stdev=sampleStdev(daily);
 const volatilityAnnualPct=count>=RISK_MIN_RETURNS_VOL&&stdev!==null?rounded(stdev*Math.sqrt(sessionsPerYear)*100):null;
 const returnPct=rounded((points.at(-1).close/points[0].close-1)*100);
 let sharpeAnnual=null;
 if(riskFreeAnnualPct!==null){
  const riskFree=Number(riskFreeAnnualPct);
  if(!Number.isFinite(riskFree)||riskFree<=-100||riskFree>100)throw Error('Taxa livre de risco inválida');
  // The caller must ensure the benchmark and price series are in the same currency.
  if(count>=RISK_MIN_RETURNS_SHARPE&&stdev!==null&&stdev>1e-12){
   const mean=daily.reduce((a,b)=>a+b,0)/count,rfDaily=(1+riskFree/100)**(1/sessionsPerYear)-1;
   sharpeAnnual=rounded((mean-rfDaily)/stdev*Math.sqrt(sessionsPerYear));
  }
 }
 return {
  status:'observed_price_risk',symbol:series.symbol,market,currency:prepared.currency,
  provider:prepared.provider,priceBasis:prepared.priceBasis,
  firstDate:points[0].date,lastDate:points.at(-1).date,observations:points.length,returnObservations:count,
  observationSessionsPerYear:sessionsPerYear,returnPct,maxDrawdownPct:rounded(maxDrawdownPct),volatilityAnnualPct,
  sharpeAnnual,sharpeRiskFreeAnnualPct:riskFreeAnnualPct,
  notes:[
   'Medidas somente de preços, sem dividendos, impostos, taxas e inflação.',
   'Volatilidade: desvio-padrão amostral dos retornos entre fechamentos × raiz de '+sessionsPerYear+' sessões por ano.',
   'Drawdown máximo: maior queda observada de um pico anterior para um fechamento dentro do período.',
   volatilityAnnualPct===null?'Volatilidade anualizada indisponível: exige pelo menos '+RISK_MIN_RETURNS_VOL+' retornos diários.':'Volatilidade anualizada é uma extrapolação estatística, não previsão.',
   sharpeAnnual===null?'Sharpe não calculado: requer taxa livre de risco explícita na mesma moeda, pelo menos '+RISK_MIN_RETURNS_SHARPE+' retornos e volatilidade positiva.':'Sharpe anualizado por taxa livre de risco explícita na moeda da série.'
  ]
 };
}
