import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSECAnnualFacts} from '../src/sec-fundamentals.js';
const fact=(val,end='2026-09-26',filed='2026-11-03',start='2025-09-28')=>
 ({val,end,filed,start,form:'10-K',fp:'FY',accn:'0000320193-26-000026'});
const fixture={cik:320193,entityName:'Apple Inc.',facts:{'us-gaap':{
 RevenueFromContractWithCustomerExcludingAssessedTax:{units:{USD:[fact(400),fact(330,'2025-09-27','2025-11-03','2024-09-29')]}},
 NetIncomeLoss:{units:{USD:[fact(100)]}},
 Assets:{units:{USD:[fact(700)]}},
 Liabilities:{units:{USD:[fact(400)]}},
 StockholdersEquity:{units:{USD:[fact(300),fact(250,'2025-09-27','2026-11-03','2024-09-29')]}},
}}};
test('SEC derives ratios only from same fiscal year and validated annual periods',()=>{
 const result=extractSECAnnualFacts(fixture);
 assert.equal(result.status,'available');
 assert.equal(result.metrics.revenue.value,400);
 assert.equal(result.metrics.netMarginPct.value,25);
 assert.ok(Math.abs(result.metrics.roePct.value-100/275*100)<1e-8);
 assert.equal(result.periodEnd,'2026-09-26');
 assert.equal(result.metrics.revenue.accession,'0000320193-26-000026');
});
test('SEC does not invent ROE if prior annual equity is absent',()=>{
 const doc=structuredClone(fixture);
 doc.facts['us-gaap'].StockholdersEquity.units.USD=[fact(300)];
 const x=extractSECAnnualFacts(doc);
 assert.equal(x.metrics.roePct,null);
});
test('SEC skips quarter/YTD facts and mismatched fiscal dates',()=>{
 const doc=structuredClone(fixture);
 doc.facts['us-gaap'].NetIncomeLoss.units.USD=[{...fact(999),form:'10-Q'},{...fact(10),end:'2026-03-28'}];
 const x=extractSECAnnualFacts(doc);
 assert.equal(x.metrics.netIncome,null);
 assert.equal(x.metrics.netMarginPct,null);
});
test('SEC handles absent revenue and rejects wrong issuer',()=>{
 const doc=structuredClone(fixture);
 delete doc.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax;
 assert.equal(extractSECAnnualFacts(doc).status,'insufficient');
 assert.throws(()=>extractSECAnnualFacts({...fixture,cik:123}),/CIK/);
});

test('SEC rejects mismatched filing, duration and quarterly prior equity',()=>{
 const doc=structuredClone(fixture);
 doc.facts['us-gaap'].NetIncomeLoss.units.USD=[{...fact(100),start:'2025-10-15'}];
 doc.facts['us-gaap'].StockholdersEquity.units.USD=[fact(300),fact(250,'2026-06-27')];
 let r=extractSECAnnualFacts(doc);assert.equal(r.metrics.netMarginPct,null);assert.equal(r.metrics.roePct,null);
 doc.facts['us-gaap'].NetIncomeLoss.units.USD=[{...fact(100),accn:'different-revision'}];
 r=extractSECAnnualFacts(doc);assert.equal(r.metrics.netIncome,null);
});

test('SEC seleciona exercício mais recente entre conceitos alternativos de receita',()=>{
 const doc=structuredClone(fixture);
 doc.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD=[fact(330,'2025-09-27','2025-11-03','2024-09-29')];
 doc.facts['us-gaap'].Revenues={units:{USD:[fact(400)]}};
 assert.equal(extractSECAnnualFacts(doc).periodEnd,'2026-09-26');
});
