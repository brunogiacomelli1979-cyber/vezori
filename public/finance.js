/** VEZORI finance engine. No manufactured prices, no short sales, no assumptions of tax basis. */
import {ASSETS} from './asset-registry.js';
export {ASSETS} from './asset-registry.js';
export const KEY='vezori-portfolio-v3';
export const STRATEGIES=[
 {title:'Indexação Global',by:'Inspirada em John Bogle',desc:'Disciplina, diversificação global e baixo custo. A alocação é didática, não uma carteira oficial.',allocation:[['Ações amplas',70],['Renda fixa',30]],review:'Anual'},
 {title:'Qualidade & Valor',by:'Inspirada em Warren Buffett',desc:'Negócios duráveis, retorno sobre capital, caixa e preço disciplinado. Composição ilustrativa.',allocation:[['Ações selecionadas',80],['Liquidez',20]],review:'Anual'},
 {title:'All Weather Didático',by:'Inspirada em Ray Dalio',desc:'Diferentes cenários econômicos com ações, títulos, ouro e commodities. Não reproduz a Bridgewater.',allocation:[['Ações',30],['Títulos',55],['Ouro',7.5],['Commodities',7.5]],review:'Semestral'},
 {title:'Value Quantitativo',by:'Inspirada em Benjamin Graham',desc:'Filtros de valor, solvência, margem de segurança e diversificação de empresas.',allocation:[['Ações filtradas',65],['Renda fixa',35]],review:'Semestral'},
 {title:'Multiclasse Global',by:'Modelo educacional VEZORI',desc:'Estudo de diversificação incluindo uma alocação pequena e arriscada em criptoativos.',allocation:[['Ações/ETFs',40],['Renda fixa',45],['Ouro',10],['Cripto',5]],review:'Semestral'}
];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const finitePositive=n=>finite(n)&&n>0;
export const round=(n,d=2)=>Math.round((n+Number.EPSILON)*10**d)/10**d;
export function validDate(date){
 if(typeof date!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(date))return false;
 const d=new Date(date+'T12:00:00.000Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date;
}
function transactionFields(tx){
 if(!tx||!Object.hasOwn(ASSETS,tx.symbol))throw Error('Ativo não suportado.');
 if(!['buy','sell','income'].includes(tx.side))throw Error('Tipo de operação inválido.');
 if(!validDate(tx.date))throw Error('Data inválida.');
 if(!/^[a-zA-Z0-9_-]{1,60}$/.test(String(tx.id||'')))throw Error('Identificador inválido.');
 const qty=Number(tx.qty),unitPrice=Number(tx.unitPrice),fx=Number(tx.fx),fee=Number(tx.fee??0);
 if(!finitePositive(unitPrice)||!finitePositive(fx)||!finite(fee)||fee<0)throw Error('Preço, câmbio e taxas devem ser válidos.');
 if(tx.side!=='income'&&!finitePositive(qty))throw Error('Quantidade deve ser positiva.');
 if(tx.side==='income'&&qty!==0)throw Error('Proventos não utilizam quantidade.');
 if(tx.side==='income'&&fee>=unitPrice)throw Error('Taxa não pode ser maior que o provento.');
 if(tx.side==='sell'&&fee>=qty*unitPrice)throw Error('Taxa não pode consumir toda a venda.');
 if(ASSETS[tx.symbol].currency==='BRL'&&Math.abs(fx-1)>1e-9)throw Error('Câmbio BRL deve ser 1.');
 const safe={id:String(tx.id),date:tx.date,symbol:tx.symbol,side:tx.side,qty,unitPrice,fx,fee};
 return safe;
}
export function validateTransaction(tx,existing=[]){
 const safe=transactionFields(tx);
 if(existing.some(t=>t.id===safe.id))throw Error('Operação duplicada.');
 book([...existing,safe]);return safe;
}
export function book(txs){
 if(!Array.isArray(txs)||txs.length>20000)throw Error('Histórico excede o limite permitido.');
 const positions=Object.create(null);
 for(const tx of txs)transactionFields(tx);
 const ordered=txs.map((tx,i)=>({tx,i})).sort((a,b)=>a.tx.date.localeCompare(b.tx.date)||a.i-b.i);
 for(const {tx} of ordered){
  if(!ASSETS[tx.symbol]||!validDate(tx.date)||!['buy','sell','income'].includes(tx.side))throw Error('Transação inválida.');
  const qty=Number(tx.qty),price=Number(tx.unitPrice),fx=Number(tx.fx),fee=Number(tx.fee??0);
  if(!finitePositive(price)||!finitePositive(fx)||!finite(fee)||fee<0||(tx.side==='income'?qty!==0:!finitePositive(qty)))throw Error('Transação inválida.');
  const p=positions[tx.symbol]??{symbol:tx.symbol,qty:0,costBRL:0,realizedBRL:0,incomeBRL:0};
  if(tx.side==='buy'){
   p.qty+=qty;p.costBRL+=(qty*price+fee)*fx;
  }else if(tx.side==='sell'){
   if(qty>p.qty+1e-8)throw Error('Venda excede a posição em '+tx.symbol);
   if(fee>=qty*price)throw Error('Taxa de venda inválida.');
   const avg=p.qty>0?p.costBRL/p.qty:0;
   p.costBRL-=avg*qty;p.qty-=qty;p.realizedBRL+=(qty*price-fee)*fx-avg*qty;
   if(p.qty<1e-8){p.qty=0;p.costBRL=0;}
  }else{
   if(fee>=price)throw Error('Taxa do provento inválida.');
   p.incomeBRL+=(price-fee)*fx;
  }
  if(![p.qty,p.costBRL,p.realizedBRL,p.incomeBRL].every(Number.isFinite))throw Error('Operação excede a precisão numérica suportada.');
  positions[tx.symbol]=p;
 }
 return Object.values(positions);
}
/** Portfolio mark-to-market uses provider quotes and current FX; historical acquisition FX comes from transactions. */
export function portfolio(txs,quotes=[],fx=[]){
 const states=book(txs),positions=states.filter(p=>p.qty>1e-8);
 const quoteMap=new Map(quotes.map(q=>[q.symbol,q]));
 const fxMap=new Map(fx.map(row=>[row.pair,Number(row.rate)]));
 let marketBRL=0,costBRL=0,knownCostBRL=0,unrealizedBRL=0;
 const rows=positions.map(p=>{
  const currency=ASSETS[p.symbol].currency,q=quoteMap.get(p.symbol),rate=currency==='BRL'?1:fxMap.get(currency+'/BRL');
  const valid=!!q&&(q.market==null||q.market===ASSETS[p.symbol].market)&&q.currency===currency&&finitePositive(Number(q.price))&&finitePositive(rate);
  const value=valid?p.qty*Number(q.price)*rate:null;
  costBRL+=p.costBRL;
  if(valid){marketBRL+=value;knownCostBRL+=p.costBRL;unrealizedBRL+=value-p.costBRL;}
  return {...p,currency,marketBRL:value,quoteAvailable:valid,price:valid?Number(q.price):null,fxRate:valid?rate:null,priceAsOf:q?.providerAsOf||null};
 });
 const realizedBRL=states.reduce((s,p)=>s+p.realizedBRL,0);
 const incomeBRL=states.reduce((s,p)=>s+p.incomeBRL,0);
 return {rows,marketBRL,costBRL,knownCostBRL,unrealizedBRL,realizedBRL,incomeBRL,complete:rows.every(row=>row.quoteAvailable),coverage:rows.filter(row=>row.quoteAvailable).length,total:rows.length};
}
/** XIRR (money-weighted return). Cashflows must include final market value; no root => null. */
export function xirr(flows){
 if(!Array.isArray(flows)||flows.length<2||flows.some(f=>!validDate(f.date)||!finite(Number(f.amount))))return null;
 const sorted=[...flows].sort((a,b)=>a.date.localeCompare(b.date));
 const amounts=sorted.map(x=>Number(x.amount));
 if(!amounts.some(v=>v>0)||!amounts.some(v=>v<0))return null;
 const t0=Date.parse(sorted[0].date+'T00:00:00Z');
 const years=sorted.map(x=>(Date.parse(x.date+'T00:00:00Z')-t0)/86400000/365.25);
 if(Math.max(...years)<1/365.25)return null;
 const npv=r=>amounts.reduce((sum,amount,i)=>sum+amount/Math.pow(1+r,years[i]),0);
 let low=-0.9999,high=10,fLow=npv(low),fHigh=npv(high);
 for(let k=0;k<20&&Math.sign(fLow)===Math.sign(fHigh);k++){high=high*2+1;fHigh=npv(high);}
 if(!finite(fLow)||!finite(fHigh)||Math.sign(fLow)===Math.sign(fHigh))return null;
 for(let k=0;k<160;k++){
  const mid=(low+high)/2,f=npv(mid);
  if(!finite(f))return null;
  if(Math.abs(f)<1e-7||high-low<1e-12)return mid;
  if(Math.sign(f)===Math.sign(fLow)){low=mid;fLow=f;}else{high=mid;fHigh=f;}
 }
 return (low+high)/2;
}
export function portfolioXirr(txs,summary,asOf=new Date().toISOString().slice(0,10)){
 if(!txs.length||!summary.complete||!validDate(asOf)||txs.some(t=>t.date>asOf))return null;
 const flows=txs.map(t=>{
  const fx=Number(t.fx),fee=Number(t.fee??0);
  const amount=t.side==='income'?(Number(t.unitPrice)-fee)*fx:(t.side==='buy'?-1:1)*(Number(t.qty)*Number(t.unitPrice)+(t.side==='buy'?fee:-fee))*fx;
  return {date:t.date,amount};
 });
 if(summary.marketBRL>0)flows.push({date:asOf,amount:summary.marketBRL});
 return xirr(flows);
}
export function project(initial,monthly,annualRate,years){
 if(![initial,monthly,annualRate,years].every(finite)||initial<0||monthly<0||annualRate<=-1||annualRate>20||!Number.isInteger(years)||years<1||years>40)throw Error('Parâmetros de simulação inválidos.');
 let amount=initial,contributions=initial;const monthlyRate=Math.pow(1+annualRate,1/12)-1;const values=[];
 for(let n=1;n<=years*12;n++){amount=amount*(1+monthlyRate)+monthly;contributions+=monthly;if(!Number.isFinite(amount)||!Number.isFinite(contributions))throw Error('Projeção excede o limite numérico.');if(n%12===0)values.push({year:n/12,amount,contributions});}
 return values;
}
export function parseBackup(text){
 const obj=JSON.parse(text);
 if(!obj||![2,3].includes(obj.version)||!Array.isArray(obj.transactions)||obj.transactions.length>20000)throw Error('Backup inválido.');
 const checked=obj.transactions.map(tx=>transactionFields({...tx,fee:tx?.fee??0}));
 if(new Set(checked.map(t=>t.id)).size!==checked.length)throw Error('Operação duplicada.');
 book(checked);
 return checked;
}
