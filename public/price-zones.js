/** VEZORI — faixas históricas indicativas, não ordens de negociação.
 * Usa apenas fechamentos reais; não extrapola níveis sem amostra mínima.
 */
const finite=p=>typeof p==='number'&&Number.isFinite(p)&&p>0;
const round=n=>Number(n.toFixed(6));
export function suggestPriceZones(series){
 if(!series||!['BR','US','CRYPTO'].includes(series.market)||series.interval!=='1d'||!Array.isArray(series.points))throw Error('Série diária verificável necessária');
 if(!/^[A-Z]{3}$/.test(series.currency||''))throw Error('Moeda da série inválida');
 const dated=new Map();
 for(const p of series.points){
  if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!finite(p.close))throw Error('Histórico contém datas ou preços inválidos');
  if(dated.has(p.date)&&dated.get(p.date)!==p.close)throw Error('Fechamentos conflitantes na mesma data');
  dated.set(p.date,p.close);
 }
 const pts=[...dated].sort((a,b)=>a[0].localeCompare(b[0]));
 if(pts.length<50)throw Error('Exige pelo menos 50 fechamentos válidos para níveis indicativos');
 for(let i=1;i<pts.length;i++){
  const days=(Date.parse(pts[i][0]+'T00:00:00Z')-Date.parse(pts[i-1][0]+'T00:00:00Z'))/86400000;
  if(days<1||(series.market==='CRYPTO'?days>3:days>8))throw Error('Histórico possui lacunas incompatíveis com análise diária');
 }
 const values=pts.map(x=>x[1]),last=values.at(-1);
 const returns=values.slice(1).map((x,i)=>Math.log(x/values[i]));
 const mu=returns.reduce((a,b)=>a+b,0)/returns.length;
 const sigma=Math.sqrt(returns.reduce((a,b)=>a+(b-mu)**2,0)/(returns.length-1));
 if(!(sigma>0))throw Error('Variação histórica insuficiente para estimar faixas');
 const percentile=(arr,p)=>{
  const sorted=[...arr].sort((a,b)=>a-b),at=(sorted.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo);
 };
 const rolling=values.slice(-50);
 const sma20=values.slice(-20).reduce((a,b)=>a+b,0)/20;
 const sma50=rolling.reduce((a,b)=>a+b,0)/50;
 const support=percentile(rolling,0.2),resistance=percentile(rolling,0.8);
 // Volatilidade observada: desvio dos log-retornos; faixas nunca superam/ignoram o último fechamento.
 const buffer=last*(Math.exp(sigma*Math.sqrt(5))-1);
 const buyLow=Math.min(support,last-buffer),buyHigh=Math.min(last,support+buffer/2);
 const sellLow=Math.max(last,resistance-buffer/2),sellHigh=Math.max(resistance,last+buffer);
 const stop=buyLow-buffer;
 if(![buyLow,buyHigh,sellLow,sellHigh,stop].every(finite)||buyLow>buyHigh||sellLow>sellHigh)throw Error('Níveis inválidos na amostra');
 const reward=sellLow-buyHigh,risk=buyHigh-stop;
 return {
  status:'indicative_historical_zones',symbol:series.symbol,market:series.market,currency:series.currency,
  provider:String(series.provider||'Não identificado'),priceBasis:String(series.priceBasis||'Não identificada'),
  firstDate:pts[0][0],lastDate:pts.at(-1)[0],observations:pts.length,referenceClose:round(last),
  buy:[round(buyLow),round(buyHigh)],sell:[round(sellLow),round(sellHigh)],riskLimit:round(stop),
  sma20:round(sma20),sma50:round(sma50),dailyLogVolatility:round(sigma),supportP20:round(support),
  resistanceP80:round(resistance),rewardRiskRatio:risk>0?round(Math.max(0,reward)/risk):null,
  methodology:'Quantis 20/80 de 50 fechamentos; médias de 20/50 sessões; amplitude por volatilidade logarítmica amostral em 5 sessões.',
  disclaimer:'Zonas retrospectivas indicativas, não previsão nem recomendação. Não incluem proventos, custos, tributos, câmbio, liquidez ou fundamentos. Não são níveis validados por backtest fora da amostra.'
 };
}
