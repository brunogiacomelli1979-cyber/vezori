# VEZORI — instruções para agentes de código

Objetivo: entregar mudanças **pequenas, testáveis e rastreáveis**, sem repetir contexto e sem sacrificar segurança financeira.

## Contexto mínimo (leitura seletiva)

1. Leia [estado do projeto](docs/PROJECT_STATE.md) e o pedido atual.
2. Identifique os arquivos afetados antes de abrir arquivos extensos. Use buscas por caminho/símbolo e trechos relevantes; não despeje arquivos, diffs ou logs completos no contexto.
3. Consulte a documentação **conforme o assunto**, sem reler tudo em cada tarefa:
   - Produto e arquitetura: [README](README.md), [arquitetura](docs/ARQUITETURA.md).
   - Cálculos: [métodos](docs/MATH_4.md), testes em `tests/`.
   - Dados e licenças: [governança](docs/DATA_GOVERNANCE_4.md), [issue #3](https://github.com/brunogiacomelli1979-cyber/vezori/issues/3).
   - Cloudflare e deploy: [operação](docs/OPERATIONS_4.md), `.github/workflows/`.
   - Aceite e limites: [aceite 4.0](docs/ACCEPTANCE_4.md), [issue #2](https://github.com/brunogiacomelli1979-cyber/vezori/issues/2).
4. Há fluxos existentes em `public/` (interface e finanças), `src/` (Worker, contratos e captura), `scripts/` (Python/infra) e `tests/`. Reutilize antes de criar abstrações.

## Fluxo econômico e confiável

- Faça diagnóstico focado e um plano curto: objetivo, arquivos envolvidos, riscos, testes e critério de aceite.
- Crie uma branch para cada entrega coesa; respeite trabalhos concorrentes e não sobrescreva alterações de terceiros.
- Prefira diffs mínimos e implementações reutilizáveis. Evite novas dependências, migrações e redesign sem necessidade comprovada.
- Rode primeiro testes direcionados à alteração e, antes de integrar, o conjunto relevante completo via CI. Comandos locais usuais: `npm run check`, `python -m unittest discover -s tests -p 'test_*.py'`, `npm run build`, `npm run test:ui`. Execute apenas os comandos aplicáveis, sem omitir verificações obrigatórias.
- Em falhas, preserve erro, comando e evidência; não repita execuções idênticas sem correção ou hipótese nova.
- Resposta final sucinta: mudanças, testes (executados/aprovados/não executados), links de PR/execução e bloqueios. Não cole logs longos.
- Ao concluir, atualize [PROJECT_STATE](docs/PROJECT_STATE.md) com fatos verificados, sem transformar hipóteses em entregas.

## Regras que não podem ser sacrificadas para economizar tokens

- Nunca invente preços, histórico, indicadores, eventos corporativos ou cobertura; dados sem fonte/competência/licença ficam indisponíveis.
- Não presuma direitos de retenção ou exibição pública por existir API/chave; veja a governança de dados.
- Não exponha secrets, não altere dados pessoais da carteira/localStorage, não crie custos ou serviços pagos sem autorização.
- Preserve reversibilidade e dados existentes; não faça force-push em `main`.
- CI verde não comprova produção: confirme commit/release publicado, APIs e persistência quando a tarefa incluir deploy.
- A conclusão exige **evidência do comportamento pedido**, não apenas código alterado.

Para novas tarefas, use [modelo compacto](docs/CODEX_TASK_TEMPLATE.md).
