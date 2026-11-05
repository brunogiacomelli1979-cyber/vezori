/** VEZORI Laboratório — portfolio designs for educational, hypothetical simulations.
 * Prices displayed as context only. User-defined rates, not predictions or backtests.
 * Does not modify live positions or simulate trade execution.
 */
import {ASSETS,STRATEGIES} from './finance.js';

export const LAB_BUCKETS=Object.freeze({
  RF_SIM:{name:'Renda fixa / títulos · classe hipotética',currency:'BRL',market:'SIM',assetClass:'fixed',hypothetical:true},
  OURO_SIM:{name:'Ouro · classe hipotética',currency:'BRL',market:'SIM',assetClass:'gold',hypothetical:true},
  COM_SIM:{name:'Commodities · classe hipotética',currency:'BRL',market:'SIM',assetClass:'commodities',hypothetical:true},
  CAIXA_SIM:{name:'Liquidez / caixa · classe hipotética',currency:'BRL',market:'SIM',assetClass:'cash',hypothetical:true}
});
export const LAB_EXTRA=Object.freeze({
  BOVA11:{name:'ETF de referência Ibovespa',currency:'BRL',market:'BR',assetClass:'etf',hypothetical:false},
  BND:{name:'Vanguard Total Bond Market ETF',currency:'USD',market:'US',assetClass:'fixed',hypothetical:false},
  SGOV:{name:'iShares 0-3 Month Treasury Bond ETF',currency:'USD',market:'US',assetClass:'fixed',hypothetical:false},
  GLD:{name:'SPDR Gold Shares',currency:'USD',market:'US',assetClass:'gold',hypothetical:false},
  DBC:{name:'Invesco DB Commodity Index Tracking Fund',currency:'USD',market:'US',assetClass:'commodities',hypothetical:false}
});
/** Study templates are independently authored examples; they are NOT the named investors' holdings. */
export const LAB_PRESETS=Object.freeze([
 {id:'indexacao',description:'Diversificação por índices amplos e parcela de renda fixa. VOO e BOVA11 são exemplos de ETFs, sujeitos a preço/cobertura do fornecedor.',
  picks:[['VOO',50],['BOVA11',20],['RF_SIM',30]],alternatives:['BND','QQQ','ITUB4'],warning:'Os 30% de renda fixa são uma classe conceitual, não um título específico.'},
 {id:'qualidade',description:'Conjunto de empresas para estudar qualidade e valuation. Não foram verificados ROE, margem, vantagem competitiva ou preço justo destas ações.',
  picks:[['ITUB4',25],['AAPL',25],['VALE3',15],['PETR4',15],['CAIXA_SIM',20]],alternatives:['MGLU3','BOVA11','VOO'],warning:'Os tickers são candidatos didáticos, não uma classificação comprovada de qualidade ou valor.'},
 {id:'allweather',description:'Composição educacional por classes econômicas; não é a carteira da Bridgewater nem reproduz o All Weather original.',
  picks:[['VOO',20],['BOVA11',10],['RF_SIM',55],['OURO_SIM',7.5],['COM_SIM',7.5]],alternatives:['BND','GLD','DBC'],warning:'Renda fixa, ouro e commodities são classes hipotéticas até serem substituídas por instrumentos identificados.'},
 {id:'value',description:'Universo inicial de empresas para aplicação futura de filtros fundamentalistas, diversificado com renda fixa conceitual.',
  picks:[['ITUB4',25],['VALE3',20],['PETR4',20],['RF_SIM',35]],alternatives:['AAPL','SGOV','BOVA11'],warning:'Não há cálculo atual de margem de segurança, P/L ou ROE; nenhum papel foi classificado como barato.'},
 {id:'multiclasse',description:'Exemplo multiclasse com ETFs, títulos, ouro e pequena participação em cripto. Volatilidade não é modelada nesta projeção.',
  picks:[['VOO',20],['BOVA11',20],['RF_SIM',45],['OURO_SIM',10],['BTC',3],['ETH',2]],alternatives:['GLD','BND','SOL'],warning:'Cripto pode apresentar perdas elevadas; retornos hipotéticos constantes não reproduzem esse risco.'}
]);

const money=(n,ccy='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:ccy,maximumFractionDigits:2}).format(n);
const fmt=(n,d=2)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assetMeta=(symbol,catalog=[])=>LAB_BUCKETS[symbol]||LAB_EXTRA[symbol]||ASSETS[symbol]||catalog.find(r=>r.symbol===symbol&&r.market==='BR'&&r.currency==='BRL');
export const LAB_DRAFT_KEY='vezori-lab-scenarios-v1';
export const LAB_DEFAULTS=Object.freeze({initial:10000,monthly:300,years:10});
export function suggestedPortfolio(index){
 if(!Number.isInteger(index)||index<0||index>=LAB_PRESETS.length)throw Error('Estratégia inválida');
 return LAB_PRESETS[index].picks.map(([symbol,weight])=>({symbol,weight,rate:demoAnnualRate(symbol,assetMeta(symbol))}));
}
export function validateStudy(rows,params={}){
 if(!Array.isArray(rows)||rows.length<1||rows.length>15)throw Error('Escolha entre 1 e 15 ativos ou classes.');
 const used=new Set(),clean=[];
 for(const row of rows){
  const symbol=String(row?.symbol||'').toUpperCase(),weight=Number(row?.weight),rate=Number(row?.rate);
  if(!/^[A-Z0-9_]{2,12}$/.test(symbol)||used.has(symbol))throw Error('Ativos duplicados ou inválidos.');
  if(!Number.isFinite(weight)||weight<=0||weight>100)throw Error(`Informe um peso maior que zero e até 100% para ${symbol}.`);
  if(!Number.isFinite(rate)||rate< -90||rate>100)throw Error(`A taxa hipotética de ${symbol} deve estar entre -90% e 100% ao ano.`);
  used.add(symbol);clean.push({symbol,weight,rate});
 }
 const sum=clean.reduce((a,r)=>a+r.weight,0);
 if(Math.abs(sum-100)>0.001)throw Error(`A soma dos pesos deve ser 100% (atual: ${fmt(sum)}%).`);
 const initial=Number(params.initial),monthly=Number(params.monthly),years=Number(params.years);
 if(!Number.isFinite(initial)||initial<0||initial>1e8)throw Error('Capital inicial deve estar entre R$ 0 e R$ 100 milhões.');
 if(!Number.isFinite(monthly)||monthly<0||monthly>1e7)throw Error('Aporte mensal deve estar entre R$ 0 e R$ 10 milhões.');
 if(!Number.isInteger(years)||years<1||years>40)throw Error('Horizonte deve ser de 1 a 40 anos.');
 if(initial===0&&monthly===0)throw Error('Informe um capital inicial ou aporte mensal positivo.');
 return {rows:clean,initial,monthly,years};
}
/** Monthly compounding of each sleeve, contributions allocated by *target* weights.
 * Buy-and-hold with target-weight contributions, no rebalancing, costs, FX, dividends, tax, or inflation.
 */
export function simulateStudy(rows,params){
 const clean=validateStudy(rows,params);
 const holdings=clean.rows.map(r=>({symbol:r.symbol,weight:r.weight,rate:r.rate,
  initial:clean.initial*r.weight/100,monthly:clean.monthly*r.weight/100,
  value:clean.initial*r.weight/100,contributed:clean.initial*r.weight/100,
  monthlyRate:Math.pow(1+r.rate/100,1/12)-1}));
 const years=[];
 for(let month=1;month<=clean.years*12;month++){
  for(const h of holdings){h.value=h.value*(1+h.monthlyRate)+h.monthly;h.contributed+=h.monthly;}
  if(month%12===0){
   const amount=holdings.reduce((s,h)=>s+h.value,0),capital=clean.initial+clean.monthly*month;
   years.push({year:month/12,amount,capital,gain:amount-capital});
  }
 }
 const total=holdings.reduce((s,h)=>s+h.value,0),invested=clean.initial+clean.monthly*clean.years*12;
 if(!Number.isFinite(total))throw Error('Projeção matemática excedeu o limite numérico.');
 return {total,invested,gain:total-invested,years,holdings:holdings.map(h=>({symbol:h.symbol,weight:h.weight,rate:h.rate,amount:h.value,invested:h.contributed,gain:h.value-h.contributed,finalWeight:total?h.value/total*100:0})),params:{initial:clean.initial,monthly:clean.monthly,years:clean.years}};
}
/** Educational arbitrary rate set, only applied after an explicit user click. */
export function demoAnnualRate(symbol,metadata=assetMeta(symbol)){
 if(metadata?.assetClass&&['fixed','gold','commodities','cash'].includes(metadata.assetClass))return {fixed:5,gold:4,commodities:3,cash:0}[metadata.assetClass];
 if(['BTC','ETH','SOL'].includes(symbol))return 12;
 if(symbol==='VOO'||symbol==='QQQ'||symbol==='BOVA11')return 7;
 return 8;
}

export function createLabBuilder({state}){
 const $=id=>document.getElementById(id);
 let active=0,drafts={},holdings=suggestedPortfolio(0),params={...LAB_DEFAULTS},initialized=false;
 const note='As taxas pré-preenchidas são exemplos arbitrários para exercício, NÃO expectativas de retorno. Você pode alterá-las ou zerá-las; cotações reais não entram no cálculo.';
 function liveMeta(symbol){return assetMeta(symbol,state.catalog||[]);}
 function latest(symbol){
  const q=(state.data?.quotes||[]).find(q=>q.symbol===symbol)||state.catalog?.find(q=>q.symbol===symbol);
  return q&&Number.isFinite(q.price)&&q.price>0?q:null;
 }
 function restore(){
  try{
   const parsed=JSON.parse(localStorage.getItem(LAB_DRAFT_KEY)||'{}');
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return;
   for(let i=0;i<LAB_PRESETS.length;i++){
    const d=parsed[i];
    if(!d||!Array.isArray(d.holdings)||d.holdings.length>15)continue;
    const clean=d.holdings.filter(row=>row&&Number.isFinite(row.weight)&&Number.isFinite(row.rate)&&row.weight>=0&&row.weight<=100&&row.rate>=-90&&row.rate<=100&&/^[A-Z0-9_]{2,12}$/.test(row.symbol));
    if(clean.length!==d.holdings.length||new Set(clean.map(x=>x.symbol)).size!==clean.length)continue;
    const p=d.params;
    if(!p||!Number.isFinite(p.initial)||p.initial<0||p.initial>1e8||!Number.isFinite(p.monthly)||p.monthly<0||p.monthly>1e7||!Number.isInteger(p.years)||p.years<1||p.years>40)continue;
    drafts[i]={holdings:clean.map(x=>({symbol:x.symbol,weight:x.weight,rate:x.rate})),params:{initial:p.initial,monthly:p.monthly,years:p.years}};
   }
  }catch{/* Local storage may be corrupt or blocked; do not overwrite the investment portfolio. */}
 }
 function save(){
  drafts[active]={holdings:holdings.map(r=>({...r})),params:{...params}};
  try{localStorage.setItem(LAB_DRAFT_KEY,JSON.stringify(drafts));}catch{/* storage unavailable */}
 }
 function clearResult(){
  $('lab-result-summary').innerHTML='<p>Configure as premissas e selecione <strong>Calcular cenário</strong> para ver a projeção.</p>';
  $('lab-result-chart').innerHTML='';
  $('lab-result-holdings').innerHTML='';
  $('lab-result-note').textContent='Nenhum resultado calculado. Alterações nos pesos ou nas taxas invalidam o cenário anterior.';
  $('lab-status').textContent='Aguardando cálculo';
 }
 function catalogOptions(){
  const universe=new Map(Object.entries(ASSETS).map(([symbol,meta])=>[symbol,meta]));
  for(const [symbol,meta] of Object.entries(LAB_EXTRA))universe.set(symbol,meta);
  for(const [symbol,meta] of Object.entries(LAB_BUCKETS))universe.set(symbol,meta);
  for(const item of state.catalog||[])if(item.market==='BR'&&item.currency==='BRL'&&/^[A-Z0-9]{3,12}$/.test(item.symbol)&&!universe.has(item.symbol))universe.set(item.symbol,item);
  return [...universe].sort(([a],[b])=>a.localeCompare(b)).map(([symbol,meta])=>`<option value="${esc(symbol)}">${esc(symbol)} · ${esc(meta.name||symbol)}</option>`).join('');
 }
 function weightStatus(){
  const weight=holdings.reduce((sum,r)=>sum+(Number.isFinite(Number(r.weight))?Number(r.weight):0),0);
  const okay=Math.abs(weight-100)<=.001&&holdings.length>0&&holdings.every(r=>Number.isFinite(r.weight)&&r.weight>0);
  $('lab-weights').textContent=`${fmt(weight)}% / 100%`;
  $('lab-weights').className='lab-weight-state '+(okay?'valid':'invalid');
  $('lab-weights-note').textContent=okay?'Pesos válidos para simulação.':'Ajuste os pesos até que somem exatamente 100%, sem posições com 0%.';
  $('lab-run').disabled=!okay;
 }
 function renderHoldings(){
  const rows=holdings.map((row,index)=>{
   const meta=liveMeta(row.symbol),q=latest(row.symbol),quoteLine=meta?.hypothetical?'Classe ilustrativa · sem cotação':q?`${money(q.price,q.currency||'BRL')} (apenas referência de mercado)`:'Cotação não disponível nesta consulta';
   return `<tr><td><div class="lab-asset-name"><strong>${esc(row.symbol)}</strong><small>${esc(meta?.name||row.symbol)}</small><small class="lab-asset-quote">${esc(quoteLine)}</small></div></td>
    <td><label class="lab-cell-input"><span class="lab-sr-only">Peso de ${esc(row.symbol)} (%)</span><input type="number" data-lab-field="weight" data-lab-index="${index}" min="0" max="100" step="0.5" value="${Number.isFinite(row.weight)?row.weight:''}" inputmode="decimal" aria-label="Peso de ${esc(row.symbol)} em porcentagem" /><span>%</span></label></td>
    <td><label class="lab-cell-input"><span class="lab-sr-only">Taxa anual hipotética de ${esc(row.symbol)} (%)</span><input type="number" data-lab-field="rate" data-lab-index="${index}" min="-90" max="100" step="0.5" value="${Number.isFinite(row.rate)?row.rate:''}" inputmode="decimal" aria-label="Taxa anual hipotética de ${esc(row.symbol)}" /><span>%</span></label></td>
    <td><button class="lab-delete" type="button" data-lab-remove="${index}" aria-label="Retirar ${esc(row.symbol)} da simulação">×</button></td></tr>`;
  }).join('');
  $('lab-rows').innerHTML=rows||'<tr><td colspan="4">Nenhum ativo selecionado. Escolha um ativo e adicione-o.</td></tr>';
  weightStatus();
 }
 function renderSuggestions(){
  const s=STRATEGIES[active],preset=LAB_PRESETS[active];
  $('lab-model').value=String(active);
  $('lab-model-caption').textContent=`${s.by} · ${s.desc}`;
  $('lab-preset-description').textContent=preset.description;
  $('lab-risk-note').textContent=preset.warning;
  $('lab-alternatives').innerHTML=preset.alternatives.map(symbol=>{
   const selected=holdings.some(h=>h.symbol===symbol),meta=liveMeta(symbol);
   return `<button type="button" data-lab-alt="${esc(symbol)}" ${selected?'disabled':''} title="${esc(meta?.name||symbol)}">+ ${esc(symbol)}</button>`;
  }).join('');
  $('lab-add-asset').innerHTML='<option value="">Selecione outro ativo ou classe…</option>'+catalogOptions();
  $('lab-add-asset').value='';
  $('lab-initial').value=String(params.initial);
  $('lab-monthly').value=String(params.monthly);
  $('lab-years').value=String(params.years);
  renderHoldings();
 }
 function selectModel(index){
  if(!Number.isInteger(index)||index<0||index>=LAB_PRESETS.length)return;
  if(initialized)save();active=index;
  const d=drafts[index];holdings=d?d.holdings.map(r=>({...r})):suggestedPortfolio(index);
  params=d?{...d.params}:{...LAB_DEFAULTS};
  $('lab-error').textContent='';renderSuggestions();clearResult();initialized=true;
   $('lab-message').textContent=holdings.every(r=>r.rate===0)?
    'Todas as taxas estão em 0% a.a.: este cenário terá apenas o capital aportado. Para testar ganhos e perdas, aplique hipóteses ilustrativas ou edite cada taxa.':note;
  document.querySelectorAll('[data-lab-template]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.labTemplate)===active)));
 }
 function add(symbol){
  if(!liveMeta(symbol)){setError('Ativo não encontrado no catálogo disponível.');return;}
  if(holdings.some(x=>x.symbol===symbol)){setError('O ativo já está na simulação. Ajuste o peso na linha existente.');return;}
  if(holdings.length>=15){setError('A simulação comporta até 15 ativos ou classes.');return;}
  // Transfere automaticamente parte do maior peso para a posição incluída.
  let moved=100,from=null;
  if(holdings.length){
   const largest=holdings.reduce((best,row)=>row.weight>best.weight?row:best,holdings[0]);
   moved=Math.min(10,Math.floor(largest.weight/2*2)/2);
   if(moved<=0){setError('Ajuste os pesos atuais antes de incluir mais ativos.');return;}
   from=largest.symbol;largest.weight=Math.round((largest.weight-moved)*1000)/1000;
  }
  holdings.push({symbol,weight:moved,rate:0});
  setError('');save();renderSuggestions();clearResult();
  $('lab-message').textContent=from?`${symbol} adicionado com ${fmt(moved)}% transferidos de ${from}. Confira e ajuste os pesos.`:`${symbol} adicionado com 100% da carteira. Você pode dividir o peso entre outros ativos.`;
 }
 function setError(message){$('lab-error').textContent=message||'';}
 function renderProjection(result){
  const p=result.params;
  const last=result.years.at(-1);
  $('lab-result-summary').innerHTML=`<div><span>Patrimônio matemático no cenário</span><strong>${money(result.total)}</strong></div><div><span>Total aportado</span><strong>${money(result.invested)}</strong></div><div><span>Diferença hipotética</span><strong class="${result.gain>=0?'lab-positive':'lab-negative'}">${money(result.gain)}</strong></div><div><span>Horizonte</span><strong>${p.years} anos</strong></div>`;
  const timeline=[{year:0,amount:p.initial,capital:p.initial},...result.years];
  const max=Math.max(...timeline.map(y=>y.amount),...timeline.map(y=>y.capital),1),w=940,h=255,pad={left:70,right:22,top:18,bottom:34};
  const px=i=>pad.left+i/(Math.max(timeline.length-1,1))*(w-pad.left-pad.right),py=value=>h-pad.bottom-value/max*(h-pad.top-pad.bottom);
  const lineFor=key=>timeline.map((r,i)=>(i===0?'M':'L')+px(i).toFixed(2)+' '+py(r[key]).toFixed(2)).join(' ');
  const guidelines=[0,.25,.5,.75,1].map(f=>`<line x1="${pad.left}" x2="${w-pad.right}" y1="${py(max*f).toFixed(2)}" y2="${py(max*f).toFixed(2)}" stroke="#415066" stroke-opacity=".4"/><text x="${pad.left-10}" y="${(py(max*f)+4).toFixed(2)}" text-anchor="end" fill="#94a3b8" font-size="11">${esc(fmt(max*f/1000,0))}k</text>`).join('');
  $('lab-result-chart').innerHTML=`<svg role="img" aria-label="Evolução matemática de cenário em ${p.years} anos, com total projetado de ${esc(money(result.total))}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${guidelines}<path d="${lineFor('capital')}" fill="none" stroke="#7a93aa" stroke-width="2" stroke-dasharray="6 5"/><path d="${lineFor('amount')}" fill="none" stroke="#10b981" stroke-width="3"/><text x="${pad.left}" y="${h-7}" fill="#a5b9ca" font-size="11">Ano 0</text><text x="${w-pad.right}" y="${h-7}" text-anchor="end" fill="#a5b9ca" font-size="11">Ano ${p.years}</text></svg><div class="lab-chart-legend"><span><i class="lab-line-green"></i>Valor hipotético</span><span><i class="lab-line-gray"></i>Capital aportado</span></div>`;
  $('lab-result-holdings').innerHTML=result.holdings.map(row=>`<tr><td>${esc(row.symbol)}</td><td>${fmt(row.weight)}%</td><td>${fmt(row.rate)}% a.a.</td><td>${money(row.amount)}</td><td>${fmt(row.finalWeight)}%</td></tr>`).join('');
  $('lab-result-note').textContent=`Resultado nominal de ${p.years} anos. Juro mensal equivalente = (1 + taxa anual/100)^(1/12) − 1; aporte aplicado no fim de cada mês. Não há rebalanceamento. Não inclui tributos, custos, proventos, inflação, câmbio ou volatilidade. Taxas são hipóteses, não previsões.`;
  const flat=result.holdings.every(row=>row.rate===0);
  $('lab-status').textContent=flat?'Taxas 0%: sem rendimento':`Cenário ilustrativo · ${result.holdings.length} posições`;
  $('lab-message').textContent=flat?
   'O resultado corresponde apenas aos aportes: todas as taxas foram zeradas, portanto não existe ganho ou perda matemática.':
   'Simulação matemática calculada a partir das taxas anuais editáveis; resultados futuros podem ser totalmente diferentes.';
 }
 function calculate(){
  setError('');
  try{
   const r=simulateStudy(holdings,params);renderProjection(r);save();
  }catch(e){setError(e.message);clearResult();}
 }
 function mount(){
  restore();
  $('lab-model').innerHTML=STRATEGIES.map((s,i)=>`<option value="${i}">${esc(s.title)}</option>`).join('');
  $('lab-model').addEventListener('change',e=>selectModel(Number(e.target.value)));
  $('strategies-grid').addEventListener('click',e=>{
   const button=e.target.closest('[data-lab-template]');if(!button)return;
   selectModel(Number(button.dataset.labTemplate));$('lab-builder').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('lab-reset').addEventListener('click',()=>{
   holdings=suggestedPortfolio(active);params={...LAB_DEFAULTS};save();setError('');renderSuggestions();clearResult();
  });
  $('lab-add').addEventListener('click',()=>add($('lab-add-asset').value));
  $('lab-alternatives').addEventListener('click',e=>{const b=e.target.closest('[data-lab-alt]');if(b)add(b.dataset.labAlt);});
  $('lab-rows').addEventListener('input',e=>{
   const input=e.target.closest('[data-lab-field]');if(!input)return;
   const index=Number(input.dataset.labIndex),field=input.dataset.labField;
   if(!holdings[index]||!['weight','rate'].includes(field))return;
   holdings[index][field]=input.value===''?NaN:Number(input.value);
   setError('');weightStatus();clearResult();
  });
  $('lab-rows').addEventListener('change',()=>{save();renderHoldings();});
  $('lab-rows').addEventListener('click',e=>{
   const b=e.target.closest('[data-lab-remove]');if(!b)return;
   const removed=holdings.splice(Number(b.dataset.labRemove),1)[0];
   if(removed&&holdings.length){
    const largest=holdings.reduce((best,row)=>row.weight>best.weight?row:best,holdings[0]);
    largest.weight=Math.round((largest.weight+removed.weight)*1000)/1000;
   }
   save();renderSuggestions();clearResult();
  });
  for(const [id,key] of [['lab-initial','initial'],['lab-monthly','monthly'],['lab-years','years']]){
   $(id).addEventListener('input',e=>{params[key]=e.target.value===''?NaN:Number(e.target.value);save();clearResult();});
  }
  $('lab-demo-rates').addEventListener('click',()=>{
   holdings=holdings.map(row=>({...row,rate:demoAnnualRate(row.symbol,liveMeta(row.symbol))}));save();renderSuggestions();clearResult();
   $('lab-message').textContent='Taxas de exemplo aplicadas. Valores arbitrários para aprendizagem, não retornos históricos ou esperados.';
  });
  $('lab-zero-rates').addEventListener('click',()=>{
   holdings=holdings.map(row=>({...row,rate:0}));save();renderSuggestions();clearResult();
   $('lab-message').textContent='Todas as taxas agora são 0%. O cálculo mostrará somente o capital aportado, sem rendimento.';
  });
  $('lab-run').addEventListener('click',calculate);
  selectModel(0);
  // selectModel informa o tipo de cenário ao carregar o modelo.
 }
 function refreshQuotes(){
  if($('lab-builder')&&document.querySelector('#view-strategies')?.classList.contains('active')){
   renderHoldings();$('lab-add-asset').innerHTML='<option value="">Selecione outro ativo ou classe…</option>'+catalogOptions();
  }
 }
 return {mount,selectModel,refreshQuotes};
}