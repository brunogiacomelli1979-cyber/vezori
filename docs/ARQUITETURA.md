# VEZORI — Arquitetura v1.0

## Componentes

- `public/index.html`: aplicativo com navegação, carteira, gráficos, simulador e painel de fontes.
- `public/styles.css`: identidade visual VEZORI (navy + turquesa + dourado), layout responsivo.
- `public/app.js`: controlador da interface, consultas de API e persistência local da carteira.
- `public/finance.js`: cálculos determinísticos e exportação/importação: custo médio móvel, resultado realizado, dividendos, patrimônio, XIRR, projeção de aportes.
- `src/worker.js`: backend Cloudflare que protege segredos, normaliza provedores, valida parâmetros, usa cache e reporta falhas.
- `tests/`: testes unitários com respostas simuladas **somente durante testes**, não embutidas na versão de produção.
- `.github/workflows/test.yml`: verificação de sintaxe e testes a cada push.

## Fontes e frequência

| Fonte | Rota | Aplicação | Frequência |
| --- | --- | --- | --- |
| brapi | `/api/v2/stocks/quote`, `/api/v2/stocks/historical` | ações B3, preço/histórico | conforme atualização da API, possivelmente com atraso |
| Frankfurter | `/v2/rate/{base}/{quote}` | câmbio para valuation BRL | referência diária, não spot |
| Banco Central | SGS 432 últimos dados | meta Selic | publicação oficial |
| CoinGecko | `/simple/price`, `/coins/{id}/market_chart` | cripto | conforme API, sujeito a quota |
| Twelve Data | `/quote`, `/time_series` | ações/ETFs EUA | conforme plano, sujeito a quota |

## Cálculos

`custo_compra_BRL = (quantidade × preço + taxas) × FX_histórico`

`resultado_realizado_BRL = (preço_venda × quantidade − taxas) × FX_venda − custo_médio_BRL × quantidade_vendida`

`valor_mercado_BRL = quantidade_aberta × cotação_atual × FX_atual`

`resultado_não_realizado_BRL = valor_mercado_BRL − custo_restante_BRL`

`proventos_BRL = (valor_provento − taxas) × FX_histórico`

`XIRR = raiz do VPL dos fluxos de compras (negativos), vendas e proventos (positivos) e valor terminal (positivo); taxa anualizada.`

Para ativo USD o FX atual vem da taxa de referência Frankfurter, cuja hora-base pode diferir da sessão de bolsa. A conversão **não** separa resultados de câmbio e variação de preço; ambos estão no P&L em BRL.

## Controles de integridade

- Não existe fallback numérico em produção: sem preço ou FX, a posição fica marcada como **não precificada**, e o total completo fica indisponível.
- Não permite venda descoberta nem quantidade/preço/câmbio inválidos.
- Chaves de mercado nunca entram no HTML ou `localStorage`.
- API aceita mercados validados, símbolos com padrão limitado e períodos históricos pré-definidos (1 e 3 meses).
- Erros de fontes são isolados e não derrubam todos os resultados.
- XIRR sem raiz ou sem posições com cobertura integral fica indisponível.

## Roadmap

1. **V1.0 (entregue em código):** integrações reais, frontend, carteira local, 21 testes automatizados, fontes e estratégias didáticas.
2. **V1.1:** ampliar catálogo de ativos, suportar dividendos/eventos corporativos automáticos apenas após conciliação de fontes.
3. **V1.2:** banco de dados D1 + login seguro, controle de permissões e sincronização de dispositivos.
4. **V1.3:** backtest com dados históricos ajustados, custos e tratamento de viés de sobrevivência, com índices de comparação.
5. **V2.0:** relatórios de fatores, alocação estratégica e alertas com trilha de auditoria.

Não há motor de backtest implementado na V1.0; as carteiras de grandes investidores são **modelos de estudo**, sem simulação histórica apresentada como real.
