"""Keep the existing five ticker dossier URLs, derived from the same validated historical batch."""
from pathlib import Path
from scripts.publish_cvm_fundamentals import ISSUERS,make_public
from .core import canonical
def publish(bundle,out=Path('public/data/fundamentals')):
    pending={}
    for symbol,identity in ISSUERS.items():
        doc=bundle.documents.get('cvm:'+identity['cnpj'])
        if not doc:raise ValueError('Legacy CVM issuer missing from official historical batch')
        rows=[r for r in doc['observations'] if r['values']['kind']=='DFP' and r['values']['scope']=='con' and r['values']['referenceDate']==r['values']['periodEnd']]
        end=max(r['values']['periodEnd'] for r in rows);rows=[r for r in rows if r['values']['periodEnd']==end]
        version=max(r['values']['filingVersion'] for r in rows);rows=[r for r in rows if r['values']['filingVersion']==version]
        # A same-version source correction retains all observations; select the last ordinal for the dossier.
        rows=list({r['key']:r for r in rows}.values())
        source=doc['sources'][rows[0]['provenance']['sourceId']]
        raw={'symbol':symbol,'cnpj':identity['cnpj'],'year':int(end[:4]),'scope':'con','sourceUrl':source['url'],'sourceSha256':source['sha256'],'extractedAt':source['retrievedAt'],'facts':[{'statement':r['values']['statement'],'accountCode':r['values']['accountCode'],'accountLabel':r['values']['label'],'value':r['values']['valueBRL'],'unit':r['values']['currency'],'sourceScale':r['values']['sourceScale'],'periodEnd':r['values']['periodEnd'],'periodStart':r['values']['periodStart'],'version':r['values']['filingVersion']} for r in rows]}
        result=make_public(raw,doc['name']);result.update({'dataEngineRecordUrl':'/api/data-engine/record?dataset=cvm&id='+identity['cnpj'],'dataLicense':doc['license'],'filingVersion':version,'publishedAt':rows[0]['values']['publishedAt']})
        pending[symbol]=result
    out.mkdir(parents=True,exist_ok=True)
    for symbol,document in pending.items():(out/(symbol+'.json')).write_bytes(canonical(document))
    return pending
