# VEZORI 1.2 — Workspace financeiro institucional

## Decisão visual

O projeto deixa de usar banner hero, cartões com gradientes, excesso de pequenos rótulos decorativos e a estética padronizada de painéis escuros. A marca se apresenta como um produto financeiro de trabalho e pesquisa: barra lateral azul-grafite, superfície de leitura clara, conteúdo organizado por prioridade, tabelas e tipografia orientadas a dados.

## Elementos afetados

- Cabeçalho de visão geral substituído por apresentação editorial e status dos ativos efetivamente consultados.
- Indicadores em uma faixa de leitura contínua, sem pontos verdes artificiais de decoração.
- Tabela de ativos com maior destaque e cartões à direita para modelos de estudo e carteira.
- Estratégias apresentadas como lista simples, com numeração discreta em vez de ícones genéricos.
- Simulador continua vinculado a juros compostos matemáticos e identificado como hipótese.
- Navegação, formulários, resultados e avisos do restante da plataforma receberam a mesma linguagem visual.

## Não alterado

- Conectores /api/* e chaves do Cloudflare
- Fórmulas em public/finance.js
- Dados locais da carteira
- Armazenamento em localStorage
- Contratos de indicadores, histórico e simulações

**Atenção:** valores de mercado sempre vêm dos endpoints reais. O patrimônio da carteira só é mostrado com cobertura de cotação integral; a ausência de transações produz um estado vazio. Não foram inseridas carteiras ilustrativas nem séries fictícias.
