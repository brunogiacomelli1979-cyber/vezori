"""BCB rates are distinct instruments: annual target, daily effective, monthly inflation, PTAX."""
import json
from datetime import date
from urllib.parse import urlencode
from .core import BCB_TERMS, br_date, iso, number, observation, now

SERIES={
 'selic_target':{'code':432,'name':'Meta Selic','unit':'% a.a.','frequency':'daily target in force'},
 'selic_effective':{'code':11,'name':'Selic efetiva','unit':'% a.d.','frequency':'business daily'},
 'cdi':{'code':12,'name':'CDI — SGS 12','unit':'% a.d.','frequency':'business daily'},
 'ipca':{'code':433,'name':'IPCA — SGS/IBGE','unit':'% a.m.','frequency':'monthly'},
}
def parse_sgs(raw, *, start,end,source):
    if not isinstance(raw,list) or not raw:raise ValueError('SGS empty/unexpected response')
    result={}
    for row in raw:
        if not {'data','valor'}<=set(row):raise ValueError('SGS schema changed')
        day=br_date(row['data']);value=number(row['valor'])
        if day<start or day>end:raise ValueError('SGS point outside requested window')
        if day in result and result[day]['values']['value']!=value:raise ValueError('Conflicting SGS duplicate')
        result[day]=observation(day,{'date':day,'value':value},row,source)
    return list(result.values())
def ingest(fetcher,bundle, *, start='2024-01-01',end=None):
    end=end or date.today().isoformat();iso(start);iso(end)
    if start>end or (date.fromisoformat(end)-date.fromisoformat(start)).days>3650:raise ValueError('SGS window must be 0–10 years')
    for id,meta in SERIES.items():
        args=urlencode({'formato':'json','dataInicial':date.fromisoformat(start).strftime('%d/%m/%Y'),'dataFinal':date.fromisoformat(end).strftime('%d/%m/%Y')})
        url=f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{meta["code"]}/dados?'+args
        path,source=fetcher.get(url,license=BCB_TERMS)
        rows=parse_sgs(json.loads(path.read_bytes()),start=start,end=end,source=source)
        bundle.put('macro',id,{**meta,'provider':'BCB SGS','currency':'BRL','license':BCB_TERMS,'metadataUrl':f'https://www3.bcb.gov.br/sgspub/consultarmetadados/consultarMetadadosSeries.do?method=consultarMetadadosSeriesInternet&hdOidSerieSelecionada={meta["code"]}','priceBasis':'official rate; not a security price','coverageNote':'Observed dates only; no holiday/month interpolation. IPCA reference date identifies a month, not publication day.'},rows)
    params=urlencode({'@dataInicial':"'"+date.fromisoformat(start).strftime('%m-%d-%Y')+"'",'@dataFinalCotacao':"'"+date.fromisoformat(end).strftime('%m-%d-%Y')+"'",'$format':'json','$top':'10000'})
    url='https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?'+params
    path,source=fetcher.get(url,license=BCB_TERMS);raw=json.loads(path.read_bytes())
    if raw.get('@odata.nextLink'):raise ValueError('PTAX requires pagination before publishing')
    rows=[];seen={}
    for item in raw.get('value',[]):
        day=iso(item['dataHoraCotacao'][:10])
        if not start<=day<=end:raise ValueError('PTAX outside requested window')
        buy=number(item['cotacaoCompra']);sell=number(item['cotacaoVenda'])
        if buy<=0 or sell<=0 or buy>sell:raise ValueError('PTAX quote invalid')
        if day in seen and seen[day]!=(buy,sell):raise ValueError('Multiple PTAX values for same reference date')
        if day in seen:continue
        seen[day]=(buy,sell);rows.append(observation(day,{'date':day,'buy':buy,'sell':sell,'sourceTimestamp':item['dataHoraCotacao']},item,source))
    if not rows:raise ValueError('No official PTAX observations')
    bundle.put('macro','ptax_usd_brl',{'name':'PTAX USD/BRL','provider':'BCB PTAX','unit':'BRL per USD','currency':'BRL','frequency':'business daily official reference','license':BCB_TERMS,'priceBasis':'official PTAX buy/sell reference, not brokerage execution FX','sourceTimeZone':'America/Sao_Paulo'},rows)
    bundle.manifest['datasets']['macro']={'status':'available','provider':'BCB SGS / PTAX','series':5,'checkedAt':now(),'requestStart':start,'requestEnd':end}
