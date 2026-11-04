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
 const entries=new Map(Object.entries(ASSETS).map(([symbol,meta])=>[symbol,{symbol,name:meta.name,market:meta.market,currency:meta.currency,category:'',quote:quoteMap.get(symbol)?.currency===meta.currency?quoteMap.get(symbol):null}]));
 for(const raw of data.catalog||[]){
  if(!raw||!/^[A-Z0-9]{3,12}$/.test(raw.symbol||'')||raw.market!=='BR'||raw.currency!=='BRL')continue;
  const quote=Number.isFinite(raw.price)&&raw.price>0?{symbol:raw.symbol,currency:'BRL',price:raw.price,changePct:Number.isFinite(raw.changePct)?raw.changePct:null,
   provider:raw.provider||'brapi',providerAsOf:raw.providerAsOf||null,retrievedAt:raw.retrievedAt||null}:null;
  const prior=entries.get(raw.symbol);
  if(prior){if(!prior.quote&&quote)prior.quote=quote;prior.category=raw.category||'';}
  else entries.set(raw.symbol,{symbol:raw.symbol,name:String(raw.name||raw.symbol).slice(0,90),market:'BR',currency:'BRL',category:raw.category||'',quote});
 }
 const q=String(search).trim().toLocaleLowerCase('pt-BR');
 const rows=[...entries.values()].filter(x=>(market==='all'||x.market===market)&&(!q||(x.symbol+' '+x.name).toLocaleLowerCase('pt-BR').includes(q)));
 const alpha=(a,b)=>a.symbol.localeCompare(b.symbol);
 if(sort==='name')rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||alpha(a,b));
 else if(sort==='up')rows.sort((a,b)=>(b.quote?.changePct??-Infinity)-(a.quote?.changePct??-Infinity)||alpha(a,b));
 else if(sort==='down')rows.sort((a,b)=>(a.quote?.changePct??Infinity)-(b.quote?.changePct??Infinity)||alpha(a,b));
 else rows.sort(alpha);
 return rows;
}

export function createMarketHome({state,navigate,selectAsset,getJson,registerCatalog}){
 const id=name=>document.getElementById(name);
 const labels={BR:'Ativos da B3',US:'Ações e ETFs internacionais',CRYPTO:'Criptomoedas'};
 const descriptions={BR:'Ações, fundos imobiliários, ETFs e BDRs · preços em reais',US:'Mercado norte-americano · preços em dólares',CRYPTO:'Criptoativos · preços em reais'};
 const labelSubtype={fii:'FII',etf:'ETF',bdr:'BDR',stock:'Ação',unit:'Unit'};
 const order=['BR','US','CRYPTO'];
 let filter='all',query='',sort='symbol',shownBrazil=24;
 let catalog=[],page=0,hasMore=false,catalogTotal=null,loading=false,notice='',timer=null,sequence=0;
 function box(label,item,formatter,emptyText){
  return `<div class="home-indicator"><span>${homeEsc(label)}</span><strong>${item?homeEsc(formatter(item)):'—'}</strong><small>${item?homeEsc(`${item.provider} · ${item.date||'data não informada'}`):emptyText}</small></div>`;
 }
 function renderIndicators(){
  const d=state.data,fx=d?.fx||[],macro=d?.macro||[];
  const usd=fx.find(x=>x.pair==='USD/BRL'&&x.rate>0),eur=fx.find(x=>x.pair==='EUR/BRL'&&x.rate>0);
  const selic=macro.find(x=>x.code==='SELIC_META'&&Number.isFinite(Number(x.value)));
  id('home-indicators').innerHTML=box('Dólar / real',usd,x=>homeMoney(x.rate),'Câmbio indisponível')+
   box('Euro / real',eur,x=>homeMoney(x.rate),'Câmbio indisponível')+
   box('Meta Selic',selic,x=>`${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(x.value))}% a.a.`,'Indicador indisponível');
 }
 function renderRow(row){
  const q=row.quote,p=q?homeMoney(q.price,q.currency):'—',change=q?homePct(q.changePct):'—';
  const trend=!q||q.changePct==null?'neutral':q.changePct>0?'positive':q.changePct<0?'negative':'neutral';
  const status=q?`${q.provider} · ${q.providerAsOf?homeWhen(q.providerAsOf):q.retrievedAt?'consultado em '+homeWhen(q.retrievedAt)+' (hora do preço não informada)':'hora do preço não informada'}`:
   !state.data?'Consultando fonte…':row.market==='US'&&state.data.availability?.twelvedata==='key_required'?'Sem cotação · integração necessária':'Sem cotação nesta consulta';
  const subtype=labelSubtype[row.category]||'';
  return `<button type="button" class="home-asset-row" data-home-asset="${homeEsc(row.symbol)}" aria-label="Abrir análise de ${homeEsc(row.name)}, ${homeEsc(row.symbol)}">
   <span class="home-row-identity"><span class="home-row-symbol">${homeEsc(row.symbol)}${subtype?`<em class="home-kind">${homeEsc(subtype)}</em>`:''}</span><span class="home-row-company">${homeEsc(row.name)}</span></span>
   <span class="home-row-price">${homeEsc(p)}</span><span class="home-row-change ${trend}">${homeEsc(change)}</span>
   <span class="home-row-source">${homeEsc(status)}</span><span class="home-row-arrow" aria-hidden="true">→</span>
  </button>`;
 }
 function renderGroups(rows){
  if(!rows.length){id('home-groups').innerHTML=`<div class="home-empty"><strong>Nenhum ativo encontrado.</strong><p>Experimente outro nome ou retire os filtros. A busca na B3 também consulta a fonte pública.</p><button type="button" data-home-reset>Limpar filtros</button></div>`;return;}
  id('home-groups').innerHTML=order.map(market=>{
   const all=rows.filter(x=>x.market===market);if(!all.length)return '';
   const items=market==='BR'?all.slice(0,shownBrazil):all,covered=items.filter(x=>x.quote).length;
   const more=market==='BR'&&(shownBrazil<all.length||hasMore)&&!loading;
   return `<section class="home-market-group" aria-label="${homeEsc(labels[market])}">
    <div class="home-group-head"><div><h3>${homeEsc(labels[market])}</h3><p>${homeEsc(descriptions[market])}</p></div>
    <span class="home-group-count">${covered}/${items.length} exibidos com cotação</span></div>
    <div class="home-table-labels" aria-hidden="true"><span>Ativo</span><span>Último preço</span><span>Variação</span><span>Fonte / referência</span><span></span></div>
    <div class="home-market-rows">${items.map(renderRow).join('')}</div>
    ${more?`<div class="home-more-bar"><button type="button" data-home-more>Ver mais ativos da B3 <span aria-hidden="true">↓</span></button></div>`:''}
   </section>`;
  }).join('');
 }
 function render(){
  const data={...(state.data||{}),catalog};
  const all=homeCatalog(data,{search:query,market:filter,sort});
  const covered=all.filter(x=>x.quote).length;
  id('home-catalog-total').textContent=`${all.length} encontrados · ${catalog.length} listados pela B3 nesta pesquisa${catalogTotal!=null?' · '+catalogTotal+' na fonte':''}`;
  id('home-status').textContent=loading?`Ampliando catálogo da B3…`:state.data?`${covered} preços disponíveis no filtro`:'Carregando cotações reais…';
  id('home-updated').textContent=notice|| (state.data?`Última consulta: ${homeWhen(state.data.generatedAt)}`:'Aguardando atualização das APIs');
  id('home-search').value=query;id('home-sort').value=sort;
  id('home-filters').querySelectorAll('[data-home-filter]').forEach(b=>{const active=b.dataset.homeFilter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  renderIndicators();renderGroups(all);
 }
 async function loadCatalog(reset=false){
  const seq=++sequence,requestedQuery=query.trim();
  const next=reset?1:page+1;
  loading=true;notice='';render();
  try{
   const result=await getJson('/api/catalog?limit=50&page='+next+'&search='+encodeURIComponent(requestedQuery));
   if(seq!==sequence||requestedQuery!==query.trim())return;
   if(result.mode!=='real_market_catalog'||!Array.isArray(result.items))throw Error('Contrato de catálogo inválido');
   catalog=reset?result.items:[...catalog,...result.items.filter(x=>!catalog.some(y=>y.symbol===x.symbol))];
   state.catalog=catalog;
   page=next;hasMore=result.hasNextPage===true;catalogTotal=result.totalCount;
   registerCatalog?.(catalog);
  }catch(err){
   if(seq!==sequence)return;
   notice='Listagem ampla indisponível: exibindo o catálogo local. '+String(err.message||'Falha de fornecedor').slice(0,90);
  }finally{if(seq===sequence){loading=false;render();}}
 }
 function setSearch(value){
  query=String(value??'').slice(0,64);
  catalog=[];state.catalog=[];page=0;catalogTotal=null;hasMore=false;shownBrazil=24;
  if(timer!==null)clearTimeout(timer);
  sequence++;
  render();
  timer=setTimeout(()=>{loadCatalog(true);},400);
 }
 async function loadMore(){
  const matched=homeCatalog({...(state.data||{}),catalog},{search:query,market:filter,sort}).filter(x=>x.market==='BR');
  shownBrazil+=24;
  if(shownBrazil>=matched.length&&hasMore&&!loading)await loadCatalog(false);
  else render();
 }
 function reset(){
  filter='all';sort='symbol';query='';shownBrazil=24;catalog=[];state.catalog=[];
  if(timer!==null)clearTimeout(timer);sequence++;render();loadCatalog(true);
 }
 function mount(){
  id('home-search').addEventListener('input',e=>setSearch(e.target.value));
  id('home-filters').addEventListener('click',e=>{const b=e.target.closest('[data-home-filter]');if(!b)return;filter=b.dataset.homeFilter;shownBrazil=24;render();});
  id('home-sort').addEventListener('change',e=>{sort=e.target.value;render();});
  id('home-groups').addEventListener('click',e=>{
   const asset=e.target.closest('[data-home-asset]');
   if(asset){selectAsset(asset.dataset.homeAsset);return;}
   if(e.target.closest('[data-home-reset]')){reset();return;}
   if(e.target.closest('[data-home-more]'))loadMore();
  });
  document.querySelector('[data-home-advanced]')?.addEventListener('click',()=>navigate('market'));
  render();loadCatalog(true);
 }
 return {mount,render,setSearch,reset};
}
