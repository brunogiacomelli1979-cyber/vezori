# VEZORI Data Engine 1.0

O layout v4, carteira local, cálculos e adaptadores de preços existentes foram preservados. A nova camada fornece contas oficiais históricas, macro, fundos e Tesouro; nenhuma fonte de preços foi liberada por mera disponibilidade técnica. SEC adiada expressamente pelo proprietário.

[Auditoria inicial](DATA_ENGINE_AUDIT_1.md) · [Matriz de fontes e open source](DATA_ENGINE_SOURCES_1.md)

## Pipeline e armazenamento

`scripts/engine/` contém adaptadores CVM, BCB/PTAX, fundos/FII, Tesouro e SEC. `core.py` centraliza HTTPS autorizado, limites, retries 429/5xx, cache por hash, descarga atômica e validações. Não desabilita TLS. A falha de um arquivo interrompe a publicação do novo lote; a versão anterior continua servida.

`python -m scripts.data_engine --groups all` gera:

- `public/data/engine/manifest.json`: cobertura por instrumento, contagens, datas, licença e ciclo executado.
- `objects/<sha256>.json`: identidade, observações, valores normalizados, campos originais selecionados, versões/correções e proveniências compartilhadas por hash. Um índice antigo não é silenciosamente substituído por outro valor.
- `chunks/<sha256>.json.gz` e `bundle.json.gz`: recuperação verificável do lote anterior, particionada para evitar o limite por arquivo e milhares de requisições no próximo ciclo.
- Os cinco dossiês em `data/fundamentals/` são derivados desse mesmo lote, mantendo os contratos PETR3/PETR4/VALE3/ITUB3/ITUB4 sem segundo download divergente.
- `out/engine-run.json`: resumo sem credenciais; após deploy, selado e gravado em `vezori:engine:runs:<run>-<attempt>` no KV existente. Rerun idêntico é idempotente; diferença na mesma chave é recusada. Ponteiro latest pode ser reparado sem apagar a execução original.

Os assets são publicados com o Worker como uma versão. Contêineres JSON antigos redundantes deixam de fazer parte da próxima versão depois de suas observações/revisões serem incorporadas ao novo head; **nenhuma observação é apagada**. URLs de objetos valem para a versão publicada, não são promessa de hospedagem eterna de todos os contêineres antigos. O rollback conserva a versão anterior de código/assets. O pack de recuperação conserva o conteúdo completo do head, inclusive correções.

Arquivos-fonte completos são guardados por hash no cache de execução, não prometidos como arquivo público eterno da CVM. Os registros originais selecionados e seus hashes ficam exportáveis no objeto; a origem completa, membro ZIP, hash do arquivo, data de obtenção e licença permanecem na proveniência. Revisões já removidas pela origem antes da primeira coleta não podem ser reconstruídas. Nenhum dado ausente é interpolado.

Limites de projeto: 150 MiB por download, 350 MiB por CSV descompactado selecionado, 18.000 instrumentos, 24 MiB por objeto/partição, recuperação inflada limitada. A primeira carga mediu cerca de 211 MB JSON distribuído em 2.323 instrumentos e 18,3 MB em partições comprimidas; cada objeto ficou abaixo de 700 KB. [Cloudflare](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) permite até 20.000 assets no plano gratuito e 25 MiB por arquivo. Não se habilitou plano pago. D1/Parquet não adicionariam benefício necessário à consulta pontual atual; expansão deve medir limites de CPU, objetos e retenção antes de ampliar a janela/universo.

O repositório não versiona as bases completas: gera-as a partir dos contratos oficiais e recupera o lote anterior. Artifacts de CI guardam manifesto/evidências pequenas, sem copiar centenas de MB a cada execução. Logs/artefatos não incluem contato SEC ou tokens.

## Datas, revisões e indicadores

- DFP e ITR, con/ind, data de referência, início/fim da duração e versão do filing são chaves distintas. Comparativos permanecem explicitamente ligados ao filing que os publicou. Não somar trimestre, semestre e YTD, nem deduzir Q4 de versões diferentes.
- Moeda e escala são controles independentes. “MIL” não implica BRL. Unidade desconhecida fica indisponível, com original preservado.
- Mudança de valor na mesma chave gera `revisionOrdinal` adicional; reapresentação com nova versão legal tem outra chave e `filingVersion`. O manifesto distingue correções de mesma chave da contagem de registros de versões legais.
- Liquidez corrente = ativo circulante / passivo circulante. Margens = resultado bruto ou líquido / receita da mesma duração. Passivo exigível/ativo = (passivo circulante + não circulante)/ativo; não é dívida financeira/EBITDA. ROE só anual com lucro e PL comparativo/corrente do mesmo filing, ambos positivos; duração do resultado e intervalo dos balanços entre 330 e 380 dias. Denominador/duração inválidos → indisponível. Os cinco índices foram reconciliados independentemente com Decimal e contas originais de uma empresa não financeira; o gate bancário é testado separadamente.
- Bancos, seguradoras, intermediários, securitizadoras e setores financeiros identificados não recebem automaticamente índices industriais; setor desconhecido também bloqueia esses índices. Não há P/L, P/VP, EV/EBITDA ou métricas por ação sem preços/quantidade de ações reconciliados.
- Fundos/FIIs: cota patrimonial é contábil. Tesouro: taxas/PU compra/venda/base não são a rentabilidade realizada do usuário. PTAX não é FX executável nem muda lançamentos da carteira.
- Lacunas: meses ausentes no intervalo observado são identificados; saltos diários acima de oito dias são candidatos, sem fingir calendário oficial reconciliado. `completeSinceInception=false`. `checkedAt`, publicação do lote, competência e divulgação são momentos diferentes.

## APIs e interface

| Endpoint GET | Contrato |
|---|---|
| `/api/data-engine/status` | Versão, cobertura agregada, datas, armazenamento, fontes e bloqueios; não declara continuidade automática por um deploy verde |
| `/api/data-engine/catalog?dataset=cvm&q=PETR4&limit=25&offset=0` | Busca por identidade/nome/ticker confirmado/código CVM, paginação 1–100; datasets cvm, macro, funds, fii, treasury, sec |
| `/api/data-engine/record?dataset=cvm&id=33000167000101` | Objeto validado contra SHA-256, identidade e tamanho; download completo com linhas originais selecionadas, fontes, revisão e licença |
| `/api/data-engine/runs` | Última execução selada e verificada do KV; diferencia evento controlado e schedule. Uma ocorrência não garante disponibilidade futura |

Integrações recebe apenas um painel de consulta/download, filtros de ano e consolidação e estado dos bloqueios. Fichas legadas continuam com o mesmo contrato. Novas empresas/fundos são consultáveis por identidade oficial sem inventar ticker. O piloto de fundos não é um ranking de investimento. A exibição de dados contábeis não preenche automaticamente preços ausentes da carteira.

Aceite API inicial em produção: [deploy 42419064975](https://github.com/brunogiacomelli1979-cyber/vezori/actions/runs/42419064975), release `c9596583df25c48f4bed673942e0d26e217b0792`; objetos das cinco bases recuperados e verificados e margem líquida DFP reconciliada contra os campos originais. A observação é datada: consulte a release atual para revisões posteriores. Inspeção de navegador também levou a uma regressão específica para troca de catálogo durante uma consulta, mensagens com hashes em celular e busca por vencimento. Referência do filing e exercício comparativo são exibidos separadamente na tabela CVM.

## EOD local

Integrações → Histórico EOD por arquivo privado. CSV **UTF-8** com cabeçalho `date,market,symbol,currency,close,adjustment`, ISO date e ponto decimal; mercado BR/US/CRYPTO; ajuste raw ou split_adjusted declarado pela origem. Bytes inválidos são rejeitados; BOM válido é preservado no original e no hash. Restauração recalcula o SHA-256 de cada CSV antes de gravar. Retorno total não é aceito como preço. Limite 1 MiB/10.000 linhas por arquivo, quatro versões locais. Rejeita conflitos, datas impossíveis/futuras, moeda e base mistas; sem preencher datas.

Arquivo importado ativa história privada para identidades compatíveis; versão pode ser trocada/desativada sem apagar os arquivos. Símbolos adicionais podem ser abertos como **identidade declarada**, sem fingir cadastro oficial. Não há upload, POST ou mudança das cotações usadas na carteira. Exportação do original e restauração validada preservam os bytes anteriores na chave de recuperação; quota/corrupção não confirmam gravação inexistente. Arquivos privados continuam sujeitos aos direitos obtidos pelo usuário; importar não concede redistribuição.

## Ciclos e recuperação

| Ciclo GitHub Actions | UTC | Comportamento |
|---|---|---|
| Macro / Tesouro | 22:15 seg–sáb | BCB conforme publicação; PUs oficiais disponíveis, sem fabricar dia novo |
| Fundos / FIIs | 12:15 seg–sáb | Informes publicados; atualização real da fonte pode ser semanal ou atrasada |
| CVM | quarta 12:37 | DFP dos dois anos anteriores e ITR do ano atual; parâmetros CLI permitem recortes explícitos |
| SEC | 01:15 ter–sáb | Bloqueado enquanto SEC_DATA_ENABLED não for true e identificação verdadeira não estiver no secret |
| EOD Brasil | 23:30 seg–sex = 20:30 Brasília | Gate registra bloqueio, sem consultar fornecedores ou publicar preços até haver direitos; só então deverá exigir fechamento correto da sessão |
| Worker existente | 02:30 diário | Snapshot independente permitido pela política atual; não é prova de arquivo de preços cripto |

GitHub pode atrasar agendas. `workflow_dispatch` e deploy são execuções controladas; não são prova de evento `schedule`. O relatório final deve registrar o run realmente observado, ou deixar a operação contínua pendente. Para SEC futura, cadastrar contato verdadeiro no secret `SEC_USER_AGENT`, documentar identidade e só então ativar a variável GitHub `SEC_DATA_ENABLED=true`; o proprietário adiou essa etapa, portanto permanece desligada.

Fluxo de publicação exige testes, ingestão validada, KV real, versão anterior arquivada com número da tentativa, deploy, recibo KV relido e reconciliação pública das cinco bases. Concorrência serializada. Rollback: artifact `vezori-rollback-<sha>-<attempt>` no run, `npx wrangler rollback <version_id> --name vezori`; verificar binding e APIs. Não apaga KV nem carteiras. Artifacts duram 30 dias; fonte/observações normalizadas permanecem no lote recuperável. Em falha de fonte/schema/TLS, corrigir/reexecutar; não desativar verificação, inventar dado ou republicar vazio como cobertura completa.

## Testes e verificações reais

`npm run check`; `python -m unittest discover -s tests -p 'test_*.py'`; `npm run test:ui`. Fixtures pequenas de arquivos oficiais ficam em `tests/fixtures/data-engine`, com licença, hashes originais e hashes dos recortes; `.gitattributes` preserva seus bytes entre Windows/Linux. Cenários artificiais de falha ficam apenas em testes.

O workflow de auditoria separado executa a ingestão real sem credenciais e sem publicar. Depois do deploy, `node scripts/verify-data-engine.mjs` compara o manifesto publicado, SHA dos objetos, identidades, fontes, contas e margem líquida contra as linhas CVM originais, além de recibo KV. `--published-only` permite nova consulta sem arquivo de build local. Evidência real é separada dos testes determinísticos. O relatório final informa o SHA e os runs efetivamente aprovados.

`npm run test:data-production` repete o aceite HTTP e compara os valores exibidos nas cinco bases com os registros verificados, nas quatro resoluções. O teste privado usa duas observações reais já consultáveis da CoinGecko em contextos descartáveis; não as envia ou transforma em arquivo público. Não acessa o perfil/carteira do proprietário. Os resultados/screenhots ficam em `out/engine-browser/`.
