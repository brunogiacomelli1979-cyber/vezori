# VEZORI — Veja além dos números

Plataforma independente de inteligência de investimentos com **consultas reais a APIs financeiras**, motor de carteira multimoeda, desempenho ponderado por fluxos e estudo de estratégias. Código preparado para novo repositório GitHub dedicado (`vezori`) e publicação com **Cloudflare Workers**, sem Railway e sem obrigatoriedade de servidores pagos.

> **Status:** v1.0 do MVP implementada e com testes automatizados. **Não está publicada nem conectada a credenciais pessoais.** Integrações externas foram verificadas contra documentação e endpoints públicos; testes automatizados usam respostas controladas para garantir cálculos e contratos. Teste ao vivo no endereço final ainda depende de implantação e configuração das chaves.

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

## Publicação em novo repositório GitHub

1. Crie `https://github.com/brunogiacomelli1979-cyber/vezori` como repositório **novo** (não use ou altere seus demais projetos).
2. Envie o conteúdo **desta pasta** para a raiz do repositório.
3. Acesse Cloudflare, crie um Worker com integração ao novo repositório GitHub e comando `npx wrangler deploy` (ou autentique Wrangler e execute `npm run deploy`).
4. Cadastre as chaves opcionais no Cloudflare Worker em **Settings → Variables and Secrets**:
   - `BRAPI_API_KEY` (brapi)
   - `COINGECKO_API_KEY` (CoinGecko Demo)
   - `TWELVEDATA_API_KEY` (Twelve Data Basic)
5. Abra o endereço `*.workers.dev` informado pelo Cloudflare e verifique `/api/health` e `/api/dashboard`.

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
