/** Private user-file history. No upload, public licence inference, quote substitution or interpolation. */
import {validDate} from './finance.js';
export const LOCAL_EOD_KEY='vezori-local-eod-v1';
function csv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!field||quoted)quoted=!quoted;else throw Error('Aspas CSV inválidas.');}
  else if(ch===','&&!quoted){row.push(field);field='';}
  else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}
  else field+=ch;
 }
 if(quoted)throw Error('CSV possui aspas sem fechamento.');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function parseLocalEod(text,{sourceName,asOf=new Date().toISOString().slice(0,10)}={}){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>1024*1024)throw Error('CSV local limitado a 1 MiB.');
 if(!sourceName?.trim()||sourceName.length>80)throw Error('Informe a origem legítima do arquivo (até 80 caracteres).');
 const table=csv(text.replace(/^\uFEFF/,'')),header=table.shift()?.map(x=>x.trim());
 const required=['date','market','symbol','currency','close','adjustment'];
 if(!header||new Set(header).size!==header.length||required.some(k=>!header.includes(k)))throw Error('Colunas obrigatórias: '+required.join(',')+'.');
 if(table.length<2||table.length>10000)throw Error('Importe de 2 a 10.000 registros.');
 const points=new Map(),bases=new Map();
 for(const line of table){
  if(line.length!==header.length)throw Error('Quantidade de colunas inconsistente.');
  const raw=Object.fromEntries(header.map((k,i)=>[k,line[i].trim()]));
  const date=raw.date,market=raw.market.toUpperCase(),symbol=raw.symbol.toUpperCase(),currency=raw.currency.toUpperCase(),adjustment=raw.adjustment;
  if(!validDate(date)||date>asOf||!['BR','US','CRYPTO'].includes(market)||!/^[A-Z0-9][A-Z0-9._-]{1,14}$/.test(symbol)||!/^[A-Z]{3}$/.test(currency)||!['raw','split_adjusted'].includes(adjustment))throw Error('Data, identidade, moeda ou ajuste inválido. Use raw ou split_adjusted; índices de retorno total não são preços EOD.');
  if(!/^(?:\d+\.?\d*|\.\d+)$/.test(raw.close)||!Number.isFinite(Number(raw.close))||Number(raw.close)<=0)throw Error('Fechamento deve ser positivo, com ponto decimal e sem separador de milhar.');
  const instrument=market+':'+symbol;
  if(bases.has(instrument)&&bases.get(instrument)!==currency+':'+adjustment)throw Error('Não misture moedas ou ajustes do mesmo ativo.');
  bases.set(instrument,currency+':'+adjustment);
  const key=instrument+':'+date,point={date,market,symbol,currency,close:Number(raw.close),adjustment};
  if(points.has(key)&&points.get(key).close!==point.close)throw Error('Fechamentos conflitantes na mesma data.');
  points.set(key,point);
 }
 return {sourceName:sourceName.trim(),rows:[...points.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.symbol.localeCompare(b.symbol)),policy:'local_only',originalCsv:text};
}
export function loadLocalEod(storage){
 const raw=storage.getItem(LOCAL_EOD_KEY);if(!raw)return {version:1,files:[],activeHash:null};
 let data;try{data=JSON.parse(raw);}catch{throw Error('Arquivo EOD local corrompido; exporte o original antes de restaurar.');}
 if(data.version!==1||!Array.isArray(data.files)||data.files.length>4)throw Error('Contrato EOD local inválido.');
 for(const file of data.files){
  if(!/^[a-f0-9]{64}$/.test(file.fileSha256))throw Error('Identificador EOD local inválido.');
  const parsed=parseLocalEod(file.originalCsv,{sourceName:file.sourceName});
  if(JSON.stringify(parsed.rows)!==JSON.stringify(file.rows))throw Error('Conteúdo EOD local divergente do CSV original.');
 }
 if(data.activeHash!==null&&!data.files.some(f=>f.fileSha256===data.activeHash))throw Error('Versão EOD ativa ausente.');
 return data;
}
export function saveLocalEod(storage,data){
 const serialized=JSON.stringify(data);
 loadLocalEod({getItem:()=>serialized});
 const prior=storage.getItem(LOCAL_EOD_KEY);
 if(prior!==null)storage.setItem(LOCAL_EOD_KEY+'-recovery',prior);
 storage.setItem(LOCAL_EOD_KEY,serialized);
}
export function localEodInstruments(storage){
 const data=loadLocalEod(storage),file=data.files.find(f=>f.fileSha256===data.activeHash);
 if(!file)return [];
 const result=new Map();for(const row of file.rows)result.set(row.market+':'+row.symbol,{symbol:row.symbol,market:row.market,currency:row.currency,name:row.symbol+' · identidade declarada em arquivo privado'});
 return [...result.values()];
}
export async function importLocalEod(storage,text,sourceName){
 const file=parseLocalEod(text,{sourceName}),fileSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const data=loadLocalEod(storage);
 if(!data.files.some(f=>f.fileSha256===fileSha256))data.files.push({...file,fileSha256,importedAt:new Date().toISOString()});
 data.activeHash=fileSha256;saveLocalEod(storage,data);return {fileSha256,observations:file.rows.length};
}
export function localEodHistory(storage,{market,symbol,currency,range='max',asOf=new Date().toISOString().slice(0,10)}){
 const data=loadLocalEod(storage),file=data.files.find(f=>f.fileSha256===data.activeHash);
 if(!file)return null;
 let rows=file.rows.filter(r=>r.market===market&&r.symbol===symbol);
 if(!rows.length)return null;
 if(rows.some(r=>r.currency!==currency))throw Error('Moeda do arquivo local diverge da identidade do ativo.');
 const months={'1mo':1,'3mo':3,'6mo':6,'1y':12,'2y':24,'5y':60,'10y':120};
 if(range!=='max'){
  if(!months[range])throw Error('Período EOD inválido.');
  const cutoff=new Date(asOf+'T00:00:00Z');cutoff.setUTCMonth(cutoff.getUTCMonth()-months[range]);rows=rows.filter(r=>r.date>=cutoff.toISOString().slice(0,10));
 }
 if(rows.length<2)throw Error('Arquivo local ativo sem duas observações nesse período; escolha Máximo disponível ou outro arquivo.');
 return {symbol,market,currency,interval:'1d',range,provider:'Arquivo local — '+file.sourceName,priceBasis:'user_declared_'+rows[0].adjustment,points:rows.map(({date,close})=>({date,close})),coverage:{completeSinceListing:false,actualFirst:rows[0].date,actualLast:rows.at(-1).date,reason:'Importação privada; ajustes declarados pelo usuário, sem reconciliação de eventos corporativos. Não é fonte pública nem garantia de fechamento oficial.'},localOnly:true,fileSha256:file.fileSha256};
}
