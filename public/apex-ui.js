/** VEZORI Portfolio Workspace — real-data adaptation of the supplied Apex visual reference.
 * No demo assets, pseudo-live price movements or artificial historic performance.
 */
import {ASSETS,book,portfolio,validateTransaction} from './finance.js';

const $=id=>document.getElementById(id);
const money=(n,c='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
const number=(n,d=2)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(n);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marketLabel={BR:'Ações Brasil',US:'Internacional',CRYPTO:'Criptomoedas'};
const marketColor={BR:'#10b981',US:'#4bacc7',CRYPTO:'#a78bfa'};
const periodLabels={'1M':'1M','6M':'6M','1A':'1A','YTD':'YTD','ALL':'TUDO'};
const transactionName={buy:'Compra',sell:'Venda',income:'Provento'};

/** Calculated solely from validated user-entered buys. Not a historic portfolio valuation. */
export function portfolioTimeline(txs,period='ALL',referenceDate=new Date()){
 if(!Object.hasOwn(periodLabels,period))throw Error('Período inválido');
 const buys=txs.filter(t=>t.side==='buy'&&ASSETS[t.symbol]).sort((a,b)=>a.date.localeCompare(b.date));
 if(!buys.length)return [];
 const today=new Date(referenceDate.getFullYear(),referenceDate.getMonth(),referenceDate.getDate());
 const start=new Date(today);
 if(period==='1M')start.setMonth(start.getMonth()-1);
 else if(period==='6M')start.setMonth(start.getMonth()-6);
 else if(period==='1A')start.setFullYear(start.getFullYear()-1);
 else if(period==='YTD')start.setMonth(0,1);
 else start.setTime(Date.parse(buys[0].date+'T12:00:00'));
 const from=new Date(start.getFullYear(),start.getMonth(),start.getDate());
 const threshold=from.getFullYear()+'-'+String(from.getMonth()+1).padStart(2,'0')+'-'+String(from.getDate()).padStart(2,'0');
 let cumulative=0;
 const result=[];
 for(const t of buys){
  const amount=(t.qty*t.unitPrice+t.fee)*t.fx;
  if(!Number.isFinite(amount))continue;
  if(t.date<threshold){cumulative+=amount;continue;}
  if(result.length===0)result.push({date:threshold,value:cumulative});
  cumulative+=amount;
  if(result.at(-1)?.date===t.date)result[result.length-1].value=cumulative;
  else result.push({date:t.date,value:cumulative});
 }
 if(result.length===0)return [];
 const end=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
 if(result.at(-1).date<end)result.push({date:end,value:cumulative});
 return result;
}

export function overviewMetrics(txs,quotes=[],fx=[]){
 const p=portfolio(txs,quotes,fx);
 const gross=txs.filter(t=>t.side==='buy').reduce((total,t)=>total+(t.qty*t.unitPrice+t.fee)*t.fx,0);
 const maxWeight=(p.complete&&p.marketBRL>0)?Math.max(...p.rows.map(r=>r.marketBRL||0),0)/p.marketBRL:null;
 const allocations={BR:0,US:0,CRYPTO:0};
 if(p.complete&&p.marketBRL>0){for(const row of p.rows)allocations[ASSETS[row.symbol].market]+=row.marketBRL;}
 return {portfolio:p,gross,maxWeight,allocations};
}

export function createApexDashboard({state,save,portfolioView,navigate}){
 let timeframe='ALL',filter='all',query='',sort='ticker';
 let lineChart=null,donutChart=null;
 const hasCharts=()=>typeof window.Chart==='function';
 function resetCharts(){if(lineChart){lineChart.destroy();lineChart=null;}if(donutChart){donutChart.destroy();donutChart=null;}}
 function chartLines(){
  const values=portfolioTimeline(state.transactions,timeframe);
  const empty=$('apex-evolution-empty'),canvas=$('apex-evolution-chart');
  if(!values.length){if(lineChart){lineChart.destroy();lineChart=null;}empty.hidden=false;canvas.hidden=true;return;}
  empty.hidden=true;canvas.hidden=false;
  if(!hasCharts()){empty.hidden=false;empty.textContent='Gráfico indisponível sem Chart.js. O histórico de aportes permanece na carteira.';return;}
  const labels=values.map(v=>new Date(v.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'}));
  if(lineChart)lineChart.destroy();
  lineChart=new window.Chart(canvas,{type:'line',data:{labels,datasets:[{label:'Compras registradas (R$)',data:values.map(v=>v.value),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.11)',fill:true,tension:.2,borderWidth:2.2,pointRadius:values.length>18?0:2.3,pointHoverRadius:4}]},options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>money(context.parsed.y)}}},scales:{x:{grid:{display:false},ticks:{color:'#91a1b6',maxTicksLimit:8,font:{size:10}}},y:{beginAtZero:true,grid:{color:'rgba(149,170,196,.08)'},ticks:{color:'#91a1b6',maxTicksLimit:5,font:{size:10},callback:v=>'R$ '+number(v/1000,0)+' mil'}}}}});
 }
 function chartAllocation(meta){
  const p=meta.portfolio,valid=p.total>0&&p.complete&&p.marketBRL>0;
  const empty=$('apex-alloc-empty'),canvas=$('apex-allocation-chart');
  empty.hidden=valid;canvas.hidden=!valid;
  const legend=$('apex-alloc-legend');
  if(!valid){if(donutChart){donutChart.destroy();donutChart=null;}legend.innerHTML='';$('apex-allocation-footnote').textContent=p.total?'Cobertura incompleta: o gráfico não soma posições sem preço.':'Registre uma operação para ver a distribuição real.';return;}
  const entries=Object.entries(meta.allocations).filter(([,value])=>value>0);
  legend.innerHTML=entries.map(([key,value])=>`<div class="apex-alloc-legend-item"><i style="background:${marketColor[key]}"></i><span>${marketLabel[key]}</span><strong>${number(value/p.marketBRL*100,1)}%</strong></div>`).join('');
  $('apex-allocation-footnote').textContent='Distribuição pelo valor de mercado com cotações disponíveis na última consulta.';
  if(!hasCharts()){empty.hidden=false;empty.textContent='Gráfico visual indisponível; percentuais ao lado representam dados reais.';return;}
  if(donutChart)donutChart.destroy();
  donutChart=new window.Chart(canvas,{type:'doughnut',data:{labels:entries.map(e=>marketLabel[e[0]]),datasets:[{data:entries.map(e=>e[1]),backgroundColor:entries.map(e=>marketColor[e[0]]),borderWidth:0,hoverOffset:5}]},options:{animation:false,responsive:true,maintainAspectRatio:false,cutout:'73%',plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>context.label+': '+money(context.parsed)}}}}});
 }
 function table(meta){
  let rows=meta.portfolio.rows.filter(row=>(filter==='all'||ASSETS[row.symbol].market===filter)&&(row.symbol.toLowerCase().includes(query)||ASSETS[row.symbol].name.toLowerCase().includes(query)));
  if(sort==='pnl')rows.sort((a,b)=>(b.quoteAvailable?(b.marketBRL-b.costBRL)/Math.max(b.costBRL,.000001):-Infinity)-(a.quoteAvailable?(a.marketBRL-a.costBRL)/Math.max(a.costBRL,.000001):-Infinity));
  else if(sort==='value')rows.sort((a,b)=>(b.marketBRL??-1)-(a.marketBRL??-1));
  else rows.sort((a,b)=>a.symbol.localeCompare(b.symbol));
  $('apex-assets-body').innerHTML=rows.length?rows.map(row=>{
   const m=ASSETS[row.symbol].market,pnl=row.quoteAvailable?row.marketBRL-row.costBRL:null,returnPct=(pnl!=null&&row.costBRL>0)?pnl/row.costBRL*100:null;
   return `<tr><td><strong class="apex-symbol">${esc(row.symbol)}</strong><span class="apex-symbol-sub">${esc(ASSETS[row.symbol].name)}</span></td><td><span class="apex-table-tag">${marketLabel[m]}</span></td><td class="apex-value">${number(row.qty,8)}</td><td class="apex-value">${money(row.costBRL/row.qty)}</td><td class="apex-value">${row.quoteAvailable?money(row.price,row.currency):'Sem cotação'}</td><td class="apex-pnl ${pnl==null?'':pnl>=0?'positive':'negative'}">${returnPct==null?'—':(returnPct>0?'+':'')+number(returnPct)+'%'}</td><td class="apex-value">${row.quoteAvailable?money(row.marketBRL):'—'}</td><td><button class="apex-row-btn" type="button" data-apex-trade="buy" data-apex-symbol="${esc(row.symbol)}" title="Registrar compra">+</button><button class="apex-row-btn" type="button" data-apex-trade="sell" data-apex-symbol="${esc(row.symbol)}" title="Registrar venda">−</button></td></tr>`;
  }).join(''):`<tr><td colspan="8" class="apex-empty-cell">${meta.portfolio.total?'Nenhum ativo corresponde ao filtro.':'Nenhuma posição cadastrada. Use “Nova operação” para começar.'}</td></tr>`;
 }
 function feeds(meta){
  const txs=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  $('apex-recent').innerHTML=txs.length?txs.slice(0,4).map(t=>`<div class="apex-feed-item"><div><strong>${transactionName[t.side]} · ${esc(t.symbol)}</strong><span>${new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR')}${t.side==='income'?'':' · '+number(t.qty,8)+' un.'}</span></div><div class="apex-feed-value">${money((t.side==='income'?t.unitPrice-t.fee:t.qty*t.unitPrice+(t.side==='buy'?t.fee:-t.fee))*t.fx)}</div></div>`).join(''):'<p class="apex-empty-message">Nenhuma operação lançada.</p>';
  const incomes=txs.filter(t=>t.side==='income');
  $('apex-income-events').innerHTML=incomes.length?incomes.slice(0,4).map(t=>`<div class="apex-feed-item"><div><strong>${esc(t.symbol)} · Provento recebido</strong><span>${new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR')}</span></div><div class="apex-feed-value positive">+${money((t.unitPrice-t.fee)*t.fx)}</div></div>`).join(''):'<p class="apex-empty-message">Nenhum provento recebido foi registrado.</p>';
 }
 function render(){
  if(!$('apex-total'))return;
  const meta=overviewMetrics(state.transactions,state.data?.quotes||[],state.data?.fx||[]),p=meta.portfolio;
  $('apex-total').textContent=p.total?(p.complete?money(p.marketBRL):'Parcial'):'R$ 0,00';
  $('apex-total-note').textContent=p.total?`${p.coverage} de ${p.total} posições com preço válido`:'Nenhuma posição cadastrada';
  $('apex-pnl').textContent=p.total&&p.complete?money(p.unrealizedBRL):'—';
  $('apex-pnl').className=p.total&&p.complete?(p.unrealizedBRL>=0?'positive':'negative'):'';
  $('apex-pnl-note').textContent=p.total&&p.complete?'Diferença entre valor atual e custo histórico':'Sem dados suficientes para calcular';
  $('apex-income').textContent=money(p.incomeBRL);
  $('apex-concentration').textContent=meta.maxWeight==null?'—':number(meta.maxWeight*100,1)+'%';
  $('apex-risk-fill').style.width=meta.maxWeight==null?'0%':Math.min(meta.maxWeight*100,100).toFixed(1)+'%';
  $('apex-concentration-note').textContent=meta.maxWeight==null?'Depende da carteira precificada':'Maior posição em relação ao total';
  $('apex-gross').textContent=money(meta.gross);
  $('apex-coverage').textContent=`${p.coverage} / ${p.total}`;
  table(meta);feeds(meta);chartLines();chartAllocation(meta);
 }
 function tradeUI(){
  const symbol=$('apex-trade-symbol').value,side=$('apex-trade-side').value,usd=ASSETS[symbol].currency==='USD';
  $('apex-trade-qty-wrap').hidden=side==='income';$('apex-trade-qty').required=side!=='income';
  $('apex-trade-price-label').textContent=side==='income'?'Valor total do provento':'Preço unitário';
  const fx=$('apex-trade-fx');fx.disabled=!usd;if(!usd)fx.value='1';else if(fx.value==='1')fx.value='';
  $('apex-trade-hint').textContent=usd?'Preço e taxas em USD. Informe o câmbio BRL/USD da data da operação.':'Preço e taxas em BRL. Registre o valor real negociado, não a cotação da tela.';
 }
 function openTrade(symbol='PETR4',side='buy'){
  const dlg=$('apex-trade-modal');
  if(!dlg||!dlg.showModal)return;
  $('apex-trade-form').reset();$('apex-trade-symbol').value=ASSETS[symbol]?symbol:'PETR4';$('apex-trade-side').value=side;
  $('apex-trade-date').value=new Date().toLocaleDateString('en-CA');$('apex-trade-error').textContent='';tradeUI();dlg.showModal();
  $('apex-trade-qty').focus();
 }
 function submitTrade(event){
  event.preventDefault();$('apex-trade-error').textContent='';
  try{
   const side=$('apex-trade-side').value;
   const tx={id:'tx_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)).replaceAll('-',''),date:$('apex-trade-date').value,symbol:$('apex-trade-symbol').value,side,qty:side==='income'?0:Number($('apex-trade-qty').value),unitPrice:Number($('apex-trade-price').value),fee:Number($('apex-trade-fee').value||0),fx:Number($('apex-trade-fx').value)};
   const validated=validateTransaction(tx,state.transactions);
   save([...state.transactions,validated]);portfolioView();$('apex-trade-modal').close();
  }catch(error){$('apex-trade-error').textContent=error.message;}
 }
 function mount(){
  if(!$('apex-total'))return;
  $('apex-trade-symbol').innerHTML=Object.keys(ASSETS).map(s=>`<option value="${s}">${s} · ${esc(ASSETS[s].name)}</option>`).join('');
  $('apex-new-asset').addEventListener('click',()=>openTrade());
  $('apex-trade-close').addEventListener('click',()=>$('apex-trade-modal').close());
  $('apex-trade-cancel').addEventListener('click',()=>$('apex-trade-modal').close());
  $('apex-trade-symbol').addEventListener('change',tradeUI);
  $('apex-trade-side').addEventListener('change',tradeUI);
  $('apex-trade-form').addEventListener('submit',submitTrade);
  $('apex-assets-body').addEventListener('click',event=>{const btn=event.target.closest('[data-apex-trade]');if(btn)openTrade(btn.dataset.apexSymbol,btn.dataset.apexTrade);});
  $('apex-asset-search').addEventListener('input',event=>{query=event.target.value.trim().toLowerCase();table(overviewMetrics(state.transactions,state.data?.quotes||[],state.data?.fx||[]));});
  $('apex-asset-filter').addEventListener('change',event=>{filter=event.target.value;table(overviewMetrics(state.transactions,state.data?.quotes||[],state.data?.fx||[]));});
  $('apex-asset-sort').addEventListener('click',()=>{sort=sort==='ticker'?'pnl':sort==='pnl'?'value':'ticker';$('apex-asset-sort').textContent={ticker:'Ordenar: Ativo ↓',pnl:'Ordenar: Resultado ↓',value:'Ordenar: Valor ↓'}[sort];table(overviewMetrics(state.transactions,state.data?.quotes||[],state.data?.fx||[]));});
  $('apex-timeframe').addEventListener('click',event=>{const btn=event.target.closest('[data-period]');if(!btn)return;timeframe=btn.dataset.period;for(const b of $('apex-timeframe').querySelectorAll('button'))b.classList.toggle('selected',b===btn);chartLines();});
  render();
 }
 return {mount,render,resetCharts};
}