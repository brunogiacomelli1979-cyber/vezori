import {analyzeExtendedRisk} from './risk-metrics.js';
/** VEZORI 2.0 — exploration, issuer/asset detail, and comparisons.
 * Data contracts are explicit: absent financial fundamentals are never inferred.
 * Charts reflect provider price closes; not total returns and not normalized across currencies.
 */
import {ASSETS} from './finance.js';
import {mountMarketChart} from './market-charts.js';
import {analyzeAssetRisk} from './risk-analytics.js';
import {suggestPriceZones} from './price-zones.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=(value,d=2)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(value);
const currency=(value,ccy='BRL')=>value==null||!Number.isFinite(value)?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:ccy,maximumFractionDigits:2}).format(value);
const percent=value=>value==null||!Number.isFinite(value)?'—':`${value>0?'+':''}${num(value)}%`;
const byMarket={BR:'Ações Brasil',US:'EUA / ETFs',CRYPTO:'Criptomoedas'};
const marketOf=symbol=>ASSETS[symbol]?.market;
const delta=value=>value==null||!Number.isFinite(value)?'':value>0?'positive':value<0?'negative':'';
const when=value=>{
 if(!value)return 'Horário não informado';
 const t=Date.parse(value);
 return Number.isFinite(t)?new Date(t).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):String(value).slice(0,24);
};
const validPoint=p=>p&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&typeof p.close==='number'&&Number.isFinite(p.close)&&p.close>0;

/** Normalized overlapping close-to-close price series, base 100 on a single common date. */
export function alignNormalizedSeries(series){
 if(!Array.isArray(series)||series.length<2||series.length>5)throw Error('Selecione de 2 a 5 séries históricas');
 const prepared=series.map(s=>({symbol:s.symbol,points:new Map((s.points||[]).filter(validPoint).map(p=>[p.date,p.close]))}));
 let common=[...prepared[0].points.keys()];
 for(const s of prepared.slice(1))common=common.filter(d=>s.points.has(d));
 common.sort();
 if(common.length<2)return {dates:[],datasets:[],message:'Não existem ao menos duas datas em comum entre as séries.'};
 const datasets=prepared.map(s=>({symbol:s.symbol,values:common.map(date=>100*s.points.get(date)/s.points.get(common[0]))}));
 return {dates:common,datasets,message:null};
}

export function summarizeHistory(series){
 const points=(series?.points||[]).filter(validPoint).slice().sort((a,b)=>a.date.localeCompare(b.date));
 if(points.length<2)return null;
 const first=points[0],last=points.at(-1);
 const values=points.map(p=>p.close);
 return {first:first.date,last:last.date,firstClose:first.close,lastClose:last.close,min:Math.min(...values),max:Math.max(...values),returnPct:(last.close/first.close-1)*100,count:points.length};
}

/** Market universe is intentionally fixed to assets supported by validated endpoints. */
export function explorationRows(data={},opts={}){
 const {search='',market='all',sort='symbol'}=opts;
 const quotes=new Map((data.quotes||[]).filter(q=>Number.isFinite(q?.price)&&q.price>0).map(q=>[q.symbol,q]));
 const entries=new Map(Object.entries(ASSETS));
 for(const record of data.catalog||[]){
  if(!record||!/^[A-Z0-9]{3,12}$/.test(record.symbol)||record.market!=='BR')continue;
  if(!entries.has(record.symbol))entries.set(record.symbol,{name:record.name,market:'BR',currency:'BRL'});
  if(!quotes.has(record.symbol)&&Number.isFinite(record.price)&&record.price>0)quotes.set(record.symbol,{...record});
 }
 let rows=[...entries].map(([symbol,meta])=>({symbol,...meta,quote:quotes.get(symbol)||null}));
 const match=String(search).trim().toLocaleLowerCase('pt-BR');
 rows=rows.filter(row=>(market==='all'||market===row.market)&&(!match||`${row.symbol} ${row.name}`.toLocaleLowerCase('pt-BR').includes(match)));
 const collate=(a,b)=>a.symbol.localeCompare(b.symbol);
 if(sort==='variation')rows.sort((a,b)=>(b.quote?.changePct??-Infinity)-(a.quote?.changePct??-Infinity)||collate(a,b));
 else if(sort==='price')rows.sort((a,b)=>(b.quote?.price??-Infinity)-(a.quote?.price??-Infinity)||collate(a,b));
 else if(sort==='availability')rows.sort((a,b)=>(!!b.quote)-(!!a.quote)||collate(a,b));
 else rows.sort(collate);
 return rows;
}

export function createResearchTools({state,navigate,getJson}){
 let search='',market='all',sort='availability',selected='PETR4',period='1mo',comparePeriod='1mo';
 const members=new Set();
 const historyCache=new Map();
 let detailChart=null,comparisonChart=null,detailRequest=0,compareRequest=0,fundamentalRequest=0;
 const catalog=new Map();
 const metaOf=s=>ASSETS[s]||catalog.get(s)?.meta;
 const supported=s=>!!metaOf(s);
 const quote=s=>(state.data?.quotes||[]).find(q=>q.symbol===s)||catalog.get(s)?.quote||null;
 const historyKey=(symbol,range)=>`${symbol}:${range}`;
 const fetchHistory=async(symbol,range)=>{
  if(!supported(symbol))throw Error('Ativo não suportado');
  if(!['1mo','3mo','6mo','1y','2y','5y','10y','max'].includes(range))throw Error('Período inválido');
  const key=historyKey(symbol,range),cached=historyCache.get(key);
  if(cached&&Date.now()-cached.time<600000)return cached.promise;
  const promise=getJson(`/api/history?market=${metaOf(symbol).market}&symbol=${encodeURIComponent(symbol)}&range=${range}`)
    .then(data=>{
      if(data.symbol!==symbol||data.market!==metaOf(symbol).market||!Array.isArray(data.points))throw Error('Contrato de série histórica inconsistente');
      return data;
    });
  historyCache.set(key,{promise,time:Date.now()});
  try{return await promise;}catch(e){historyCache.delete(key);throw e;}
 };
 function renderExplorer(){
  const body=$('research-explore-body');if(!body)return;
  const rows=explorationRows({...state.data,catalog:state.catalog||[]},{search,market,sort});
  const live=rows.filter(r=>!!r.quote).length;
  $('research-explore-count').textContent=`${live} com cotação · ${rows.length} no filtro · cobertura do catálogo carregado`;
  body.innerHTML=rows.length?rows.map(({symbol,name,market,currency:ccy,quote:q})=>`<tr>
   <td><button type="button" class="research-ticker" data-research-detail="${symbol}">${esc(symbol)}</button><span class="research-symbol-sub">${esc(name)}</span></td>
   <td><span class="research-type">${esc(byMarket[market])}</span></td>
   <td class="research-num">${q?currency(q.price,q.currency):'—'}</td>
   <td class="research-num ${delta(q?.changePct)}">${percent(q?.changePct)}</td>
   <td><span class="research-provider">${q?esc(q.provider):'Indisponível'}</span><span class="research-symbol-sub">${q?esc(when(q.providerAsOf)):'Sem cotação neste plano ou nesta consulta'}</span></td>
   <td><div class="research-actions"><button type="button" class="research-small-btn" data-research-detail="${symbol}">Analisar</button><button type="button" class="research-small-btn ${members.has(symbol)?'selected':''}" data-research-toggle="${symbol}" aria-pressed="${members.has(symbol)}">${members.has(symbol)?'Selecionado':'Comparar'}</button></div></td>
  </tr>`).join(''):'<tr><td colspan="6" class="research-empty">Nenhum ativo corresponde à pesquisa.</td></tr>';
 }
 function setChart(which,labels,datasets,labelMode='value'){
  const canvas=$(which==='detail'?'research-asset-chart':'research-compare-chart');
  const host=$(which==='detail'?'research-asset-lightweight':'research-compare-lightweight');
  if(!canvas||!host)return;
  if(which==='detail'&&detailChart){detailChart.destroy();detailChart=null;}
  if(which==='compare'&&comparisonChart){comparisonChart.destroy();comparisonChart=null;}
  const fallback=$(which==='detail'?'research-asset-chart-fallback':'research-compare-chart-fallback');
  // Preferred: interactive price chart with crosshair and zoom; Chart.js remains as offline fallback.
  // fitContent must measure the visible host, otherwise all dates collapse at the right edge.
  host.hidden=false;canvas.hidden=true;fallback.hidden=true;
  const premium=mountMarketChart(host,labels,datasets,window.LightweightCharts);
  if(premium){
   host.hidden=false;canvas.hidden=true;fallback.hidden=true;
   if(which==='detail')detailChart=premium;else comparisonChart=premium;
   return;
  }
  host.hidden=true;
  if(!window.Chart){canvas.hidden=true;fallback.hidden=false;fallback.textContent='Gráfico indisponível no navegador. Utilize os indicadores numéricos e as fontes abaixo.';return;}
  canvas.hidden=false;fallback.hidden=true;
  const colors=['#10b981','#60a5fa','#f59e0b','#a78bfa','#f472b6'];
  const chart=new window.Chart(canvas,{type:'line',data:{labels,datasets:datasets.map((s,i)=>({label:s.symbol,data:s.values,borderColor:colors[i],backgroundColor:`${colors[i]}18`,pointRadius:labels.length>35?0:1.5,pointHoverRadius:4,tension:.12,borderWidth:2,fill:datasets.length===1,spanGaps:false}))},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{display:datasets.length>1,labels:{color:'#c4d2e0',boxWidth:12,boxHeight:3}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${labelMode==='normalized'?num(ctx.parsed.y,2):currency(ctx.parsed.y,quote(selected)?.currency||metaOf(selected).currency)}`}}},scales:{x:{ticks:{maxTicksLimit:8,color:'#97a9b9'},grid:{display:false}},y:{ticks:{color:'#97a9b9',callback:value=>labelMode==='normalized'?num(value,0):num(value,2)},grid:{color:'rgba(148,163,184,.12)'}}}}});
  if(which==='detail')detailChart=chart;else comparisonChart=chart;
 }

 function secMoney(value){
  if(typeof value!=='number'||!Number.isFinite(value))return '—';
  const abs=Math.abs(value),div=abs>=1e12?1e12:abs>=1e9?1e9:abs>=1e6?1e6:1;
  const suffix=div===1e12?' tri':div===1e9?' bi':div===1e6?' mi':'';
  return 'US$ '+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value/div)+suffix;
 }
 function secMetric(label,record,mode='USD'){
  const value=record?.value;
  const displayed=typeof value==='number'&&Number.isFinite(value)?
    mode==='%'?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value)+'%':secMoney(value):'—';
  const date=record?.periodEnd||'Período indisponível';
  const filed=record?.filed?' · publicado '+record.filed:'';
  return '<div><span>'+esc(label)+'</span><strong>'+esc(displayed)+'</strong><small>'+esc(date+filed)+'</small></div>';
 }

 function cvmMoney(value){
  if(typeof value!=='number'||!Number.isFinite(value))return '—';
  const n=Math.abs(value),d=n>=1e12?1e12:n>=1e9?1e9:n>=1e6?1e6:1;
  return 'R$ '+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value/d)+(d===1e12?' tri':d===1e9?' bi':d===1e6?' mi':'');
 }
 function cvmFact(row){
  return '<div><span>'+esc(String(row.label||row.accountCode||'Conta CVM').slice(0,110))+'</span><strong>'+esc(cvmMoney(row.valueBRL))+'</strong>'+
    '<small>'+esc(row.statement+' · conta '+row.accountCode+' · revisão '+row.version)+'</small></div>';
 }
 async function renderFundamentals(){
  const id=++fundamentalRequest,grid=$('research-fundamental-grid'),status=$('research-fundamental-status');
  if(!grid||!status)return;
  grid.innerHTML='';
  const source=$('research-fundamental-document'),method=$('research-fundamental-method');
  if(source)source.hidden=true;
  if(method)method.textContent='';
  status.textContent='Consultando demonstrativos oficiais disponíveis…';
  const market=metaOf(selected)?.market;
  if(market!=='BR'&&market!=='US'){
   status.textContent='Demonstrações contábeis corporativas não se aplicam diretamente a este tipo de ativo.';
   return;
  }
  try{
   const data=await getJson('/api/fundamentals?market='+market+'&symbol='+encodeURIComponent(selected));
   if(id!==fundamentalRequest)return;
   if(market==='BR'){
    if(data.status!=='verified_accounts'){
     status.textContent=data.message||'Sem demonstração oficial validada e publicada para este ticker.';
     return;
    }
    const priority=['3.01','3.09','3.11','1','2.03','6.01'];
    const chosen=priority.map(code=>data.accounts.find(x=>x.accountCode===code&&Number.isFinite(x.valueBRL))).filter(Boolean);
    const available=data.accounts.filter(x=>Number.isFinite(x.valueBRL));
    grid.innerHTML=(chosen.length>=3?chosen:available).slice(0,6).map(cvmFact).join('');
    status.textContent='CVM DFP · '+data.issuer+' · exercício '+data.statementYear+' · encerramento '+data.periodEnd+
      ' · consolidadas. Contas oficiais e revisões; não são múltiplos de valuation.';
    if(source&&data.sourceUrl?.startsWith('https://dados.cvm.gov.br/')){
     source.hidden=false;source.href=data.sourceUrl;source.textContent='Abrir arquivo DFP oficial da CVM';
    }
    if(method)method.textContent=(data.methodology||'')+' '+(data.limitations||'');
    return;
   }
   if(data.status!=='available'){
    status.textContent=data.message||'Demonstrações SEC indisponíveis na configuração atual.';
    return;
   }
   const m=data.metrics||{};
   grid.innerHTML=secMetric('Receita anual (10-K)',m.revenue)+secMetric('Lucro líquido anual',m.netIncome)+
    secMetric('Ativos totais',m.assets)+secMetric('Passivos totais',m.liabilities)+
    secMetric('Margem líquida anual',m.netMarginPct,'%')+secMetric('ROE (patrimônio médio)',m.roePct,'%');
   status.textContent='SEC EDGAR · '+data.companyName+' · exercício '+data.periodEnd+
     ' · demonstrações US-GAAP; não equivalem a P/L, P/VP ou dividend yield.';
   if(source&&data.sourceUrl?.startsWith('https://data.sec.gov/')){
    source.hidden=false;source.href=data.sourceUrl;source.textContent='Abrir demonstrações oficiais da SEC';
   }
   if(method)method.textContent=data.methodology||'';
  }catch(err){
   if(id!==fundamentalRequest)return;
   status.textContent='Sem fundamentos verificáveis para este ativo: '+String(err.message||'fonte indisponível').slice(0,130);
  }
 }
 function renderDetailHeader(){
  const q=quote(selected),meta=metaOf(selected);
  $('research-asset-name').textContent=`${selected} · ${meta.name}`;
  $('research-asset-type').textContent=`${byMarket[meta.market]} · ${meta.currency}`;
  $('research-asset-price').textContent=q?currency(q.price,q.currency):'Sem cotação';
  $('research-asset-change').textContent=percent(q?.changePct);
  $('research-asset-change').className=`research-value-change ${delta(q?.changePct)}`;
  $('research-asset-source').textContent=q?`${q.provider} · ${when(q.providerAsOf)} · consulta ${when(q.retrievedAt)}`:'Cotação não disponível na configuração atual. Não foi utilizado valor estimado.';
  $('research-asset-symbol').value=selected;
 }
 async function renderDetail(){
  renderDetailHeader();
  const request=++detailRequest;
  const crypto=metaOf(selected)?.market==='CRYPTO';
  $('research-crypto-sentiment-panel').hidden=!crypto;
  $('research-crypto-sentiment').innerHTML='';
  if(crypto){
   $('research-crypto-sentiment-status').textContent='Consultando CoinGecko…';
   getJson('/api/crypto-sentiment').then(data=>{
    if(request!==detailRequest)return;
    if(data.status!=='available'||!Number.isFinite(data.score))throw Error('Índice indisponível');
    $('research-crypto-sentiment').innerHTML='<div><span>Fear & Greed global</span><strong>'+num(data.score,0)+' / 100</strong><small>'+esc(data.sentiment)+'</small></div>';
    $('research-crypto-sentiment-status').textContent='CoinGecko · consulta '+when(data.retrievedAt)+' · indicador global; não é sinal individual de negociação.';
   }).catch(err=>{
    if(request!==detailRequest)return;
    $('research-crypto-sentiment-status').textContent='Sentimento indisponível: '+String(err.message||'falha da fonte')+'.';
   });
  }
  $('research-asset-history-status').textContent='Consultando série histórica no provedor…';
  $('research-history-cta').hidden=true;
  $('research-history-alternative').hidden=true;
  $('research-history-nextstep').textContent='';
  $('research-asset-chart').closest('.research-chart').classList.remove('is-missing');
  $('research-asset-details').innerHTML='';
  $('research-risk-metrics').innerHTML='';
  $('research-risk-status').textContent='Aguardando histórico válido para estimar risco de preço…';
  $('research-price-zones').innerHTML='';
  $('research-price-zones-status').textContent='Buscando pelo menos 50 fechamentos verificáveis…';
  const canvas=$('research-asset-chart');canvas.hidden=true;
  $('research-asset-lightweight').hidden=true;
  if(detailChart){detailChart.destroy();detailChart=null;}
  $('research-asset-chart-fallback').hidden=false;
  $('research-asset-chart-fallback').textContent='Consultando preços de fechamento…';
  try{
   const series=await fetchHistory(selected,period);
   if(request!==detailRequest)return;
   const summary=summarizeHistory(series);
   if(!summary)throw Error('Menos de dois fechamentos válidos no período');
   const points=series.points.filter(validPoint).slice().sort((a,b)=>a.date.localeCompare(b.date));
   $('research-asset-history-status').textContent=`${summary.count} observações · ${series.provider} · ${summary.first} a ${summary.last} · ${series.priceBasis} · ${series.coverage?.reason||'Cobertura integral não confirmada'}`;
   $('research-asset-details').innerHTML=`<div><span>Retorno de preço no período</span><strong class="${delta(summary.returnPct)}">${percent(summary.returnPct)}</strong></div><div><span>Menor fechamento</span><strong>${currency(summary.min,series.currency)}</strong></div><div><span>Maior fechamento</span><strong>${currency(summary.max,series.currency)}</strong></div><div><span>Último fechamento</span><strong>${currency(summary.lastClose,series.currency)}</strong></div>`;
   setChart('detail',points.map(p=>p.date),[{symbol:selected,values:points.map(p=>p.close)}]);
   // A janela de análise usa 3 meses, mesmo quando o gráfico mostra 1 mês.
   try{
    const zoneSeries=period==='3mo'?series:await fetchHistory(selected,'3mo');
    if(request!==detailRequest)return;
    const zones=suggestPriceZones({...zoneSeries,points:zoneSeries.points.slice(-1000)});
    const fmt=n=>currency(n,zones.currency);
    $('research-price-zones').innerHTML=
     '<div><span>Faixa de compra indicativa</span><strong class="positive">'+fmt(zones.buy[0])+' – '+fmt(zones.buy[1])+'</strong><small>Suporte estatístico + volatilidade</small></div>'+
     '<div><span>Faixa de venda indicativa</span><strong>'+fmt(zones.sell[0])+' – '+fmt(zones.sell[1])+'</strong><small>Resistência estatística + volatilidade</small></div>'+
     '<div><span>Limite de risco ilustrativo</span><strong class="negative">'+fmt(zones.riskLimit)+'</strong><small>Não é uma ordem automática de stop</small></div>'+
     '<div><span>Médias históricas 20 / 50</span><strong>'+fmt(zones.sma20)+' / '+fmt(zones.sma50)+'</strong><small>Referência: '+esc(zones.lastDate)+'</small></div>';
    $('research-price-zones-status').textContent=zones.observations+' fechamentos de '+zones.provider+' · '+zones.firstDate+' a '+zones.lastDate+' · '+zones.methodology+' '+zones.disclaimer;
   }catch(error){
    if(request!==detailRequest)return;
    $('research-price-zones').innerHTML='';
    $('research-price-zones-status').textContent='Faixas indisponíveis: '+String(error.message||error)+'. Nenhum preço indicativo foi inventado.';
   }

   $('research-history-cta').hidden=true;
   $('research-history-nextstep').textContent='';
   try{
    const risk=analyzeAssetRisk({...series,points:series.points.slice(-1000)});
    const pct=value=>value===null?'—':num(value)+'%';
    $('research-risk-metrics').innerHTML=
     '<div><span>Drawdown máximo (preço)</span><strong>'+esc(pct(risk.maxDrawdownPct))+'</strong><small>Queda máxima desde um pico observado</small></div>'+
     '<div><span>Volatilidade anualizada</span><strong>'+esc(pct(risk.volatilityAnnualPct))+'</strong><small>'+(risk.volatilityAnnualPct===null?'Mínimo: 30 retornos válidos':'Estimativa de retornos diários; '+risk.observationSessionsPerYear+' sessões/ano')+'</small></div>'+
     '<div><span>Retorno de preço</span><strong class="'+delta(risk.returnPct)+'">'+esc(pct(risk.returnPct))+'</strong><small>Não inclui dividendos ou câmbio</small></div>'+
     '<div><span>Observações</span><strong>'+risk.observations+'</strong><small>'+esc(risk.firstDate+' a '+risk.lastDate)+'</small></div>';
    const extended=analyzeExtendedRisk({...series,points:series.points.slice(-1000)});
    $('research-risk-metrics').innerHTML+=
     '<div><span>VaR histórico diário (95%)</span><strong>'+esc(pct(extended.historicalVaR95DailyPct))+'</strong><small>Mínimo: 100 retornos de preço</small></div>'+
     '<div><span>CVaR histórico diário (95%)</span><strong>'+esc(pct(extended.historicalCVaR95DailyPct))+'</strong><small>Média das perdas na cauda observada</small></div>';
    $('research-risk-status').textContent=risk.provider+' · '+risk.priceBasis+' · histórico de preços, não retorno total. Sharpe exige taxa livre de risco explícita, mesma moeda e amostra mínima; por isso não foi estimado automaticamente.';
   }catch(error){
    $('research-risk-metrics').innerHTML='';
    $('research-risk-status').textContent='Risco histórico indisponível: '+error.message+'. Nenhum valor foi estimado.';
   }
  }catch(err){
   if(request!==detailRequest)return;
   $('research-asset-history-status').textContent=`Histórico indisponível: ${err.message}`;
   $('research-risk-status').textContent='Risco histórico indisponível sem fechamentos verificáveis.';
   $('research-price-zones').innerHTML='';
   $('research-price-zones-status').textContent='Sem histórico verificável suficiente; nenhuma sugestão de preço será exibida.';
   $('research-asset-chart-fallback').hidden=false;
   $('research-asset-chart').closest('.research-chart').classList.add('is-missing');
   const text=String(err.message||'').toLowerCase(),m=metaOf(selected)?.market;
   if(m==='BR'&&/(chave brapi|exige chave|http 401|http 403)/.test(text)){
    $('research-asset-chart-fallback').textContent='Este histórico precisa de uma chave brapi; a cotação exibida acima vem da listagem pública.';
    $('research-history-nextstep').textContent='A brapi oferece chave gratuita para histórico de até 3 meses. Na VEZORI, a chave deve ficar no segredo BRAPI_API_KEY do Cloudflare, nunca no navegador ou repositório. Confira os termos de exibição pública.';
    const link=$('research-history-cta');
    link.href='https://brapi.dev/';link.textContent='Consultar chave gratuita na brapi';link.hidden=false;
    if(selected==='PETR3'){
     $('research-history-alternative').hidden=false;
     $('research-history-alternative').textContent='Ver histórico de PETR4 (ação diferente)';
    }
   }else if(m==='US'){
    $('research-asset-chart-fallback').textContent='Histórico americano indisponível sem fonte habilitada para exibição pública.';
    $('research-history-nextstep').textContent='A plataforma não redistribui automaticamente cotações de planos pessoais. A contratação deve autorizar exibição pública para ações, ETFs e REITs.';
    const link=$('research-history-cta');
    link.href='https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage';
    link.textContent='Consultar regras de licenciamento';link.hidden=false;
   }else{
    $('research-asset-chart-fallback').textContent='Não há série histórica verificável nesta consulta. A ficha mantém os dados que foram efetivamente recebidos.';
    $('research-history-nextstep').textContent='Verifique a fonte, a cobertura do plano e tente novamente mais tarde. Nenhuma série foi interpolada.';
   }
   // Fallback displays captured quotes ONLY, never disguises them as exchange closes.
   try{
    const archive=await getJson('/api/observations?market='+m+'&symbol='+encodeURIComponent(selected)+'&months=24');
    if(request!==detailRequest)return;
    if(archive.status==='available'&&archive.points?.length>=2){
     const points=archive.points.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.price)&&p.price>0);
     if(points.length>=2){
      $('research-asset-chart').closest('.research-chart').classList.remove('is-missing');
      setChart('detail',points.map(p=>p.date),[{symbol:selected,values:points.map(p=>p.price)}]);
      $('research-asset-history-status').textContent='Arquivo diário da VEZORI · '+points.length+' cotações observadas · '+points[0].date+' a '+points.at(-1).date+' · NÃO são fechamentos oficiais nem histórico integral.';
      $('research-history-nextstep').textContent='Gráfico alternativo: apenas cotações realmente capturadas após habilitar o KV, sem interpolação. Risco e faixas sugeridas ficam indisponíveis sem fechamentos oficiais adequados.';
     }
    }
   }catch(_){/* Preserve original provider error and configuration instructions. */}
  }
 }
 function renderSelected(){
  $('research-compare-selection').innerHTML=[...members].map(s=>`<button type="button" class="research-chip" data-research-remove="${s}" title="Remover ${s} da seleção">${esc(s)} ×</button>`).join('');
  $('research-compare-count').textContent=`${members.size} de 5 ativos selecionados`;
  $('research-compare-run').disabled=members.size<2;
  const choices=$('research-compare-add');
  choices.innerHTML='<option value="">Adicionar um ativo…</option>'+[...new Set([...Object.keys(ASSETS),...catalog.keys()])].filter(s=>!members.has(s)).map(s=>`<option value="${s}">${s} · ${esc(metaOf(s).name)}</option>`).join('');
  renderExplorer();
 }
 function addCompare(symbol){
  if(!supported(symbol))return;
  if(members.has(symbol))return;
  if(members.size>=5){$('research-explore-count').textContent='Limite de 5 ativos no comparador. Remova um antes de adicionar outro.';return;}
  members.add(symbol);renderSelected();
 }
 async function renderComparison(){
  const symbols=[...members];if(symbols.length<2)return;
  const request=++compareRequest;
  $('research-compare-status').textContent='Consultando séries reais…';
  $('research-compare-foot').textContent='';
  $('research-compare-chart').hidden=true;
  $('research-compare-lightweight').hidden=true;
  if(comparisonChart){comparisonChart.destroy();comparisonChart=null;}
  $('research-compare-chart-fallback').hidden=false;
  $('research-compare-chart-fallback').textContent='Comparando datas de fechamento em comum…';
  const fetched=[];const failures=new Map();
  // Two in-flight requests at a time to avoid stressing free APIs.
  for(let i=0;i<symbols.length;i+=2){
   const batch=await Promise.allSettled(symbols.slice(i,i+2).map(symbol=>fetchHistory(symbol,comparePeriod)));
   batch.forEach((r,j)=>{
    const symbol=symbols[i+j];
    if(r.status==='fulfilled'&&summarizeHistory(r.value))fetched.push(r.value);
    else failures.set(symbol,r.status==='rejected'?r.reason.message:'Série insuficiente');
   });
  }
  if(request!==compareRequest)return;
  $('research-compare-table').innerHTML=symbols.map(symbol=>{
   const q=quote(symbol),history=fetched.find(s=>s.symbol===symbol),summary=history?summarizeHistory(history):null;
   return `<tr><td><strong>${esc(symbol)}</strong><span class="research-symbol-sub">${esc(metaOf(symbol).name)}</span></td><td>${esc(byMarket[metaOf(symbol).market])}</td><td class="research-num">${q?currency(q.price,q.currency):'—'}</td><td class="research-num ${delta(q?.changePct)}">${percent(q?.changePct)}</td><td class="research-num ${delta(summary?.returnPct)}">${percent(summary?.returnPct)}</td><td><span class="research-provider">${q?esc(q.provider):'Sem preço'}</span><span class="research-symbol-sub">${summary?`${esc(history.provider)} · ${summary.first} — ${summary.last}`:esc(failures.get(symbol)||'Série não disponível')}</span></td></tr>`;
  }).join('');
  if(fetched.length<2){$('research-compare-status').textContent=`Séries comparáveis insuficientes (${fetched.length}/${symbols.length}).`;
   $('research-compare-chart-fallback').textContent='Não há pelo menos duas séries válidas. Confira limites de acesso às APIs e histórico.';return;}
  const normalized=alignNormalizedSeries(fetched);
  if(normalized.dates.length<2){$('research-compare-status').textContent='Séries sem datas suficientes em comum.';
   $('research-compare-chart-fallback').textContent=normalized.message;return;}
  $('research-compare-status').textContent=`${normalized.datasets.length} séries · ${normalized.dates.length} datas comuns · Base 100 em ${normalized.dates[0]}`;
  $('research-compare-foot').textContent=`${fetched.map(s=>`${s.symbol}: ${s.provider} (${s.priceBasis})`).join(' · ')}. Variações calculadas sobre preço de fechamento; não incluem dividendos, custos ou câmbio de conversão. Séries com ajustes distintos podem não ser diretamente comparáveis.`;
  setChart('compare',normalized.dates,normalized.datasets,'normalized');
 }
 function registerCatalog(records=[]){
  for(const row of records){
   if(!row||!/^[A-Z0-9]{3,12}$/.test(row.symbol)||row.market!=='BR'||row.currency!=='BRL')continue;
   const meta={name:String(row.name||row.symbol).slice(0,90),market:'BR',currency:'BRL'};
   const itemQuote=Number.isFinite(row.price)&&row.price>0?{symbol:row.symbol,name:meta.name,currency:'BRL',price:row.price,changePct:row.changePct,
    provider:row.provider||'brapi',providerAsOf:row.providerAsOf||null,retrievedAt:row.retrievedAt||null}:null;
   catalog.set(row.symbol,{meta,quote:itemQuote});
  }
  const dropdown=$('research-asset-symbol');
  if(dropdown){
   dropdown.innerHTML=[...new Set([...Object.keys(ASSETS),...catalog.keys()])].map(s=>'<option value="'+esc(s)+'">'+esc(s)+' · '+esc(metaOf(s).name)+'</option>').join('');
   dropdown.value=selected;
  }
  renderSelected();
  if(state.active==='market')renderExplorer();
  if(state.active==='asset')renderDetailHeader();
 }

 function mount(){
  window.addEventListener('vezori-local-eod-changed',()=>historyCache.clear());
  $('research-explore-search').addEventListener('input',event=>{search=event.target.value;renderExplorer();});
  $('research-explore-market').addEventListener('change',event=>{market=event.target.value;renderExplorer();});
  $('research-explore-sort').addEventListener('change',event=>{sort=event.target.value;renderExplorer();});
  $('research-explore-body').addEventListener('click',event=>{
   const detail=event.target.closest('[data-research-detail]');
   if(detail){selectAsset(detail.dataset.researchDetail);return;}
   const toggle=event.target.closest('[data-research-toggle]');
   if(toggle){if(members.has(toggle.dataset.researchToggle))members.delete(toggle.dataset.researchToggle);else addCompare(toggle.dataset.researchToggle);renderSelected();}
  });
  $('research-asset-symbol').innerHTML=Object.entries(ASSETS).map(([symbol,meta])=>`<option value="${symbol}">${symbol} · ${esc(meta.name)}</option>`).join('');
  $('research-asset-symbol').addEventListener('change',event=>selectAsset(event.target.value));
  $('research-asset-period').addEventListener('change',event=>{period=event.target.value;renderDetail();});
  $('research-asset-add-compare').addEventListener('click',()=>{addCompare(selected);navigate('compare');});
  $('research-asset-back').addEventListener('click',()=>navigate('overview'));
  $('research-history-alternative').addEventListener('click',()=>selectAsset('PETR4'));
  $('research-compare-selection').addEventListener('click',event=>{const chip=event.target.closest('[data-research-remove]');if(chip){members.delete(chip.dataset.researchRemove);renderSelected();}});
  $('research-compare-add').addEventListener('change',event=>{if(event.target.value)addCompare(event.target.value);});
  $('research-compare-period').addEventListener('change',event=>{comparePeriod=event.target.value;});
  $('research-compare-run').addEventListener('click',renderComparison);
  $('research-compare-back').addEventListener('click',()=>navigate('market'));
  $('research-explore-open-compare').addEventListener('click',()=>navigate('compare'));
  renderSelected();renderDetailHeader();
 }
 function selectAsset(symbol){
  if(!supported(symbol))return false;
  selected=symbol;navigate('asset');
  return true;
 }
 function registerLocalInstrument(meta){
  if(!meta||!/^[A-Z0-9][A-Z0-9._-]{1,14}$/.test(meta.symbol)||!['BR','US','CRYPTO'].includes(meta.market)||!/^[A-Z]{3}$/.test(meta.currency))return false;
  const existing=metaOf(meta.symbol);
  if(existing)return existing.market===meta.market&&existing.currency===meta.currency;
  catalog.set(meta.symbol,{meta:{...meta,localOnly:true},quote:null});registerCatalog([]);return true;
 }
 function onNavigate(view){
  if(view==='market')renderExplorer();
  if(view==='asset'){renderDetail();renderFundamentals();}
  if(view==='compare'){renderSelected();renderComparison();}
 }
 function refresh(){renderExplorer();renderDetailHeader();}
 return {mount,refresh,onNavigate,selectAsset,addCompare,registerCatalog,registerLocalInstrument};
}
