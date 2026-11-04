// VEZORI — Abertura centrada no catálogo. Sem preço, histórico ou patrimônio simulados.

import {ASSETS} from './finance.js';

function homeEsc(value){
 return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function homeMoney(value,unit='BRL'){
 if(typeof value!=='number'||!Number.isFinite(value))return '—';
 return new Intl.NumberFormat('pt-BR',{style:'currency',currency:unit,maximumFractionDigits:2}).format(value);
}

function homePct(value){
 if(typeof value!=='number'||!Number.isFinite(value))return '—';
 return `${value>0?'+':''}${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value)}%`;
}

function homeWhen(s){
 if(!s)return 'Horário não fornecido';
 const date=new Date(s);
 return Number.isFinite(date.getTime())?date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):String(s).slice(0,24);
}

export function homeCatalog(data={},opts={}){
 const {search='',market='all',sort='symbol'}=opts;
 const quoteMap=new Map((data.quotes||[]).filter(q=>q&&Number.isFinite(q.price)&&q.price>0).map(q=>[q.symbol,q]));
 const q=String(search).trim().toLocaleLowerCase('pt-BR');
 const entries=Object.entries(ASSETS)
  .map(([symbol,asset])=>({symbol,name:asset.name,market:asset.market,currency:asset.currency,quote:quoteMap.get(symbol)?.currency===asset.currency?quoteMap.get(symbol):null}))
  .filter(x=>(market==='all'||x.market===market)&&(!q||(x.symbol+' '+x.name).toLocaleLowerCase('pt-BR').includes(q)));
 const alpha=(a,b)=>a.symbol.localeCompare(b.symbol);
 if(sort==='name')entries.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||alpha(a,b));
 else if(sort==='up')entries.sort((a,b)=>(b.quote?.changePct??-Infinity)-(a.quote?.changePct??-Infinity)||alpha(a,b));
 else if(sort==='down')entries.sort((a,b)=>(a.quote?.changePct??Infinity)-(b.quote?.changePct??Infinity)||alpha(a,b));
 else entries.sort(alpha);
 return entries;
}

export function createMarketHome({state,navigate,selectAsset}){
 const id=name=>document.getElementById(name);
 const labels={BR:'Ações brasileiras',US:'Ações e ETFs internacionais',CRYPTO:'Criptomoedas'};
 const explanations={BR:'Bolsa brasileira · preços em reais',US:'Mercado norte-americano · preços em dólares',CRYPTO:'Criptoativos · preços em reais'};
 const order=['BR','US','CRYPTO'];
 let filter='all',query='',sort='symbol';
 function marketIndicator(label,item,renderValue,fallback){
  return `<div class="home-indicator"><span>${homeEsc(label)}</span><strong>${item?homeEsc(renderValue(item)):'—'}</strong><small>${item?homeEsc(`${item.provider} · ${item.date||'data não informada'}`):fallback}</small></div>`;
 }
 function renderIndicators(){
  const d=state.data;
  const fx=d?.fx||[],macro=d?.macro||[];
  const usd=fx.find(x=>x.pair==='USD/BRL'&&x.rate>0);
  const eur=fx.find(x=>x.pair==='EUR/BRL'&&x.rate>0);
  const selic=macro.find(x=>x.code==='SELIC_META'&&Number.isFinite(Number(x.value)));
  id('home-indicators').innerHTML=
   marketIndicator('Dólar / real',usd,x=>homeMoney(x.rate),'Câmbio indisponível')+
   marketIndicator('Euro / real',eur,x=>homeMoney(x.rate),'Câmbio indisponível')+
   marketIndicator('Meta Selic',selic,x=>`${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(x.value))}% a.a.`,'Indicador indisponível');
 }
 function renderRow(row){
  const q=row.quote,p=q?homeMoney(q.price,q.currency):'—';
  const change=q?homePct(q.changePct):'—';
  const trend=!q||q.changePct==null?'neutral':q.changePct>0?'positive':q.changePct<0?'negative':'neutral';
  const status=q?`${q.provider} · ${homeWhen(q.providerAsOf)}`:!state.data?'Aguardando fonte de mercado…':
    row.market==='US'&&state.data.availability?.twelvedata==='key_required'?'Sem cotação · requer chave do fornecedor':'Sem cotação na consulta atual';
  return `<button type="button" class="home-asset-row" data-home-asset="${homeEsc(row.symbol)}" aria-label="Abrir análise de ${homeEsc(row.name)}, ${homeEsc(row.symbol)}">
   <span class="home-row-identity"><span class="home-row-symbol">${homeEsc(row.symbol)}</span><span class="home-row-company">${homeEsc(row.name)}</span></span>
   <span class="home-row-price">${homeEsc(p)}</span>
   <span class="home-row-change ${trend}">${homeEsc(change)}</span>
   <span class="home-row-source">${homeEsc(status)}</span>
   <span class="home-row-arrow" aria-hidden="true">→</span>
  </button>`;
 }
 function renderGroups(rows){
  if(!rows.length){
   id('home-groups').innerHTML=`<div class="home-empty"><strong>Nenhum ativo encontrado.</strong><p>Tente outro nome ou selecione “Todos” para voltar ao catálogo disponível.</p><button type="button" data-home-reset>Limpar filtros</button></div>`;
   return;
  }
  id('home-groups').innerHTML=order.map(market=>{
   const items=rows.filter(x=>x.market===market);
   if(!items.length)return '';
   const covered=items.filter(x=>x.quote).length;
   return `<section class="home-market-group" aria-label="${homeEsc(labels[market])}">
    <div class="home-group-head"><div><h3>${homeEsc(labels[market])}</h3><p>${homeEsc(explanations[market])}</p></div>
    <span class="home-group-count">${covered}/${items.length} com cotação</span></div>
    <div class="home-table-labels" aria-hidden="true"><span>Ativo</span><span>Último preço</span><span>Variação</span><span>Fonte / referência</span><span></span></div>
    <div class="home-market-rows">${items.map(renderRow).join('')}</div>
   </section>`;
  }).join('');
 }
 function render(){
  const data=state.data;
  const all=homeCatalog(data,{search:query,market:filter,sort});
  const coverage=all.filter(item=>item.quote).length;
  const total=Object.keys(ASSETS).length;
  id('home-catalog-total').textContent=`${all.length} de ${total} ativos catalogados`;
  id('home-status').textContent=data?`${(data.quotes||[]).length} ativos com preço real · ${coverage} neste filtro`:'Carregando cotações reais…';
  id('home-updated').textContent=data?`Última consulta: ${homeWhen(data.generatedAt)}`:'Aguardando atualização das APIs';
  id('home-search').value=query;
  id('home-sort').value=sort;
  id('home-filters').querySelectorAll('[data-home-filter]').forEach(b=>{
   const active=b.dataset.homeFilter===filter;
   b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
  renderIndicators();
  renderGroups(all);
 }
 function setSearch(value){
  query=String(value??'').slice(0,64);
  render();
 }
 function reset(){filter='all';query='';sort='symbol';render();}
 function mount(){
  id('home-search').addEventListener('input',e=>setSearch(e.target.value));
  id('home-filters').addEventListener('click',e=>{
   const b=e.target.closest('[data-home-filter]');if(!b)return;
   filter=b.dataset.homeFilter;render();
  });
  id('home-sort').addEventListener('change',e=>{sort=e.target.value;render();});
  id('home-groups').addEventListener('click',e=>{
   const asset=e.target.closest('[data-home-asset]');
   if(asset){selectAsset(asset.dataset.homeAsset);return;}
   if(e.target.closest('[data-home-reset]'))reset();
  });
  document.querySelector('[data-home-advanced]')?.addEventListener('click',()=>navigate('market'));
  render();
 }
 return {mount,render,setSearch,reset};
}
