# VEZORI — Snapshot diário Cloudflare KV

A estrutura de armazenamento está implementada, mas a ativação do KV ainda requer vinculação de um namespace real no Cloudflare.

- Cron Trigger: `30 2 * * 2-6` (02:30 UTC, terça a sábado; segunda a sexta à noite em Brasília).
- Snapshot validado com chaves `vezori:market:YYYY-MM-DD` e `vezori:market:latest`. Grava preços e metadados de fonte sem inferir valores.
- O sistema evita regravação no mesmo dia, rejeita captura sem dados válidos e sinaliza idade superior a 72 horas.
- Sem KV, a rotina agendada encerra sem coletar; o site mantém a consulta às APIs e cache regional anterior.
- Não equivale a fechamento oficial, pois o gatilho não consulta calendário de feriados e sessões.

## Passos de ativação
1. Criar um namespace Cloudflare KV chamado `VEZORI_MARKET_SNAPSHOTS` na própria conta.
2. Obter o ID real e acrescentar o binding a `wrangler.jsonc`:
   ```json
   "kv_namespaces": [{"binding": "MARKET_SNAPSHOTS", "id": "ID_REAL_DO_NAMESPACE"}]
   ```
3. Publicar; verificar `/api/health`: `sourcesConfigured.marketSnapshotStorage` igual a `true`.
4. Observar Cron e validar `/api/dashboard`, que passará a exibir `meta.isDailySnapshot`, `snapshotCapturedAt`, `ageHours`, `stale`.
5. Confrontar os preços de fechamento com a fonte e tratar feriados e reconciliações por classe.

Não inventar IDs, não inserir segredos no repositório, não afirmar armazenamento persistente antes da configuração.

Fontes: https://developers.cloudflare.com/workers/configuration/cron-triggers/ e https://developers.cloudflare.com/kv/platform/limits/
