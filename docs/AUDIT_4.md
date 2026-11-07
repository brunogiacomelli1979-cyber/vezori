# Auditoria VEZORI 4.0

Referência inicial: `2ca104bebcf49eebe98072f7cca4debe8c998ce8`, 07/11/2026.
Branch de trabalho: `feat/vezori-4-audit-reliability`. Não havia PRs na consulta à API GitHub; issues abertas #1, #2 e #3 lidas. Nenhum AGENTS.md no checkout. Node local 24.15.0 / npm 11.12.1. Baseline: 132 testes Node aprovados; testes Python executados separadamente.

## Evidências de produção e publicação

- `/api/health`, consultado em 07/11/2026 16:35 UTC: HTTP 200, `marketSnapshotStorage:false`, brapi/SEC/Twelve Data não configurados; CoinGecko configurado. Nenhum valor secreto consultado.
- `/api/storage-status`: 404 com `Rota não encontrada`. A interface identifica versão 3.0. Portanto a produção diverge da main; não existe identificação do SHA publicado.
- Run [42369530205](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42369530205): testes e geração CVM aprovados; preparação KV falhou; publicação e smoke ignorados. Log real: `Unable to list KV namespaces (unclassified)`. Isso NÃO demonstra por si só falta de permissões. O script transforma exceções de processo, JSON e API no mesmo estado.
- Inspeção em navegador: mercados, carteira vazia, fontes e datas visíveis; navegação móvel horizontal; tipografia pequena e múltiplas camadas CSS com temas claros/escuros conflitantes. Data macro pode ser posterior à consulta e não há rejeição sistemática disso.

## Arquitetura e contratos

`src/worker.js` concentra rotas GET, validação de símbolos, adaptadores brapi/CoinGecko/Twelve Data/Frankfurter/BCB, cache regional e cron. `daily-snapshot.js` guarda chave por dia e ponteiro latest; `daily-observations.js` guarda ativo/mês, com até 24 leituras por consulta. KV é eventualmente consistente: idempotência não equivale a transação nem protege múltiplos escritores concorrentes.

`sec-fundamentals.js` extrai fatos 10-K. Scripts Python extraem ZIP CVM com SHA-256 e publicam JSON por ticker. O build gera os arquivos oficiais. O navegador utiliza `finance.js` (livro de operações, marcação, XIRR e projeção), `risk-analytics.js`, `portfolio-risk.js` e `price-zones.js`; `app.js` coordena home, pesquisa, comparador, carteira Apex e laboratório. Chart.js tem fallback numérico; Lightweight Charts v5 é preferido nas séries de preço. Carteira v2/v3 em localStorage, sem tráfego de dados pessoais ao Worker.

## Achados classificados

| Severidade | Achado / risco | Ação necessária |
|---|---|---|
| Alta | KV ausente e deploy bloqueado; erro não classificado | Separar contrato CLI, saída de processo e resposta API; verificar binding e persistência real |
| Alta | Não há SHA/versionamento verificável de produção | Metadados de build e comparação estrita pós-publicação |
| Alta | Histórico BR escolhe adjustedClose por ponto, podendo misturar ajustes | Escolher uma base homogênea para toda a série; rejeitar identidade/conflitos/datas inválidas |
| Alta | `parseBackup` valida incrementalmente na ordem recebida | Validar estrutura/IDs e livro cronológico completo; aceitar backup fora de ordem válido |
| Alta | Salvamento muda estado em memória antes de localStorage; corrupção pode ser sobrescrita após restore vazio | Persistir antes de confirmar estado; cópia recuperável e bloqueio de gravação após corrupção |
| Alta | Parser SEC pode combinar períodos iniciais, revisões e patrimônio de trimestre | Exigir duração, período e accession comparáveis; patrimônio anterior anual |
| Média | Calendários de bolsa usam heurística de 8 dias, não sessões oficiais | Documentar limitação; não afirmar cobertura percentual integral |
| Média | Datas impossíveis aceitas no arquivo/zonas e timestamps de fonte não reconciliados | Round-trip de data e testes de regressão |
| Média | Projeções não modelam inflação/custos; README afirma taxas iniciais zero, código usa exemplos | Premissas explícitas e parâmetros auditáveis |
| Média | Testes UI atuais procuram strings, não exercitam navegador | Playwright, quatro resoluções, fluxos e capturas reais |
| Média | Sem lockfile e Wrangler flutuante; deploy local não aplica pré-requisitos de CI | Instalação reproduzível, build e validação obrigatória |
| Média | Sem política CSP de assets, rate limiting global ou prova completa de direitos de retenção | Headers compatíveis; cache limitado; política de fontes e pendências contratuais |
| Baixa | CSS acumulado e excesso de `!important`, tabelas/controles pequenos | Design system documentado, ajustes responsivos incrementais preservando módulos |

## Ordem de correção e aceite

1. Diagnóstico reprodutível de infraestrutura e proveniência da versão; nenhum ID inventado, nenhum recurso de outro Worker alterado.
2. Skills de projeto com revisão fixa e matriz open source/licenças, preservando MIT autoral.
3. Integridade temporal, base de preços e armazenamento: não executar backfill extenso, não interpolar, `completeSinceListing:false`.
4. Regressão financeira independente, recuperação da carteira, melhorias do laboratório.
5. Ajustes de interface e acessibilidade; Playwright em 1920×1080, 1366×768, 768×1024 e 390×844, revisão das imagens.
6. PR, validação, integração reversível e publicação somente com verificações obrigatórias. Binding vazio não satisfaz aceite de persistência: escrita/leitura/releitura e captura devem ser comprovadas.

## Limites de aceite

Sem credencial Cloudflare local confirmada e sem fonte licenciada para backfill integral. Não ampliar permissões, contratar serviços ou declarar métricas de retorno total usando preços. Métodos avançados, otimização, Monte Carlo e sinais de negociação só podem ser promovidos após metodologia, dados e validação temporal apropriados. Não há material do Airport Cargo Analytics anexado: preservar a identidade existente e aplicar princípios de densidade/legibilidade, sem alegar inspeção dessa referência.
