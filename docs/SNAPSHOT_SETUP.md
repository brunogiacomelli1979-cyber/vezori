# VEZORI — armazenamento histórico e publicação segura

## Estado e arquitetura

- Cron Trigger: `30 2 * * *` (**todos os dias às 02:30 UTC**), necessário porque criptomoedas negociam também nos fins de semana.
- Captura por data UTC: `vezori:market:YYYY-MM-DD` e ponteiro `vezori:market:latest`.
- Arquivo por ativo e mês: `vezori:observations:v1:{market}:{symbol}:{YYYY-MM}`.
- O índice `latest` pode ser reparado após falha de gravação sem substituir os dados do dia previamente persistidos.
- Observações são **cotações capturadas**, não necessariamente fechamento oficial da bolsa ou retorno total. Não utilizar snapshots como preços ajustados para análise técnica.
- O binding `MARKET_SNAPSHOTS` é exigido para novos deploys por meio do workflow; caso faltem credenciais ou permissões, o deploy deve **falhar**, não apenas exibir aviso.
- A operação `scheduled` produz erro se a gravação do snapshot ou o arquivamento das observações falhar, para que o problema apareça no monitoramento do Worker.
- Dados históricos de terceiros só poderão ser coletados/redistribuídos conforme licença de uso válida.

## Ativação

1. Garantir no GitHub Actions que `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` estejam cadastrados como segredos.
2. Conceder ao token as permissões necessárias para Workers/Deploy e **Workers KV Storage Read e Write** no escopo da conta desejada. Não compartilhar tokens no chat nem no Git.
3. O workflow executa `node scripts/provision_kv.mjs --required`. Se a configuração já contiver `MARKET_SNAPSHOTS` com ID válido, preserva o binding. Caso contrário, procura o namespace `vezori-MARKET_SNAPSHOTS` (também aceita o nome legado `VEZORI_MARKET_SNAPSHOTS`) e cria quando autorizado.
4. Se forem encontrados dois namespaces candidatos, interromper e resolver a ambiguidade manualmente. O script nunca escolhe um namespace arbitrariamente.
5. Reexecutar o workflow **VEZORI - Testar e publicar no Cloudflare** e confirmar a conclusão dos testes, do deploy e do smoke pós-publicação.
6. Conferir `/api/health`: `sourcesConfigured.marketSnapshotStorage === true`.
7. Conferir `/api/storage-status`: `not_configured` significa binding ausente; `configured_empty` significa vínculo ativo, ainda sem snapshot; `active` significa snapshot recuperável. O último status, isoladamente, não comprova observações completas para todos os ativos.
8. Depois da primeira execução do Cron, conferir a data, os arquivos de observação e o log da execução; não interpretar cotações de fins de semana como sessões da B3.

## Consultas de observações

`GET /api/observations?market=BR&symbol=PETR4&months=12`

Para buscar uma página mais antiga: `GET /api/observations?market=BR&symbol=PETR4&months=12&through=2025-12`. O campo `previousPageMonth` indica a referência para continuar paginando. Não são gerados registros para datas sem coleta.

## Limites e alertas

Cloudflare Workers KV Free (verificar limites vigentes): **1.000 escritas/dia, 100.000 leituras/dia e 1 GB armazenado**. O fluxo inicial de sete ativos usa cerca de nove gravações por dia quando tudo funciona. A expansão para centenas de ativos precisará de orçamento de escritas, possivelmente armazenando séries em outra camada.

KV possui consistência eventual e limite de gravações na mesma chave. Evitar concorrência de deploys e múltiplos gravadores do mesmo ativo/mês. Não divulgar IDs de namespaces, credenciais ou conteúdo de variáveis secretas.

Fontes: https://developers.cloudflare.com/workers/configuration/cron-triggers/ ; https://developers.cloudflare.com/kv/platform/limits/ ; https://developers.cloudflare.com/kv/reference/kv-commands/
