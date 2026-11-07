"""Official CVM registry + historical DFP/ITR; no ticker inference or mixed durations."""
from pathlib import Path
from zipfile import ZipFile
import io
from scripts.cvm_extract import file_key, source_url, normalize_scale, decimal_pt
from scripts.publish_cvm_fundamentals import ISSUERS, CODE_PREFIXES
from .core import ODBL, cnpj, csv_rows, iso, number, observation, zip_rows

REGISTRY='https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv'
def registry(fetcher):
    path,source=fetcher.get(REGISTRY)
    result={}
    with path.open(encoding='latin1',newline='') as stream:
        for row in csv_rows(stream,{'CNPJ_CIA','DENOM_SOCIAL','CD_CVM','SETOR_ATIV','SIT'}):
            id=cnpj(row['CNPJ_CIA'])
            # Explicit whitelist: registry contacts, addresses and natural persons are not copied.
            result[id]={'cnpj':id,'name':row['DENOM_SOCIAL'],'cvmCode':row['CD_CVM'],'sector':row['SETOR_ATIV'],'registrationStatus':row['SIT'],'registryProvenance':source,'symbols':[s for s,m in ISSUERS.items() if m['cnpj']==id]}
    return result

def extract(path,source,kind,year):
    with ZipFile(path) as archive:
        general=f'{kind.lower()}_cia_aberta_{year}.csv'
        filings={}
        for row in zip_rows(path,general,{'CNPJ_CIA','DT_REFER','VERSAO','DT_RECEB','ID_DOC'}):
            filings[(cnpj(row['CNPJ_CIA']),iso(row['DT_REFER']),int(row['VERSAO']))]={'publishedAt':iso(row['DT_RECEB']) if row['DT_RECEB'] else None,'documentId':row['ID_DOC'],'documentUrl':row.get('LINK_DOC') or None}
        for scope in ['con','ind']:
            for name in archive.namelist():
                statement=file_key(name,kind,year,scope)
                if not statement:continue
                for row in zip_rows(path,name,{'CNPJ_CIA','DT_REFER','VERSAO','CD_CVM','DENOM_CIA','CD_CONTA','DS_CONTA','VL_CONTA','MOEDA','ESCALA_MOEDA','ORDEM_EXERC','DT_FIM_EXERC'}):
                    if row['CD_CONTA'] not in CODE_PREFIXES[statement]:continue
                    id=cnpj(row['CNPJ_CIA']);reference=iso(row['DT_REFER']);end=iso(row['DT_FIM_EXERC'])
                    start=iso(row['DT_INI_EXERC']) if row.get('DT_INI_EXERC') else None
                    if start and start>end:raise ValueError('CVM duration inverted')
                    version=int(row['VERSAO'])
                    if version<1:raise ValueError('CVM filing version must be positive')
                    unit,scale=normalize_scale(row['ESCALA_MOEDA'])
                    currency='BRL' if row['MOEDA'].strip().upper() in {'REAL','REAIS','BRL'} else None
                    amount=decimal_pt(row['VL_CONTA'])
                    raw={k:row.get(k) for k in ['CNPJ_CIA','CD_CVM','DT_REFER','DT_INI_EXERC','DT_FIM_EXERC','VERSAO','ORDEM_EXERC','CD_CONTA','DS_CONTA','VL_CONTA','MOEDA','ESCALA_MOEDA']}
                    filing=filings.get((id,reference,version),{'publishedAt':None,'documentId':None,'documentUrl':None})
                    values={'kind':kind,'scope':scope,'statement':statement,'referenceDate':reference,'periodEnd':end,'periodStart':start,'filingVersion':version,'exerciseOrder':row['ORDEM_EXERC'],'accountCode':row['CD_CONTA'],'label':row['DS_CONTA'],'currency':currency,'sourceCurrency':row['MOEDA'],'sourceScale':row['ESCALA_MOEDA'],'valueBRL':float(amount*scale) if currency and scale is not None else None,**filing}
                    key='|'.join([kind,scope,reference,end,start or '',str(version),statement,row['CD_CONTA'],row['ORDEM_EXERC']])
                    yield id,{'name':row['DENOM_CIA'],'cvmCode':row['CD_CVM']},observation(key,values,raw,{**source,'member':name})

def indicators(document):
    # A specific filing revision and scope is a single accounting universe.
    latest={r['key']:r for r in document['observations']};groups={}
    for row in latest.values():
        v=row['values']
        if v['currency']!='BRL' or v['valueBRL'] is None:continue
        key=(v['kind'],v['scope'],v['referenceDate'],v['filingVersion'])
        groups.setdefault(key,[]).append(row)
    sector=document.get('sector','').strip()
    financial=any(s in sector.lower() for s in ['banco','intermedia','segur','previd','crédito','securitiz','arrendamento'])
    result=[]
    for key,rows in sorted(groups.items()):
        current=[r for r in rows if r['values']['periodEnd']==key[2]]
        # Ratios by duration: never mix an isolated quarter with YTD in the same filing.
        starts={r['values']['periodStart'] for r in current if r['values']['statement']=='DRE'}
        for start in starts:
            def fact(statement,code,period_start=None):
                found=[r for r in current if r['values']['statement']==statement and r['values']['accountCode']==code and (period_start is None or r['values']['periodStart']==period_start)]
                return found[0] if len(found)==1 else None
            revenue=fact('DRE','3.01',start);income=fact('DRE','3.11',start);gross=fact('DRE','3.03',start)
            assets=fact('BPA','1');ca=fact('BPA','1.01');cl=fact('BPP','2.01');nc=fact('BPP','2.02');equity=fact('BPP','2.03')
            def ratio(a,b):return a['values']['valueBRL']/b['values']['valueBRL'] if a and b and b['values']['valueBRL']>0 else None
            metrics={}
            if sector and not financial:
                metrics['currentRatio']=ratio(ca,cl)
                metrics['netMarginPct']=None if ratio(income,revenue) is None else ratio(income,revenue)*100
                metrics['grossMarginPct']=None if ratio(gross,revenue) is None else ratio(gross,revenue)*100
                metrics['liabilitiesToAssetsPct']=(cl['values']['valueBRL']+nc['values']['valueBRL'])/assets['values']['valueBRL']*100 if assets and cl and nc and assets['values']['valueBRL']>0 else None
                old=[r for r in rows if r['values']['statement']=='BPP' and r['values']['accountCode']=='2.03' and r['values']['periodEnd']<key[2]]
                prior=max(old,key=lambda r:r['values']['periodEnd']) if old else None
                days=(__import__('datetime').date.fromisoformat(key[2])-__import__('datetime').date.fromisoformat(start)).days if start else 0
                equity_days=(__import__('datetime').date.fromisoformat(key[2])-__import__('datetime').date.fromisoformat(prior['values']['periodEnd'])).days if prior else 0
                metrics['roePct']=income['values']['valueBRL']/((equity['values']['valueBRL']+prior['values']['valueBRL'])/2)*100 if income and equity and prior and 330<=days<=380 and 330<=equity_days<=380 and equity['values']['valueBRL']>0 and prior['values']['valueBRL']>0 else None
            result.append({'kind':key[0],'scope':key[1],'periodEnd':key[2],'periodStart':start,'filingVersion':key[3],'status':'sector_specific_required' if financial else 'sector_unknown' if not sector else 'accounting_ratios','metrics':metrics,'inputs':{r['values']['statement']+':'+r['values']['accountCode']:r['key'] for r in current if r['values']['statement']!='DRE' or r['values']['periodStart']==start},'method':'Ratios of BRL accounts in the same filing version/scope/duration; ROE only with annual income and comparative equity in that filing. Liabilities/assets is not financial debt/EBITDA. No price multiples.'})
    return result

def ingest(fetcher,bundle, *, years=(2024,2025),itr_year=2026):
    companies=registry(fetcher);batch={}
    for kind,year in [('DFP',y) for y in years]+[('ITR',itr_year)]:
        path,source=fetcher.get(source_url(kind,year))
        for id,meta,row in extract(path,source,kind,year):
            item=batch.setdefault(id,{'meta':{**meta,**companies.get(id,{}),'license':ODBL,'currency':'BRL','frequency':'annual and interim/YTD; durations retained','provider':'CVM Dados Abertos'},'rows':[]})
            item['rows'].append(row)
    for id,item in batch.items():
        bundle.put('cvm',id,item['meta'],item['rows'])
        bundle.documents['cvm:'+id]['indicators']=indicators(bundle.documents['cvm:'+id])
    if not batch:raise ValueError('No official CVM statements')
    bundle.manifest['datasets']['cvm']={'status':'available','source':'CVM DFP/ITR and registry','license':ODBL,'years':list(years),'itrYear':itr_year,'companiesInBatch':len(batch),'scope':'All issuers with selected root accounts in the requested official archives, both con/ind, all available revisions; no inferred ticker mappings','checkedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
