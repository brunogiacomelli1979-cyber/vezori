import unittest
from scripts.publish_cvm_fundamentals import ISSUERS,select_accounts,make_public

def row(st,code,value="1000",date="2025-12-31"):
 return {
  "statement":st,"accountCode":code,"accountLabel":f"Conta oficial {code}",
  "value":value,"unit":"BRL","sourceScale":"MIL","periodEnd":date,
  "periodStart":"2025-01-01","version":2
 }

class CVMPublicationTests(unittest.TestCase):
 def record(self):
  return {"symbol":"PETR3","cnpj":"33000167000101","year":2025,
   "sourceUrl":"https://dados.cvm.gov.br/zip","sourceSha256":"a"*64,
   "scope":"con","extractedAt":"2026-11-05T00:00:00Z",
   "facts":[row("DRE","3.01"),row("DRE","3.09"),
            row("BPA","1"),row("BPP","2.03"),
            row("DRE","3.01","900","2024-12-31")]}
 def test_verified_issuer_mapping(self):
  self.assertEqual(ISSUERS["PETR3"]["cnpj"],ISSUERS["PETR4"]["cnpj"])
  self.assertEqual(ISSUERS["ITUB3"]["cnpj"],ISSUERS["ITUB4"]["cnpj"])
  self.assertNotEqual(ISSUERS["ITUB4"]["cnpj"],"60701190000104")
 def test_account_codes_remain_unmodified(self):
  record=self.record()
  published=make_public(record,"PETROBRAS")
  self.assertEqual(published["periodEnd"],"2025-12-31")
  self.assertEqual(published["status"],"verified_accounts")
  self.assertEqual(published["sourceSha256"],"a"*64)
  self.assertEqual({r["accountCode"] for r in published["accounts"]},{"3.01","3.09","1","2.03"})
  self.assertEqual(published["accounts"][0]["valueBRL"],1000)
 def test_rejects_conflicting_versions_and_incomplete_dre(self):
  record=self.record();record["facts"].append(row("DRE","3.01","99"))
  with self.assertRaisesRegex(ValueError,"conflitante"):select_accounts(record)
  record=self.record();record["facts"]=[r for r in record["facts"] if r["statement"]!="DRE"]
  with self.assertRaisesRegex(ValueError,"insuficientes"):select_accounts(record)
 def test_never_claims_valuation(self):
  result=make_public(self.record(),"PETROBRAS")
  self.assertNotIn("roe",result)
  self.assertNotIn("earningsPerShare",result)
  self.assertIn("Não são indicadores",result["methodology"])

if __name__=="__main__":
 unittest.main()
