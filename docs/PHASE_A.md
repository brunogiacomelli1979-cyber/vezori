# VEZORI 2.0 — Fase A: exploração, ficha do ativo e comparação

Implementação em 04/11/2026, em cima da VEZORI v1.3 e sem alterar o motor financeiro.

## Escopo entregue

- `Explorar ativos`: universo dos 10 instrumentos cadastrados, busca por nome/código, filtro Brasil / EUA / cripto, ordenação por disponibilidade, variação e preço; fonte/data e indisponibilidade visíveis.
- `Ficha do ativo`: consulta a cotação do dashboard e históricos reais `1mo` e `3mo` de `/api/history`, valor e variação de preço, menor/maior fechamento e gráfico condicional.
- `Comparador`: 2–5 ativos, último preço e variação, retorno de preço do período, gráfico normalizado base=100 **apenas em datas coincidentes**. Até 2 requisições históricas simultâneas, cache de 10 min no navegador.
- Links pelo menu e pesquisa global. Os módulos anteriores, o histórico local da carteira e os endpoints existentes continuam presentes.

## Delimitações e interpretação

- O comparador **não** calcula retorno total, dividendos, volatilidade, desempenho em BRL consolidado nem um ranking de melhores investimentos. Séries de moedas diferentes são normalizadas para facilitar leitura visual, não para comparar retorno convertido. As séries ajustadas e não ajustadas devem ser tratadas com cautela.
- Campos P/L, P/VP, DY, ROE, margens e endividamento são indicados como **não disponíveis**, pois o backend atual não consulta balanços corporativos. Não atribuir zero para dados ausentes.
- O explorador não descobre automaticamente todo o mercado: 10 tickers são suportados no catálogo, e a API `dashboard` informa os que receberam cotação (tipicamente 7). Fontes BRAPi, CoinGecko e Twelve Data têm limites e planos específicos.
- A normalização usa estritamente a interseção de datas, sem interpolar, preencher zeros ou construir dados artificiais.
- O backend e as chaves Secret não foram modificados. Sem envio de operações financeiras pessoais para servidor.

## Critérios de validação

1. Testes automatizados de cálculo (interseção de séries, retorno, ausência de dados) e contrato UI, além do conjunto anterior.
2. GitHub Actions precisa passar em `npm run check` antes de Wrangler publicar.
3. Teste de produção verifica `/`, `/api/health` e `/api/dashboard`, fontes e preço não simulado.
4. Na UI, verificar ações de filtro e navegação no navegador e se a ficha apresenta erro amigável quando históricos falham.

## Próximas fases

Ingestão histórica CVM DFP/ITR, indicadores fundamentalistas com datas/contas/TTM e comparabilidade setorial; proventos corporativos; ampliacão de cobertura; histórico patrimonial real; melhorias de experiência com feedback da primeira versão.

Issue principal de especificação: https://github.com/brunogiacomelli1979-cyber/vezori/issues/1