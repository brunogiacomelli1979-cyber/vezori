/** VEZORI / SEC companyfacts — US-GAAP facts with provenance.
 * Only accepted annual 10-K facts; no valuation multiples inferred from incomplete data.
 */
export const SEC_COMPANIES=Object.freeze({AAPL:{cik:'0000320193',name:'Apple Inc.'}});
const annualDays=(a,b)=>{
 const start=Date.parse(a),end=Date.parse(b);
 return Number.isFinite(start)&&Number.isFinite(end)?(end-start)/86400000:null;
};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s));
function annualCandidates(doc,concepts,unit,periodEnd=null,duration=false){
 const facts=doc?.facts?.['us-gaap'];
 if(!facts)return [];
 for(const concept of concepts){
  const source=facts[concept]?.units?.[unit]||[];
  const candidates=source.filter(x=>{
   if(!x||x.form!=='10-K'||x.fp!=='FY'||!validDate(x.end)||!validDate(x.filed)||
    typeof x.val!=='number'||!Number.isFinite(x.val)||!x.accn)return false;
   if(periodEnd&&x.end!==periodEnd)return false;
   if(duration){const days=annualDays(x.start,x.end);if(days===null||days<330||days>380)return false;}
   return true;
  }).sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed));
  if(candidates.length)return candidates.map(x=>({...x,concept}));
 }
 return [];
}
function metric(item,unit){
 if(!item)return null;
 return {value:item.val,unit,concept:item.concept,periodEnd:item.end,periodStart:item.start||null,filed:item.filed,accession:item.accn,form:item.form};
}
/** Calculate margin and ROE only when the underlying facts and fiscal periods match. */
export function extractSECAnnualFacts(document,symbol='AAPL'){
 const company=SEC_COMPANIES[symbol];
 if(!company||!document||typeof document!=='object')throw Error('Empresa ou documento SEC não reconhecido');
 if(String(document.cik)!==String(Number(company.cik)))throw Error('CIK divergente');
 const revenueTags=['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'];
 const revenues=annualCandidates(document,revenueTags,'USD',null,true);
 const latest=revenues[0];
 if(!latest)return {status:'insufficient',symbol,cik:company.cik,companyName:document.entityName||company.name,
  source:'SEC companyfacts',metrics:{},message:'Nenhuma receita anual padronizada de 10-K disponível nesta taxonomia.'};
 const end=latest.end, rev=metric(latest,'USD');
 const income=metric(annualCandidates(document,['NetIncomeLoss'],'USD',end,true)[0],'USD');
 const assets=metric(annualCandidates(document,['Assets'],'USD',end)[0],'USD');
 const liabilities=metric(annualCandidates(document,['Liabilities'],'USD',end)[0],'USD');
 const equity=metric(annualCandidates(document,['StockholdersEquity'],'USD',end)[0],'USD');
 const oldEquity=annualCandidates(document,['StockholdersEquity'],'USD',null,false)
  .filter(x=>x.end<end).sort((a,b)=>b.end.localeCompare(a.end)||b.filed.localeCompare(a.filed))[0];
 const avgEquity=equity&&oldEquity&&(equity.value+oldEquity.val)/2>0?(equity.value+oldEquity.val)/2:null;
 const margin=income&&rev.value>0?income.value/rev.value*100:null;
 const roe=income&&avgEquity?income.value/avgEquity*100:null;
 return {status:'available',symbol,cik:company.cik,companyName:document.entityName||company.name,
  currency:'USD',periodEnd:end,source:'SEC companyfacts',sourceUrl:`https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`,
  methodology:'Receita e lucro anuais 10-K de duração 330–380 dias; balanço ao encerramento; margem líquida = lucro/receita; ROE só com patrimônio líquido médio de dois encerramentos.',
  metrics:{revenue:rev,netIncome:income,assets,liabilities,equity,
   netMarginPct:margin==null?null:{value:margin,unit:'%',periodEnd:end,derivedFrom:['revenue','netIncome']},
   roePct:roe==null?null:{value:roe,unit:'%',periodEnd:end,derivedFrom:['netIncome','equity corrente e anterior']}}
 };
}
