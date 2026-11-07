"""Build source-backed data assets. No market licences/credentials are inferred from successful HTTP."""
import argparse, json, os
from datetime import date, timedelta
from pathlib import Path
from scripts.engine.core import Bundle, Fetcher, canonical, previous_bundle
from scripts.engine import cvm, funds, macro, treasury, sec, legacy
from scripts.cvm_extract import source_url

SCHEDULES={'15 22 * * 1-6':'macro,treasury','15 12 * * 1-6':'funds,fii','37 12 * * 3':'cvm','15 1 * * 2-6':'sec','30 23 * * 1-5':'prices'}
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--groups',default='all');p.add_argument('--schedule',default='');p.add_argument('--years',nargs='+',type=int,default=[date.today().year-2,date.today().year-1]);p.add_argument('--itr-year',type=int,default=date.today().year)
    p.add_argument('--out-dir',type=Path,default=Path('public/data/engine'));p.add_argument('--seed-dir',type=Path);p.add_argument('--offline',action='store_true');p.add_argument('--no-recovery',action='store_true')
    a=p.parse_args();groups=(SCHEDULES.get(a.schedule,a.groups)).split(',')
    if groups==['all']:groups=['cvm','macro','funds','fii','treasury','sec','prices']
    if not set(groups)<={'cvm','macro','funds','fii','treasury','sec','prices'}:raise ValueError('Unknown data cycle')
    previous=previous_bundle() if not a.no_recovery else None;bundle=Bundle(previous)
    # Bootstrap all official sources once; later scheduled cycles preserve other datasets.
    if not previous and groups!=['prices']:groups=['cvm','macro','funds','fii','treasury','sec','prices']
    today=date.today();prior_month=today.replace(day=1)-timedelta(days=1)
    months=[prior_month.strftime('%Y%m'),today.strftime('%Y%m')]
    seeds={}
    if a.seed_dir:
        for kind,year in [('DFP',y) for y in a.years]+[('ITR',a.itr_year)]:
            file=a.seed_dir/(kind.lower()+str(year)+'.zip')
            if file.exists():seeds[source_url(kind,year)]=file
        for url,name in [(cvm.REGISTRY,'companies.txt'),(treasury.URL,'treasury.txt'),(f'https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_{today.year}.zip','fii.zip'),(f'https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_{months[0]}.zip','funds.zip')]:
            file=a.seed_dir/name
            if file.exists():seeds[url]=file
    fetcher=Fetcher(seeds=seeds,offline=a.offline)
    if 'cvm' in groups:cvm.ingest(fetcher,bundle,years=a.years,itr_year=a.itr_year)
    if 'macro' in groups:macro.ingest(fetcher,bundle)
    if 'funds' in groups:funds.ingest_daily(fetcher,bundle,months=months)
    if 'fii' in groups:funds.ingest_fii(fetcher,bundle,year=today.year)
    if 'treasury' in groups:treasury.ingest(fetcher,bundle)
    if 'sec' in groups:sec.ingest(fetcher,bundle,os.environ.get('SEC_USER_AGENT'))
    bundle.manifest['blocked']['prices']={'status':'rights_required','markets':['BR equities/FII/ETF/BDR','US stocks/ETF/REIT','CRYPTO permanent EOD archive'],'reason':'No free public-display and permanent-retention agreement verified. Existing licensed live-query adapters remain separate. Local CSV import is private and grants no redistribution rights.','brazilScheduleUTC':'30 23 * * 1-5','brazilScheduleLocal':'20:30 America/Sao_Paulo; actual provider closing timestamp must match before accepting a close','cryptoReference':'UTC date; existing daily observations are not automatically official exchange closes'}
    summary=bundle.publish(a.out_dir,run_id=os.environ.get('GITHUB_RUN_ID','local'),event=os.environ.get('GITHUB_EVENT_NAME','controlled'),groups=groups,receipts=fetcher.receipts)
    if 'cvm' in bundle.manifest.get('catalog',{}):legacy.publish(bundle)
    print(json.dumps({'engineVersion':summary['engineVersion'],'datasets':{k:v['status'] for k,v in summary['datasets'].items()},'storage':summary['storage'],'blocked':list(summary['blocked'])},ensure_ascii=True))
if __name__=='__main__':main()
