import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY,parseBackup,validateTransaction,book,portfolioXirr} from '../public/finance.js';
import {createPortfolioStorage,RECOVERY_KEY} from '../public/portfolio-storage.js';
const buy={id:'buy',date:'2025-01-01',symbol:'PETR4',side:'buy',qty:10,unitPrice:20,fx:1,fee:0};
test('backup válido fora de ordem preserva venda e compra e não valida prefixos incompletos',()=>{
 const sell={...buy,id:'sell',date:'2025-02-01',side:'sell',qty:4,unitPrice:30};
 const list=parseBackup(JSON.stringify({version:3,transactions:[sell,buy]}));
 assert.equal(book(list)[0].realizedBRL,40);
 assert.throws(()=>validateTransaction({...buy,symbol:'__proto__'}),/Ativo/);
 assert.throws(()=>book([{...buy,fx:2}]),/BRL/);
 assert.equal(portfolioXirr([buy],{complete:true,marketBRL:200},'2024-12-01'),null);
});
test('corrupção bloqueia gravação; restauração preserva bytes originais recuperáveis',()=>{
 const map=new Map([[KEY,'{corrupted']]);
 const store=createPortfolioStorage({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)});
 assert.throws(()=>store.load(),/inválido/);
 assert.throws(()=>store.save([buy]),/bloqueada/);
 assert.equal(map.get(KEY),'{corrupted');
 store.save([buy],{replaceDamaged:true});
 assert.equal(map.get(RECOVERY_KEY),'{corrupted');
 assert.equal(store.load().length,1);
});
test('quota impede substituir o documento atual; versão anterior fica disponível',()=>{
 const old=JSON.stringify({version:2,transactions:[buy]});
 const map=new Map([[KEY,old]]);
 const store=createPortfolioStorage({getItem:k=>map.get(k)??null,setItem:(k,v)=>{if(k===KEY)throw Error('quota');map.set(k,v);}});
 store.load();assert.throws(()=>store.save([]),/quota/);
 assert.equal(map.get(KEY),old);assert.equal(map.get(RECOVERY_KEY),old);
});
