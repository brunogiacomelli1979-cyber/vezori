# VEZORI 2.3 — Laboratório de simulações por estratégia

## Escopo
- Mantém a home de mercados, catálogo B3, ficha de ativos, comparação, carteira e páginas de pesquisa.
- Adiciona um construtor de carteira educacional à aba Laboratório, associado aos cinco modelos STRATEGIES existentes.
- Cada modelo fornece uma seleção inicial de ativos e classes com pesos somando 100%, descrição das limitações e alternativas selecionáveis.
- Inclusão/removal de ativos do universo suportado e da listagem pública B3 disponível no navegador; edições de peso e taxa anual hipotética por posição.
- Parâmetros: capital inicial, aporte mensal e horizonte de 1 a 40 anos; projeção anual por linha e resumo consolidado.
- Aportes respeitam os pesos-alvo escolhidos; não ocorre rebalanceamento do patrimônio acumulado. Taxas efetivas mensais são calculadas a partir da taxa anual informada por ativo.
- Rascunhos de cada estratégia ficam no localStorage `vezori-lab-scenarios-v1`. Os dados da carteira real são armazenados separadamente sob `vezori-portfolio-v3` e não são alterados.

## Contratos e limites
- As sugestões são **candidatos didáticos**, não posições oficiais dos investidores ou carteiras recomendadas.
- Classes genéricas `RF_SIM`, `OURO_SIM`, `COM_SIM`, `CAIXA_SIM` **não são produtos negociáveis nem possuem cotações**; servem apenas para modelar a repartição sugerida.
- BOVA11 pode estar sem cotação no plano atual; preço exibido é meramente informativo.
- Taxas anuais são inicialmente **0%**, sem previsão de rentabilidade; o usuário pode aplicar um conjunto de taxas de exemplo arbitrárias mediante clique explícito.
- Simulação sem câmbio, impostos, custos, inflação, volatilidade ou proventos e **não equivale a backtesting**.
- Exige 100% de pesos, 1–15 posições, taxa anual de -90% a +100%, horizonte de 1–40 anos.
- Utiliza somente o frontend e o motor matemático, sem novas APIs nem secrets.

## Aceite
- Todos os cinco modelos têm composição independente e pesos válidos.
- Atualizar seleção ou premissas invalida os resultados anteriores; simulação requer pesos corretos.
- O usuário consegue navegar do card de estratégia ao construtor, substituir ativos e gerar um gráfico com valores nominais e contribuições.
- Persistência separada da carteira real, com validação do rascunho local.
- Layout responsivo; inputs e botões com labels; detalhes das limitações visíveis.