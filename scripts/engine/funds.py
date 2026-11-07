"""CVM fund NAV is accounting value, never a traded quote."""
from datetime import date
from zipfile import ZipFile
from .core import ODBL, cnpj, iso, number, observation, zip_rows, now

def daily_rows(path,source, *, selected=None,identities_only=False):
    with ZipFile(path) as z:names=z.namelist()
    if len(names)!=1 or not names[0].endswith('.csv'):raise ValueError('Unexpected daily fund archive')
    for row in zip_rows(path,names[0],{'DT_COMPTC','VL_PATRIM_LIQ','VL_QUOTA','CAPTC_DIA','RESG_DIA','NR_COTST'}):
        field='CNPJ_FUNDO_CLASSE' if 'CNPJ_FUNDO_CLASSE' in row else 'CNPJ_FUNDO' if 'CNPJ_FUNDO' in row else None
        if not field:raise ValueError('Fund identity schema changed')
        id=cnpj(row[field]);sub=row.get('ID_SUBCLASSE') or None
        if sub:id+='_'+sub
        if identities_only:
            yield id,None
            continue
        if selected is not None and id not in selected:continue
        day=iso(row['DT_COMPTC'])
        values={'date':day,'cnpj':cnpj(row[field]),'subclassId':sub,'navBRL':number(row['VL_PATRIM_LIQ'],optional=True),'navPerUnitBRL':number(row['VL_QUOTA'],optional=True),'subscriptionsBRL':number(row['CAPTC_DIA'],optional=True),'redemptionsBRL':number(row['RESG_DIA'],optional=True),'investors':number(row['NR_COTST'],optional=True)}
        if values['investors'] is not None and (values['investors']<0 or int(values['investors'])!=values['investors']):raise ValueError('Invalid investor count')
        yield id,observation(day,values,row,{**source,'member':names[0]})

def ingest_daily(fetcher,bundle, *, months,limit=100):
    paths=[];ids=set()
    for month in months:
        url='https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_'+month+'.zip'
        try:path,source=fetcher.get(url)
        except RuntimeError as e:
            if month==date.today().strftime('%Y%m') and 'HTTP 404' in str(e):continue
            raise
        paths.append((path,source))
        for id,row in daily_rows(path,source,identities_only=True):ids.add(id)
    # An explicit, stable bounded pilot; no selection based on apparent investment performance.
    chosen=set(sorted(ids)[:limit]);rows={id:[] for id in chosen}
    for path,source in paths:
        for id,row in daily_rows(path,source,selected=chosen):
            if id in chosen:rows[id].append(row)
    for id,data in rows.items():
        if data:bundle.put('funds',id,{'name':'CVM classe/fundo '+id,'license':ODBL,'provider':'CVM Informe Diário','currency':'BRL','frequency':'reported business daily','priceBasis':'accounting NAV per unit, not exchange trading price','coverageNote':'Pilot: first '+str(limit)+' class/subclass identifiers in lexicographic order in selected monthly archives; not all funds or a recommendation'},data)
    if not rows:raise ValueError('No daily fund records')
    bundle.manifest['datasets']['funds']={'status':'available','provider':'CVM Informe Diário','license':ODBL,'monthsRequested':months,'filesAvailable':len(paths),'pilotLimit':limit,'instrumentsInBatch':len(rows),'checkedAt':now()}

def ingest_fii(fetcher,bundle, *, year):
    url=f'https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_{year}.zip'
    path,source=fetcher.get(url);meta={}
    general=f'inf_mensal_fii_geral_{year}.csv';complement=f'inf_mensal_fii_complemento_{year}.csv'
    for row in zip_rows(path,general,{'CNPJ_Fundo_Classe','Data_Referencia','Versao','Data_Entrega','Nome_Fundo_Classe','Codigo_ISIN'}):
        id=cnpj(row['CNPJ_Fundo_Classe']);ref=iso(row['Data_Referencia']);version=int(row['Versao'])
        published=iso(row['Data_Entrega'][:10]) if row['Data_Entrega'] else None
        meta[(id,ref,version)]={'name':row['Nome_Fundo_Classe'],'isin':row['Codigo_ISIN'] or None,'publishedAt':published}
    batch={}
    for row in zip_rows(path,complement,{'CNPJ_Fundo_Classe','Data_Referencia','Versao','Patrimonio_Liquido','Valor_Patrimonial_Cotas','Total_Numero_Cotistas','Cotas_Emitidas'}):
        id=cnpj(row['CNPJ_Fundo_Classe']);ref=iso(row['Data_Referencia']);version=int(row['Versao'])
        identity=meta.get((id,ref,version),{'name':'FII '+id,'isin':None,'publishedAt':None})
        values={'date':ref,'referenceMonth':ref[:7],'filingVersion':version,'publishedAt':identity['publishedAt'],'navBRL':number(row['Patrimonio_Liquido'],optional=True),'navPerUnitBRL':number(row['Valor_Patrimonial_Cotas'],optional=True),'unitsIssued':number(row['Cotas_Emitidas'],optional=True),'investors':number(row['Total_Numero_Cotistas'],optional=True)}
        raw={k:row[k] for k in ['CNPJ_Fundo_Classe','Data_Referencia','Versao','Patrimonio_Liquido','Valor_Patrimonial_Cotas','Total_Numero_Cotistas','Cotas_Emitidas']}
        item=batch.setdefault(id,{'meta':identity,'rows':[]})
        item['meta']=identity;item['rows'].append(observation(ref+'|'+str(version),values,raw,{**source,'member':complement}))
    for id,item in batch.items():bundle.put('fii',id,{'name':item['meta']['name'],'isin':item['meta']['isin'],'license':ODBL,'provider':'CVM FII Informe Mensal','currency':'BRL','frequency':'monthly, source month reference date retained','priceBasis':'accounting NAV per unit, not exchange price; no dividend yield inferred'},item['rows'])
    if not batch:raise ValueError('No FII monthly records')
    bundle.manifest['datasets']['fii']={'status':'available','provider':'CVM FII Informe Mensal','license':ODBL,'year':year,'instrumentsInBatch':len(batch),'checkedAt':now()}
