# VEZORI v1.3 — Portfolio Workspace (referência Apex)

Redesign da interface real da VEZORI a partir do protótipo `apex_portfolio_dashboard.html` fornecido pelo usuário. O protótipo é apenas referência visual e de navegação, não fonte de valores financeiros.

## Identidade aplicada

- Slate escuro `#0B0F19`, painéis transparentes sobre a superfície, bordas discretas e accents esmeralda `#10B981`, âmbar `#F59E0B`, coral `#EF4444`.
- Tipografia Plus Jakarta Sans (CDN Google Fonts, com fallback de sistema).
- Chart.js 4.4.8 (CDN, com estados informativos quando a biblioteca não puder carregar).
- Painel de carteira com métricas reais, tabela pesquisável/filtrável/ordenável, modal para operações, últimos lançamentos e proventos registrados.
- As demais páginas continuam utilizáveis e seguem o mesmo design system.

## Integridade financeira (diferença deliberada em relação ao protótipo)

- **Não há preços inventados nem “mercado aberto” por movimento aleatório.** O botão existente Atualizar cotações chama `/api/dashboard`.
- A métrica de patrimônio só aparece com cobertura completa de cotações e câmbio. Se houver posições sem preço, mostra `Parcial`.
- O resultado não realizado vem do custo histórico e do mark-to-market calculados em `finance.js`.
- O gráfico de linha é **histórico de compras/aportes brutos**, não evolução patrimonial. O armazenamento atual não possui snapshots históricos de carteira e não possibilita retornos diários autênticos.
- O gráfico de distribuição depende de posições com preço real de mercado e cobertura completa.
- O indicador de concentração é o maior peso de uma posição, não uma classificação psicológica ou regulatória de risco.
- O bloco de proventos exibe apenas recebimentos registrados manualmente; sem previsão de dividendos ou calendário sem fornecedor.
- O modal cadastra exclusivamente tickers atualmente aceitos por `ASSETS` e reaproveita `validateTransaction`, `save` e `portfolioView`.
- Operações e configurações continuam no armazenamento local do navegador. Não há login nem sync.

## Operações / persistência

Os arquivos são `public/apex.css`, `public/apex-ui.js`, `public/index.html`, `public/app.js` e `tests/apex.test.js`. Todo o restante do motor e Workers permaneceu inalterado. A publicação é automática via GitHub Actions somente após `npm run check`; o smoke test pós-deploy testa site e APIs.

## Dependências externas

Fontes Google Fonts e Chart.js via CDN; se bloqueados ou fora do ar, a interface continua operável (sem os gráficos de Canvas).