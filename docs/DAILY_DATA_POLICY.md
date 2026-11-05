# VEZORI — Estratégia de dados americanos e cache diário (05/11/2026)

## Estado implementado
- A API de mercado consulta provedores reais e não cria preço ou dividendos fictícios.
- O Cache API do Cloudflare reduz solicitações por região de execução, com um corte diário às **02:30 UTC**, após o fechamento regular das bolsas brasileiras e americanas. As cotações continuam apresentando data/hora da fonte, quando fornecidas.
- **Limitação:** cache por região não garante exatamente uma coleta por dia, nem cria arquivo histórico durável. Sem acesso, não há captura agendada. Dados da primeira visita antes do corte podem refletir a última atualização intradiária; não rotular genericamente como fechamento oficial.
- Na ausência ou erro de fornecedor a interface marca indisponibilidade. Se houver erro parcial, dashboard pode tentar novamente em 30 minutos.
- Operações da carteira e rascunhos do Laboratório continuam em armazenamento local, independentemente do cache do mercado.

## API para ações, REITs e ETFs dos EUA
- A **Twelve Data** documenta cobertura de ações, ETFs, REITs e fundos. Seu Basic gratuito tem **8 créditos/minuto, até 800/dia**, mas esse plano é para uso interno, sem autorização automática para exibição pública/redistribuição.
- O backend só publica cotações de Twelve Data quando estão configuradas a chave secreta `TWELVEDATA_API_KEY` **e** a indicação administrativa `US_PUBLIC_DISPLAY_AUTHORIZED=true`. A flag só deve ser habilitada após autorização contratual verdadeira do fornecedor.
- Se a chave existir sem autorização pública, `availability.twelvedata='display_rights_required'`; a plataforma mostra o bloqueio, em vez de vazar preços ou chaves.
- A disponibilidade técnica e os direitos de divulgação precisam ser avaliados separadamente. Uma modalidade gratuita pode servir a prototipação e testes privados, mas **não** implica direito de publicar no Worker aberto.
- Outros candidatos: Alpaca (gratuito IEX para uso privado, com questões de redistribuição); FMP (gratuito até 250 requisições/dia, mas exibição pública exige licença própria). Não efetuar scraping das plataformas de referência.

## Próxima evolução para snapshot garantido pós-fechamento
1. Criar namespace Workers KV e binding no Worker (requer configuração Cloudflare). O plano gratuito atualmente oferece limites adequados a snapshots pequenos.
2. Configurar Cron Trigger às **02:30 UTC, terça a sábado**, conferindo feriados e o fechamento dos mercados. Capturar apenas conjuntos licenciados, de maneira incremental e com retenção controlada.
3. Guardar `asOf`, `retrievedAt`, `source`, `market`, `license`, `currency` e integridade do snapshot. Separar B3, EUA, cripto e indicadores macro; cripto é 24/7.
4. Servir último snapshot válido com indicação da idade e atraso; alertar em vez de fingir atualização.
5. Testar limites de quota, falha da fonte, idempotência e recuperação de snapshot antes de trocar o Cache API pelo armazenamento persistente.

## Fontes e licenciamento
- https://twelvedata.com/pricing
- https://twelvedata.com/etf
- https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage
- https://brapi.dev/faq
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/kv/platform/limits/

Não publicar chaves, tokens, arquivos de licença ou dados pessoais no repositório.
