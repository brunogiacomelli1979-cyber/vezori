"""Official Treasury buy/sell morning quotes; not investor realized returns."""
from .core import ODBL, br_date, csv_rows, digest, number, observation, now

URL='https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv'
FIELDS={'Tipo Titulo','Data Vencimento','Data Base','Taxa Compra Manha','Taxa Venda Manha','PU Compra Manha','PU Venda Manha','PU Base Manha'}
def parse(path,source, *, start='2024-01-01'):
    with path.open(encoding='utf-8-sig',newline='') as stream:
        for row in csv_rows(stream,FIELDS):
            day=br_date(row['Data Base']);maturity=br_date(row['Data Vencimento'],future=True)
            if day<start:continue
            title=row['Tipo Titulo'].strip()
            if not title or maturity<day:raise ValueError('Invalid Treasury identity/maturity')
            id='td_'+digest((title+'|'+maturity).encode())[:24]
            values={'date':day,'maturity':maturity,'buyRateAnnualPct':number(row['Taxa Compra Manha'],optional=True),'sellRateAnnualPct':number(row['Taxa Venda Manha'],optional=True),'buyPriceBRL':number(row['PU Compra Manha'],optional=True),'sellPriceBRL':number(row['PU Venda Manha'],optional=True),'basePriceBRL':number(row['PU Base Manha'],optional=True)}
            for field in ['buyPriceBRL','sellPriceBRL','basePriceBRL']:
                if values[field] is not None and values[field]<0:raise ValueError('Negative Treasury unit price')
            indexer='Selic' if 'Selic' in title else 'IPCA' if any(t in title for t in ['IPCA','Renda+','Educa+']) else 'IGP-M' if 'IGPM' in title else 'prefixado' if 'Prefixado' in title else None
            yield id,{'name':title+' · '+maturity,'titleType':title,'maturity':maturity,'indexer':indexer,'unit':'BRL per unit / quoted annual rate or spread over index','currency':'BRL','provider':'Tesouro Transparente','license':ODBL,'frequency':'reported trading daily, morning quotes','priceBasis':'buy/sell/base morning quotes, separately identified','methodology':'For indexed securities, quoted rates are spreads over the index; PU changes omit coupons, reinvestment, fees and taxes and are not realized investor returns.'},observation(day,values,row,source)
def ingest(fetcher,bundle, *, start='2024-01-01'):
    path,source=fetcher.get(URL);batch={}
    for id,meta,row in parse(path,source,start=start):
        item=batch.setdefault(id,{'meta':meta,'rows':[]});item['rows'].append(row)
    for id,item in batch.items():bundle.put('treasury',id,item['meta'],item['rows'])
    if not batch:raise ValueError('No official Treasury data')
    bundle.manifest['datasets']['treasury']={'status':'available','provider':'Tesouro Transparente','license':ODBL,'instrumentsInBatch':len(batch),'requestStart':start,'checkedAt':now()}
