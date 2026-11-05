# VEZORI — Análise de risco de preços reais

## Disponibilidade na interface
- **Ficha do ativo:** seção «Risco observado do preço», vinculada ao período histórico selecionado (1 ou 3 meses).
- **Laboratório:** seção opcional recolhida «Risco histórico dos ativos», que consulta sob demanda até **5 ativos reais** da composição. Não insere os dados históricos nas projeções de aportes.
- Ativos conceituais `RF_SIM`, `OURO_SIM`, `COM_SIM`, `CAIXA_SIM` não possuem histórico negociado e são excluídos das métricas.
- Os ativos da B3 atualmente suportados sem chave para histórico são limitados pela política da brapi; EUA requer chave e direitos de exibição; cripto depende da CoinGecko Demo.
- Ao recusar fonte, amostra ou consistência, o sistema exibe **indisponível**, sem preencher números artificialmente.

## Fórmulas e requisitos

Dados de entrada: série de fechamentos positivos em moeda identificada, com data `YYYY-MM-DD`, mercado `BR`, `US` ou `CRYPTO` e intervalo `1d`. Datas conflitantes são rejeitadas; há detecção de lacunas longas. Cripto exige sequências de dias consecutivos.

Retorno de preço do período: `100 * (P_final / P_inicial - 1)`. Não é retorno total de dividendos.

Drawdown máximo observado: pico acumulado de fechamentos `H_t = max(P_0 .. P_t)`; `100 * max((H_t - P_t) / H_t)`. Mostra magnitude positiva da queda observada.

Volatilidade anualizada: desvio-padrão **amostral** dos retornos simples de fechamento a fechamento `r_t = P_t / P_(t-1) - 1`, multiplicado por `100 * sqrt(N)`, com `N = 252` para mercados de ações e `N = 365` para cripto. Exige pelo menos **30 retornos diários**; caso contrário, a célula aparece como indisponível. A anualização em janelas curtas é uma extrapolação, não uma previsão.

Sharpe: suporte de motor, **não exibido automaticamente**. Exige taxa anual livre de risco fornecida explicitamente, **moeda coincidente**, pelo menos **60 retornos** e desvio-padrão positivo. Usa taxa diária efetiva `(1 + rf_anual/100)^(1/N) - 1` e `sqrt(N) * média(r_t - rf_diário) / sd_amostral(r_t)`.

## O que esta análise NÃO faz
- Não soma preços de moedas diferentes nem supõe câmbio.
- Não incorpora dividendos, juros de empréstimos, spreads, IR, inflação, corretagem ou rebalanceamento.
- Não comprova retornos futuros nem valida "valor justo" ou recomendação de ativos.
- Não é **backtest de carteira**, **QuantStats** ou **PyPortfolioOpt**: estas integrações exigem histórico maior, comparável por moeda e eventos corporativos.

## Validação automatizada
- Testes `tests/risk-analytics.test.js` confirmam retorno, drawdown, volatilidade anualizada, condições do Sharpe, datas e lacunas.
- Workflow de publicação verifica disponibilidade do módulo e busca PETR4 no ambiente publicado; se o provedor entregar série suficiente, recalcula drawdown e volatilidade em Node e valida os resultados.

## Próximos passos
1. Montar séries históricas ajustadas com fontes licenciadas, com diferentes classes em moeda de referência comum.
2. Incorporar corretamente proventos, split e férias/feriados de bolsa; conferir diferentes padrões de ajuste.
3. Somente então avaliar riscos da carteira com pesos e políticas de rebalanceamento declarados; indicadores QuantStats e otimização PyPortfolioOpt deverão ser avaliados fora da amostra para evitar overfitting.
4. Ativar namespace KV real antes de prometer histórico persistente capturado pelo Cron.

Documentação das fontes e ativações: `docs/FUNDAMENTALS_DATA.md`, `docs/SNAPSHOT_SETUP.md`, `docs/DAILY_DATA_POLICY.md`.
