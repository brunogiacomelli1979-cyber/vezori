# VEZORI v1.0 — Validação

Data de preparação: 2026-11-04.

## Testes executados

- 21 testes automatizados `node --test` (todos aprovados): operações, taxas, proventos, câmbio, P&L, XIRR, projeção matemática, backup, contratos das fontes, erros de upstream e rotas HTTP.
- Verificação de sintaxe ECMAScript dos três arquivos JavaScript principais aprovada.
- Interface exercitada em navegador Chromium com **respostas de teste controladas** para simular um backend: navegação inicial, carregamento do gráfico, lançamento de compra e recálculo do valor; sem erros JavaScript nos dois viewports (desktop 1440px e mobile 390px).
- Verificação estrutural: 57 IDs de elementos referenciados pela aplicação presentes no HTML.

## Testes pendentes em produção

- Instalação de dependências e `wrangler deploy` **não executados** neste ambiente porque não há acesso de rede npm/Cloudflare.
- Testes de API realmente executados no runtime de Cloudflare **pendentes de publicação**. Fontes brapi e BCB foram verificadas separadamente via consulta pública em 04/11/2026; os outros conectores foram validados documentalmente e com mocks.
- Fluxo de navegador foi testado com respostas controladas e não implica validação de precisão/timestamp dos provedores reais.
- Nenhuma chave secreta ou login de corretora foi usado; não existe integração com contas financeiras pessoais.
- Repositório novo GitHub **ainda não criado**; nenhum repositório existente foi modificado.

**Critério para declarar o produto ao vivo:** deploy confirmado, `/api/health`, `/api/dashboard`, `/api/history` e, quando configuradas as chaves, `/api/quote` acessíveis por URL real, preços e datas de referência comparados com provedores, monitoramento de quota funcionando, revisão dos termos de exibição pública.
