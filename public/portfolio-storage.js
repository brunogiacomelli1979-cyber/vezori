/** Local-only persistence. A failed write never commits application state. */
import {KEY,parseBackup} from './finance.js';
export const RECOVERY_KEY=KEY+'-recovery';
export function createPortfolioStorage(storage){
 let damaged=false;
 return {
  load(){
   const raw=storage.getItem(KEY)??storage.getItem('investimentos-local-v2');
   try{const transactions=raw?parseBackup(raw):[];damaged=false;return transactions;}
   catch{damaged=true;throw Error('Histórico local inválido. Exporte o original e importe um backup validado; gravações estão bloqueadas.');}
  },
  raw(){return storage.getItem(KEY)??storage.getItem('investimentos-local-v2')??'';},
  recovery(){return storage.getItem(RECOVERY_KEY);},
  save(transactions,{replaceDamaged=false}={}){
   if(damaged&&!replaceDamaged)throw Error('Gravação bloqueada: restaure um backup validado antes de registrar operações.');
   const serialized=JSON.stringify({version:3,brand:'VEZORI',savedAt:new Date().toISOString(),transactions});
   parseBackup(serialized);
   const prior=storage.getItem(KEY)??storage.getItem('investimentos-local-v2');
   // Preserve the exact previous bytes, including a corrupt document, before replacement.
   if(prior!==null)storage.setItem(RECOVERY_KEY,prior);
   storage.setItem(KEY,serialized);
   damaged=false;
  }
 };
}
