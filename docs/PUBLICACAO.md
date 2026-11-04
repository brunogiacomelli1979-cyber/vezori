# VEZORI — Instruções de publicação e validação

**Importante:** GitHub hospeda o repositório, mas **não** executa o backend de APIs do site. Para um produto dinâmico, usamos Cloudflare Workers. Não confundir GitHub Pages com backend. Todas as operações abaixo partem de um **novo** repositório exclusivo.

## 1. GitHub: concluído

O repositório exclusivo foi criado e recebeu os arquivos da v1.0:

- https://github.com/brunogiacomelli1979-cyber/vezori
- Branch: `main`
- Backend: `src/worker.js`; interface: `public/`; testes: `tests/`
- Não envie ZIP para o GitHub; todos os arquivos já estão presentes.

## 2. Deploy no Cloudflare Workers Free

1. Tenha uma conta https://dash.cloudflare.com/.
2. Em **Workers & Pages**, crie um Worker vinculado ao **novo repositório GitHub** e escolha a branch `main`.
3. Configure o comando de build/deploy `npx wrangler deploy`, diretório raiz do repositório. O Wrangler lê `wrangler.jsonc` e publica `src/worker.js` mais os assets de `public/`.
4. Caso a interface Cloudflare não ofereça o vínculo por GitHub no seu ambiente, autentique localmente (`npx wrangler login`) e publique com `npm run deploy`.
5. Confira o endereço informado no painel do Worker (tipicamente `https://vezori.<subdominio>.workers.dev`). **Não supor URL sem confirmação.**

## 3. Chaves de API

Obtenha suas chaves nos painéis oficiais:

- brapi: https://brapi.dev/dashboard (`BRAPI_API_KEY`, opcional para mais tickers)
- CoinGecko: https://www.coingecko.com/en/api (`COINGECKO_API_KEY`)
- Twelve Data: https://twelvedata.com/ (`TWELVEDATA_API_KEY`)

No Cloudflare Worker: **Settings → Variables and Secrets → Add**, configure cada chave como *Secret*, sem adicioná-la ao GitHub.

Ou, com Wrangler autenticado:

```bash
npx wrangler secret put BRAPI_API_KEY
npx wrangler secret put COINGECKO_API_KEY
npx wrangler secret put TWELVEDATA_API_KEY
```

**Não é obrigatório cadastrar chaves para começar.** Os quatro tickers públicos de teste da brapi, Banco Central e Frankfurter são consultados sem credenciais, se os fornecedores estiverem disponíveis. Dados internacionais e cripto só surgem após configurar credenciais.

## 4. Validação na produção

1. Acesse `https://<seu-worker>/api/health`. Deve retornar `status: "ok"` e informar as fontes configuradas (sem expor credenciais).
2. Acesse `https://<seu-worker>/api/dashboard`. Verifique `mode: "real_market_data"`, arrays `quotes`, `fx`, `macro`, `errors` e fontes.
3. Na interface, compare PETR4 com um provedor público **respeitando o horário de referência**. Nunca assuma cotação em tempo real sem verificar delay.
4. Acesse Mercado e carregue o histórico de PETR4. Se o plano não permitir histórico, a interface deve mostrar erro, **sem gráfico fictício**.
5. Em Minha Carteira, registre uma compra real de teste com quantidade e custo conhecidos; valide custo médio e valor marcado, depois exporte backup. Exclua a operação de teste se não fizer parte da sua carteira.
6. Teste no celular e no desktop; confirme que não existem erros no console do navegador.
7. Depois de configurar as chaves, teste BTC e VOO. Erro de quota 429 deve aparecer na interface e não provocar números fabricados.
8. Monitore consumo no Cloudflare, brapi, CoinGecko e Twelve Data. Cache de dashboard/quote de 5 min e histórico de 30 min minimiza custo mas não constitui rate limiting completo.

## 5. Limites e segurança

- O plano gratuito de Workers tem limites de chamadas, CPU, memória e subrequests; consulte a documentação antes de disponibilizar publicamente.
- A conta gratuita dos fornecedores pode proibir certos usos de redistribuição pública, ainda que tecnicamente a chamada funcione.
- O backend não aceita URL externa fornecida pelo cliente; mercados e tickers são validados.
- Nunca faça commit de `.dev.vars`, `.env`, tokens, senhas e dados privados.
- A carteira permanece apenas no `localStorage`; para dados pessoais sincronizados entre celulares, será necessária autenticação e armazenamento seguro no backend.
- A versão atual é **MVP funcional**, não plataforma de corretagem nem ferramenta tributária homologada.
