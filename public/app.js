import {ASSETS,KEY,STRATEGIES,validateTransaction,book,portfolio,portfolioXirr,project,parseBackup} from './finance.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,currency='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency,maximumFractionDigits:2}).format(n);
const number=(n,d=2)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(n);
const pct=n=>n==null?'—':`${n>0?'+':''}${number(n)}%`;
const formatTime=t=>{if(!t)return 'Não informada';const d=new Date(t);return Number.isNaN(d.getTime())?String(t):d.toLocaleString('pt-BR');};
const cssChange=n=>n>0?'positive':n<0?'negative':'flat';
const state={data:null,transactions:[],active:'overview',filter:'all'};
const save=()=>localStorage.setItem(KEY,JSON.stringify({version:3,brand:'VEZORI',savedAt:new Date().toISOString(),transactions:state.transactions}));
function restore(){
 try{
  const text=localStorage.getItem(KEY)||localStorage.getItem('investimentos-local-v2');
  return text?parseBackup(text):[];
 }catch(e){$('portfolio-msg').textContent='Não foi possível validar o histórico local; importe um backup confiável.';return [];}
}
function quoteText(q){return money(q.price,q.currency);}
function makeRows(quotes,short=false){
 if(!quotes.length)return `<tr><td colspan="${short?3:6}" class="empty-row">Nenhuma cotação disponível neste filtro. Verifique as integrações.</td></tr>`;
 return quotes.map(q=>{
  const basic=`<td><strong class="asset-main">${esc(q.symbol)}</strong><span class="asset-sub">${esc(q.name)}</span></td>`;
  return short?`<tr>${basic}<td>${quoteText(q)}</td><td class="change ${cssChange(q.changePct)}">${pct(q.changePct)}</td></tr>`:
   `<tr>${basic}<td>${q.market==='BR'?'Brasil':q.market==='US'?'EUA':'Cripto'}</td><td>${quoteText(q)}</td><td class="change ${cssChange(q.changePct)}">${pct(q.changePct)}</td><td>${esc(q.provider)}</td><td>${esc(formatTime(q.providerAsOf))}</td></tr>`;
 }).join('');
}
function marketView(){
 const d=state.data;if(!d)return;
 const available=d.quotes.filter(q=>state.filter==='all'||q.market===state.filter);
 $('market-table').innerHTML=makeRows(available);
 $('overview-stocks').innerHTML=makeRows(d.quotes.filter(q=>q.market==='BR'),true);
 $('market-count').textContent=`${available.length} cotações disponíveis · cache até 5 min`;
 const warnings=[];
 if(d.availability?.coingecko==='partial_failure')warnings.push('CoinGecko público indisponível; uma chave Demo gratuita pode melhorar os limites de acesso.');
 if(d.availability?.twelvedata==='key_required')warnings.push('Twelve Data: registre a chave gratuita no backend para visualizar ações e ETFs dos EUA.');
 for(const error of d.errors||[])warnings.push(`${error.source}: ${error.message}`);
 $('market-warnings').innerHTML=warnings.map(t=>`<div class="warning">${esc(t)}</div>`).join('');
}
function overviewStrategyPreview(){
 const container=$('overview-strategies');
 if(!container)return;
 const symbols=['◎','↗','◈'];
 container.innerHTML=STRATEGIES.slice(0,3).map((strategy,i)=>
  `<button class="strategy-preview-item" type="button" data-strategy="${i}"><span class="strategy-symbol" aria-hidden="true">${symbols[i]}</span><span class="strategy-preview-text"><strong>${esc(strategy.title)}</strong><small>${esc(strategy.by)}</small></span><span class="strategy-arrow" aria-hidden="true">↗</span></button>`
 ).join('');
}
function overviewPortfolioPreview(summary){
 const target=$('overview-portfolio');if(!target)return;
 if(!summary.total){
  target.innerHTML='<div class="portfolio-empty"><span class="portfolio-empty-icon" aria-hidden="true">▢</span><strong>Comece a acompanhar sua carteira</strong><p>Cadastre sua primeira operação para visualizar patrimônio e composição.</p><button class="text-link" type="button" data-overview-portfolio>Registrar operação ↗</button></div>';
  return;
 }
 if(!summary.complete||summary.marketBRL<=0){
  target.innerHTML=`<div class="portfolio-empty"><span class="portfolio-empty-icon" aria-hidden="true">!</span><strong>Patrimônio ainda não consolidado</strong><p>${summary.coverage} de ${summary.total} posições possuem cotação válida. O total não é exibido até completar a cobertura.</p><button class="text-link" type="button" data-overview-portfolio>Ver posições ↗</button></div>`;
  return;
 }
 const colors={BR:'#46d3b6',US:'#5a9dca',CRYPTO:'#e8bb72'};
 const names={BR:'Brasil',US:'Exterior',CRYPTO:'Cripto'};
 const amounts={BR:0,US:0,CRYPTO:0};
 for(const row of summary.rows){const m=ASSETS[row.symbol].market;if(Object.hasOwn(amounts,m))amounts[m]+=row.marketBRL;}
 let cursor=0;
 const parts=Object.entries(amounts).filter(([,amount])=>amount>0).map(([market,amount])=>{
  const start=cursor;cursor+=amount/summary.marketBRL*100;
  return {market,amount,start,end:cursor};
 });
 const stops=parts.map(p=>`${colors[p.market]} ${p.start.toFixed(4)}% ${p.end.toFixed(4)}%`).join(', ');
 const legend=parts.map(p=>`<div class="portfolio-legend-row"><span style="background:${colors[p.market]}"></span>${names[p.market]}<strong>${number(p.amount/summary.marketBRL*100,1)}%</strong></div>`).join('');
 target.innerHTML=`<div class="portfolio-preview-full"><div class="portfolio-donut" style="background:conic-gradient(${stops})" role="img" aria-label="Composição da carteira por mercado"><div class="portfolio-donut-inner"><strong>${money(summary.marketBRL)}</strong><span>Patrimônio</span></div></div><div class="portfolio-legend">${legend}</div></div>`;
}
function overviewProjectionPreview(points){
 const chart=$('overview-sim-chart'),metrics=$('overview-sim-metrics');
 if(!chart||!metrics||!points?.length)return;
 const last=points.at(-1),max=Math.max(...points.map(p=>p.amount),1);
 const sampled=points.length>12?points.filter((p,i)=>i===0||i===points.length-1||i%Math.ceil(points.length/11)===0):points;
 chart.innerHTML=sampled.map((p,i)=>`<div class="preview-bar-wrap" title="Ano ${p.year} · ${money(p.amount)}"><div class="preview-bar" style="height:${Math.max(3,p.amount/max*137).toFixed(1)}px"></div><span class="preview-bar-label">${sampled.length<=12||i===0||i===sampled.length-1?p.year+'a':''}</span></div>`).join('');
 metrics.innerHTML=`<div class="sim-metric">Montante hipotético<strong>${money(last.amount)}</strong></div><div class="sim-metric">Capital aportado<strong>${money(last.contributions)}</strong></div><div class="sim-metric">Juros matemáticos<strong>${money(last.amount-last.contributions)}</strong></div>`;
}
function dashboardView(){
 const d=state.data;if(!d)return;
 const usd=d.fx.find(f=>f.pair==='USD/BRL'),eur=d.fx.find(f=>f.pair==='EUR/BRL');
 const selic=d.macro.find(m=>m.code==='SELIC_META'),btc=d.quotes.find(q=>q.symbol==='BTC');
 const kpis=[
  {title:'DÓLAR DE REFERÊNCIA',value:usd?money(usd.rate):'Indisponível',foot:usd?`Frankfurter · ${usd.date}`:'Fonte indisponível'},
  {title:'EURO DE REFERÊNCIA',value:eur?money(eur.rate):'Indisponível',foot:eur?`Frankfurter · ${eur.date}`:'Fonte indisponível'},
  {title:'META SELIC',value:selic?`${number(selic.value)}%`:'Indisponível',foot:selic?`BCB · ${selic.date}`:'Fonte indisponível'},
  {title:'BITCOIN / BRL',value:btc?money(btc.price):'Sem cotação',foot:btc?`${btc.provider} · ${formatTime(btc.providerAsOf)}`:'Fonte de cripto indisponível'}
 ];
 $('overview-kpis').innerHTML=kpis.map(i=>`<article class="metric-card"><div class="metric-title">${esc(i.title)}</div><div class="metric-value">${esc(i.value)}</div><div class="metric-foot">${esc(i.foot)}</div></article>`).join('');
 $('hero-count').textContent=String(d.quotes.length).padStart(2,'0');
 $('hero-time').textContent=`Consulta: ${formatTime(d.generatedAt)}`;
 $('last-sync').textContent=`Última consulta ${formatTime(d.generatedAt)}`;
 if($('sidebar-source-status'))$('sidebar-source-status').textContent=`${d.quotes.length} ativos com preço disponível`;
}
function providerView(){
 const catalog=[
  ['brapi','Ações brasileiras','PETR4, VALE3, ITUB4, MGLU3 sem chave; outros tickers requerem plano compatível.'],
  ['frankfurter','Câmbio de referência','USD/BRL e EUR/BRL, atualizações diárias; não equivale à PTAX e nem ao câmbio de compra.'],
  ['bcb','Banco Central','Meta Selic oficial, série SGS 432; não confundir com CDI efetivo.'],
  ['coingecko','Criptomoedas — CoinGecko','BTC, ETH e SOL em BRL pela API pública sem chave; chave Demo opcional para limites mais estáveis.'],
  ['twelvedata','Ações e ETFs internacionais','VOO, QQQ e AAPL com chave Twelve Data; sujeito às permissões do plano gratuito.']
 ];
 const avail=state.data?.availability||{};
 $('provider-grid').innerHTML=catalog.map(([key,title,desc])=>{
  const status=avail[key]||'unavailable';const label={available:'Consultado',public_no_key:'API pública sem chave',key_required:'Chave necessária',partial_failure:'Falha parcial',unavailable:'Pendente'}[status];
  const cls=status==='available'||status==='public_no_key'?'good':status==='key_required'?'waiting':'bad';
  return `<article class="provider-card"><h3>${esc(title)}</h3><p>${esc(desc)}</p><span class="provider-state ${cls}">${label}</span></article>`;
 }).join('');
}
function portfolioView(){
 const p=portfolio(state.transactions,state.data?.quotes||[],state.data?.fx||[]);
 $('portfolio-cost').textContent=money(p.costBRL);
 $('portfolio-value').textContent=p.complete?money(p.marketBRL):'Parcial';
 $('portfolio-pnl').textContent=p.complete?money(p.unrealizedBRL):'Indisponível';
 $('portfolio-realized').textContent=money(p.realizedBRL);
 $('portfolio-income').textContent=money(p.incomeBRL);
 const annual=portfolioXirr(state.transactions,p);
 $('portfolio-xirr').textContent=annual==null?'—':pct(annual*100);
 $('portfolio-coverage').textContent=p.total?`${p.coverage} de ${p.total} posições com preço real`:'Nenhuma posição cadastrada';
 $('portfolio-msg').textContent=p.complete?'Custo histórico de operações convertido pela taxa informada em cada transação. Preços de mercado vêm das fontes acima.':'Cobertura incompleta: não apresentamos o valor total ou a rentabilidade como se todas as posições estivessem precificadas.';
 $('portfolio-table').innerHTML=p.rows.length?p.rows.map(r=>`<tr><td><strong class="asset-main">${esc(r.symbol)}</strong><span class="asset-sub">${esc(ASSETS[r.symbol].name)}</span></td><td>${number(r.qty,8)}</td><td>${money(r.costBRL)}</td><td>${r.quoteAvailable?money(r.marketBRL):'<span class="muted">Sem cotação</span>'}</td></tr>`).join(''):'<tr><td colspan="4">Carteira vazia. Registre uma compra para começar.</td></tr>';
 overviewPortfolioPreview(p);
 $('transactions-table').innerHTML=state.transactions.length?[...state.transactions].reverse().map(t=>{
  const side=t.side==='buy'?'Compra':t.side==='sell'?'Venda':'Provento';
  return `<tr><td>${esc(t.date)}</td><td>${side}</td><td>${esc(t.symbol)}</td><td>${t.side==='income'?'—':number(t.qty,8)}</td><td>${money(t.unitPrice,ASSETS[t.symbol].currency)}</td><td><button class="delete-button" data-delete="${esc(t.id)}" aria-label="Excluir operação">Excluir</button></td></tr>`;
 }).join(''):'<tr><td colspan="6">Nenhuma operação.</td></tr>';
}
function strategiesView(){
 const colors=['#29c7ae','#378cb5','#e5b96a','#ae8bdb'];
 $('strategies-grid').innerHTML=STRATEGIES.map((s,i)=>`<article class="strategy-card"><div class="strategy-header"><span class="strategy-index">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(s.title)}</h3><span class="strategy-by">${esc(s.by)}</span></div></div><p>${esc(s.desc)}</p><div class="allocation-bar">${s.allocation.map((a,k)=>`<span style="width:${a[1]}%;background:${colors[k]}"></span>`).join('')}</div><div class="allocation-legend">${s.allocation.map((a,k)=>`<span><i style="background:${colors[k]}"></i>${esc(a[0])} ${a[1]}%</span>`).join('')}</div><div class="strategy-note">Revisão sugerida: ${esc(s.review)}</div></article>`).join('');
}
function simulationView(){
 try{
  const initial=Number($('sim-initial').value),monthly=Number($('sim-monthly').value),rate=Number($('sim-rate').value)/100,years=Number($('sim-years').value);
  const result=project(initial,monthly,rate,years),last=result.at(-1),max=Math.max(...result.map(v=>v.amount),1);
  $('sim-result').innerHTML=`<div>Montante hipotético<strong>${money(last.amount)}</strong></div><div>Capital aportado<strong>${money(last.contributions)}</strong></div><div>Juros matemáticos<strong>${money(last.amount-last.contributions)}</strong></div>`;
  overviewProjectionPreview(result);
  $('sim-chart').innerHTML=result.map((x,i)=>`<div class="sim-bar" style="height:${Math.max(2,x.amount/max*145)}px" title="Ano ${x.year}: ${money(x.amount)}">${i===0||i===result.length-1||i%5===4?`<span class="chart-year">${x.year}a</span>`:''}</div>`).join('');
 }catch(e){$('sim-result').textContent=e.message;$('sim-chart').innerHTML='';}
}
function navigate(view){
 if(!['overview','market','portfolio','strategies','about'].includes(view))return;
 state.active=view;
 document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+view));
 document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 $('breadcrumb').textContent={overview:'VISÃO GERAL',market:'MERCADO REAL',portfolio:'MINHA CARTEIRA',strategies:'LABORATÓRIO',about:'INTEGRAÇÕES'}[view];
 const titles={overview:['Visão geral','Inteligência de mercado, carteira e estratégias em um só lugar.'],market:['Mercado real','Cotações, comparações e séries históricas verificáveis.'],portfolio:['Minha carteira','Operações e patrimônio calculados a partir dos seus registros.'],strategies:['Laboratório','Modelos de estudo e simulações quantitativas.'],about:['Integrações','Fontes de dados e condições de atualização.']};
 if($('header-title'))$('header-title').textContent=titles[view][0];
 if($('header-subtitle'))$('header-subtitle').textContent=titles[view][1];
 window.scrollTo({top:0,behavior:'instant'});
}
async function getJson(url){
 const response=await fetch(url,{headers:{accept:'application/json'}});
 let data;try{data=await response.json();}catch{throw Error('Resposta JSON inválida');}
 if(!response.ok)throw Error(String(data.error||`HTTP ${response.status}`));return data;
}
async function refresh(){
 const refreshLabel=$('refresh').innerHTML;
 $('refresh').disabled=true;$('refresh').textContent='Consultando…';
 $('api-status').classList.remove('error');$('api-status').innerHTML='<span class="dot pulse"></span> Consultando fontes...';
 try{
  const d=await getJson('/api/dashboard');if(d.mode!=='real_market_data'||!Array.isArray(d.quotes)||!Array.isArray(d.fx)||!Array.isArray(d.macro))throw Error('Formato desconhecido da API');
  state.data=d;
  const n=d.quotes.length+d.fx.length+d.macro.length;
  $('api-status').innerHTML=`<span class="dot"></span> ${n} dados reais recebidos`;
  if(!n){$('api-status').classList.add('error');$('api-status').textContent='Fontes indisponíveis';}
  dashboardView();marketView();portfolioView();providerView();
 }catch(e){$('api-status').classList.add('error');$('api-status').textContent='Falha de conexão';$('notice').innerHTML=`<span>⚠</span><span>O backend não respondeu: ${esc(e.message)}. Nenhum dado fictício foi usado.</span>`;portfolioView();}
 finally{$('refresh').disabled=false;$('refresh').innerHTML=refreshLabel;}
}
function changeOperationUI(){
 const symbol=$('tx-symbol').value,side=$('tx-side').value,currency=ASSETS[symbol].currency;
 const isIncome=side==='income';$('qty-wrapper').hidden=isIncome;
 $('tx-price-label').textContent=isIncome?'Valor total do provento':'Preço unitário';
 $('tx-qty').required=!isIncome;
 $('tx-fx').disabled=currency==='BRL';
 if(currency==='BRL')$('tx-fx').value='1';
 else if($('tx-fx').value==='1')$('tx-fx').value='';
 $('tx-currency-info').textContent=currency==='BRL'?'Preço e taxas em reais. A taxa de câmbio é 1.':`Preço e taxas em ${currency}. Informe o câmbio real de cada operação em R$/${currency} na data histórica; não substitua pela taxa atual.`;
}
function addOperation(event){
 event.preventDefault();const feedback=$('transaction-feedback');feedback.classList.remove('error');
 try{
  const side=$('tx-side').value;
  const obj={id:'tx_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)).replaceAll('-',''),date:$('tx-date').value,symbol:$('tx-symbol').value,side,qty:side==='income'?0:Number($('tx-qty').value),unitPrice:Number($('tx-price').value),fx:Number($('tx-fx').value),fee:Number($('tx-fee').value||0)};
  const cleaned=validateTransaction(obj,state.transactions);
  state.transactions.push(cleaned);save();portfolioView();
  $('tx-qty').value='';$('tx-price').value='';$('tx-fee').value='0';feedback.textContent='Operação salva localmente e cálculo atualizado.';
 }catch(e){feedback.classList.add('error');feedback.textContent=e.message;}
}
function exportBackup(){
 const body=JSON.stringify({version:3,brand:'VEZORI',exportedAt:new Date().toISOString(),transactions:state.transactions},null,2);
 const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='vezori-carteira-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importBackup(e){
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>4_000_000)throw Error('Arquivo excede 4 MB');
  const arr=parseBackup(await file.text());
  if(!confirm(`Importar ${arr.length} operações? O histórico local atual será substituído.`))return;
  state.transactions=arr;save();portfolioView();$('portfolio-msg').textContent=`Backup validado: ${arr.length} operações importadas.`;
 }catch(err){$('portfolio-msg').textContent='Falha ao importar: '+err.message;}
 finally{e.target.value='';}
}
async function lookup(e){
 e.preventDefault();const box=$('lookup-result'),market=$('lookup-market').value,symbol=$('lookup-symbol').value.trim().toUpperCase();
 if(!/^[A-Z0-9.]{1,8}$/.test(symbol)){box.textContent='Ticker inválido';return;}
 box.textContent='Consultando cotação...';
 try{
  const {quote}=await getJson(`/api/quote?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(symbol)}`);
  box.innerHTML=`<div class="lookup-result-success"><div><span class="muted">${esc(quote.name)}</span><br/><strong>${esc(quote.symbol)}</strong></div><div><strong>${money(quote.price,quote.currency)}</strong><br/><span class="change ${cssChange(quote.changePct)}">${pct(quote.changePct)}</span></div><div class="micro-note">${esc(quote.provider)} · ${esc(formatTime(quote.providerAsOf))}</div></div>`;
 }catch(err){box.innerHTML=`<div class="warning">${esc(err.message)}. Verifique chave, ticker e limite do plano.</div>`;}
}
function chartSVG(series){
 const pts=series.points;if(pts.length<2)throw Error('Série não possui pontos suficientes para gráfico');
 const W=920,H=260,L=58,R=20,T=20,B=37;
 const values=pts.map(p=>p.close),min=Math.min(...values),max=Math.max(...values),span=max-min||Math.max(1,max*.03);
 const lo=min-span*.10,hi=max+span*.10,plotW=W-L-R,plotH=H-T-B;
 const sx=i=>L+i/(pts.length-1)*plotW,sy=v=>T+(hi-v)/(hi-lo)*plotH;
 const line=pts.map((p,i)=>`${i===0?'M':'L'}${sx(i).toFixed(1)},${sy(p.close).toFixed(1)}`).join(' ');
 const area=line+` L${sx(pts.length-1).toFixed(1)},${H-B} L${L},${H-B} Z`;
 const lines=[0,.25,.5,.75,1].map(f=>{const y=T+f*plotH,v=hi-f*(hi-lo);return `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W-R}" y2="${y.toFixed(1)}" stroke="#6a829a" stroke-opacity=".24"/><text x="${L-9}" y="${y+4}" fill="#9bacbd" text-anchor="end" font-size="11">${number(v)}</text>`;}).join('');
 const first=pts[0].date,last=pts.at(-1).date;
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histórico real do ativo ${esc(series.symbol)} entre ${first} e ${last}"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#29c7ae" stop-opacity=".29"/><stop offset="100%" stop-color="#29c7ae" stop-opacity="0"/></linearGradient></defs>${lines}<path d="${area}" fill="url(#areaFill)"/><path d="${line}" fill="none" stroke="#29c7ae" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${sx(pts.length-1).toFixed(1)}" cy="${sy(pts.at(-1).close).toFixed(1)}" r="4.5" fill="#e5b96a"/><text x="${L}" y="${H-9}" fill="#9bacbd" font-size="12">${first}</text><text x="${W-R}" y="${H-9}" text-anchor="end" fill="#9bacbd" font-size="12">${last}</text></svg>`;
}
async function history(e){
 e?.preventDefault();const [market,symbol]=$('history-symbol').value.split(':'),range=$('history-range').value;
 const button=$('history-submit');button.disabled=true;$('history-status').textContent='Consultando série histórica real...';
 try{
  const series=await getJson(`/api/history?market=${market}&symbol=${symbol}&range=${range}`);
  $('history-chart').innerHTML=chartSVG(series);
  const a=series.points[0].close,b=series.points.at(-1).close,change=(b/a-1)*100;
  $('history-status').textContent=`${symbol} · ${series.points.length} observações · ${series.provider}`;
  $('history-foot').innerHTML=`<span>${esc(series.priceBasis)}</span><span>${money(a,series.currency)} → ${money(b,series.currency)} <b class="${cssChange(change)}">(${pct(change)})</b></span>`;
 }catch(err){$('history-status').textContent='Não foi possível obter histórico: '+err.message;$('history-chart').innerHTML='<span class="muted">Sem pontos disponíveis. Nenhuma série foi simulada.</span>';$('history-foot').textContent='';}
 finally{button.disabled=false;}
}
function init(){
 state.transactions=restore();$('tx-date').value=new Date().toLocaleDateString('en-CA');
 document.querySelectorAll('[data-view]').forEach(x=>x.addEventListener('click',()=>navigate(x.dataset.view)));
 document.querySelectorAll('[data-go]').forEach(x=>x.addEventListener('click',()=>navigate(x.dataset.go)));
 $('overview-strategies').addEventListener('click',event=>{if(event.target.closest('[data-strategy]'))navigate('strategies');});
 $('overview-portfolio').addEventListener('click',event=>{if(event.target.closest('[data-overview-portfolio]'))navigate('portfolio');});
 $('global-search-form').addEventListener('submit',event=>{
  event.preventDefault();const symbol=$('global-search').value.trim().toUpperCase();
  if(!/^[A-Z0-9.]{1,8}$/.test(symbol)){ $('global-search').setCustomValidity('Informe um ticker válido');$('global-search').reportValidity();return; }
  $('global-search').setCustomValidity('');
  navigate('market');
  if(['BTC','ETH','SOL'].includes(symbol)){const filter=document.querySelector('[data-filter="CRYPTO"]');filter?.click();return;}
  if(ASSETS[symbol]?.market==='US')$('lookup-market').value='US';else $('lookup-market').value='BR';
  $('lookup-symbol').value=symbol;
  lookup({preventDefault(){}});
 });
 $('global-search').addEventListener('input',()=>{$('global-search').setCustomValidity('');});
 document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));marketView();}));
 $('refresh').addEventListener('click',refresh);
 $('tx-symbol').addEventListener('change',changeOperationUI);$('tx-side').addEventListener('change',changeOperationUI);
 $('transaction-form').addEventListener('submit',addOperation);
 $('export-data').addEventListener('click',exportBackup);$('import-data').addEventListener('change',importBackup);
 $('clear-portfolio').addEventListener('click',()=>{if(confirm('Apagar todas as operações deste navegador? Exporte o backup antes de confirmar.')){state.transactions=[];save();portfolioView();}});
 $('transactions-table').addEventListener('click',event=>{
  const id=event.target.closest('[data-delete]')?.dataset.delete;if(!id)return;
  if(!confirm('Excluir esta operação? O histórico de custo médio será reprocessado.'))return;
  const next=state.transactions.filter(t=>t.id!==id);
  try{book(next);state.transactions=next;save();portfolioView();}catch(err){alert('Não é possível excluir esta operação: '+err.message);}
 });
 $('sim-form').addEventListener('submit',event=>{event.preventDefault();simulationView();});
 $('lookup-form').addEventListener('submit',lookup);$('history-form').addEventListener('submit',history);
 overviewStrategyPreview();strategiesView();simulationView();portfolioView();changeOperationUI();refresh();
}
init();
