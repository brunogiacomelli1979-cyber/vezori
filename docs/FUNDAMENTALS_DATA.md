# VEZORI — Fundamentos auditáveis, fase 1

## Gráficos financeiros
- Ficha e comparador utilizam TradingView Lightweight Charts 5.2.1, com fallback Chart.js quando a biblioteca CDN não está disponível.
- Observações inválidas e datas sem preço são descartadas, **não** interpoladas; base 100 só usa datas coincidentes.
- Attribution: TradingView Lightweight Charts™ — Copyright (c) 2025 TradingView, Inc. https://www.tradingview.com/ .
- A TradingView fornece a **biblioteca gráfica**, não os dados exibidos.

## SEC: US-GAAP (americano)
- Parser em `src/sec-fundamentals.js`, API `/api/fundamentals?market=US&symbol=AAPL`.
- Apenas CIK verificado para AAPL: 0000320193.
- Exige um User-Agent de identificação profissional (contato real) no segredo Cloudflare `SEC_USER_AGENT`.
- Até que esse segredo seja configurado, responde `not_configured` e o usuário vê uma mensagem — **não** números estimados.
- Receita e lucro anuais: somente fatos com formulário 10-K e período de 330–380 dias, escolhendo a competência recente; US-GAAP.
- ROE apenas quando houver PL atual e anterior para o cálculo do patrimônio médio; margem = lucro/receita.
- Não inferimos P/L, P/VP, DY ou taxa de crescimento de dados incompletos. Cada métrica expõe período, conceito, accession e data de publicação.
- O código está preparado, mas **não valida a disponibilidade em produção da SEC até que a identificação seja configurada**.

## CVM: DFP e ITR (Brasil)
- Extrator `scripts/cvm_extract.py` processa ZIPs oficiais da CVM e gera JSON auditável; sem dependências Python externas.
- Identificador oficial da empresa: CNPJ de 14 dígitos. A relação **ticker ↔ CNPJ não é deduzida automaticamente**; a pessoa que executar deve validá-la.
- Os documentos são `DFP` (anuais) e `ITR` (trimestrais); escopo `con` consolidado ou `ind` individual.
- Processa DRE, BPA, BPP e DFC_MI/DFC_MD (quando houver); mantém só `ÚLTIMO` período, seleciona a maior versão por demonstração e competência, rejeita duplicatas conflitantes.
- Valores monetários informados com escala MIL são convertidos para BRL; escalas desconhecidas preservam valor original e são marcadas sem conversão.
- Proveniência: URL oficial, SHA-256 do arquivo ZIP, versão contábil, competência, código de conta, escala, CNPJ, data de extração.
- Por enquanto a saída é **contas brutas validadas**, não ROE/ROIC/P/L automáticos: critérios setoriais e ações em circulação ainda precisam ser conciliados.
- A ação GitHub `CVM — Extrair demonstrativos oficiais (manual)` permite a extração com CNPJ validado e produz um artifact; **não** incorpora dados não revisados ao site público.
- A API da CVM publica arquivos revisáveis semanalmente. A ação manual reduz risco de erros em reapresentações.

## Próxima etapa — armazenamento e indicadores
1. Validar mapeamento público CNPJ ↔ ticker para uma primeira empresa da B3 (identificação de classe e múltiplas ações).
2. Selecionar 3 empresas de setores diferentes para validar tratamento setorial de receitas/resultado/patrimônio.
3. Comparar resultado do extrator com as linhas oficiais e discutir reapresentações/formatos de ITR.
4. Publicar apenas documentos validados com as datas, origens e as respectivas métricas verificadas.
5. Criar snapshots persistidos após o fechamento, quando houver binding Cloudflare KV ou D1 provisionado.

## Fontes
- https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp
- https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data
- https://tradingview.github.io/lightweight-charts/docs
