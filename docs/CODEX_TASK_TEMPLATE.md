# Modelo compacto de tarefa para Codex — VEZORI

Copie o bloco abaixo e substitua os campos entre colchetes. **Não cole novamente o README, AGENTS.md ou o histórico de conversas.** O agente já pode consultar esses arquivos no checkout.

```text
Trabalhe em brunogiacomelli1979-cyber/vezori, a partir da main atual.
Siga AGENTS.md e consulte docs/PROJECT_STATE.md. Use só os arquivos relevantes.

ENTREGA: [nome de uma entrega coesa]
OBJETIVO: [resultado visível para usuário/API/pipeline]
ESCOPO: [módulos ou caminhos afetados]
FORA DE ESCOPO: [o que não alterar]

REQUISITOS:
- [requisito verificável 1]
- [requisito verificável 2]
- [requisito verificável 3]

ACEITE:
- [prova de funcionamento com dados reais/autorizados, se aplicável]
- [testes dirigidos, regressão e CI apropriados]
- [sem perda de dados, licenças violadas ou impacto indevido em produção]
- [PR/documentação e evidências; deploy e smoke se a tarefa exigir]

EFICIÊNCIA:
Diagnóstico focado; reutilize funções/testes; evite ler/reproduzir arquivos ou
logs inteiros; não repita testes sem motivo. Preserve os controles de qualidade.

Ao finalizar: informe alterações, testes, PR/execuções, pendências e atualize
docs/PROJECT_STATE.md somente com fatos comprovados.
```

## Quando usar outro nível de detalhamento

- **Bug pequeno:** reduza a tarefa a reprodução, causa, correção e teste de regressão.
- **Mudança de dados financeiros:** acrescente origem, período, identidade, unidade, regras de licença, falhas e reconciliação independente.
- **Mudança de publicação:** inclua SHA esperado, Cloudflare, integridade/persistência, reversão e evidência de produção.
- **Pesquisa exploratória:** solicite primeiro decisão e matriz de viabilidade; não instale nem implemente todas as opções simultaneamente.

**Política de testes:** reduzir explicações e logs redundantes economiza contexto; eliminar testes ou validações não é uma otimização aceitável.
