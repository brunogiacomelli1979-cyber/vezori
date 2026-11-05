#!/usr/bin/env python3
"""Generate public, source-backed CVM annual accounts with verified issuer identities.

No company financial figures are hardcoded. Every amount is extracted from the official
CVM DFP ZIP at build time and carries its account code, period, revision and source hash.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from scripts.cvm_extract import download_zip, make_record, source_url

# Mapping confirmed from B3 company profile / corporate disclosure, not ticker guessing.
ISSUERS = {
    "PETR3": {"cnpj": "33000167000101", "issuer": "PETRÓLEO BRASILEIRO S.A. - PETROBRAS"},
    "PETR4": {"cnpj": "33000167000101", "issuer": "PETRÓLEO BRASILEIRO S.A. - PETROBRAS"},
    "VALE3": {"cnpj": "33592510000154", "issuer": "VALE S.A."},
    "ITUB3": {"cnpj": "60872504000123", "issuer": "ITAÚ UNIBANCO HOLDING S.A."},
    "ITUB4": {"cnpj": "60872504000123", "issuer": "ITAÚ UNIBANCO HOLDING S.A."},
}
# Root and first-level accounting lines only; their descriptions are kept from CVM.
CODE_PREFIXES = {
    "DRE": ("3.01", "3.03", "3.05", "3.09", "3.11"),
    "BPA": ("1", "1.01", "1.02"),
    "BPP": ("2", "2.01", "2.02", "2.03"),
    "DFC_MI": ("6.01", "6.02", "6.03"),
    "DFC_MD": ("6.01", "6.02", "6.03"),
}
MAX_ROWS_PER_STATEMENT = 10

def select_accounts(record):
    facts = record.get("facts") or []
    if not facts:
        raise ValueError("Nenhuma conta contábil retornada")
    dates = sorted({r["periodEnd"] for r in facts}, reverse=True)
    newest = dates[0]
    selected = []
    for statement, codes in CODE_PREFIXES.items():
        subset = [r for r in facts if r["periodEnd"] == newest and r["statement"] == statement
                  and r.get("unit") == "BRL" and r.get("value") is not None
                  and r.get("accountCode") in codes]
        # No substitution from children when an official root account is missing.
        unique = {}
        for row in subset:
            code = row["accountCode"]
            if code in unique and unique[code] != row:
                raise ValueError(f"Conta conflitante: {statement}/{code}")
            unique[code] = row
        for row in sorted(unique.values(), key=lambda x:x["accountCode"])[:MAX_ROWS_PER_STATEMENT]:
            value = float(row["value"])
            if not (-1e17 < value < 1e17):
                raise ValueError("Valor contábil fora do limite")
            selected.append({
                "statement": row["statement"], "accountCode":row["accountCode"],
                "label":row["accountLabel"], "valueBRL":value,
                "periodEnd":row["periodEnd"], "version":row["version"],
                "sourceScale":row["sourceScale"], "periodStart":row.get("periodStart")
            })
    if len(selected) < 4 or not any(r["statement"] == "DRE" for r in selected):
        raise ValueError("Demonstrações insuficientes para divulgar contas resumidas")
    return newest, selected

def make_public(record, issuer):
    date, accounts = select_accounts(record)
    return {
        "schemaVersion":1,
        "status":"verified_accounts",
        "symbol":record["symbol"], "issuer":issuer,
        "cnpj":record["cnpj"],"source":"CVM Dados Abertos / DFP",
        "sourceUrl":record["sourceUrl"],
        "sourceSha256":record["sourceSha256"],
        "statementYear":record["year"],"periodEnd":date,
        "scope":record["scope"],"currency":"BRL",
        "extractedAt":record["extractedAt"],
        "accounts":accounts,
        "methodology":"Contas oficiais consolidadas do último período DFP e revisão mais recente; valores convertidos de MIL para BRL conforme unidade original. Não são indicadores de P/L, P/VP, DY nem ROE.",
        "limitations":"Classificações e definições contábeis podem variar entre bancos, mineradoras e petrolíferas. Valores não são comparáveis sem reconciliação setorial."
    }

def generate(*,year:int,out_dir:Path,archive:Path|None=None):
    url=source_url("DFP",year)
    path=archive or Path(".cache/cvm")/url.rsplit("/",1)[-1]
    if not path.exists():
        download_zip(url,path)
    pending={}
    for symbol,meta in ISSUERS.items():
        raw=make_record(path,ticker=symbol,cnpj=meta["cnpj"],kind="DFP",year=year,scope="con")
        public=make_public(raw,meta["issuer"])
        pending[symbol]=public
    # Only publish after every issuer passed validation; no half-published batch.
    out_dir.mkdir(parents=True,exist_ok=True)
    for symbol,record in pending.items():
        (out_dir/f"{symbol}.json").write_text(json.dumps(record,ensure_ascii=False,separators=(",",":"),allow_nan=False)+"\n",encoding="utf-8")
    print(f"CVM DFP: published {len(pending)} ticker dossiers from year {year}, {sum(len(v['accounts']) for v in pending.values())} official accounts; source={url}")
    return pending

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--year",type=int,default=2025)
    p.add_argument("--out-dir",type=Path,default=Path("public/data/fundamentals"))
    p.add_argument("--archive",type=Path,default=None)
    a=p.parse_args()
    generate(year=a.year,out_dir=a.out_dir,archive=a.archive)

if __name__=="__main__":
    main()
