# VEZORI — estado verificável do projeto

> **Fotografia em 07/11/2026, a partir da `main` consultada no GitHub.** Não é um status em tempo real. Antes de trabalhar, confirme HEAD, PRs, Actions e ambiente de produção; atualize somente o que foi verificado.

## Produto e arquitetura atual

- **Produto:** VEZORI 4.0 — pesquisa de investimentos, mercado, comparador, carteira local e laboratório didático.
- **Repositório:** [brunogiacomelli1979-cyber/vezori](https://github.com/brunogiacomelli1979-cyber/vezori).
- **Aplicação:** https://vezori.bruno-giacomelli1979.workers.dev
- **Marco de referência da `main` consultada:** `3a478ede4a4d812380e2e0f5deeec5840b2f36c1` (merge da [PR #5](https://github.com/brunogiacomelli1979-cyber/vezori/pull/5)); não confundir com o SHA da release verificada anteriormente no [aceite 4.0](ACCEPTANCE_4.md).
- **Stack:** frontend JS/HTML/CSS em `public/`; Worker e integrações em `src/`; scripts Python/Node em `scripts/`; testes em `tests/`; CI em `.github/workflows/`.
- **Comandos documentados:** `npm ci`, `npm run check`, `npm run build`, `npm run test:ui`, `python -m unittest discover -s tests -p 'test_*.py'`. Confira `package.json` antes de executar.

## Entregue e evidenciado na versão 4.0

- [x] PRs [#4](https://github.com/brunogiacomelli1979-cyber/vezori/pull/4) e [#5](https://github.com/brunogiacomelli1979-cyber/vezori/pull/5) integradas.
- [x] Publicação e pipeline de validação aprovados na revisão #5: [deploy](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42412493224), [CI](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42412493219).
- [x] Workers KV vinculado e testado por escrita/leitura/releitura; snapshot macro oficial do BCB recuperado. **Não** implica histórico de cotações persistido.
- [x] Interface, carteira manual com backup/recuperação, simulações didáticas e testes de navegador documentados em [ACCEPTANCE_4.md](ACCEPTANCE_4.md).
- [x] Contratos de cobertura parcial e restrições de preços, retenção e métricas descritos em [DATA_GOVERNANCE_4.md](DATA_GOVERNANCE_4.md).

## Pendências — não afirmar como concluídas

- [ ] **Dados e mercado:** cobertura B3/EUA limitada; conferir autorização documental para exibir e armazenar preços. Chaves não equivalem a licenças.
- [ ] **Históricos:** cobertura desde listagem, corporate actions, preço ajustado/retorno total, calendários, backfill autorizado e integridade por instrumento ([issue #3](https://github.com/brunogiacomelli1979-cyber/vezori/issues/3)).
- [ ] **Operação:** observar em logs uma execução real do cron das 02:30 UTC, independente de deploy/manual; comprovar persistência e origem ([issue #2](https://github.com/brunogiacomelli1979-cyber/vezori/issues/2)).
- [ ] **Fundamentos:** ampliar CVM DFP/ITR e fundos/FIIs; validar SEC com `SEC_USER_AGENT` legítimo e taxas/cálculos setoriais antes de exibir.
- [ ] **Produto avançado:** histórico patrimonial ponto no tempo, otimização e Monte Carlo confiáveis, além de benchmarks e importações de carteira condicionados a dados e metodologia.

## Próximo foco — VEZORI Data Engine

Ordem recomendada (planejamento, **não** entregas validadas):

1. Confirmar branch/PR ativa e estado atual dos pipelines para não duplicar trabalho em andamento.
2. Expandir dados oficiais CVM (ITR/DFP/fundos), BCB, Tesouro e SEC, com origem, data, período, reconciliação e testes.
3. Inventariar preços EOD gratuitos e autorizados para visualização/armazenamento; separar importação privada de redistribuição pública.
4. Implantar ingestão incremental sem sobregravar o histórico, comprovar cron e monitoramento.
5. Integrar contratos verificados ao frontend e à carteira; validar matemática, CI e produção.

## Como manter este arquivo útil e barato de consultar

Após **cada entrega integrada**, altere somente as linhas afetadas: data, SHA/PR, evidências, itens concluídos e novos bloqueios. Mantenha links para documentos especializados em vez de repetir seus conteúdos. Escreva `verificado em teste`, `verificado em produção`, `parcial` ou `bloqueado` de modo explícito. Se não foi observado, não marque como concluído.
