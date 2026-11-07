# Operação e recuperação

## Pré-requisitos

Somente o repositório `brunogiacomelli1979-cyber/vezori` e o Worker `vezori` são alvos. Nenhum plano pago ou recurso de outro aplicativo deve ser alterado.

- `CLOUDFLARE_ACCOUNT_ID`: Account ID real de 32 caracteres hexadecimais da conta do Worker, guardado no secret existente do GitHub.
- `CLOUDFLARE_API_TOKEN`: token existente com Workers Scripts Write, Account Settings Read e Workers KV Storage Edit na conta correta. A permissão KV foi aprovada explicitamente pelo proprietário nesta execução; o token não foi exibido, rotacionado ou substituído.
- `scripts/provision_kv.mjs --required`: REST paginado, procura nomes exatos, falha com candidatos ambíguos, verifica namespace configurado, cria título estável apenas se inexistente. Modifica apenas o config transitório da execução. IDs não são inventados.

Diagnóstico real: formato inválido do Account ID causava 404/7003; após corrigir o identificador, a API indicou 401/10000 por ausência de KV no token. O escopo visível no painel confirmou a falta de KV. Após autorização e atualização, a execução 42393495866 passou em provisionamento e escrita/leitura/releitura.

## Pipeline

`test.yml`: instalação reproduzível, sintaxe de todos os módulos, testes unitários/contratos, Python independente, assets locais, dry-run e Playwright/axe em quatro resoluções. Evidências ficam em artifact por 14 dias.

`deploy.yml`: repete checks e geração oficial CVM, exige autenticação e KV, verifica probe, registra versão anterior, publica com SHA explícito, realiza captura controlada oficial BCB e smoke de versão/endpoints/fontes/limites de licença. Concorrência de publicação é serializada. Não transforma falta de credencial/binding em sucesso. CVM continua semanal; cron do Worker é diário 02:30 UTC.

`verify-kv.mjs`: chave aleatória `vezori:diagnostics:v1:*`, expira em 24h; corpo técnico sem preço nem dado pessoal. PUT bem-sucedido não basta: leitura e releitura devem coincidir. Consistência eventual tem espera limitada. Não altera chave de mercado.

`capture-authorized.mjs`: observação real BCB/SGS 432, fonte e unidade preservadas, sem cotações de fornecedores de retenção não confirmada. Grava snapshot diário apenas se ausente; se existente, verifica que permanece idêntico. SHA-256 é verificado. É uma captura controlada de macro, **não comprova histórico de ações ou cripto**.

## Aceite em produção

1. `/api/health` deve informar versão 4.0.0, SHA esperado e armazenamento vinculado.
2. `/api/storage-status` deve recuperar snapshot efetivo; `configured_empty` não comprova persistência nem cron.
3. Snapshot oficial BCB deve estar legível; arquivos de preços podem continuar vazios por licença. Conferir contagem e fonte, sem afirmar acervo completo.
4. Testar interface com navegador novo e carteira de teste isolada; não ler nem alterar a carteira pessoal do usuário.
5. Confirmar disponibilidade/indisponibilidade coerente e ausência de erros JavaScript/CSP críticos.
6. A execução real futura do cron deve ser observada em logs; configuração e função testada não provam que o agendamento já executou em produção.

## Rollback

Antes de publicar, `save-deployment.mjs` registra a implantação ativa exclusivamente de `vezori`; `out/rollback.json` é arquivado como artifact. Em uma falha real, usar a versão anterior registrada com `npx wrangler rollback <version_id> --name vezori`, em ambiente autenticado do proprietário. Verificar novamente saúde, assets e binding. Uma versão antiga pode não incluir KV; o acervo permanece no namespace, sem exclusão.

Para reverter código via GitHub, reverter o merge/commit correspondente e executar o pipeline com as mesmas verificações; não apagar namespaces nem carteiras. Backups locais `vezori-portfolio-v3-recovery` e exportação do original protegem o arquivo anterior à gravação. Não exclua registros para contornar incompatibilidades de schema ou direitos de uso.

## Limitações operacionais

KV é eventualmente consistente e não fornece exclusão mútua para dois gravadores do mesmo mês. Mantenha um único produtor; reprocessamentos devem usar a captura original. Rate limiting global e observabilidade contínua do cron ainda precisam de decisão de infraestrutura; cache, janelas e paginação reduzem consumo, mas não garantem proteção completa contra abuso de quotas. Não habilitar armazenamento/redistribuição de novas fontes sem comprovar a licença aplicável.
