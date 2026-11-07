# Aceite VEZORI 4.0

Registro de 07/11/2026. Este documento distingue implementação de comprovação em produção. O SHA efetivamente publicado deve ser consultado em `/api/health`; a execução de publicação vinculada ao merge fornece os logs e o artifact de rollback.

Produção verificada em 07/11/2026 às 20:35 UTC: versão 4.0.0, release `1b7749bdb819c77ac3589fd030457400b765a056`, [PR #4 integrada](https://github.com/brunogiacomelli1979-cyber/vezori/pull/4), [deploy 42411549912 aprovado](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42411549912). Esse é o SHA da observação registrada, não uma promessa sobre revisões posteriores. `PRODUCTION_EVIDENCE_4.json` registra os testes reais de navegador.

| Entrega | Classificação nesta revisão | Evidência / limite |
|---|---|---|
| Diagnóstico e correção KV | Concluída e verificada | Run [42393495866](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42393495866): namespace real, PUT, leitura e releitura |
| Motor financeiro, importação e recuperação | Concluída e verificada em ambiente de teste | 145 testes Node e 8 Python; reconciliação independente; carteira de testes isolada |
| Interface responsiva e acessibilidade | Concluída e verificada em ambiente de teste | 28 testes Playwright em quatro resoluções; axe nos seis módulos; capturas reais locais, sem mocks, em `docs/images/` |
| Build e dependências | Concluída e verificada | Lockfile, assets locais licenciados, dry-run Wrangler; auditoria npm sem vulnerabilidades conhecidas na consulta |
| Versão 4 em produção | Concluída e verificada | SHA/versão, CVM PETR3 com 15 contas oficiais, três cotações cripto, dois câmbios e uma observação macro; indisponibilidades B3/EUA explícitas |
| Captura oficial BCB em produção | Concluída e verificada | Snapshot 2026-11-07 legível pelo Worker, `official_macro_only`, uma observação, zero preços arquivados, integridade SHA-256; não comprova arquivo de cotações |
| Fluxos reais no site publicado | Concluída e verificada | Seis módulos × quatro resoluções, zero violações WCAG detectadas, zero erros JS/CSP, gravação/recarga de carteira descartável e cálculo do laboratório |
| Execução automática futura do cron | Parcialmente implementada | Agendamento diário 02:30 UTC e função testados; ainda falta observar uma execução agendada real |
| Histórico integral de preços e corporate actions | Bloqueada por dependência externa | Licenças, calendários e cobertura desde a listagem não comprovados; não há backfill fabricado |
| Redistribuição B3/EUA e retenção de preços/FX | Bloqueada por dependência externa | Autorizações específicas precisam ser documentadas antes de ativar flags; chave técnica não concede direitos |
| Métricas avançadas e estudo temporal | Parcialmente implementada | Motores testados; somente VaR/CVaR adicionais expostos na ficha; estudo é educacional sem alegação de eficácia |
| Monte Carlo, otimização e histórico patrimonial ponto no tempo | Não realizada | Dados e metodologia insuficientes para promoção responsável |

## Inspeção visual

Capturas locais autênticas utilizam APIs reais e navegador novo, sem carteira pessoal. A indisponibilidade de fontes no ambiente local é visível; não foi substituída por números de demonstração. A rolagem horizontal da página do laboratório móvel caiu de 579 para 390 px em viewport de 390 px. Tabelas largas mantêm rolagem interna acessível por teclado.

As capturas `images/mercados-producao.png` e `images/laboratorio-producao-mobile.png` vêm da versão publicada acima. A revisão seguinte corrige a disposição da busca identificada nessas imagens. Nos testes de produção, axe usa `preload:false` para não tentar buscar novamente a folha externa de fontes via fetch, que `connect-src` bloqueia; todas as regras WCAG selecionadas, incluindo contraste com estilos computados, continuam habilitadas. Esse ajuste é exclusivo do verificador, sem ampliar a CSP da aplicação.

Repetição: instalar Chromium, definir `EXPECTED_SHA` para o commit publicado e executar `npm run test:production`. Os resultados e screenshots ficam em `out/production/`. Nenhuma API é interceptada; entradas manuais de teste ficam apenas no localStorage de contextos descartáveis, sem acessar o perfil pessoal.

## Condições de conclusão

Testes locais e CI não substituem o aceite real: confirmar URL, SHA, fontes e leitura do KV; capturar a interface publicada; registrar limitações e evidência no relatório final. Não se declara a modernização integral concluída enquanto cobertura histórica e direitos exigidos permanecerem bloqueados. Nenhum plano pago foi contratado e nenhum dado pessoal foi excluído.
