# VEZORI — Fundamentos auditáveis, fase 1

## Gráficos financeiros
- Ficha e comparador utilizam TradingView Lightweight Charts 5.2.1, com fallback Chart.js quando a biblioteca CDN não está disponível.
- Observações inválidas e datas sem preço são descartadas, **não** interpoladas; base 100 só usa datas coincidentes.
- Attribution: TradingView Lightweight Charts™ — Copyright (c) 2025 TradingView, Inc. https://www.tradingview.com/ .
- A TradingView fornece a **biblioteca gráfica**, não os dados exibidos.

## SEC: US-GAAP (americano)
- Parser em `src/sec-fundamentals.js`, API `/api/fundamentals?market=US&symbol=AAPL`.
- CIKs registrados e verificados para AAPL, MSFT, Realty Income (O) e Prologis (PLD); o acesso real exige configuração `SEC_USER_AGENT` com contato válido da aplicação.
- Exige um User-Agent de identificação profissional (contato real) no segredo Cloudflare `SEC_USER_AGENT`.
- Até que esse segredo seja configurado, responde `not_configured` e o usuário vê uma mensagem — **não** números estimados.
- Receita e lucro anuais: somente fatos com formulário 10-K e período de 330–380 dias, escolhendo a competência recente; US-GAAP.
- ROE apenas quando houver PL atual e anterior para o cálculo do patrimônio médio; margem = lucro/receita.
- Não inferimos P/L, P/VP, DY ou taxa de crescimento de dados incompletos. Cada métrica expõe período, conceito, accession e data de publicação.
- O código está preparado, mas **não valida a disponibilidade em produção da SEC até que a identificação seja configurada**.

## CVM: DFP e ITR (Brasil) — dados oficiais em produção

- Durante o deploy, `scripts/publish_cvm_fundamentals.py` baixa o ZIP DFP 2025 **oficial**, confere os CNPJs de Petrobras, Vale e Itaú Unibanco Holding e gera cinco dossiês em `public/data/fundamentals/`.
- Tickers publicados: **PETR3, PETR4, VALE3, ITUB3, ITUB4**. Último build validado: **73 contas oficiais**, encerramento em **31/12/2025**.
- Contrato das fichas: `/api/fundamentals?market=BR&symbol=...`; responde apenas dossiês com ticker, moeda, fonte e SHA-256 de origem consistentes.
- Cada conta conserva nome CVM, código, demonstração, versão contábil, escala e competência. Nenhuma taxa ou múltiplo de valuation é criado a partir da variação do preço.
- Ações ON/PN recebem o **mesmo demonstrativo corporativo**, mas são tickers distintos com preços e direitos diferentes. O histórico da PETR4 **não substitui** o da PETR3.
- O extrator original `scripts/cvm_extract.py` suporta DFP/ITR, dados consolidados e individuais com controle de reapresentações; a publicação automática usa apenas contas consolidadas DFP 2025.
- O workflow atualiza os dossiês após testes e validação contra a fonte, inclusive em agenda semanal. Se a fonte não estiver disponível, o deploy falha na fase de coleta em vez de publicar balanços fictícios.
- Indicadores como P/L, dividend yield, ROIC ou dívida líquida/EBITDA dependem de reconciliação setorial, ações em circulação e outras fontes; **não** estão prontos.

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
