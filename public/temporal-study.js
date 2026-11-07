/** Research harness only: signals at t, execution at next observed close. */
import {prepareRiskHistory} from './risk-analytics.js';
import {suggestPriceZones} from './price-zones.js';
export function evaluatePriceZones(series,{window=50,costBps=10,slippageBps=10}={}){
 const prepared=prepareRiskHistory(series),points=prepared.points;
 if(!Number.isInteger(window)||window<50||window>252||points.length<window+2)throw Error('Amostra temporal insuficiente');
 if(!Number.isFinite(costBps)||costBps<0||costBps>500||!Number.isFinite(slippageBps)||slippageBps<0||slippageBps>500)throw Error('Custos inválidos');
 const friction=(costBps+slippageBps)/10000;
 let cash=1,units=0;const trades=[],decisions=[];
 for(let i=window-1;i<points.length-1;i++){
  const training=points.slice(i-window+1,i+1);let zones;
  try{zones=suggestPriceZones({...series,points:training});}catch{continue;}
  const signal=units===0&&points[i].close<=zones.buy[1]?'buy':units>0&&points[i].close>=zones.sell[0]?'sell':'hold';
  decisions.push({signalDate:points[i].date,trainingEnd:training.at(-1).date,signal});
  const next=points[i+1];
  if(signal==='buy'){units=cash/(next.close*(1+friction));cash=0;trades.push({signalDate:points[i].date,executionDate:next.date,side:'buy',observedClose:next.close});}
  if(signal==='sell'){cash=units*next.close*(1-friction);units=0;trades.push({signalDate:points[i].date,executionDate:next.date,side:'sell',observedClose:next.close});}
 }
 const end=cash+units*points.at(-1).close*(1-friction);
 return {status:'educational_walk_forward',window,costBps,slippageBps,outOfSampleObservations:points.length-window,
  returnPct:(end-1)*100,buyAndHoldPriceReturnPct:(points.at(-1).close/points[window].close-1)*100,trades,decisions,
  survivorshipControlled:false,parameterOptimized:false,priceBasis:prepared.priceBasis,
  limitations:'Execução hipotética no próximo preço observado com custo proporcional fixo; fechamento pode não ser executável. Sem impostos, dividendos, volume, spread variável ou controle de sobrevivência do universo. Não valida lucratividade nem recomendação.'};
}
