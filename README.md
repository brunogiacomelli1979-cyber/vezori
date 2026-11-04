# VEZORI — Veja além dos números

Plataforma independente de inteligência de investimentos com **consultas reais a APIs financeiras**, motor de carteira multimoeda, desempenho ponderado por fluxos e estudo de estratégias. Código preparado para novo repositório GitHub dedicado (`vezori`) e publicação com **Cloudflare Workers**, sem Railway e sem obrigatoriedade de servidores pagos.

> **Status de produção (04/11/2026):** deploy confirmado em https://vezori.bruno-giacomelli1979.workers.dev via GitHub Actions. **24 testes automatizados aprovados.** A verificação online confirmou 4 cotações brasileiras, 2 referências de câmbio e 1 indicador macro. A API CoinGecko pública sem chave respondeu HTTP 403 no Cloudflare: para habilitar BTC, ETH e SOL, cadastre uma chave gratuita Demo como secret `COINGECKO_API_KEY` no Worker. Ações/ETFs internacionais requerem `TWELVEDATA_API_KEY`. Não publicar credenciais no repositório.

## Recursos já implementados

| Recurso | Funciona? | Fonte / observação |
| --- | --- | --- |
| Ações brasileiras PETR4, VALE3, ITUB4, MGLU3 | Sim, consultas sem token | brapi /v2/stocks/quote |
| Busca por ticker B3 | Sim, se permitido no plano | Requer `BRAPI_API_KEY` para outros papéis |
| Dólar e euro em reais | Sim, referência diária | Frankfurter v2, não é PTAX intradiária |
| Meta Selic | Sim, valor oficial disponível | BCB SGS 432 |
| Bitcoin, Ethereum e Solana | Sim, ao configurar chave Demo | CoinGecko |
| VOO, QQQ e AAPL | Sim, ao configurar chave Basic | Twelve Data |
| Histórico gráfico 1 ou 3 meses | Sim, se endpoint/plano retornar pontos | BRAPI v2 stocks/historical, Twelve Data /time_series, CoinGecko /market_chart |
| Carteira real, sem dados pré-carregados | Sim | Lançamentos de compras, vendas, proventos, taxas e câmbio histórico |
| Custo médio e ganhos realizados | Sim | Média móvel ponderada de custos em BRL, taxas incluídas |
| Patrimônio e ganho não realizado | Sim, se há cotação e FX para todas as posições | Mark-to-market em BRL |
| XIRR | Sim, se série de fluxos é válida e há precificação integral | Retorno anualizado ponderado por fluxos, com saldo terminal |
| Estratégias de estudo | Sim | Modelos didáticos, **não são carteiras reais nem backtests** |
| Projeção de aportes | Sim, matemática hipotética | Taxa escolhida pelo usuário, não previsão nem histórico |
| Exportação/importação | Sim | JSON validado, somente no navegador |
| Login, sincronização da carteira, imposto, trading | Não | Próximas versões com backend autenticado |

## Saúde das APIs e limites observados

Em 04/11/2026, a brapi respondeu HTTP 429 com quatro requisições simultâneas; a implementação foi alterada para consultar os quatro tickers gratuitos em lote, reduzindo as chamadas. A API pública CoinGecko sem credencial respondeu HTTP 403 na infraestrutura Cloudflare. Os valores ausentes são explicitamente marcados como indisponíveis — não são preenchidos com preços fictícios.

- Chaves financeiras são configuradas em **Cloudflare Workers > vezori > Settings > Variables and Secrets**, como tipo **Secret**.
- Configurar `COINGECKO_API_KEY` para criptomoedas e `TWELVEDATA_API_KEY` para ativos globais. A `BRAPI_API_KEY` é opcional para outros tickers, conforme plano.
- Não confundir os dois segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`, usados no GitHub apenas para deploy, com chaves dos provedores financeiros, usadas no Worker em tempo de execução.

## Arquitetura

```text
GitHub (código, CI) -> Cloudflare Workers (frontend + API server-side)
                                   |
                      ┌────────────┼─────────────┐
                      |            |             |
                     brapi       Banco Central   Frankfurter
                      |            |             |
                    CoinGecko   Twelve Data    Cache de resposta
                                   |
                   Interface + motor financeiro no navegador
                   carteira local, sem upload de transações
```

O Workers serve os arquivos de `public/` e executa `src/worker.js` para rotas `/api/*`. Chaves ficam em `Secrets`, nunca no frontend. Não há preços embutidos ou fallback numérico em produção. Cada consulta informa fonte e data de referência quando oferecida.

## Começar localmente

Pré-requisitos: Node.js 20+ e uma conta Cloudflare para publicação.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Edite `.dev.vars` somente no seu computador para habilitar APIs opcionais. Não faça commit desse arquivo.

Para testar os cálculos e o roteamento sem gastar requisições financeiras:

```bash
npm test
```

## Repositório criado — próxima etapa: Cloudflare Workers

- Repositório: https://github.com/brunogiacomelli1979-cyber/vezori
- Branch de produção: `main`
- Código enviado: frontend, backend, testes e documentação.
- **Ainda não há URL pública operacional do aplicativo.**

Para publicar, no painel https://dash.cloudflare.com/ abra **Workers & Pages → Create application → GitHub**, autorize o repositório `brunogiacomelli1979-cyber/vezori`, mantenha o diretório raiz e o nome de Worker `vezori` (igual ao `wrangler.jsonc`), selecione `main` e configure o comando de deploy `npx wrangler deploy`. Em seguida, confira `/api/health` e `/api/dashboard`.

As chaves opcionais `BRAPI_API_KEY`, `COINGECKO_API_KEY` e `TWELVEDATA_API_KEY` devem ser inseridas somente em **Worker → Settings → Variables and Secrets**, como *Secrets*.

Mais detalhes em [docs/PUBLICACAO.md](docs/PUBLICACAO.md) e [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Rotas da API

- `GET /api/health` — status e flags de configuração (sem expor valores das chaves).
- `GET /api/dashboard` — cotações, câmbio, Selic, fontes, status por fornecedor e falhas.
- `GET /api/quote?market=BR&symbol=PETR4` — consulta de um ativo brasileiro ou internacional (`market=US`) ou cripto (`market=CRYPTO`, BTC/ETH/SOL).
- `GET /api/history?market=BR&symbol=PETR4&range=1mo` — série de preços de 1 ou 3 meses, conforme limites do plano.

## Transparência financeira e limitações

- Câmbio atual de referência Frankfurter é aplicado à **marcação atual** de ativos USD. O câmbio histórico da **compra/venda** deve ser informado pelo usuário. Isso evita converter operações antigas usando dólar de hoje.
- Preços podem ter delay e ser preços de fechamento. **Não são feed tick-by-tick**, e o indicador Selic é a **meta**, não o CDI.
- A carteira tem preço médio e resultado em reais (BRL), sem classificação de lote fiscal, imposto, split automático, custo cambial separado ou cálculo de proventos recebidos automaticamente. Registre taxas/proventos corretamente.
- XIRR representa o retorno dos fluxos lançados e a precificação terminal. Sem cobertura integral, aparece indisponível. Não equivale a desempenho bruto da plataforma ou cálculo tributário.
- Os gráficos mostram apenas valores realmente retornados pelas APIs; histórico ajustado e bruto têm implicações diferentes para cálculo de retorno.
- Projeções e carteiras-modelo são material educacional, não aconselhamento financeiro, garantia de rendimento ou réplica das posições de grandes investidores.
- A carteira local fica no dispositivo, em `localStorage`. **Não armazene chaves, senhas ou documentos no histórico.** Faça backup regularmente. Para sincronização entre dispositivos será necessário banco de dados com autenticação e controles de segurança.
- Produtos públicos que redistribuem dados de mercado podem exigir direitos/licenças de exibição (B3/EUA) mesmo que a API tenha plano gratuito. Confirme termos antes de uso comercial/público amplo.

## Fontes oficiais

- https://brapi.dev/docs e https://brapi.dev/faq/api-e-gratis-mesmo
- https://dadosabertos.bcb.gov.br/ e https://api.bcb.gov.br/
- https://frankfurter.dev/
- https://docs.coingecko.com/
- https://twelvedata.com/docs
- https://developers.cloudflare.com/workers/static-assets/

## Licença e marca

**VEZORI** é a identidade do projeto. Disponibilidade jurídica e digital do nome ainda requer verificação formal. Código sob licença MIT; não usar marcas ou layouts de terceiros.
