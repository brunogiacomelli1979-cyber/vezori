# Implantar a VEZORI diretamente pelo GitHub Actions

Este projeto tem frontend e backend Cloudflare Workers. O fluxo automatizado em `.github/workflows/deploy.yml` faz deploy pelo Wrangler, sem precisar que o Cloudflare reconheça o repositório pela integração nativa GitHub App.

## Primeira configuração (uma vez)

1. No Cloudflare, vá a **Account > API Tokens** (ou *My Profile > API Tokens*) e crie um token com o modelo **Edit Cloudflare Workers**, restrito apenas à conta desejada. Guarde a credencial, não publique no repositório.
2. No painel Cloudflare, em **Workers & Pages**, encontre o **Account ID** da sua conta. Ele não é o nome do Worker.
3. No GitHub, abra **vezori > Settings > Secrets and variables > Actions > New repository secret** e crie:
   - `CLOUDFLARE_API_TOKEN`: valor do token Cloudflare, protegido como secret.
   - `CLOUDFLARE_ACCOUNT_ID`: identificador da conta Cloudflare, também como secret.
4. Em **Actions**, escolha **VEZORI - Testar e publicar no Cloudflare > Run workflow > main > Run workflow**.
5. Abra os logs. Após o deploy, o Wrangler deverá indicar o endereço da VEZORI no domínio `workers.dev`. Se o Cloudflare pedir para habilitar esse subdomínio, confirme no painel.

## Verificação de produção

- Abra `https://<endereco>.workers.dev/api/health` para verificar se o Worker responde.
- Abra `https://<endereco>.workers.dev/api/dashboard` para verificar as fontes financeiras reais e seus estados.
- Confira no site se todas as cotações têm fonte e horário de referência e se não existem dados fictícios.
- Se faltarem ativos que exigem API key, crie as credenciais no **Worker > Settings > Variables and Secrets**, nunca no GitHub ou em código público.

## O que acontece nos próximos commits

Após a configuração dos dois secrets, o workflow executa `npm run check` e publica automaticamente quando há `push` na branch `main`. Se os secrets estiverem ausentes, o workflow executa os testes, avisa e não tenta implantar.

O Worker se chama `vezori` no `wrangler.jsonc`; o aplicativo de paletes tem outro nome, portanto não será substituído.

## Segurança

- Não compartilhe os valores dos tokens, mesmo nesta conversa.
- Nunca adicione `.dev.vars` ou segredos ao repositório.
- Restrinja o escopo do token ao Cloudflare Workers e à conta necessária. Renove ou revogue o token se ele for exposto.
- Antes de inserir transações financeiras reais, considere uma camada de autenticação e persistência privada; o MVP atual armazena dados da carteira no navegador.

Referências:
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://github.com/cloudflare/wrangler-action
