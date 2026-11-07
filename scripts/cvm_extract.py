#!/usr/bin/env python3
"""VEZORI: auditable CVM DFP/ITR ZIP extractor; does not infer financial ratios.

Requires explicit ticker -> CNPJ authorization: never guess issuer mappings.
Source: https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/{DFP|ITR}/DADOS/
"""
from __future__ import annotations
import argparse
import csv
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from io import TextIOWrapper
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen
from zipfile import ZipFile

KINDS = {"DFP", "ITR"}
STATEMENTS = {"DRE", "BPA", "BPP", "DFC_MI", "DFC_MD"}
SCOPE = {"con", "ind"}
REQ_FIELDS = {"CNPJ_CIA", "DT_REFER", "VERSAO", "CD_CONTA", "DS_CONTA", "VL_CONTA", "ESCALA_MOEDA", "MOEDA", "ORDEM_EXERC"}
MAX_ZIP = 75 * 1024 * 1024


def normalize_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) != 14:
        raise ValueError("CNPJ precisa conter 14 dígitos")
    return digits


def decimal_pt(value: str) -> Decimal:
    text = str(value).strip()
    if not text:
        raise ValueError("Valor contábil ausente")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        n = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError("Valor contábil inválido") from exc
    if not n.is_finite():
        raise ValueError("Valor contábil não-finito")
    return n


def source_url(kind: str, year: int) -> str:
    kind = kind.upper()
    if kind not in KINDS or not (2010 if kind=="DFP" else 2011) <= year <= datetime.now(timezone.utc).year:
        raise ValueError("Tipo/ano de demonstrativo inválido")
    filename = f"{kind.lower()}_cia_aberta_{year}.zip"
    return f"https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/{kind}/DADOS/{filename}"


def file_key(name: str, kind: str, year: int, scope: str):
    """Only accepted document families are imported; no blanket ZIP extraction."""
    base = Path(name).name.lower()
    if not base.endswith(f"_{scope}_{year}.csv") or not base.startswith(f"{kind.lower()}_cia_aberta_"):
        return None
    marker = base[len(f"{kind.lower()}_cia_aberta_"):-len(f"_{scope}_{year}.csv")]
    return marker.upper() if marker.upper() in STATEMENTS else None


def normalize_scale(raw: str):
    code = raw.strip().upper()
    if code in {"MIL", "MILHAR", "MILHARES", "MIL REAIS"}:
        return "BRL", Decimal(1000)
    if code in {"UNIDADE", "UNIDADES", "REAIS", "REAL"}:
        return "BRL", Decimal(1)
    return None, None


def rows_in_zip(path: Path, *, kind: str, year: int, cnpj: str, scope: str = "con"):
    kind = kind.upper()
    if kind not in KINDS or scope not in SCOPE or not (2010 if kind=="DFP" else 2011) <= year <= datetime.now(timezone.utc).year:
        raise ValueError("Tipo, escopo ou ano inválido")
    cnpj = normalize_cnpj(cnpj)
    if path.stat().st_size > MAX_ZIP:
        raise ValueError("Arquivo excede limite de segurança")
    found = []
    with ZipFile(path) as archive:
        for entry in archive.infolist():
            statement = file_key(entry.filename, kind, year, scope)
            if not statement:
                continue
            if entry.file_size > 100 * 1024 * 1024:
                raise ValueError("CSV inflado excede limite de segurança")
            with archive.open(entry) as binary:
                reader = csv.DictReader(TextIOWrapper(binary, encoding="latin-1", errors="replace", newline=""), delimiter=";")
                if not reader.fieldnames or not REQ_FIELDS.issubset(set(reader.fieldnames)):
                    raise ValueError(f"Schema CVM inesperado em {entry.filename}")
                for item in reader:
                    if re.sub(r"\D", "", item.get("CNPJ_CIA", "")) != cnpj:
                        continue
                    current = item.get("ORDEM_EXERC", "").upper()
                    if not current.strip().startswith(("ÚLTIMO", "ULTIMO")):
                        continue
                    version = int(item["VERSAO"])
                    reference=date.fromisoformat(item['DT_REFER'])
                    if reference.isoformat()!=item['DT_REFER'] or reference>datetime.now(timezone.utc).date() or version<1:
                        raise ValueError('Competência ou revisão CVM inválida')
                    unit, scale = normalize_scale(item.get("ESCALA_MOEDA", ""))
                    if item.get('MOEDA','').strip().upper() not in {'REAL','REAIS','BRL'}:
                        unit,scale=None,None
                    value = decimal_pt(item["VL_CONTA"])
                    found.append({
                        "statement": statement,
                        "scope": scope,
                        "periodEnd": item["DT_REFER"],
                        "periodStart": item.get("DT_INI_EXERC") or None,
                        "version": version,
                        "accountCode": item["CD_CONTA"],
                        "accountLabel": item["DS_CONTA"].strip(),
                        "originalValue": str(value),
                        "sourceScale": item.get("ESCALA_MOEDA", ""),
                        "sourceCurrency":item['MOEDA'],
                        "unit": unit,
                        "value": str(value * scale) if scale is not None else None,
                    })
    if not found:
        return []
    # Never mix amended/re-presented statements. Select one revision per statement+period.
    latest = {}
    for row in found:
        key = (row["statement"], row["periodEnd"])
        latest[key] = max(row["version"], latest.get(key, -1))
    selected = [r for r in found if r["version"] == latest[(r["statement"], r["periodEnd"])]]
    unique = {}
    for row in selected:
        key = (row["statement"], row["periodEnd"], row["periodStart"], row["accountCode"])
        if key in unique and unique[key] != row:
            raise ValueError(f"Duplicata conflitante em {key}")
        unique[key] = row
    return sorted(unique.values(), key=lambda r: (r["periodEnd"], r["statement"], r["accountCode"]))


def make_record(path: Path, *, ticker: str, cnpj: str, kind: str, year: int, scope: str = "con"):
    if not re.fullmatch(r"[A-Z0-9]{4,12}", ticker):
        raise ValueError("Ticker inválido")
    cnpj = normalize_cnpj(cnpj)
    contents = path.read_bytes()
    rows = rows_in_zip(path, kind=kind, year=year, cnpj=cnpj, scope=scope)
    if not rows:
        raise ValueError("Nenhuma demonstração correspondente; confirme CNPJ, ano, tipo e escopo")
    return {
        "schemaVersion": 1,
        "status": "raw_validated",
        "symbol": ticker,
        "cnpj": cnpj,
        "kind": kind,
        "year": year,
        "scope": scope,
        "source": "CVM DFP/ITR",
        "sourceUrl": source_url(kind, year),
        "sourceSha256": sha256(contents).hexdigest(),
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "methodology": "Linhas contábeis oficiais da última versão por demonstração e período; nenhuma taxa ou múltiplo derivado.",
        "facts": rows,
    }


def download_zip(url: str, output: Path):
    if not url.startswith("https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/"):
        raise ValueError("Origem não autorizada")
    output.parent.mkdir(parents=True, exist_ok=True)
    req = Request(url, headers={"User-Agent": "VEZORI Financial Research (public CVM data)"})
    with urlopen(req, timeout=40) as response, output.open("wb") as dest:
        while block := response.read(1024 * 1024):
            if dest.tell() + len(block) > MAX_ZIP:
                raise ValueError("Download CVM excede limite")
            dest.write(block)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ticker", required=True, type=str.upper)
    ap.add_argument("--cnpj", required=True)
    ap.add_argument("--kind", choices=["DFP", "ITR"], default="DFP")
    ap.add_argument("--scope", choices=["con", "ind"], default="con")
    ap.add_argument("--year", required=True, type=int)
    ap.add_argument("--archive", type=Path, help="ZIP CVM já baixado; sem este parâmetro baixa o ZIP oficial")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    url = source_url(args.kind, args.year)
    archive = args.archive or Path(".cache/cvm") / url.rsplit("/", 1)[1]
    if not archive.exists():
        download_zip(url, archive)
    record = make_record(archive, ticker=args.ticker, cnpj=args.cnpj, kind=args.kind, year=args.year, scope=args.scope)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"CVM: {record['symbol']} {len(record['facts'])} linhas, ZIP SHA-256 {record['sourceSha256']}, output {args.out}")


if __name__ == "__main__":
    main()
