# Data Engine 1.0 — auditoria inicial

07/11/2026, main `3a478ede4a4d812380e2e0f5deeec5840b2f36c1`, branch `feat/vezori-data-engine-1`.

Produção consultada antes de alterar código: v4.0.0 e SHA correto; KV `active`, snapshot 07/11 `official_macro_only`, uma observação BCB, zero preços arquivados, SHA-256. Dashboard: três cripto, dois câmbios, uma macro. CVM PETR3: `verified_accounts`. B3 pública: 422 por direitos; arquivo cripto: vazio. Issues #1–#3 revisadas; descrevem corretamente os bloqueios de direitos, SEC e execução agendada não observada. PRs #4/#5 e CI/deploy anteriores aprovados.

## Componentes preservados

- Worker, assets e KV já operacionais; nenhum D1/PostgreSQL necessário.
- Extrator `scripts/cvm_extract.py`: DFP/ITR, con/ind, Decimal, revisão e hash. Publicador atual filtra só o último DFP, cinco tickers/três emissores; não é uma base histórica ampla.
- SEC companyfacts: quatro CIKs, apenas 10-K e dependência explícita de identificação verdadeira.
- Carteira local, gráficos, comparador e motores quantitativos: manter testes e layout v4.
- README e docs v4 atuais; `docs/ARQUITETURA.md` é documento histórico v1 com limites antigos, não contrato atual.

## Riscos e decisões

| Severidade | Lacuna | Resposta |
|---|---|---|
| Alta | Cache de ZIP por nome pode reutilizar arquivo parcial/antigo; mudança de schema não é bem isolada | Download atômico, hash e cache por conteúdo, HTTP limitado/retry, validação antes de publicação |
| Alta | Não há DFP/ITR histórico amplo nem política de reapresentações na publicação | Observações identificadas por período, duração, consolidação e revisão; preservar mudanças, sem derivar Q4 por subtração |
| Alta | Escala monetária sem confirmação de MOEDA pode rotular moeda estrangeira como BRL | Moeda e escala independentes; valores incompatíveis ficam indisponíveis |
| Alta | Usar trimestre/semestre como duração equivalente ou banco como indústria | Duração explícita, indicadores só entre fatos conciliados; bancos sem margens industriais automáticas |
| Alta | Arquivo público de preços sem licença | Nenhuma flag ativada; opção de importação exclusivamente local |
| Média | Ausência de catálogo oficial de empresas/fundos/títulos e métricas de cobertura | Catálogos por CNPJ/CVM ou identidade do título; ticker apenas quando confirmado |
| Média | Macro limitada à meta Selic e FX não PTAX | Séries independentes com unidades e frequência; não substituir taxa da carteira silenciosamente |
| Média | Cron configurado sem execução agendada observada | Separar evidência de execução controlada e automática; não declarar continuidade sem evento schedule |

## Fontes e armazenamento

CVM (DFP/ITR/cadastro/fundos/FII) e Tesouro declaram ODbL em seus catálogos oficiais. Dados derivados levam atribuição/licença e download; código permanece MIT. BCB preserva política de origem por série. Provedores EOD continuam condicionados a contrato. Nenhum download automático B3.

Ingestão Python stdlib no GitHub Actions, adaptadores independentes, registros originais selecionados e hashes, objetos JSON de conteúdo verificável nos assets, catálogo/manifesto e logs selados no KV existente. Publicação por versão do Worker fornece mudança atômica de código+base e rollback. Arrays e objetos serão limitados; D1/Parquet somente se medições mostrarem ganho.
