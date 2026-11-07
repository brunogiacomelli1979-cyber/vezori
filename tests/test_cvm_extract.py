import tempfile
import unittest
from pathlib import Path
from decimal import Decimal
from zipfile import ZipFile
from scripts.cvm_extract import decimal_pt, source_url, make_record, file_key

HEADER='CNPJ_CIA;DT_REFER;VERSAO;CD_CONTA;DS_CONTA;VL_CONTA;ESCALA_MOEDA;MOEDA;ORDEM_EXERC\n'
CNPJ='12.345.678/0001-95'

class CVMTest(unittest.TestCase):
    def fixture(self):
        temp=tempfile.TemporaryDirectory()
        path=Path(temp.name)/'fixture.zip'
        csv=HEADER+f'{CNPJ};2025-12-31;1;3.01;Receita;120,25;MIL;REAL;ÚLTIMO\n'+f'{CNPJ};2025-12-31;2;3.01;Receita;125,00;MIL;REAL;ÚLTIMO\n'+f'{CNPJ};2025-12-31;2;3.11;Lucro;10,00;MIL;REAL;ÚLTIMO\n'+f'{CNPJ};2025-12-31;2;3.01;Receita;100,00;MIL;REAL;PENÚLTIMO\n'
        with ZipFile(path,'w') as zf:zf.writestr('dfp_cia_aberta_DRE_con_2025.csv',csv.encode('latin-1'))
        return temp,path
    def test_newest_revision_and_scale(self):
        temp,path=self.fixture()
        try:
            result=make_record(path,ticker='TEST3',cnpj=CNPJ,kind='DFP',year=2025)
            self.assertEqual(len(result['facts']),2)
            self.assertEqual(result['facts'][0]['value'],'125000.00')
            self.assertEqual(result['facts'][0]['version'],2)
            self.assertEqual(len(result['sourceSha256']),64)
        finally:temp.cleanup()
    def test_schema_and_source(self):
        self.assertIn('dfp_cia_aberta_2025.zip',source_url('DFP',2025))
        self.assertEqual(file_key('dfp_cia_aberta_DRE_con_2025.csv','DFP',2025,'con'),'DRE')
        self.assertEqual(file_key('../../evil.csv','DFP',2025,'con'),None)
        self.assertEqual(decimal_pt('1.234,56'),Decimal('1234.56'))
    def test_reject_inconsistent_company(self):
        temp,path=self.fixture()
        try:
            with self.assertRaises(ValueError): make_record(path,ticker='TEST3',cnpj='12345678000100',kind='DFP',year=2025)
        finally:temp.cleanup()
    def test_foreign_currency_is_not_relabelled_as_brl(self):
        temp,path=self.fixture()
        try:
            with ZipFile(path) as z:body=z.read(z.namelist()[0]).replace(b';REAL;',b';DOLAR;')
            with ZipFile(path,'w') as z:z.writestr('dfp_cia_aberta_DRE_con_2025.csv',body)
            record=make_record(path,ticker='TEST3',cnpj=CNPJ,kind='DFP',year=2025)
            self.assertTrue(all(r['value'] is None and r['unit'] is None and r['sourceCurrency']=='DOLAR' for r in record['facts']))
        finally:temp.cleanup()

if __name__=='__main__':unittest.main()
