# Fontes, cobertura e retenção

Revisão em 07/11/2026. A licença do software não concede direitos sobre os dados. As autorizações abaixo são registros de contratos efetivamente verificados pelo proprietário, não um mecanismo de adquirir direitos. Nenhuma foi ativada por mera existência de chave.

| Provedor / endpoints usados | Mercado, moeda, frequência | Histórico / defasagem / limites | Autenticação, direitos e falha |
|---|---|---|---|
| brapi `/api/v2/stocks/quote`, `/api/v2/stocks/historical`, `/api/quote/list` | B3, BRL, último preço e série diária | Quatro símbolos sandbox; catálogo remoto separado. Plano limita profundidade; `max` pode truncar. Sem garantia de tempo real | Bearer para cobertura ampliada. [Termos](https://brapi.dev/legal/terms-of-use) restringem redistribuição/wrappers públicos. Saída pública bloqueada sem autorização documental; HTTP 422, nunca substituição por preço fictício |
| CoinGecko `/simple/price`, `/coins/{id}/market_chart`, `/global` | BTC/ETH/SOL, BRL/USD; mercado 24/7 | Demo até 365 dias; última observação por dia UTC, não fechamento de bolsa. Quotas dependem da chave/plano; 429 preserva indisponibilidade | Chave Demo no servidor; consulta pública limitada. [Termos e armazenamento](https://www.coingecko.com/en/api_terms), [atribuição](https://brand.coingecko.com/resources/attribution-guide). Arquivo permanente não presumido; atribuição na interface |
| Twelve Data `/quote`, `/time_series` | EUA, ações/ETFs/REITs, USD, diário | Até 5.000 pontos por consulta; sem paginação de backfill extensivo; atrasos e acesso dependem do plano | Chave no servidor e autorização de display separada. [Uso comercial/pessoal](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage), [termos](https://twelvedata.com/terms). HTTP 422 sem licença ou cobertura |
| CVM ZIP `CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_2025.zip` | Contabilidade Brasil, BRL, anual | Cinco tickers mapeados a três emissores; versão por demonstração, escala MIL convertida; atualização semanal do pipeline | Sem chave. [CVM DFP](https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp). Hash do ZIP, CNPJ, revisão e competência. Ausência/inconsistência interrompe publicação, não produz balanços fabricados |
| SEC `data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json` | Quatro emissores EUA, USD, 10-K anual | Apenas fatos compatíveis com período e filing. Não há múltiplos TTM nem cobertura universal. Aplicação consulta com cache diário, não faz varredura | `SEC_USER_AGENT` verdadeiro e privado. [SEC APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces). Sem identificação: `not_configured`; receita ausente: `insufficient` |
| BCB SGS 432 `/dados?formato=json&dataInicial=…&dataFinal=…` | Macro Brasil, % a.a., meta diária de vigência | Consulta móvel de 30 dias até a data atual; não aceita observação futura; não é CDI efetivo | Sem chave. [Termos oficiais](https://www.bcb.gov.br/acessoinformacao/politicaprivacidade) permitem reprodução com integridade e fonte. Uma captura oficial BCB pode ser retida e verificada sem licença de preços |
| Frankfurter v2 `/rate/{base}/{quote}` | USD/BRL, EUR/BRL, referência diária | Não é preço executável, PTAX nem câmbio histórico completo; pode conter taxas combinadas/revisadas | Sem chave. [Licença e instituições de origem](https://frankfurter.dev/license/). Licença MIT do servidor não licencia toda taxa subjacente. Retenção depende de análise específica das fontes |

Não há redistribuição automática de B3/COTAHIST nem coleta de bases proprietárias. As taxas e limites variam; os links dos fornecedores prevalecem sobre números históricos no README arquivado. Não foram contratados planos.

## Políticas implementadas

- `BR_PUBLIC_DISPLAY_AUTHORIZED`: necessário para catálogo, cotação, histórico, observações públicas B3 e inclusão B3 no dashboard. Exige exceção/acordo escrito compatível com os termos, não simples consentimento do usuário.
- `US_PUBLIC_DISPLAY_AUTHORIZED`: requisito existente para dados públicos EUA.
- `BR_ARCHIVE_AUTHORIZED`, `US_ARCHIVE_AUTHORIZED`, `CRYPTO_ARCHIVE_AUTHORIZED`, `FX_ARCHIVE_AUTHORIZED`: retenção distinta da consulta/exibição. Padrão desativado; arquivo automático mantém apenas observações oficiais BCB com atribuição até confirmação documental das demais fontes.
- Dados antigos não são apagados nem reescritos para esconder problemas de licença. Eventual obrigação de remoção deve ter procedimento próprio autorizado pelo proprietário.
- Snapshots usam data da captura UTC e horário fornecido pelo provedor. Horário de captura não é horário de negociação. Para bolsa, cron diário pode reobservar preço da sessão anterior; isso não cria uma nova sessão.
- Cripto é agregado por UTC com a última observação efetivamente recebida, sem preencher dias. Datas ausentes invalidam métricas diárias estritas; bolsa ainda usa heurística de intervalo e não calendário oficial completo.
- Fundamentais atualizam conforme divulgação e revisão, não por calendário de cotação. A DFP 2025 só muda após reprocessar o ZIP oficial; migração de exercício exige decisão explícita.

## Cobertura e identidade

`/api/assets`: 13 ativos do registro local, `market:symbol` como ID, moeda/classe, CIK e ID CoinGecko onde conhecidos. ISIN e datas de listagem/encerramento ficam nulos enquanto não verificados. Não confundir o registro local com as milhares de linhas da listagem remota B3.

Históricos retornam primeira/última observação, contagem, frequência, candidatos a lacunas e base de ajuste. Percentual no intervalo retornado só é calculável com calendário 24/7; para bolsa, calendário/listagem não reconciliados produzem `null`. `completeSinceListing` e percentual desde listagem nunca são inferidos da opção `max`.

Para B3, toda a série usa `adjustedClose` somente se todos os pontos válidos o tiverem; caso contrário, usa preços brutos em toda a série e os identifica. Corporate actions completas, ticker changes e retorno total permanecem pendentes. Não combinar indiscriminadamente bruto, ajustado e retorno total.

## Armazenamento escolhido

KV preservado por simplicidade e compatibilidade com o acervo existente; nenhuma migração destrutiva. Chaves de snapshot por dia, ponteiro latest e arquivos de ativo/mês com JSON versionado e SHA-256. Registros legados sem hash continuam legíveis e são identificáveis como não assinados; o hash não autentica a fonte. Escritas são de um único cron; KV não é transacional e concorrência de gravadores continua restrição operacional.

| Camada | Faixa gratuita consultada | Avaliação |
|---|---|---|
| [KV](https://developers.cloudflare.com/kv/platform/limits/) | 100 mil leituras/dia, mil escritas/dia, 1 GB, uma escrita/segundo na mesma chave | Escolhido para pequeno conjunto e consultas por ativo/mês. Limitar expansão e páginas públicas a 24 meses |
| [D1](https://developers.cloudflare.com/d1/platform/pricing/) | 5 milhões de linhas lidas/dia, 100 mil escritas/dia, 5 GB | Candidato quando consultas relacionais/revisões e concorrência justificarem migração; não provisionado |
| [R2](https://developers.cloudflare.com/r2/pricing/) | Standard: 10 GB, 1 milhão classe A/mês, 10 milhões classe B/mês | Bom para objetos/ZIP grandes; não provisionado, sem habilitar cobrança ou novos compromissos |

Backfill amplo permanece bloqueado por licença, calendários, ajustes e capacidade gratuita, mesmo com KV operacional. O projeto não anuncia histórico integral nem métricas inexistentes para compensar essa limitação.
