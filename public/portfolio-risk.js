/** VEZORI — study-only historical basket, NOT an investable portfolio backtest.
 * Computes a fixed-weight rebalanced DAILY return index only when real closes are aligned.
 * No filling of dates, implied FX, corporate action assumptions or price forecasts.
 */
import {prepareRiskHistory,analyzeAssetRisk,RISK_MIN_RETURNS_VOL} from './risk-analytics.js';

const dailyGap=(a,b)=>(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000;
const cleanSymbol=x=>typeof x==='string'&&/^[A-Z0-9.]{2,12}$/.test(x);

/** Pearson correlation of aligned daily percentage returns. null = zero variance. */
export function returnCorrelation(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.length<2||[...a,...b].some(v=>!Number.isFinite(v)))throw Error('Retornos para correlação não comparáveis');
 const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;
 let cross=0,aa=0,bb=0;
 for(let i=0;i<a.length;i++){const da=a[i]-ma,db=b[i]-mb;cross+=da*db;aa+=da*da;bb+=db*db;}
 return aa<=1e-20||bb<=1e-20?null:Math.max(-1,Math.min(1,cross/Math.sqrt(aa*bb)));
}

/** Each input {symbol, weight, series} is an actual sourced daily close series. */
export function analyzeHistoricalBasket(selection){
 if(!Array.isArray(selection)||selection.length<2||selection.length>5)throw Error('A cesta histórica exige entre dois e cinco ativos reais selecionados');
 const seen=new Set();
 const prepared=selection.map(item=>{
  const symbol=item?.symbol,weight=Number(item?.weight);
  if(!cleanSymbol(symbol)||seen.has(symbol))throw Error('Cesta com ativo duplicado ou identificação inválida');
  if(!Number.isFinite(weight)||weight<=0||weight>100)throw Error('Peso histórico inválido');
  if(item.series?.symbol!==symbol)throw Error('Ticker da série não corresponde ao ativo selecionado');
  seen.add(symbol);
  return {symbol,weight,...prepareRiskHistory(item.series)};
 });
 const markets=new Set(prepared.map(s=>s.market)),currencies=new Set(prepared.map(s=>s.currency));
 const bases=new Set(prepared.map(s=>s.priceBasis));
 if(currencies.size!==1)throw Error('Moedas diferentes: converter as séries com câmbio histórico licenciado antes de calcular uma cesta');
 if(markets.size!==1)throw Error('Calendários diferentes: não combinar bolsa e cripto ou bolsas distintas sem alinhamento de sessões');
 if(bases.size!==1)throw Error('Bases de preços distintas: não é seguro comparar ajustes de fontes diferentes');
 const market=prepared[0].market,currency=prepared[0].currency,priceBasis=prepared[0].priceBasis;
 const indexMaps=prepared.map(s=>new Map(s.points.map(p=>[p.date,p.close])));
 const common=prepared[0].points.map(p=>p.date).filter(d=>indexMaps.every(m=>m.has(d))).sort();
 if(common.length<RISK_MIN_RETURNS_VOL+1)throw Error('Cesta exige pelo menos '+(RISK_MIN_RETURNS_VOL+1)+' datas de fechamento coincidentes');
 // A missing observation inside the overlap would otherwise turn a multi-day change into a daily return.
 const start=common[0],end=common.at(-1),intersection=new Set(common);
 for(const item of prepared)for(const point of item.points){
  if(point.date>=start&&point.date<=end&&!intersection.has(point.date))throw Error('Série com fechamento ausente entre datas coincidentes; não preencher lacunas');
 }
 for(let i=1;i<common.length;i++){
  const gap=dailyGap(common[i-1],common[i]);
  if(gap<1||(market==='CRYPTO'?gap!==1:gap>8))throw Error('Calendário de datas coincidentes contém lacuna incompatível com análise diária');
 }
 const totalSelectedWeight=prepared.reduce((s,r)=>s+r.weight,0);
 if(!Number.isFinite(totalSelectedWeight)||totalSelectedWeight>100.001)throw Error('Soma dos pesos selecionados excede 100%');
 const normalized=prepared.map(x=>x.weight/totalSelectedWeight),dailyReturns=prepared.map(()=>[]);
 const synthetic=[{date:common[0],close:100}];
 for(let i=1;i<common.length;i++){
  let r=0;
  for(let j=0;j<prepared.length;j++){
   const m=indexMaps[j],ret=m.get(common[i])/m.get(common[i-1])-1;
   dailyReturns[j].push(ret);
   r+=normalized[j]*ret;
  }
  const price=synthetic.at(-1).close*(1+r);
  if(!Number.isFinite(price)||price<=0)throw Error('Índice histórico sintético numericamente inválido');
  synthetic.push({date:common[i],close:price});
 }
 const stats=analyzeAssetRisk({symbol:'CESTA',market,currency,interval:'1d',provider:'Índice sintético VEZORI · fontes observadas',priceBasis,points:synthetic});
 const correlations=[];
 for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
  correlations.push({a:prepared[i].symbol,b:prepared[j].symbol,coefficient:returnCorrelation(dailyReturns[i],dailyReturns[j])});
 }
 return {
  status:'historical_fixed_weight_study',market,currency,priceBasis,from:common[0],to:common.at(-1),
  observations:common.length,returnObservations:common.length-1,initialIndex:100,
  selectedOriginalWeightPct:totalSelectedWeight,
  weights:prepared.map((row,i)=>({symbol:row.symbol,originalWeightPct:row.weight,normalizedWeightPct:normalized[i]*100,provider:row.provider})),
  returnPct:stats.returnPct,maxDrawdownPct:stats.maxDrawdownPct,volatilityAnnualPct:stats.volatilityAnnualPct,
  correlations,
  methodology:'Índice fictício base 100 calculado exclusivamente de retornos de preços observados, com pesos normalizados e rebalanceamento diário matemático, sem custos.',
  limitations:'Não reproduz compras reais, pesos dinâmicos, impostos, dividendos, inflação, câmbio, eventos corporativos nem rentabilidade total. Volatilidade extrapolada da amostra.'
 };
}
