# Matemática, premissas e validação

## Carteira

Custo em BRL da compra: `(q × P + taxa) × FX_histórico`. Custo médio por unidade: custo remanescente/quantidade; venda baixa esse custo proporcionalmente. Realizado = venda líquida convertida na data menos custo médio baixado. Proventos manuais são valores totais líquidos de taxas, não dividend yield inferido. Tributos não lançados não são simulados como pagos.

Marcação usa preço atual identificado e câmbio de referência atual; custo usa FX de cada lançamento. Posições sem preço/moeda/FX não recebem zero como valor: consolidado e XIRR ficam indisponíveis. `knownCostBRL` limita denominadores às posições precificadas quando necessário. A implementação não representa declaração fiscal.

XIRR resolve `Σ fluxo_i/(1+r)^(dias_i/365,25)=0` com compras negativas, vendas/proventos positivos e valor terminal. Ausência de sinais opostos, período insuficiente, raiz não encontrada ou data terminal anterior às operações → `null`. A convenção difere da Excel ACT/365; múltiplas raízes em fluxos não convencionais não são resolvidas economicamente pelo algoritmo. Não afirmar solução única em qualquer carteira.

Backups v2/v3 validam estrutura, ID, tipos, datas reais, moeda e taxas antes de calcular o livro completo em ordem cronológica. Validação não exige que a lista importada já esteja ordenada. Gravação ocorre antes de confirmar o estado da UI; cópia anterior é preservada como bytes exatos. Corrupção bloqueia lançamentos até importação explícita válida. Exportação original e recuperação não validam nem corrigem silenciosamente o conteúdo.

## Risco de preços

Para retornos simples `r_t=P_t/P_(t−1)−1`, `N=252` em bolsa ou `365` em cripto:

| Métrica | Definição / mínimo | Limites |
|---|---|---|
| Retorno | `P_final/P_inicial−1`, 2 preços | Sem proventos/câmbio implícito |
| Volatilidade | `sd_amostral(r) × √N`, 30 retornos | Extrapolação da janela, não previsão |
| Drawdown | `max(1−P_t/pico_anterior)`, magnitude positiva | Pico anterior fora da janela não é conhecido |
| Sharpe | `média(r−rf_diário)/sd(r) × √N`, 60 retornos | Taxa explícita na mesma moeda; desvio zero → indisponível |
| Sortino | `média(r−meta)/√média(min(r−meta,0)²) × √N`, 60 retornos | Meta anual e moeda explícitas, denominador inclui toda a amostra; não mostrado automaticamente |
| CAGR | `(P_f/P_i)^(365,25/dias_civis)−1`, mínimo 365 dias | Preço, não retorno total |
| Calmar | CAGR / drawdown máximo em fração | Requer CAGR e drawdown positivo |
| VaR95 diário | negativo do quantil 5% linear dos retornos, piso zero, 100 retornos | Estimativa empírica; pode subestimar extremos ausentes na amostra |
| CVaR95 diário | negativo da média dos retornos ≤ quantil 5%, piso zero, 100 retornos | Mesma convenção empírica e janela; não confundir com distribuição normal |
| Correlação | Pearson entre retornos alinhados | Variância zero → null |
| Beta | covariância amostral ativo/benchmark ÷ variância benchmark | 30 retornos, datas integrais iguais, mesmo mercado, moeda e base |
| Tracking error | sd amostral dos retornos ativos × √N | Não preenche datas ausentes |
| Information ratio | média dos retornos ativos / sd × √N | Desvio zero → null |

A ficha exibe VaR/CVaR quando a amostra comporta; as demais novas métricas ficam disponíveis no motor sob suas condições, sem aparentar UI implementada onde ela não existe. Cesta retrospectiva mantém pesos normalizados constantes e rebalanceamento matemático diário sem custos: é um índice educacional, não performance da carteira pessoal.

Frequência e janela são as observações retornadas pela fonte, com primeira/última data. Ausências não são preenchidas. A bolsa usa limite heurístico de 8 dias entre pontos e ainda exige calendário oficial para validação plena; criptomoedas exigem dias consecutivos. Dados com bases incompatíveis não formam cesta. Há máximo de mil pontos nos motores atuais; a ficha informa a janela analisada.

## Laboratório

Aportes no fim do mês; taxa mensal efetiva `(1+taxa_anual/100)^(1/12)−1`. Cada posição recebe aportes pelo peso inicial; não há rebalanceamento dos saldos. Custo anual informado gera fator mensal `(1−custo_anual/100)^(1/12)`. O imposto hipotético incide apenas sobre ganho positivo por posição na liquidação em cada horizonte mostrado; não modela compensação de perdas, faixas legais, eventos de realização intermediários ou legislação tributária. Inflação desconta o saldo final por `(1+inflação)^anos`.

Sensibilidade usa −5/0/+5 pontos percentuais anuais em todas as taxas, limitadas ao intervalo permitido, mantendo custos e aportes. Não atribui probabilidades nem seleciona o melhor cenário. Modelos de gestores são composições didáticas independentes; taxas exemplificativas são arbitrárias e editáveis. Monte Carlo, fronteira eficiente e alocação por risco não foram promovidos sem dados comparáveis, estabilidade e metodologia suficiente.

## Faixas e estudo temporal

`price-zones.js` continua descrevendo quantis 20/80 e médias 20/50, com buffer por desvio dos log-retornos. Não equivale a valuation, alvo garantido ou recomendação. Datas impossíveis e lacunas cripto agora são recusadas.

`temporal-study.js` é um harness educacional: janela móvel somente até t, sinal em t, execução hipotética no próximo fechamento, custos/slippage parametrizados, sem otimização. Teste altera o último preço não observado e comprova que decisões anteriores não mudam. Isso verifica a fronteira temporal do código, **não valida lucro fora da amostra de mercado**. Não há controle completo de sobrevivência, liquidez, eventos ou executabilidade; `survivorshipControlled:false` é explícito. Treino/teste real amplo e comparação de metodologias continuam pendentes de dados licenciados.

## Referências independentes

As convenções foram confrontadas com [QuantStats](https://github.com/ranaroussi/quantstats/blob/main/quantstats/stats.py), especialmente desvio amostral, Sortino e CVaR histórico; o padrão paramétrico do pacote não é confundido com a nossa cauda empírica. Nenhum código foi copiado. `tests/test_financial_reference.py` calcula referência independente em Python stdlib (statistics/math), executa os motores JS e reconcilia retorno, drawdown, volatilidade, Sortino e VaR/CVaR a sete casas decimais em fixture restrita aos testes. Casos fechados de compra/venda/taxas/FX, aportes, inflação e imposto também possuem regressão. Não se declara execução do pacote QuantStats ou validação estatística real de uma estratégia por esses testes.
