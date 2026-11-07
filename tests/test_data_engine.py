import copy, csv, gzip, io, json, tempfile, unittest
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from zipfile import ZipFile
from scripts.engine import cvm, funds, macro, treasury, sec
from scripts.engine.core import Bundle, Fetcher, canonical, coverage, digest, iso, number, observation, merge_observations, previous_bundle

FIX=Path(__file__).parent/'fixtures/data-engine'
SOURCE={'url':cvm.REGISTRY,'sha256':'a'*64,'license':'https://opendatacommons.org/licenses/odbl/1-0/'}
class FixtureFetcher:
    def get(self,url,**kwargs):
        if url==cvm.REGISTRY:return FIX/'companies-real.csv',SOURCE
        raise AssertionError('Unexpected external dependency: '+url)
class Reply(io.BytesIO):
    def __init__(self,blob,url='https://api.bcb.gov.br/test',headers=None):super().__init__(blob);self.url=url;self.headers=headers or {}

class CoreTests(unittest.TestCase):
    def test_dates_missing_nonfinite(self):
        for value in ['2025-02-30','2025-2-01','9999-01-01']:
            with self.assertRaises(ValueError):iso(value)
        for value in ['', 'NaN','Infinity']:
            with self.assertRaises(ValueError):number(value)
        self.assertIsNone(number('',optional=True));self.assertEqual(number('1.234,56'),1234.56)
    def test_rows_and_corrections_are_preserved_and_replay_is_idempotent(self):
        a=observation('2025-01-01',{'date':'2025-01-01','value':1},{'value':'1'},SOURCE)
        b=observation('2025-01-01',{'date':'2025-01-01','value':2},{'value':'2'},SOURCE)
        rows=merge_observations([], [a,a,b]);self.assertEqual(len(rows),2)
        self.assertEqual([r['revisionOrdinal'] for r in rows],[1,2])
        self.assertEqual(merge_observations(rows,[b]),rows);self.assertEqual(rows[0]['values']['value'],1)
    def test_https_source_allowlist(self):
        with tempfile.TemporaryDirectory() as tmp:
            fetcher=Fetcher(Path(tmp))
            for url in ['http://api.bcb.gov.br/test','https://evil.example/test','https://user:pass@api.bcb.gov.br/test']:
                with self.assertRaises(ValueError):fetcher.get(url)
    def test_http429_retries_and_does_not_guess_data(self):
        with tempfile.TemporaryDirectory() as tmp,patch('scripts.engine.core.time.sleep'),patch('scripts.engine.core.urlopen',side_effect=[HTTPError('url',429,'quota',{},None),Reply(b'[]')]) as mocked:
            path,source=Fetcher(Path(tmp)).get('https://api.bcb.gov.br/test')
            self.assertEqual(mocked.call_count,2);self.assertEqual(source['sha256'],digest(b'[]'));self.assertEqual(path.read_bytes(),b'[]')
    def test_partial_download_does_not_replace_previous_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            fetcher=Fetcher(Path(tmp));url='https://api.bcb.gov.br/test'
            with patch('scripts.engine.core.urlopen',return_value=Reply(b'valid')):old,receipt=fetcher.get(url)
            with patch('scripts.engine.core.urlopen',return_value=Reply(b'cut',headers={'Content-Length':'100'})):
                with self.assertRaisesRegex(ValueError,'Interrupted'):fetcher.get(url)
            saved=json.loads((Path(tmp)/(digest(url.encode())+'.json')).read_bytes())
            self.assertEqual(saved['sha256'],receipt['sha256']);self.assertEqual(old.read_bytes(),b'valid')
    def test_corrupt_cache_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            fetcher=Fetcher(Path(tmp));url='https://api.bcb.gov.br/test'
            with patch('scripts.engine.core.urlopen',return_value=Reply(b'valid')):path,_=fetcher.get(url)
            path.write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'Corrupt'):Fetcher(Path(tmp),offline=True).get(url)
    def test_reference_gaps_are_reported_not_filled(self):
        doc={'frequency':'monthly','observations':[{'values':{'date':'2025-01-01'}},{'values':{'date':'2025-03-01'}}]}
        result=coverage(doc);self.assertEqual(result['missingReferenceMonthsWithinObservedSpan'],['2025-02']);self.assertFalse(result['completeSinceInception']);self.assertFalse(result['calendarReconciled'])
    def test_bundle_hashes_and_partitioned_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp);b=Bundle();b.put('macro','rate',{'name':'Rate','frequency':'daily','license':'test'},[observation('a',{'date':'2025-01-01','value':1},{'value':'1'},SOURCE)])
            b.publish(out,run_id='test',event='controlled',groups=['macro'],receipts=[SOURCE])
            entry=b.manifest['catalog']['macro'][0];self.assertEqual(digest((out/'objects'/(entry['sha256']+'.json')).read_bytes()),entry['sha256'])
            def fetch(request,**kwargs):
                route=request.full_url.split('https://vezori.bruno-giacomelli1979.workers.dev/data/engine/')[1];return Reply((out/route).read_bytes())
            with patch('scripts.engine.core.urlopen',side_effect=fetch):restored=previous_bundle()
            self.assertEqual(restored['documents']['macro:rate']['observations'][0]['values']['value'],1)
            chunk=next((out/'chunks').glob('*.gz'));chunk.write_bytes(b'corrupt')
            with patch('scripts.engine.core.urlopen',side_effect=fetch):
                with self.assertRaisesRegex(ValueError,'integrity'):previous_bundle()

class RealSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=cvm.registry(FixtureFetcher());cls.rows=list(cvm.extract(FIX/'cvm-dfp-real.zip',SOURCE,'DFP',2025))
    def test_fixture_origins_hashes_and_encoding(self):
        origins=json.loads((FIX/'sources.json').read_bytes())
        for name,meta in origins.items():self.assertEqual(digest((FIX/name).read_bytes()),meta['fixtureSha256'])
        self.assertIn('PETRÓLEO',self.registry['33000167000101']['name'])
        self.assertNotIn('EMAIL',json.dumps(self.registry));self.assertNotIn('RESP',json.dumps(self.registry))
    def test_cvm_actual_accounts_units_and_published_filing(self):
        values=[r['values'] for id,meta,r in self.rows if id=='33000167000101']
        revenue=next(v for v in values if v['scope']=='con' and v['accountCode']=='3.01' and v['periodEnd']=='2025-12-31')
        self.assertEqual(revenue['valueBRL'],497549000000)
        self.assertEqual(revenue['sourceScale'],'MIL');self.assertEqual(revenue['publishedAt'],'2026-03-05');self.assertEqual(revenue['periodStart'],'2025-01-01')
        self.assertTrue(any(v['periodEnd']=='2024-12-31' for v in values));self.assertTrue(any(v['scope']=='ind' for v in values))
        self.assertTrue(any(r['values']['filingVersion']==2 for id,meta,r in self.rows if id=='33592510000154'))
    def test_independent_decimal_margin_and_bank_gate(self):
        for id in ['33000167000101','60872504000123']:
            b=Bundle();b.put('cvm',id,self.registry[id],[r for company,_,r in self.rows if company==id]);result=cvm.indicators(b.documents['cvm:'+id])
            if id=='33000167000101':
                observed=next(x for x in result if x['scope']=='con' and x['periodStart']=='2025-01-01')
                expected=Decimal('110605000000')/Decimal('497549000000')*100
                self.assertAlmostEqual(observed['metrics']['netMarginPct'],float(expected),places=10)
            else:
                self.assertTrue(all(x['status']=='sector_specific_required' and x['metrics']=={} for x in result))
    def test_cvm_schema_change_stops_publication(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'bad.zip'
            with ZipFile(path,'w') as z:z.writestr('dfp_cia_aberta_2025.csv','unexpected;header\n')
            with self.assertRaisesRegex(ValueError,'schema'):list(cvm.extract(path,SOURCE,'DFP',2025))
    def test_fund_class_schema_nav_and_real_dates(self):
        rows=list(funds.daily_rows(FIX/'funds-real.zip',SOURCE));self.assertTrue(rows)
        first=rows[0][1]['values'];self.assertEqual(first['date'],'2026-10-01');self.assertEqual(first['navPerUnitBRL'],44.9907626);self.assertEqual(first['navBRL'],1221524.87)
        self.assertEqual(len({id for id,row in rows}),1)  # Only one requested class exists in this real subset.
    def test_fii_real_monthly_nav_is_not_exchange_price(self):
        class F:
            def get(self,url,**kwargs):return FIX/'fii-real.zip',SOURCE
        b=Bundle();funds.ingest_fii(F(),b,year=2026);doc=b.documents['fii:00332266000131']
        self.assertIn('not exchange price',doc['priceBasis']);self.assertTrue(any(r['values']['filingVersion']==2 for r in doc['observations']));self.assertTrue(all('price' not in r['values'] for r in doc['observations']))
    def test_sgs_actual_points_and_invalid_future_duplicates(self):
        raw=json.loads((FIX/'sgs-12.json').read_bytes());rows=macro.parse_sgs(raw,start='2024-01-01',end='2026-11-07',source=SOURCE)
        self.assertEqual(len(rows),6);self.assertTrue(all(r['values']['value']>0 for r in rows))
        for changed in [[{'data':'30/02/2025','valor':'1'}],[{'data':'01/01/2099','valor':'1'}],[{'data':'01/01/2025','valor':'1'},{'data':'01/01/2025','valor':'2'}]]:
            with self.assertRaises(ValueError):macro.parse_sgs(changed,start='2024-01-01',end='2026-11-07',source=SOURCE)
    def test_treasury_actual_quotes_and_maturity(self):
        rows=list(treasury.parse(FIX/'treasury-real.csv',SOURCE));self.assertTrue(rows)
        id,meta,row=rows[0];self.assertEqual(row['values']['date'],'2026-11-06');self.assertEqual(row['values']['buyPriceBRL'],20251.05);self.assertEqual(row['values']['sellPriceBRL'],20240.05);self.assertEqual(meta['indexer'],'Selic');self.assertIn('not realized',meta['methodology'])
    def test_sec_identity_deferred_never_requests(self):
        class F:
            def get(self,*args,**kwargs):raise AssertionError('Must not request SEC without identity')
        b=Bundle();sec.ingest(F(),b,None);self.assertEqual(b.manifest['blocked']['sec']['status'],'identity_required');self.assertFalse(b.documents)

if __name__=='__main__':unittest.main()
