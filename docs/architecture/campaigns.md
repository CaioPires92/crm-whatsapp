# Campanhas em Lote

## Objetivo

Separar a inbox operacional de conversas do fluxo de campanhas em lote.

A tela de `Campanhas` deve usar a base de `Leads` como origem da audiencia, com segmentacao por labels e deduplicacao por telefone valido.

## O que foi implementado agora

- Pagina `Campanhas` no dashboard.
- Filtro por labels.
- Busca por nome ou telefone.
- Contagem de leads filtrados.
- Deteccao de telefone valido.
- Dedupe por telefone.
- Preview da audiencia elegivel.
- Criacao de campanha em rascunho.
- Persistencia de destinatarios por campanha.
- Disparo em lote via Evolution API.
- Metricas iniciais de enviados, respostas, ignorados e bloqueios/falhas.

## Setup necessario

Rodar o SQL em `docs/setup/campaigns-schema.sql` no Supabase antes de usar o fluxo de campanha real.

## O que ainda falta para maturidade operacional

- Campo de opt-in para marketing.
- Campo de bloqueio de campanha.
- Cooldown para evitar reenvio muito frequente.
- Blacklist.
- Dashboard historico com multiplas campanhas.
- Regras mais robustas para inferencia de bloqueio.

## Estrutura recomendada

### Campos em `Leads`

- `telefone_envio`
- `telefone_valido`
- `aceita_campanha`
- `bloqueado_campanha`
- `ultimo_disparo_em`
- `ultimo_disparo_campanha`

### Tabela `campaigns`

- `id`
- `nome`
- `mensagem`
- `status`
- `criada_em`
- `criada_por`

### Tabela `campaign_recipients`

- `id`
- `campaign_id`
- `lead_id`
- `telefone`
- `status`
- `erro`
- `enviado_em`

## Regra de negocio sugerida

1. Selecionar labels.
2. Buscar leads elegiveis.
3. Remover leads sem telefone valido.
4. Remover duplicados por telefone.
5. Remover bloqueados ou sem opt-in.
6. Gerar preview.
7. Criar campanha.
8. Disparar em lote com intervalo e log.
