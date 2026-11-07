export function validISODate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
/** Fail closed on invalid or conflicting observations; never interpolate. */
export function normalizeHistoryPoints(points,{asOf=new Date().toISOString().slice(0,10)}={}){
 if(!Array.isArray(points)||points.length>10000)throw Error('Histórico inválido ou excessivo');
 const dates=new Map();
 for(const point of points){
  if(!validISODate(point.date)||point.date>asOf||typeof point.close!=='number'||!Number.isFinite(point.close)||point.close<=0)throw Error('Data ou preço inválido no histórico');
  if(dates.has(point.date)&&dates.get(point.date)!==point.close)throw Error('Preços conflitantes para a mesma data');
  dates.set(point.date,point.close);
 }
 return [...dates].sort(([a],[b])=>a.localeCompare(b)).map(([date,close])=>({date,close}));
}
export function withHistoryCoverage(series){
 const points=normalizeHistoryPoints(series.points),gaps=[];
 for(let i=1;i<points.length;i++){
  const days=(Date.parse(points[i].date)-Date.parse(points[i-1].date))/86400000;
  if(days>1)gaps.push({from:points[i-1].date,to:points[i].date,calendarDays:days});
 }
 const expected=points.length?1+(Date.parse(points.at(-1).date)-Date.parse(points[0].date))/86400000:0;
 return {...series,points,coverage:{...series.coverage,observations:points.length,frequency:'daily',
  calendar:series.market==='CRYPTO'?'UTC 24/7':'exchange sessions not fully reconciled',
  observedSpanCoveragePct:series.market==='CRYPTO'&&expected?points.length/expected*100:null,
  coverageSinceListingPct:null,completeSinceListing:false,gapCandidates:gaps,
  gapNote:'Gaps in calendar days; exchange weekends/holidays are not necessarily missing sessions. No interpolation.',
  corporateActionsVerified:series.corporateActionsVerified===true,storageRights:'requires provider-specific terms verification'}};
}
