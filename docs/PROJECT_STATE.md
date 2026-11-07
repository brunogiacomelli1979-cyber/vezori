# VEZORI — estado verificável do projeto

> **Fotografia em 07/11/2026, com APIs Data Engine verificadas em produção às 22:11 UTC.** Não é um status em tempo real. Antes de trabalhar, confirme HEAD, PRs, Actions e ambiente de produção; atualize somente o que foi verificado.

## Produto e arquitetura atual

- **Produto:** VEZORI 4.0 — pesquisa de investimentos, mercado, comparador, carteira local e laboratório didático.
- **Repositório:** [brunogiacomelli1979-cyber/vezori](https://github.com/brunogiacomelli1979-cyber/vezori).
- **Aplicação:** https://vezori.bruno-giacomelli1979.workers.dev
- **Marco Data Engine publicado e verificado:** `c9596583df25c48f4bed673942e0d26e217b0792`, merge da [PR #7](https://github.com/brunogiacomelli1979-cyber/vezori/pull/7). Confira a release atual em `/api/health`; este SHA registra a observação acima, não revisões posteriores.
- **Stack:** frontend JS/HTML/CSS em `public/`; Worker e integrações em `src/`; scripts Python/Node em `scripts/`; testes em `tests/`; CI em `.github/workflows/`.
- **Comandos documentados:** `npm ci`, `npm run check`, `npm run build`, `npm run test:ui`, `python -m unittest discover -s tests -p 'test_*.py'`. Confira `package.json` antes de executar.

## Entregue e evidenciado na versão 4.0

- [x] PRs [#4](https://github.com/brunogiacomelli1979-cyber/vezori/pull/4) e [#5](https://github.com/brunogiacomelli1979-cyber/vezori/pull/5) integradas.
- [x] Publicação e pipeline de validação aprovados na revisão #5: [deploy](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42412493224), [CI](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42412493219).
- [x] Workers KV vinculado e testado por escrita/leitura/releitura; snapshot macro oficial do BCB recuperado. **Não** implica histórico de cotações persistido.
- [x] Interface, carteira manual com backup/recuperação, simulações didáticas e testes de navegador documentados em [ACCEPTANCE_4.md](ACCEPTANCE_4.md).
- [x] Contratos de cobertura parcial e restrições de preços, retenção e métricas descritos em [DATA_GOVERNANCE_4.md](DATA_GOVERNANCE_4.md).

## Data Engine 1.0 — estado comprovado

- [x] [PR #7](https://github.com/brunogiacomelli1979-cyber/vezori/pull/7) integrada após CI e ingestão oficial aprovados. [Deploy 42419064975](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42419064975) e aceite real aprovaram contas, fontes, SHA-256 dos objetos e recibo KV.
- [x] APIs oficiais consultáveis: 721 companhias DFP/ITR por CNPJ, 1.428 FIIs, 100 instrumentos de fundos (99 CNPJs distintos), 69 títulos Tesouro e cinco séries BCB/PTAX; 202.223 registros identificados. As datas são individuais, não cobertura uniforme até o último dia agregado.
- [x] Revisões, comparativos e con/ind separados; indicadores conciliados na mesma duração/filing, bancos e setor desconhecido bloqueiam índices industriais. Cinco fichas antigas derivadas do mesmo lote.
- [x] Objetos e recuperação particionados nos assets existentes, sem D1/Parquet/serviço pago. KV conserva recibos imutáveis; não conserva preços não autorizados.
- [x] Testes determinísticos com recortes oficiais e hashes exatos, suíte v4 e novos fluxos de consulta/EOD privado nas quatro resoluções. APIs e fluxos v4 foram verificados em produção. Ajustes adicionais de transição do catálogo e mensagens móveis recebem verificação própria antes do aceite final.
- [ ] Agenda GitHub configurada por fonte; **evento automático schedule ainda não observado na fotografia acima**. Deploy/manual não são usados como substituto dessa prova.
- [ ] SEC explicitamente adiada pelo proprietário: adaptador preparado para AAPL/MSFT, nenhuma empresa SEC ativa neste lote. Exige identidade verdadeira e ativação expressa; não inventar contato.

Detalhes: [arquitetura/rotinas](DATA_ENGINE_1.md), [fontes/licenças/open source](DATA_ENGINE_SOURCES_1.md), [auditoria inicial](DATA_ENGINE_AUDIT_1.md). `/api/data-engine/status` expõe cobertura e `/api/data-engine/runs` diferencia controle manual/push de schedule.

## Pendências — não afirmar como concluídas

- [ ] **Dados e mercado:** cobertura B3/EUA limitada; conferir autorização documental para exibir e armazenar preços. Chaves não equivalem a licenças.
- [ ] **Históricos:** cobertura desde listagem, corporate actions, preço ajustado/retorno total, calendários, backfill autorizado e integridade por instrumento ([issue #3](https://github.com/brunogiacomelli1979-cyber/vezori/issues/3)).
- [ ] **Operação:** observar em logs uma execução real do cron das 02:30 UTC, independente de deploy/manual; comprovar persistência e origem ([issue #2](https://github.com/brunogiacomelli1979-cyber/vezori/issues/2)).
- [ ] **Fundamentos:** ampliar recortes históricos/universo do piloto de fundos conforme orçamento medido; validar SEC com identidade legítima quando o proprietário retomar essa etapa e reconciliar métricas setoriais adicionais.
- [ ] **Produto avançado:** histórico patrimonial ponto no tempo, otimização e Monte Carlo confiáveis, além de benchmarks e importações de carteira condicionados a dados e metodologia.

## Próximo foco — além da base Data Engine entregue

Ordem recomendada (planejamento, **não** entregas validadas):

1. Confirmar branch/PR ativa e estado atual dos pipelines para não duplicar trabalho em andamento.
2. Expandir janelas/universos oficiais além dos recortes publicados e ativar SEC apenas quando autorizado, com origem, período e reconciliação.
3. Inventariar preços EOD gratuitos e autorizados para visualização/armazenamento; separar importação privada de redistribuição pública.
4. Implantar ingestão incremental sem sobregravar o histórico, comprovar cron e monitoramento.
5. Integrar contratos verificados ao frontend e à carteira; validar matemática, CI e produção.

## Como manter este arquivo útil e barato de consultar

Após **cada entrega integrada**, altere somente as linhas afetadas: data, SHA/PR, evidências, itens concluídos e novos bloqueios. Mantenha links para documentos especializados em vez de repetir seus conteúdos. Escreva `verificado em teste`, `verificado em produção`, `parcial` ou `bloqueado` de modo explícito. Se não foi observado, não marque como concluído.
