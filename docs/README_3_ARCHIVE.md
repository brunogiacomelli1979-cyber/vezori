# Documento histórico — não representa o estado atual

# VEZORI — Veja além dos números

Plataforma independente de pesquisa e simulação de investimentos, desenvolvida em JavaScript/Cloudflare Workers, com pipelines Python para dados oficiais de companhias. Foco em **fontes verificáveis, UX compacta, custo operacional baixo** e transparência sobre indisponibilidade de dados.

**Produção:** https://vezori.bruno-giacomelli1979.workers.dev  
**Repositório exclusivo:** `brunogiacomelli1979-cyber/vezori` · branch `main`.

## VEZORI 3.0 — o que funciona

| Módulo | Cobertura e estado |
|---|---|
| Mercados | Listagem de ações, FIIs, ETFs e BDRs da B3 com consulta por nome; rankings curtos e navegação por ativo; cripto e catálogo de EUA |
| Cotações | brapi (ações brasileiras de teste), CoinGecko Demo (BTC/ETH/SOL quando chave configurada), Frankfurter (câmbio diário), BCB (meta Selic) |
| Fichas | Preço, variação, proveniência, gráfico financeiro via Lightweight Charts com fallback Chart.js; se histórico não estiver disponível, aviso compacto e orientação para habilitar a fonte |
| Fundamentos Brasil | CVM DFP **2025**, cinco tickers: PETR3/PETR4, VALE3, ITUB3/ITUB4; 73 contas oficiais na última publicação validada, com código CVM, escala convertida, revisão, período e SHA-256 de origem |
| Fundamentos EUA | Parser SEC EDGAR 10-K com identificação de CIK para AAPL, MSFT e REITs O/PLD, preparado para receita, lucro, ativos, passivos, margem e ROE quando insumos permitem. Exige `SEC_USER_AGENT` válido no Worker |
| Carteira | Uma aba para posições, movimentos, proventos, custo médio, ganhos realizados, XIRR e backup JSON; dados pessoais permanecem no navegador |
| Laboratório | Cinco estratégias educativas, taxas **hipotéticas editáveis**, projeções com aportes e alerta para retornos absurdos; seção opcional de risco com séries históricas reais |
| Risco observado | Retorno de preço, drawdown, volatilidade anualizada, correlação, cesta retrospectiva de 2 a 5 ativos da mesma moeda e calendário; não é retorno total, recomendação nem backtest de carteira real |
| Histórico de dados | Cache regional e código de captura diária. **O deploy novo exige binding Workers KV**, mas a ativação real permanece pendente de verificação no Cloudflare |
| Deploy e testes | GitHub Actions publica no Cloudflare e executa testes JS/Python e smoke tests com mercado e arquivos CVM. A rotina de publicação também está agendada semanalmente para atualizar DFP |

## Dados financeiros: o que NÃO é inventado

- Sem preços simulados nem preenchimento de dias ausentes. Histórico, volumes e fundamentos vêm apenas de provedores e documentos identificados.
- Cotações e histórico **não são necessariamente retorno total**; preços podem não estar ajustados por proventos, desdobramentos, câmbio e inflação.
- Ações ordinárias e preferenciais de uma mesma companhia **não são intercambiáveis**; a ficha PETR3 pode sugerir apenas um atalho **explicitamente identificado** para histórico público da PETR4.
- As contas da CVM são lançamentos **oficiais**, mas não equivalem automaticamente a P/L, P/VP, DY, valor justo ou ROIC. Indicadores dependem de critérios e insumos completos.
- As carteiras de Buffett, Bogle, Dalio e Graham são **modelos de estudo**, não réplicas reais de gestores.
- Quando o usuário possui ativos em BRL e USD, a plataforma não inventa câmbio histórico nem combina séries sem conversão válida.

## Atualização 05/11/2026 — faixas indicativas e sentimento

- **Ficha individual:** regiões históricas indicativas de compra e venda e limite de risco ilustrativo, somente quando uma série verificável contém pelo menos 50 fechamentos. O gráfico pode mostrar 1 mês, mas a análise busca uma janela de 3 meses; se não houver cobertura, exibe indisponibilidade sem fabricar níveis.
- **Metodologia:** quantis de 20%/80% dos últimos 50 fechamentos, médias de 20/50 sessões e buffer estatístico derivado do desvio-padrão amostral dos log-retornos. Essas faixas **não** foram validadas por backtest fora da amostra e não devem ser tratadas como recomendação individual, preço justo ou previsão garantida.
- **Cripto:** endpoint `GET /api/crypto-sentiment` consulta `/global` da CoinGecko para apresentar o Fear & Greed atual (0–100) quando disponível. É um índice **global** e não uma indicação individual para BTC/ETH/SOL. O endpoint histórico de Fear & Greed exige plano Analyst; não foi implementada simulação de retrospectiva nem contratação paga.
- **Testes:** `tests/price-zones.test.js` valida determinismo, amostra insuficiente, séries com conflito, lacunas e volatilidade nula. O workflow realiza smoke test pós-deploy para os novos recursos.
- **Dependências pendentes:** BRAPI_API_KEY para ampliar histórico brasileiro, COINGECKO_API_KEY Demo para histórico cripto, licença apropriada para exibição pública dos EUA, e KV para armazenamento histórico persistente. Nenhuma chave foi publicada no repositório.
- **Escopo:** a análise é de preço histórico, não incorpora múltiplos fundamentalistas completos, liquidez, spread, impostos ou preço de aquisição pessoal. Não há integração de ordens na corretora.

## Histórico ampliado — 05/11/2026

A ficha do ativo e o comparador agora aceitam **1 mês, 3 meses, 6 meses, 1 ano, 2 anos, 5 anos, 10 anos e máximo disponível**. A API `/api/history` devolve `coverage` com datas extremas efetivamente recebidas, solicitações originais e `completeSinceListing:false`: o termo máximo indica **máximo retornado pela fonte/plano**, não todo o histórico da empresa.

- **B3/brapi:** pedidos longos utilizam o endpoint oficial de série histórica. O plano gratuito pode truncar silenciosamente acima de 3 meses; a data inicial e final reais devem acompanhar o gráfico. Não preencher o intervalo faltante.
- **CoinGecko Demo:** até 365 dias, sem garantia de datas anteriores. Intervalos curtos chegam em pontos intradiários e são reduzidos por dia UTC selecionando o último preço observado de cada dia; não rotular como fechamento de bolsa. Pedidos acima de 1 ano retornam erro explícito, em vez de simular acesso pago.
- **Twelve Data:** até 5.000 pontos por consulta, respeitando assinatura e autorização para **exibição pública**. Pedidos longos poderão exigir paginação futura, desde que contratualmente permitida.
- **Atualização automática:** cron 02:30 UTC **todos os dias**, pois o mercado cripto funciona também aos finais de semana. Os snapshots diários exigem o binding `MARKET_SNAPSHOTS`; snapshots não equivalem automaticamente ao fechamento oficial de ações.
- **Atenção B3/COTAHIST:** a página oficial anuncia histórico desde 1986, mas veda coleta automatizada. Não baixar em lote nem redistribuir os arquivos sem autorização. O projeto deverá investigar contratos ou fontes alternativas autorizadas antes de realizar backfill completo.
- **História completa:** requer identificação da primeira sessão/listagem por ativo, ajustes corporativos, normalização de fusões/mudanças de ticker e séries compradas ou licenciadas quando não há fonte grátis compatível. Um valor `completeSinceListing:true` só poderá ser atribuído após auditoria formal dessa cobertura.

## Etapa seguinte — arquivo incremental de observações (05/11/2026)

O cron da VEZORI grava snapshots globais em KV e agora também mantém registros **por ativo e mês** em `vezori:observations:v1:{market}:{symbol}:{YYYY-MM}`, com moeda, valor, fornecedor, horário original informado pelo fornecedor e horário da captura. Apenas novos dias são anexados, sem sobrescrever observações antigas. Em caso de falha parcial, uma nova execução no mesmo dia usa o **snapshot original**, não uma cotação diferente.

`GET /api/observations?market=BR&symbol=PETR4&months=12` permite consultar até 24 meses por requisição; use `through=2025-12` para consultar janelas encerradas em um mês anterior. O retorno fornece `previousPageMonth` para seguir paginando sem limite artificial de idade do acervo. Sem KV ativo, retorna `storage_not_configured`; se não houver observações, retorna `no_observations`. O valor `completeSinceListing` permanece **false**. A ficha do ativo usa o gráfico de observações apenas **quando a API de histórico falha**, identificando-o como cotação capturada, e não como fechamento oficial. Este fallback **não** fornece dados para análises de volatilidade ou para o motor de compra/venda.

**Importante:** esse mecanismo é acumulativo, não realiza backfill anterior à primeira coleta e não resolve licenças de redistribuição. A habilitação de `MARKET_SNAPSHOTS` no Cloudflare é obrigatória para persistência. O armazenamento mensal usa uma escrita por ativo capturado, além das duas escritas do snapshot global; verificar quotas antes de ampliar a lista de ativos.

## Confiabilidade da implantação — 07/11/2026

- `scripts/provision_kv.mjs --required`: credenciais e vinculação KV são obrigatórias para novas publicações. A presença de um binding real existente é respeitada; permissões ausentes passam a impedir um deploy falsamente concluído.
- GitHub Actions serializa as execuções de publicação para reduzir conflitos de criação de namespaces e deploys simultâneos.
- O smoke pós-publicação exige `sourcesConfigured.marketSnapshotStorage=true`; estado `configured_empty` é aceitável antes da primeira execução cron, mas **não comprova histórico acumulado**.
- Captura com gravação parcial (chave do dia salva, índice `latest` falhando) pode ser recuperada sem sobrescrever o preço original. Datas mais antigas não substituem um `latest` mais recente.
- A rotina `scheduled` agora falha explicitamente quando o arquivo histórico não é persistido, em vez de apenas imprimir um status que poderia passar despercebido.
- Consulte [ativação KV e critérios de validação](docs/SNAPSHOT_SETUP.md). **Não há confirmação de que essas alterações já estejam implantadas com sucesso no Cloudflare.**

## Configurações externas para cobertura completa

As seguintes configurações **não** devem ser fornecidas em chats nem inseridas no repositório:

1. `BRAPI_API_KEY` — crie uma chave no plano gratuito em https://brapi.dev/ e configure como **Secret** no Cloudflare Worker `vezori`. O plano gratuito oferece até 15 mil requisições/mês e no máximo 3 meses de histórico, sujeito aos termos do provedor. Sem chave, PETR3 e outros ativos da B3 podem ter cotação de listagem, mas não histórico.
2. `SEC_USER_AGENT` — configure uma identificação de aplicação e contato **verdadeiro** para acesso automatizado às demonstrações SEC. Sem esse segredo, o endpoint informa `not_configured` e não apresenta valores fictícios.
3. **Ações e REITs americanos:** uma chave `TWELVEDATA_API_KEY` sozinha **não concede** autorização de exibição pública de cotações. A variável `US_PUBLIC_DISPLAY_AUTHORIZED=true` deve ser habilitada somente quando os direitos de exibição forem efetivamente contratados.
4. **Workers KV:** namespace `vezori-MARKET_SNAPSHOTS`, binding `MARKET_SNAPSHOTS`. O CI agora executa o provisionamento em modo obrigatório e **bloqueia o deploy se faltar o vínculo KV**. Para completar, conceda permissões suficientes de Workers KV no Cloudflare **ou** crie e vincule o namespace manualmente. Confirme `/api/health` → `sourcesConfigured.marketSnapshotStorage=true` e verifique `/api/storage-status` após a execução do cron antes de afirmar que as observações estão efetivamente sendo persistidas.

O repositório nunca publica segredos, e nenhuma ação modifica Workers de outros projetos.

## Operação

```bash
npm install --no-audit --no-fund
npm run check
python -m unittest discover -s tests -p 'test_*cvm*.py'
python -m scripts.publish_cvm_fundamentals --year 2025 --out-dir public/data/fundamentals
npm run deploy
```

Para executar localmente, use `npm run dev`. `public/data/fundamentals` é gerado com arquivos da CVM durante o deploy, não contém demonstrações fictícias fixas.

**Revisões e cron:** os demonstrativos de 2025 são reprocessados semanalmente pelo workflow de deploy. Para atualizar 2026 quando a DFP anual estiver completa e validada, altere explicitamente o parâmetro `--year` no pipeline e repita os testes.

## Arquitetura

```text
                        GitHub Actions
                       /       |       \
           Testes Node/Python  CVM DFP  Deploy Wrangler
                               |              |
                           JSON CVM      Cloudflare Worker
                                             |
                           ┌─────────────────┼──────────────────┐
                           |                 |                  |
                     APIs de mercado   Dados CVM estáticos   Cron EOD
                           |                 |             KV exigido no deploy
                           └─────────────────┴──────────────────┘
                                             |
                           VEZORI frontend + Laboratório
                                             |
                         Carteira somente em localStorage
```

## Documentação de engenharia

- [Fundamentos CVM / SEC](docs/FUNDAMENTALS_DATA.md)
- [Snapshots e ativação KV](docs/SNAPSHOT_SETUP.md)
- [Análise de risco e método](docs/RISK_ANALYTICS.md)
- [Limites de dados americanos](docs/DAILY_DATA_POLICY.md)
- [Acompanhamento de entregas e bloqueios](https://github.com/brunogiacomelli1979-cyber/vezori/issues/2)

## Licenciamento e transparência

O código autoral é MIT. As dependências gráficas conservam os créditos exigidos, e a origem dos preços é separada da origem das bibliotecas. Os direitos de exibição dos dados financeiros são independentes da licença do código open source.

**VEZORI não oferece recomendação personalizada, execução de ordens, autorização regulatória, login ou sincronização entre dispositivos.** Dados de terceiros podem estar indisponíveis e devem ser conferidos nas fontes originais.
