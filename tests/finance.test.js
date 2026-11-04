import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTransaction,book,portfolio,portfolioXirr,xirr,project,parseBackup,validDate} from '../public/finance.js';
const buy={id:'b1',date:'2026-01-05',side:'buy',symbol:'PETR4',qty:10,unitPrice:20,fx:1,fee:0};
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
test('compra e venda: custo médio e ganho realizados reais',()=>{
 const sell={...buy,id:'s1',date:'2026-02-05',side:'sell',qty:4,unitPrice:25};
 const arr=[validateTransaction(buy),validateTransaction(sell,[buy])];
 const p=book(arr)[0];assert.equal(p.qty,6);assert.equal(p.costBRL,120);assert.equal(p.realizedBRL,20);
 const m=portfolio(arr,[{symbol:'PETR4',price:30,currency:'BRL'}],[]);
 assert.equal(m.marketBRL,180);assert.equal(m.unrealizedBRL,60);assert.equal(m.complete,true);
});
test('taxas em compras e vendas são contabilizadas corretamente',()=>{
 const a=validateTransaction({...buy,fee:10});
 const b=validateTransaction({...buy,id:'s2',date:'2026-07-01',side:'sell',qty:2,unitPrice:30,fee:3},[a]);
 const p=book([a,b])[0];near(p.costBRL,168);near(p.realizedBRL,15);assert.equal(p.qty,8);
});
test('proventos: contabiliza sem alterar custo das posições',()=>{
 const a=validateTransaction(buy),d=validateTransaction({...buy,id:'d1',side:'income',date:'2026-05-01',qty:0,unitPrice:24,fee:1},[a]);
 const p=book([a,d])[0];assert.equal(p.qty,10);assert.equal(p.costBRL,200);assert.equal(p.incomeBRL,23);
});
test('impede venda descoberta e taxa inválida',()=>{
 assert.throws(()=>validateTransaction({...buy,side:'sell'}),/Venda excede/);
 assert.throws(()=>validateTransaction({...buy,fee:-1}),/taxas/);
 assert.throws(()=>validateTransaction({...buy,side:'income',qty:1}),/não utilizam quantidade/);
});
test('USD: compra usa câmbio histórico, marcação usa taxa atual',()=>{
 const tx=validateTransaction({...buy,id:'usd',symbol:'VOO',qty:2,unitPrice:100,fx:5});
 const p=portfolio([tx],[{symbol:'VOO',price:120,currency:'USD'}],[{pair:'USD/BRL',rate:6}]);
 assert.equal(p.costBRL,1000);assert.equal(p.marketBRL,1440);assert.equal(p.unrealizedBRL,440);
});
test('sem cotação ou câmbio de um ativo, cobertura incompleta sem valor inventado',()=>{
 const p=portfolio([buy],[],[]);assert.equal(p.complete,false);assert.equal(p.rows[0].marketBRL,null);assert.equal(portfolioXirr([buy],p),null);
});
test('XIRR: retorno zero para mesmo valor um ano depois',()=>{
 const result=xirr([{date:'2025-01-01',amount:-1000},{date:'2026-01-01',amount:1000}]);near(result,0);
});
test('XIRR inclui valor de mercado terminal e proventos',()=>{
 const tx=validateTransaction({...buy,date:'2025-01-01',qty:10,unitPrice:100});
 const m=portfolio([tx],[{symbol:'PETR4',price:110,currency:'BRL'}],[]);
 const result=portfolioXirr([tx],m,'2026-01-01');assert.ok(result>.09&&result<.12);
});
test('importação v2 e v3, integridade, duplicados e datas impossíveis',()=>{
 assert.equal(parseBackup(JSON.stringify({version:2,transactions:[{...buy,fee:undefined}]}))[0].fee,0);
 assert.equal(parseBackup(JSON.stringify({version:3,transactions:[buy]})).length,1);
 assert.throws(()=>parseBackup(JSON.stringify({version:3,transactions:[buy,buy]})),/duplicada/);
 assert.equal(validDate('2026-02-30'),false);
 assert.throws(()=>validateTransaction({...buy,date:'2026-02-30'}),/Data inválida/);
});
test('simulação: taxa zero soma exatamente contribuições',()=>{
 const a=project(10000,300,0,10).at(-1);near(a.amount,46000,1e-5);near(a.contributions,46000,1e-5);
 assert.throws(()=>project(1,300,-1.5,10),/inválidos/);
});
