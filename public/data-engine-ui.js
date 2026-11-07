/** A small data browser inside Integrations, preserving the v4 layout. */
import {importLocalEod,loadLocalEod,saveLocalEod,localEodInstruments,decodeLocalCsv,verifyLocalEodFiles,LOCAL_EOD_KEY} from './local-eod.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>typeof x==='number'?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8}).format(x):x??'—';
const metricNames={currentRatio:'Liquidez corrente',netMarginPct:'Margem líquida %',grossMarginPct:'Margem bruta %',liabilitiesToAssetsPct:'Passivo exigível / ativo %',roePct:'ROE anual com PL médio %'};
function download(text,name,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function get(path){const response=await fetch(path);const data=await response.json();if(!response.ok)throw Error(data.error||'Fonte indisponível');return data;}
const definitions={
 cvm:[['periodEnd','Competência'],['referenceDate','Filing de referência'],['exerciseOrder','Exercício na fonte'],['kind','DFP/ITR'],['scope','Consolidação'],['label','Conta oficial'],['valueBRL','Valor BRL'],['periodStart','Início da duração'],['filingVersion','Revisão'],['publishedAt','Divulgação']],
 macro:[['date','Referência'],['value','Taxa / índice'],['buy','PTAX compra'],['sell','PTAX venda']],
 funds:[['date','Referência'],['navBRL','Patrimônio líquido BRL'],['navPerUnitBRL','Cota contábil BRL'],['subscriptionsBRL','Captações BRL'],['redemptionsBRL','Resgates BRL'],['investors','Cotistas']],
 fii:[['referenceMonth','Mês'],['navBRL','Patrimônio líquido BRL'],['navPerUnitBRL','Cota patrimonial BRL'],['unitsIssued','Cotas emitidas'],['investors','Cotistas'],['filingVersion','Revisão']],
 treasury:[['date','Referência'],['buyRateAnnualPct','Taxa compra % a.a. / spread'],['sellRateAnnualPct','Taxa venda % a.a. / spread'],['buyPriceBRL','PU compra BRL'],['sellPriceBRL','PU venda BRL'],['basePriceBRL','PU base BRL']],
 sec:[['periodEnd','Competência'],['periodStart','Início'],['concept','Conta US-GAAP'],['value','Valor USD'],['form','Formulário'],['filed','Filing'],['accession','Accession']],
};
export function mountDataEngine(){
 if(!$('engine-query'))return;
 const homeStatus=$('home-engine-status'),homeOutput=$('home-insight-output'),homeMetrics=$('home-engine-coverage');
 const homeResults=$('home-insight-results');let insightRequest=0;
 const financialLabels=[['netMarginPct','Margem líquida','%'],['grossMarginPct','Margem bruta','%'],['currentRatio','Liquidez corrente','×'],['roePct','ROE anual','%'],['liabilitiesToAssetsPct','Passivo exigível / ativo','%']];
 const days=(a,b)=>Number.isFinite(Date.parse(a+'T00:00:00Z'))&&Number.isFinite(Date.parse(b+'T00:00:00Z'))?(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000:null;
 function annualSummary(doc){
  // Annual DFP only; no interpolation, no cross-filing quarter/YTD mixing.
  const eligible=(doc.indicators||[]).filter(x=>x.kind==='DFP'&&['con','ind'].includes(x.scope)&&x.periodStart&&x.periodEnd&&days(x.periodStart,x.periodEnd)>=330&&days(x.periodStart,x.periodEnd)<=380&&Number.isInteger(x.filingVersion));
  const scope=eligible.some(x=>x.scope==='con')?'con':'ind',byPeriod=new Map();
  for(const row of eligible.filter(x=>x.scope===scope)){
   const prior=byPeriod.get(row.periodEnd);if(!prior||row.filingVersion>prior.filingVersion)byPeriod.set(row.periodEnd,row);
  }
  const years=[...byPeriod.values()].sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
  return {latest:years.at(-1)||null,years:years.slice(-5),scope};
 }
 function homeNumber(x,suffix){return Number.isFinite(x)?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:1}).format(x)+suffix:'—';}
 function presentInsight(doc){
  const {latest,years,scope}=annualSummary(doc);const usable=latest?.status==='accounting_ratios';
  $('home-insight-name').textContent=doc.name||'Companhia';
  $('home-insight-period').textContent=latest?'DFP anual '+latest.periodEnd+' · '+(scope==='con'?'Consolidado':'Individual')+' · versão '+latest.filingVersion:'Sem DFP anual comparável neste recorte';
  homeMetrics.innerHTML=financialLabels.map(([key,label,suffix])=>'<div class="insight-metric"><span>'+esc(label)+'</span><strong>'+esc(homeNumber(usable?latest.metrics?.[key]:null,suffix))+'</strong></div>').join('');
  const trend=years.filter(x=>x.status==='accounting_ratios'&&Number.isFinite(x.metrics?.netMarginPct));
  $('home-insight-trend').innerHTML=trend.length>=2?'<h4>Histórico da margem líquida anual</h4><div class="insight-timeline">'+trend.map(x=>'<div class="insight-year"><span>'+esc(x.periodEnd)+'</span><strong>'+esc(homeNumber(x.metrics.netMarginPct,'%'))+'</strong></div>').join('')+'</div>':'<p class="micro-note">A evolução da margem exige pelo menos dois exercícios anuais comparáveis.</p>';
  $('home-insight-note').textContent=(latest?.status==='sector_specific_required'?'Instituição financeira: índices industriais não aplicáveis. ':latest?.status==='sector_unknown'?'Setor desconhecido: não atribuímos índices industriais. ':'Valores sem insumos suficientes permanecem indisponíveis. ')+
   'Origem: '+(doc.provider||'CVM')+'. Margens e ROE contábeis, não valuation; dividendos e preços não foram inferidos.';
  homeOutput.hidden=false;
 }
 async function openCompany(id){
  const token=++insightRequest;homeStatus.textContent='Calculando a partir das demonstrações CVM…';homeResults.hidden=true;
  try{
   const doc=await get('/api/data-engine/record?dataset=cvm&id='+encodeURIComponent(id));
   if(token!==insightRequest)return;
   if(!doc.integrity?.verified||doc.dataset!=='cvm'||doc.id!==id||!Array.isArray(doc.indicators))throw Error('Demonstrativo sem integridade ou indicadores validados.');
   presentInsight(doc);homeStatus.textContent='Indicadores com fonte e competência verificadas.';
  }catch(error){if(token!==insightRequest)return;homeOutput.hidden=true;homeStatus.textContent='Indicadores indisponíveis: '+error.message;}
 }
 $('home-insight-form')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const term=$('home-insight-search').value.trim();if(term.length<2){homeStatus.textContent='Informe pelo menos dois caracteres.';return;}
  const token=++insightRequest;homeResults.hidden=true;homeStatus.textContent='Pesquisando companhias…';
  try{
   const result=await get('/api/data-engine/catalog?dataset=cvm&q='+encodeURIComponent(term)+'&limit=8');
   if(token!==insightRequest)return;
   homeResults.replaceChildren();
   for(const item of result.items||[]){
    const button=document.createElement('button');button.type='button';button.className='button';button.textContent=item.name+' · '+(item.symbols||[]).join('/');button.dataset.insightId=item.id;
    homeResults.append(button);
   }
   homeResults.hidden=!homeResults.childElementCount;
   homeStatus.textContent=result.items?.length?'Selecione uma empresa para consultar os indicadores.':'Nenhuma companhia encontrada no recorte disponível.';
  }catch(error){if(token!==insightRequest)return;homeStatus.textContent='Pesquisa indisponível: '+error.message;}
 });
 homeResults?.addEventListener('click',event=>{const b=event.target.closest('[data-insight-id]');if(b)void openCompany(b.dataset.insightId);});
 document.querySelectorAll('[data-insight-company]').forEach(b=>b.addEventListener('click',()=>void openCompany(b.dataset.insightCompany)));
 void openCompany('33000167000101');
 let offset=0,current=null,catalogDataset='cvm',querySerial=0,detailSerial=0;
 function renderDocument(){
  if(!current)return;const fields=definitions[current.dataset]||[],year=$('engine-year').value,scope=$('engine-scope').value;
  const rows=current.observations.filter(r=>(!year||(r.values.date||r.values.periodEnd||'').startsWith(year))&&(!scope||r.values.scope===scope)).sort((a,b)=>(b.values.date||b.values.periodEnd||'').localeCompare(a.values.date||a.values.periodEnd||'')||b.revisionOrdinal-a.revisionOrdinal);
  $('engine-record-note').textContent=`${current.name} · ${current.id} · ${current.provider||''} · ${current.unit||current.currency||''}. ${current.priceBasis||''}. ${rows.length} registros no recorte; mostrando até 50. Revisões e linhas originais selecionadas estão no JSON completo.`;
  $('engine-record-data').innerHTML='<table><thead><tr>'+fields.map(([,name])=>'<th scope="col">'+esc(name)+'</th>').join('')+'<th scope="col">Correção observada</th></tr></thead><tbody>'+rows.slice(0,50).map(r=>'<tr>'+fields.map(([key])=>'<td>'+esc(fmt(r.values[key]))+'</td>').join('')+'<td>'+esc(r.revisionOrdinal||1)+'</td></tr>').join('')+'</tbody></table>';
  const indicators=(current.indicators||[]).filter(x=>(!year||x.periodEnd.startsWith(year))&&(!scope||x.scope===scope));
  $('engine-indicators').textContent=indicators.length?indicators.slice(-6).map(x=>x.kind+' '+x.periodStart+' → '+x.periodEnd+' '+x.scope+' rev.'+x.filingVersion+': '+(x.status!=='accounting_ratios'?'tratamento setorial necessário ou setor desconhecido; sem índices industriais.':Object.entries(x.metrics).map(([k,v])=>(metricNames[k]||k)+' = '+fmt(v)).join(' · '))).join('\n'):'';
  $('engine-license').textContent='Origem: '+(current.provider||'')+' · licença/política: '+(current.license||'não informada')+'. Não confundir cota contábil ou PU de referência com preço executável. '+(current.coverageNote||current.methodology||'');
 }
 async function query(reset=true){
  if(reset)offset=0;
  const request=++querySerial,dataset=$('engine-dataset').value,q=$('engine-search').value,pageOffset=offset;
  detailSerial++;current=null;$('engine-record').hidden=true;$('engine-catalog').replaceChildren();$('engine-next').disabled=true;
  $('engine-status').textContent='Consultando a base publicada…';
  try{
   const status=await get('/api/data-engine/status');if(status.status!=='available')throw Error('Data Engine ainda não publicado.');
   $('engine-status').textContent=`Data Engine ${status.engineVersion}: ${status.storage.instruments} instrumentos, ${status.storage.observations} registros identificados. Lote ${status.generatedAt}. As datas abaixo indicam a cobertura efetiva; lote novo não significa observação nova.`;
   const data=await get('/api/data-engine/catalog?dataset='+dataset+'&q='+encodeURIComponent(q)+'&limit=25&offset='+pageOffset);
   if(request!==querySerial)return;
   catalogDataset=dataset;
   $('engine-catalog').innerHTML=data.items?.length?'<table><thead><tr><th scope="col">Instrumento / identidade</th><th scope="col">Cobertura observada</th><th scope="col">Registros</th><th scope="col">Consulta</th></tr></thead><tbody>'+data.items.map(x=>'<tr><td>'+esc(x.name)+'<br><small>'+esc(x.id+' '+(x.symbols||[]).join('/'))+'</small></td><td>'+esc(x.first+' → '+x.last)+'</td><td>'+esc(x.observations)+'</td><td><button type="button" class="button" data-engine-id="'+esc(x.id)+'">Abrir</button></td></tr>').join('')+'</tbody></table>':'Sem cobertura nesse recorte. '+esc(data.sourceStatus?.status||'');
   $('engine-next').disabled=!data.hasNextPage;
   $('engine-blocked').textContent=Object.entries(status.blocked||{}).map(([key,value])=>key+': '+value.status+' — '+(value.reason||'')).join(' ');
  }catch(error){if(request===querySerial)$('engine-status').textContent='Dados indisponíveis: '+error.message;}
 }
 $('engine-query').addEventListener('submit',event=>{event.preventDefault();query();});
 $('engine-next').addEventListener('click',()=>{offset+=25;query(false);});
 $('engine-catalog').addEventListener('click',async event=>{
  const id=event.target.closest('[data-engine-id]')?.dataset.engineId;if(!id)return;
  const dataset=catalogDataset,request=++detailSerial;
  try{
   const document=await get('/api/data-engine/record?dataset='+dataset+'&id='+encodeURIComponent(id));
   if(request!==detailSerial||dataset!==catalogDataset)return;
   if(document.dataset!==dataset||!document.integrity?.verified||!Array.isArray(document.observations))throw Error('Registro sem identidade/integridade confirmada.');
   current=document;
   const years=[...new Set(current.observations.map(r=>(r.values.date||r.values.periodEnd||'').slice(0,4)))].sort().reverse();
   $('engine-year').innerHTML='<option value="">Todos</option>'+years.map(y=>'<option>'+esc(y)+'</option>').join('');
   $('engine-scope').value=current.dataset==='cvm'?'con':'';$('engine-scope').disabled=current.dataset!=='cvm';
   $('engine-record').hidden=false;renderDocument();
  }catch(error){if(request===detailSerial)$('engine-status').textContent='Registro indisponível: '+error.message;}
 });
 $('engine-year').addEventListener('change',renderDocument);$('engine-scope').addEventListener('change',renderDocument);
 $('engine-download').addEventListener('click',()=>{if(current)download(JSON.stringify(current,null,2),'vezori-'+current.dataset+'-'+current.id+'.json');});
 function localStatus(){
  try{const data=loadLocalEod(localStorage);$('local-eod-version').innerHTML='<option value="">Usar fontes públicas; preservar arquivos locais</option>'+data.files.map(f=>'<option value="'+f.fileSha256+'">'+esc(f.sourceName+' · '+f.rows.length+' registros · '+f.fileSha256.slice(0,10))+'</option>').join('');$('local-eod-version').value=data.activeHash||'';const instruments=localEodInstruments(localStorage);$('local-eod-instrument').innerHTML=instruments.map((x,i)=>'<option value="'+i+'">'+esc(x.market+':'+x.symbol+' · '+x.currency)+'</option>').join('');$('local-eod-open').disabled=!instruments.length;}
  catch(error){$('local-eod-status').textContent=error.message;}
 }
 $('local-eod-form').addEventListener('submit',async event=>{
  event.preventDefault();
  try{
   if(!$('local-eod-rights').checked)throw Error('Confirme a obtenção legítima para uso local.');
   const file=$('local-eod-file').files[0];if(!file)throw Error('Selecione um CSV.');if(file.size>1024*1024)throw Error('CSV limitado a 1 MiB.');
   const result=await importLocalEod(localStorage,decodeLocalCsv(await file.arrayBuffer()),$('local-eod-source').value);localStatus();window.dispatchEvent(new CustomEvent('vezori-local-eod-changed'));
   $('local-eod-status').textContent=result.observations+' registros privados importados. SHA-256 do CSV: '+result.fileSha256+'. O arquivo ativo será usado nas fichas/comparador/laboratório para ativos e moedas compatíveis; cotações da carteira não foram substituídas.';
  }catch(error){$('local-eod-status').textContent=error.message;}
 });
 $('local-eod-version').addEventListener('change',()=>{try{const data=loadLocalEod(localStorage);data.activeHash=$('local-eod-version').value||null;saveLocalEod(localStorage,data);window.dispatchEvent(new CustomEvent('vezori-local-eod-changed'));$('local-eod-status').textContent='Seleção local atualizada; arquivos anteriores preservados.';}catch(error){$('local-eod-status').textContent=error.message;}});
 $('local-eod-template').addEventListener('click',()=>download('date,market,symbol,currency,close,adjustment\r\n','vezori-eod-modelo.csv','text/csv'));
 $('local-eod-open').addEventListener('click',()=>{try{const meta=localEodInstruments(localStorage)[Number($('local-eod-instrument').value)];if(meta)window.dispatchEvent(new CustomEvent('vezori-open-local-eod',{detail:meta}));}catch(error){$('local-eod-status').textContent=error.message;}});
 $('local-eod-export').addEventListener('click',()=>download(localStorage.getItem(LOCAL_EOD_KEY)||'','vezori-eod-local-original.json'));
 $('local-eod-restore').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file||file.size>5*1024*1024)throw Error('Backup ausente ou maior que 5 MiB.');const data=await verifyLocalEodFiles(JSON.parse(await file.text()));saveLocalEod(localStorage,data);localStatus();window.dispatchEvent(new CustomEvent('vezori-local-eod-changed'));$('local-eod-status').textContent='Backup local validado e restaurado; bytes anteriores preservados na cópia de recuperação.';}catch(error){$('local-eod-status').textContent=error.message;}});
 localStatus();
}
