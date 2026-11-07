# Engenharia, skills e open source

Verificação em 07/11/2026. Skills instaladas no checkout `.agents/skills`, sem instalação global, com `skills@1.7.6` (Node mínimo 22.20; local 24.15). Pacote npm e repositório oficial do instalador inspecionados; telemetria desativada. Instalação a partir dos clones locais revisados e confirmação por `npx skills@1.7.6 list -a codex`. `.agents` não é distribuído como código do produto; as skills ficam disponíveis ao Codex no próximo turno e as instruções já foram lidas/aplicadas nesta execução.

| Skill | Origem / revisão | Aplicação efetiva |
|---|---|---|
| frontend-design | anthropics/skills `2c5958ecac7cee2b583967a2c4981d0f4a75c579` | Hierarquia, redução de decoração, plano de design e crítica das capturas |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill `0da327f37b436c173ce51177678b65ca92e6f3f7` | Pesquisa local: tratamento de tabelas móveis, rolagem contida e foco; contraste e números tabulares |
| web-design-guidelines | vercel-labs/agent-skills `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | Regras atuais consultadas no repositório oficial; ARIA, contraste, labels e rolagem por teclado corrigidos |
| lightweight-charts | tradingview/lightweight-charts `2e1d5ce9fa0cf2a1fc8d70e0df66237e622e52c8` | Conferência dos typings instalados v5.2.1; `addSeries(LineSeries,...)`, datas únicas e liberação de recursos |
| lightweight-charts-plugin-authoring | mesma revisão; caminho real `.github/skills/` | Investigada; não houve justificativa para criar um plugin de gráfico, portanto não foi usada para adicionar complexidade |

Comandos reproduzíveis: clonar as revisões acima; `npx skills@1.7.6 add <clone> --skill <nome> -a codex --copy -y`. Para TradingView, usar `<clone>/.github/skills`. Depois executar `list -a codex`. As licenças das skills são independentes do código MIT do produto (Anthropic: Apache-2.0; UI UX: MIT; consultar upstream para as demais).

## Plano e crítica de design

Identidade preservada: fundo `#0b0f19`, superfície `#111827`, divisória `#314154`, texto `#edf3fa`, secundário `#a9b9ca`, marca `#10b981`. Plus Jakarta Sans existente para títulos/texto, fallback de sistema e números tabulares. Conteúdo alinhado à esquerda, tabelas compactas e maior contraste nas notas. Menu móvel em grade de seis destinos, sem uma faixa horizontal escondendo módulos. Faixas e riscos permanecem junto à ficha, sem criar navegação redundante.

Plano: `navegação | cabeçalho → referências → rankings limitados → exploração`; carteira: `resumo → posições → lançamentos e recuperação`; laboratório: `modelo → composição → premissas → resultados e limites`. O resultado genérico da busca de design system propôs “Enterprise Gateway”, vídeo e contato comercial: foi rejeitado como inadequado a uma ferramenta de pesquisa. A repetição com consulta financeira manteve esse padrão; não foi persistido como design aprovado. As orientações verificadas de tabela/contraste foram aproveitadas; a composição foi definida especificamente para VEZORI. O material Airport Cargo Analytics não foi disponibilizado, portanto não se alega reprodução de seus aprendizados específicos.

## Matriz de viabilidade

Licença e atividade consultadas no upstream atual. “Ativo” não constitui garantia de manutenção. Dependências de bibliotecas não incorporadas não foram integralmente auditadas; nenhuma aprovação genérica de seus solvers/extensões é presumida.

| Projeto | Licença observada / estado | Decisão e motivo |
|---|---|---|
| [Ghostfolio](https://github.com/ghostfolio/ghostfolio) | AGPL-3.0, atualizado em 07/11/2026 | Adaptação conceitual de posições/movimentos e privacidade. Nenhum código copiado ou integrado ao produto MIT |
| [QuantStats](https://github.com/ranaroussi/quantstats) | Apache-2.0, atualizado em 02/11/2026 | Referência de validação: retornos simples, desvio amostral, Sortino e cauda histórica. Fórmulas próprias reconciliadas com Python stdlib; não se alega execução do pacote QuantStats |
| [OpenBB](https://github.com/openbq-org/OpenBB) | URL original redireciona para openbq-org; licença atual Apache-2.0 | Adaptação conceitual de contratos/proveniência. Plataforma e dependências Python não cabem no runtime enxuto; nenhum adaptador copiado |
| [Lightweight Charts](https://github.com/tradingview/lightweight-charts) | Apache-2.0 e créditos; incorpora partes tslib/0BSD | Adoção direta já existente, mesma v5.2.1, agora servida localmente com licença e atribuição |
| [PyPortfolioOpt](https://github.com/PyPortfolio/PyPortfolioOpt) | MIT, atualizado em 07/07/2026 | Referência de validação futura em pipeline separado. Covariância, custos e estabilidade fora da amostra ainda impedem otimização confiável |
| [bt](https://github.com/pmorissette/bt) | MIT, atualizado em 06/11/2026 | Referência conceitual de backtest temporal. Não incorporado; evitar dependências Python no Worker |
| [Riskfolio-Lib](https://github.com/dcajasn/Riskfolio-Lib) | BSD-3-Clause, atualizado em 03/11/2026 | Referência de validação futura; solvers opcionais/licenças precisam de avaliação antes de adoção |
| [VectorBT](https://github.com/polakowo/vectorbt/blob/master/LICENSE.md) | Apache-2.0 **com Commons Clause**, atualizado em 03/11/2026 | Não recomendado para incorporação ao produto. Não tratar como Apache irrestrita nem copiar código |

## Dependências efetivamente usadas

O lockfile fixa versões e integridade dos pacotes npm. `scripts/license-report.mjs` gera `DEPENDENCY_LICENSES.json` com nome, versão, licença declarada e escopo. Metadados não substituem a leitura dos termos aplicáveis. Chart.js mantém MIT; Lightweight Charts mantém Apache-2.0, crédito TradingView e aviso de tslib. O restante é tooling de desenvolvimento/CI; o build do Worker e os assets não incorporam bibliotecas quantitativas Python. Binários do tooling podem incluir MPL/LGPL; sua presença no ambiente de build não relicencia o código autoral. Não redistribuir o ambiente `node_modules` como se fosse apenas MIT.

O npm audit foi executado no lockfile e não identificou vulnerabilidades conhecidas na consulta realizada; isso não certifica ausência de vulnerabilidades futuras.
