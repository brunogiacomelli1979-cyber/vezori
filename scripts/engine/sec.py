"""Small identity-gated SEC companyfacts adapter; identification never enters public artifacts."""
import json, re, time
from .core import iso, number, observation, now

POLICY='https://www.sec.gov/about/developer-resources'
CIKS={'AAPL':'0000320193','MSFT':'0000789019'}
CONCEPTS={'RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','NetIncomeLoss','Assets','Liabilities','StockholdersEquity','NetCashProvidedByUsedInOperatingActivities'}
def parse(document,symbol,source):
    if str(document.get('cik'))!=str(int(CIKS[symbol])):raise ValueError('SEC CIK mismatch')
    gaap=document.get('facts',{}).get('us-gaap')
    if not isinstance(gaap,dict):raise ValueError('SEC companyfacts schema changed')
    result=[]
    for concept in sorted(CONCEPTS):
        for row in gaap.get(concept,{}).get('units',{}).get('USD',[]):
            if row.get('form') not in {'10-K','10-K/A','10-Q','10-Q/A'}:continue
            end=iso(row['end']);start=iso(row['start']) if row.get('start') else None;filed=iso(row['filed'])
            if start and start>end:raise ValueError('SEC reversed duration')
            accession=row.get('accn','')
            if not re.fullmatch(r'\d{10}-\d{2}-\d{6}',accession):raise ValueError('SEC accession invalid')
            values={'periodEnd':end,'periodStart':start,'filed':filed,'form':row['form'],'accession':accession,'concept':concept,'currency':'USD','value':number(row['val']),'fiscalPeriod':row.get('fp'),'fiscalYear':row.get('fy'),'durationNote':'Actual source start/end; 10-Q can be quarter or year-to-date. No quarter subtraction.'}
            key='|'.join([concept,row['form'],accession,start or '',end])
            result.append(observation(key,values,row,source))
    if not result:raise ValueError('SEC standardized facts unavailable')
    return result
def ingest(fetcher,bundle,identity=None):
    if not identity:
        bundle.manifest['blocked']['sec']={'status':'identity_required','reason':'Owner deferred SEC identity configuration; no SEC request was made.','requiredSecret':'SEC_USER_AGENT'}
        return
    if not re.fullmatch(r'[^\r\n]{8,200}',identity) or '@' not in identity:raise ValueError('SEC identification invalid')
    for symbol,cik in CIKS.items():
        path,source=fetcher.get('https://data.sec.gov/api/xbrl/companyfacts/CIK'+cik+'.json',license=POLICY,headers={'User-Agent':identity})
        doc=json.loads(path.read_bytes());rows=parse(doc,symbol,source)
        bundle.put('sec',symbol,{'name':doc.get('entityName',symbol),'symbols':[symbol],'cik':cik,'license':POLICY,'provider':'SEC companyfacts','currency':'USD','frequency':'10-K/10-Q as filed','priceBasis':'official accounting facts, no share-price multiples'},rows)
        time.sleep(1)
    bundle.manifest['blocked'].pop('sec',None)
    bundle.manifest['datasets']['sec']={'status':'available','provider':'SEC EDGAR','companies':len(CIKS),'checkedAt':now()}
