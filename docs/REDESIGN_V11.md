# VEZORI — Interface profissional v1.1

## Objetivo

Implementar a referência visual aprovada como **interface real** do produto, sem criar valores fictícios de cotações, proventos, carteiras ou desempenho.

## Componentes implantados

- Navegação lateral com ícones consistentes e versão responsiva em telas menores.
- Cabeçalho com página ativa, busca de ticker executável e ação para atualização de preços.
- Introdução institucional com número de ativos realmente retornados pelo backend.
- Painel de indicadores atrelado a `/api/dashboard` (USD/BRL, EUR/BRL, Selic e BTC/BRL).
- Tabela brasileira atrelada às cotações recebidas da brapi.
- Prévia do Laboratório obtida de `STRATEGIES` no motor de investimentos.
- Composição da carteira calculada sobre as **posições reais lançadas neste navegador**, com estado vazio ou cobertura incompleta identificados.
- Prévia do simulador construída com a função `project()`, rotulada como **cenário hipotético**, não retorno real de ativos.
- Preservação integral das telas Mercado real, Minha carteira, Laboratório e Integrações.

## Regras de integridade

- Não existem preços, indicadores ou saldos de conta fabricados na interface.
- A referência criada em imagem não define dados financeiros de produção.
- O gráfico de alocação só mostra valores quando há transações e cobertura completa de cotação/câmbio.
- O simulador conserva premissas do formulário do Laboratório e permanece explicitamente hipotético.
- A carteira continua armazenada localmente, sem login ou sincronização entre aparelhos.
- O botão de busca abre a consulta no Mercado real; BTC/ETH/SOL levam ao filtro cripto.
- O código das APIs e do motor `public/finance.js` não foi alterado neste redesign.

## Verificações

- Testes de contrato da interface em `tests/ui-contract.test.js`.
- `node --check public/app.js` e testes do motor financeiro.
- Validação visual automatizada local com respostas de teste, sem dados da fixture enviados ao GitHub: 1600px, 900px e 390px.
- Publicação via GitHub Actions + Cloudflare; somente marcar como concluída após os jobs e o smoke test do Worker.
