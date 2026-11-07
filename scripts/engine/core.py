"""Bounded HTTPS, lossless selected source rows, deterministic revisions and atomic assets."""
from __future__ import annotations
import csv, gzip, hashlib, io, json, os, re, time
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zipfile import ZipFile

ODBL='https://opendatacommons.org/licenses/odbl/1-0/'
BCB_TERMS='https://www.bcb.gov.br/acessoinformacao/politicaprivacidade'
MAX_DOWNLOAD=150*1024*1024
HOSTS={'dados.cvm.gov.br','api.bcb.gov.br','olinda.bcb.gov.br','www.tesourotransparente.gov.br','data.sec.gov'}
def canonical(obj):return json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')
def digest(blob):return hashlib.sha256(blob).hexdigest()
def now():return datetime.now(timezone.utc).isoformat()
def iso(value, *, future=False):
    text=str(value or '')
    parsed=date.fromisoformat(text)
    if parsed.isoformat()!=text or (not future and parsed>date.today()):raise ValueError('Invalid/future reference date')
    return text
def br_date(value, *, future=False):
    return iso(datetime.strptime(str(value),'%d/%m/%Y').date().isoformat(),future=future)
def number(value, *, optional=False):
    text=str(value if value is not None else '').strip()
    if not text and optional:return None
    if ',' in text:text=text.replace('.','').replace(',','.')
    try:result=Decimal(text)
    except InvalidOperation as exc:raise ValueError('Invalid numeric field') from exc
    if not result.is_finite() or abs(result)>Decimal('1e18'):raise ValueError('Nonfinite/out-of-range numeric field')
    return float(result)
def cnpj(value):
    text=re.sub(r'[.\-/\s]','',str(value)).upper()
    if not re.fullmatch(r'[A-Z0-9]{12}[0-9]{2}',text):raise ValueError('Invalid CNPJ identifier')
    return text
def csv_rows(stream, required):
    reader=csv.DictReader(stream,delimiter=';')
    if not reader.fieldnames or not set(required)<=set(reader.fieldnames):raise ValueError('Source schema changed; missing '+','.join(sorted(set(required)-set(reader.fieldnames or []))))
    for row in reader:
        if None in row:raise ValueError('CSV column count mismatch')
        if any('\ufffd' in str(v) for v in row.values()):raise ValueError('Lossy source encoding')
        yield row
def zip_rows(path,name,required):
    with ZipFile(path) as z:
        entry=z.getinfo(name)
        if entry.file_size>350*1024*1024:raise ValueError('Inflated CSV too large')
        with z.open(entry) as raw:
            yield from csv_rows(io.TextIOWrapper(raw,encoding='latin1',errors='strict',newline=''),required)

class Fetcher:
    def __init__(self,root=Path('.cache/data-engine'), *, seeds=None, offline=False):
        self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True)
        self.seeds=seeds or {};self.offline=offline;self.receipts=[]
    def get(self,url, *, license=ODBL, headers=None):
        parsed=urlparse(url)
        if parsed.scheme!='https' or parsed.hostname not in HOSTS or parsed.username or parsed.password:raise ValueError('Unapproved source URL')
        key=digest(url.encode());index=self.root/(key+'.json')
        previous=json.loads(index.read_text('utf8')) if index.exists() else None
        oldpath=self.root/(previous['sha256']+'.raw') if previous else None
        if self.offline and previous:
            if digest(oldpath.read_bytes())!=previous['sha256']:raise ValueError('Corrupt cached source')
            self.receipts.append(previous);return oldpath,previous
        seed=self.seeds.get(url)
        if seed:
            blob=Path(seed).read_bytes();metadata={}
        else:
            request_headers={'User-Agent':'VEZORI Data Engine/1.0 (official open data)',**(headers or {})}
            if previous and oldpath.exists() and previous.get('etag'):request_headers['If-None-Match']=previous['etag']
            for attempt in range(3):
                try:
                    with urlopen(Request(url,headers=request_headers),timeout=60) as response:
                        if urlparse(response.url).hostname not in HOSTS:raise ValueError('Unapproved source redirect')
                        blob=response.read(MAX_DOWNLOAD+1)
                        length=response.headers.get('Content-Length')
                        if length and length.isdigit() and int(length)!=len(blob):raise ValueError('Interrupted source download; content length mismatch')
                        metadata={'etag':response.headers.get('ETag'),'lastModified':response.headers.get('Last-Modified')}
                    break
                except HTTPError as exc:
                    if exc.code==304 and previous and oldpath.exists():
                        if digest(oldpath.read_bytes())!=previous['sha256']:raise ValueError('Corrupt HTTP cache')
                        self.receipts.append(previous);return oldpath,previous
                    if attempt==2 or exc.code not in {429,500,502,503,504}:raise RuntimeError('Source HTTP '+str(exc.code)+' at '+parsed.hostname) from None
                    delay=exc.headers.get('Retry-After','2')
                    exc.close()
                    time.sleep(min(30,int(delay) if delay.isdigit() else 2))
                except (URLError,TimeoutError) as exc:
                    if attempt==2:raise RuntimeError('Source transport failure ('+type(getattr(exc,'reason',exc)).__name__+') at '+parsed.hostname) from None
                    time.sleep(2*(attempt+1))
        if not blob or len(blob)>MAX_DOWNLOAD:raise ValueError('Empty/oversized source')
        sha=digest(blob);path=self.root/(sha+'.raw')
        if not path.exists():
            temp=path.with_suffix('.tmp');temp.write_bytes(blob);temp.replace(path)
        receipt=previous if previous and previous['sha256']==sha else {'url':url,'sha256':sha,'bytes':len(blob),'retrievedAt':now(),'license':license,**metadata}
        temp=index.with_suffix('.tmp');temp.write_bytes(canonical(receipt));temp.replace(index)
        self.receipts.append(receipt);return path,receipt

def observation(key,values,raw,source):
    return {'key':key,'values':values,'sourceRow':raw,'provenance':source,'sourceRowSha256':digest(canonical(raw))}

def merge_observations(prior,incoming):
    """Keep every changed value, including a same-filing-version correction, without replacing history."""
    result=list(prior);index={}
    for row in result:index.setdefault(row['key'],[]).append(row)
    for row in incoming:
        versions=index.setdefault(row['key'],[])
        if any(x['values']==row['values'] and x['sourceRow']==row['sourceRow'] for x in versions):continue
        row={**row,'revisionOrdinal':len(versions)+1}
        versions.append(row);result.append(row)
    return sorted(result,key=lambda r:(r['key'],r.get('revisionOrdinal',1)))

def compact_sources(document):
    sources=document.setdefault('sources',{})
    for row in document['observations']:
        source=row.get('provenance',{})
        if 'url' not in source:continue
        receipt={k:v for k,v in source.items() if k!='member'}
        source_id=digest(canonical(receipt));sources[source_id]=receipt
        row['provenance']={'sourceId':source_id,**({'member':source['member']} if source.get('member') else {})}
    return document

def coverage(document):
    dates=sorted({r['values'].get('date') or r['values'].get('periodEnd') for r in document['observations']}-{None})
    gaps=[];missing_months=[]
    frequency=document.get('frequency','')
    if 'monthly' in frequency and dates:
        observed={d[:7] for d in dates};first=date.fromisoformat(dates[0]);last=date.fromisoformat(dates[-1]);year,month=first.year,first.month
        while (year,month)<=(last.year,last.month):
            key=f'{year:04d}-{month:02d}'
            if key not in observed:missing_months.append(key)
            month+=1
            if month==13:month=1;year+=1
    elif 'daily' in frequency:
        for a,b in zip(dates,dates[1:]):
            days=(date.fromisoformat(b)-date.fromisoformat(a)).days
            if days>8:gaps.append({'after':a,'before':b,'calendarDays':days})
    return {'completeSinceInception':False,'first':dates[0] if dates else None,'last':dates[-1] if dates else None,'observedDates':len(dates),'missingReferenceMonthsWithinObservedSpan':missing_months,'gapCandidates':gaps[:100],'calendarReconciled':False,'note':'No interpolation. Daily gaps over eight calendar days are candidates, not proof of missing exchange sessions; official calendars/filing deadlines are not reconciled.'}

class Bundle:
    def __init__(self,previous=None):
        self.documents=(previous or {}).get('documents',{})
        self.manifest=(previous or {}).get('manifest',{'schemaVersion':1,'engineVersion':'1.0.0','datasets':{},'blocked':{}})
    def put(self,dataset,id,metadata,rows):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,90}',id):raise ValueError('Invalid instrument ID')
        key=dataset+':'+id;prior=self.documents.get(key,{})
        merged=merge_observations(prior.get('observations',[]),rows)
        if not merged:raise ValueError('Cannot publish empty instrument')
        self.documents[key]=compact_sources({'schemaVersion':1,'dataset':dataset,'id':id,**metadata,'sources':dict(prior.get('sources',{})),'observations':merged})
    def publish(self,out, *, run_id,event,groups,receipts):
        out=Path(out);objects=out/'objects';objects.mkdir(parents=True,exist_ok=True)
        catalog={};total=0;byte_count=0
        active_hashes=set()
        for key,doc in sorted(self.documents.items()):
            compact_sources(doc)
            doc['coverage']=coverage(doc)
            blob=canonical(doc);sha=digest(blob)
            active_hashes.add(sha)
            if len(blob)>24*1024*1024:raise ValueError('Instrument asset exceeds free static-file ceiling')
            (objects/(sha+'.json')).write_bytes(blob)
            dates=sorted({r['values'].get('date') or r['values'].get('periodEnd') for r in doc['observations']} - {None})
            latest={r['key']:r for r in doc['observations']}
            catalog.setdefault(doc['dataset'],[]).append({'id':doc['id'],'name':doc.get('name',doc['id']),'cvmCode':doc.get('cvmCode'),'symbols':doc.get('symbols',[]),'path':'/data/engine/objects/'+sha+'.json','sha256':sha,'bytes':len(blob),'observations':len(latest),'sameKeyCorrections':len(doc['observations'])-len(latest),'first':dates[0] if dates else None,'last':dates[-1] if dates else None,'license':doc.get('license'),'frequency':doc.get('frequency')})
            total+=len(latest);byte_count+=len(blob)
        if sum(map(len,catalog.values()))>18000:raise ValueError('Static asset count budget exceeded')
        self.manifest.update({'generatedAt':now(),'run':{'id':str(run_id),'event':event,'groups':groups},'catalog':catalog,'storage':{'layer':'Cloudflare Workers static assets; execution receipts in existing KV','instruments':sum(map(len,catalog.values())),'observations':total,'uncompressedBytes':byte_count},'rightsNotice':'CVM/Tesouro derived databases: ODbL, source attribution required. BCB/SEC: per-record source policy. Code licence is separate.'})
        manifest_blob=canonical(self.manifest)
        # Partition recovery by stable key hash, below the 25 MiB per-asset limit.
        chunks_dir=out/'chunks';chunks_dir.mkdir(exist_ok=True);chunks=[]
        for bucket in '0123456789abcdef':
            docs={k:v for k,v in self.documents.items() if digest(k.encode())[0]==bucket}
            if not docs:continue
            compressed=gzip.compress(canonical(docs),mtime=0)
            if len(compressed)>24*1024*1024:raise ValueError('Recovery partition exceeds asset budget; repartition before expansion')
            sha=digest(compressed);(chunks_dir/(sha+'.json.gz')).write_bytes(compressed)
            chunks.append({'path':'/data/engine/chunks/'+sha+'.json.gz','sha256':sha,'bytes':len(compressed)})
        pack=gzip.compress(canonical({'formatVersion':2,'manifest':self.manifest,'chunks':chunks}),mtime=0)
        (out/'bundle.json.gz').write_bytes(pack)
        (out/'manifest.json.tmp').write_bytes(manifest_blob);(out/'manifest.json.tmp').replace(out/'manifest.json')
        # Old containers are redundant: every observation/revision is already merged into the new head.
        # Worker versions keep the prior deployment for rollback; no source observation is pruned.
        for file in objects.glob('*.json'):
            if re.fullmatch(r'[a-f0-9]{64}',file.stem) and file.stem not in active_hashes:file.unlink()
        active_chunks={x['sha256']+'.json.gz' for x in chunks}
        for file in chunks_dir.glob('*.json.gz'):
            if re.fullmatch(r'[a-f0-9]{64}\.json\.gz',file.name) and file.name not in active_chunks:file.unlink()
        summary={'engineVersion':'1.0.0','run':self.manifest['run'],'generatedAt':self.manifest['generatedAt'],'manifestSha256':digest(manifest_blob),'datasets':self.manifest['datasets'],'storage':self.manifest['storage'],'sources':[{k:r.get(k) for k in ['url','sha256','bytes','retrievedAt','license']} for r in receipts],'blocked':self.manifest['blocked']}
        Path('out').mkdir(exist_ok=True);Path('out/engine-run.json').write_bytes(canonical(summary))
        return summary

def previous_bundle(root='https://vezori.bruno-giacomelli1979.workers.dev'):
    try:
        with urlopen(Request(root+'/data/engine/bundle.json.gz',headers={'User-Agent':'VEZORI batch recovery'}),timeout=40) as r:
            blob=r.read(25*1024*1024)
            if not blob.startswith(b'\x1f\x8b'):return None  # Pre-engine deployment serves its SPA fallback.
    except HTTPError as exc:
        if exc.code==404:return None
        raise
    with gzip.GzipFile(fileobj=io.BytesIO(blob)) as z:unpacked=z.read(512*1024*1024+1)
    if len(unpacked)>512*1024*1024:raise ValueError('Previous batch exceeds budget')
    data=json.loads(unpacked)
    if data.get('formatVersion')==2:
        documents={}
        for chunk in data.get('chunks',[]):
            if not re.fullmatch(r'/data/engine/chunks/[a-f0-9]{64}\.json\.gz',chunk['path']) or chunk['bytes']>24*1024*1024:raise ValueError('Invalid recovery chunk pointer')
            with urlopen(Request(root+chunk['path'],headers={'User-Agent':'VEZORI batch recovery'}),timeout=40) as response:blob=response.read(25*1024*1024)
            if len(blob)!=chunk['bytes'] or digest(blob)!=chunk['sha256']:raise ValueError('Recovery chunk integrity failed')
            with gzip.GzipFile(fileobj=io.BytesIO(blob)) as z:decoded=z.read(128*1024*1024+1)
            if len(decoded)>128*1024*1024:raise ValueError('Recovery chunk inflation limit')
            incoming=json.loads(decoded)
            if set(incoming)&set(documents):raise ValueError('Duplicate recovery instrument')
            documents.update(incoming)
        data['documents']=documents
    if data.get('manifest',{}).get('schemaVersion')!=1 or not isinstance(data.get('documents'),dict):raise ValueError('Previous batch schema mismatch')
    for dataset,entries in data['manifest'].get('catalog',{}).items():
        for entry in entries:
            doc=data['documents'].get(dataset+':'+entry['id'])
            if not doc or digest(canonical(doc))!=entry['sha256']:raise ValueError('Previous batch integrity mismatch')
    return data
