# Aura Ops Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o backlog operacional de hoje da Aura com dados reais, QA consolidado sem retrabalho e tentativa controlada da Hospedin apenas se a API externa tiver voltado.

**Architecture:** O trabalho de hoje e operacional, nao uma nova feature. A ordem segura e: atualizar o seed local com dados reais, sincronizar esse seed para o Supabase, rodar a bateria final de QA no fluxo atual do n8n/WhatsApp, validar persistencia em banco e so depois destravar a trilha da Hospedin se o endpoint externo estiver disponivel.

**Tech Stack:** React + Vite + TypeScript, Supabase/Postgres, Evolution API v2, n8n, Node.js scripts.

---

### Task 1: Fechar dados operacionais reais

**Files:**
- Modify: `seeds/aura-operational-data.local.json`
- Reference: `docs/setup/implementation-master-guide.md`
- Run: `scripts/sync-aura-operational-data.mjs`

- [ ] **Step 1: Revisar os itens ainda pendentes no guia mestre**

Ler primeiro:
- `docs/setup/implementation-master-guide.md`

Confirmar que os itens ainda pendentes para hoje sao:
- Wi-Fi
- check-in e check-out
- politica de pets
- cafe da manha
- regras internas
- revisao final de `room_rates`
- Hospedin apenas se a API externa voltar

- [ ] **Step 2: Atualizar o seed local com os dados reais**

Editar:
- `seeds/aura-operational-data.local.json`

Preencher no arquivo local:
- `assistant_rules` com Wi-Fi, check-in/out, pets, cafe da manha e regras internas
- `room_rates` com nomes corretos de acomodacao, baixa temporada, sabado, feriados, temporadas especiais e minimos de diarias

Regras:
- nao versionar esse arquivo
- nao mexer no workflow para trocar regra operacional
- se a Hospedin ainda estiver em manutencao, manter a parte dela sem ativacao real

- [ ] **Step 3: Rodar o dry-run da sincronizacao**

Run:
```bash
node scripts/sync-aura-operational-data.mjs
```

Expected:
- JSON com `mode: "dry-run"`
- contagem de `assistantRules`
- contagem de `roomRates`
- lista de `roomTypes`

- [ ] **Step 4: Aplicar a sincronizacao no banco**

Run:
```bash
npm run sync:aura
```

Expected:
- JSON com `mode: "apply"`
- `applied: true`
- nenhuma falha de configuracao do Supabase

- [ ] **Step 5: Validar que o banco recebeu os dados mais recentes**

Conferir no Supabase SQL Editor:
```sql
select category, rule_key, value, active
from public.assistant_rules
order by category, rule_key;

select room_type, season_name, date_from, date_to, base_price, min_nights, priority, active
from public.room_rates
order by room_type, priority, date_from;
```

Expected:
- regras de Wi-Fi e operacao aparecem sem placeholder
- tarifas estao coerentes com os nomes reais das acomodacoes

### Task 2: Rodar a bateria principal de QA sem Hospedin

**Files:**
- Reference: `docs/setup/implementation-master-guide.md`
- Reference: `n8n/workflows/hotel-kanban.json`

- [ ] **Step 1: Escolher o numero de teste**

Preferencia operacional:
- usar um numero limpo ou pouco usado para evitar leitura ambigua do historico
- se for reutilizar um numero antigo, limpar antes o estado correspondente em `Leads`, `kanban_cards` e `n8n_chat_histories` pelo painel do Supabase

- [ ] **Step 2: Garantir que o fluxo esta em modo automatico para a primeira rodada**

Conferir no dashboard:
- `Piloto Automatico` ligado

Expected:
- novas mensagens comerciais devem receber resposta automatica

- [ ] **Step 3: Executar os 8 cenarios principais de negocio**

Enviar no WhatsApp, nesta ordem:
1. `Quero um apto terreo para casal de 10/08/2026 a 12/08/2026`
2. `Quero um chale de 14/08/2026 a 16/08/2026`
3. `Quero reservar de 29/12/2026 a 02/01/2027`
4. `Qual a senha do Wi-Fi?`
5. `A tomada do chale e 110 ou 220?`
6. `Quero fechar a reserva`
7. `Como funciona cancelamento?`
8. pergunta fora da base explicita

Expected:
- baixa temporada correta no caso 1
- tarifa de final de semana no caso 2
- tarifa de Reveillon e minimo de 4 diarias no caso 3
- resposta correta de Wi-Fi no caso 4
- voltagem correta no caso 5
- coleta de nome completo e CPF antes dos dados bancarios no caso 6
- politica cadastrada no caso 7
- resposta sem improviso no caso 8

- [ ] **Step 4: Executar os cenarios de risco operacional**

Enviar no WhatsApp:
1. imagem com legenda
2. imagem sem legenda
3. audio
4. `Meu chuveiro queimou`

Expected:
- imagem e audio entram no fluxo sem quebrar
- `Meu chuveiro queimou` vira handoff humano
- nada deve ser improvisado nesse caso

### Task 3: Validar persistencia e deduplicacao

**Files:**
- Reference: `docs/setup/crm-kit-replicacao.md`
- Reference: `docs/setup/kanban-cards-migration-20260403.sql`

- [ ] **Step 1: Conferir os registros mais recentes**

Run no Supabase SQL Editor:
```sql
select id, lead_id, lead_nome, created_at
from public."Leads"
order by created_at desc
limit 20;

select id, lead_id, etapa, prioridade, ultima_interacao, created_at
from public.kanban_cards
order by ultima_interacao desc nulls last, created_at desc nulls last, id desc
limit 20;

select id, session_id, hora_data_mensagem, message
from public.n8n_chat_histories
order by hora_data_mensagem desc nulls last, id desc
limit 20;
```

Expected:
- o numero testado aparece nas tres tabelas
- o card mais recente reflete o estado certo
- o historico contem usuario e assistente

- [ ] **Step 2: Conferir que nao houve duplicidade**

Run:
```sql
select lead_id, count(*)
from public."Leads"
group by lead_id
having count(*) > 1
order by count(*) desc, lead_id asc;

select lead_id, count(*)
from public.kanban_cards
group by lead_id
having count(*) > 1
order by count(*) desc, lead_id asc;
```

Expected:
- nenhum novo duplicado criado pelos testes de hoje

### Task 4: Validar modo manual e handoff humano

**Files:**
- Reference: `docs/setup/implementation-master-guide.md`

- [ ] **Step 1: Repetir teste em modo manual**

No dashboard:
- desligar `Piloto Automatico`

Enviar uma nova mensagem comercial simples.

Expected:
- registrar no CRM
- salvar historico
- nao responder automaticamente no WhatsApp

- [ ] **Step 2: Validar handoff com a etapa correta**

Enviar:
```text
Meu chuveiro queimou
```

Expected:
- mover para `Aguardando Humano`
- registrar o caso sem resposta inventada

### Task 5: Tentar destravar a Hospedin apenas se a API voltou

**Files:**
- Modify: `seeds/aura-operational-data.local.json`
- Reference: `docs/setup/implementation-master-guide.md`

- [ ] **Step 1: Verificar se o bloqueio externo caiu**

Condicao para seguir:
- a autenticacao da Hospedin nao pode mais retornar `403`
- se ainda estiver em manutencao, parar aqui e manter o item bloqueado

- [ ] **Step 2: Se a API voltou, fechar a configuracao real**

Executar somente se o passo anterior estiver liberado:
- descobrir `account_id`
- consultar `/api/v2/{account_id}/place_types`
- preencher `hospedin_room_mappings.place_type_id`
- atualizar `public.hospedin_settings.account_id`
- mudar `public.hospedin_settings.enabled` para `true`

- [ ] **Step 3: Rodar o QA final com disponibilidade real**

Expected:
- resposta comercial usa disponibilidade real
- fallback continua seguro se a API voltar a falhar

### Task 6: Registrar status ao final do dia

**Files:**
- Modify: `docs/setup/implementation-master-guide.md`

- [ ] **Step 1: Atualizar o guia mestre**

Registrar no fim do dia:
- o que foi concluido hoje
- o que ficou bloqueado
- se a Hospedin continuou indisponivel
- se a bateria completa de QA foi finalizada

- [ ] **Step 2: Nao puxar campanhas para hoje sem fechar a Aura**

So mover para campanhas se tudo abaixo estiver resolvido:
- dados reais sincronizados
- QA principal validado
- modo manual validado
- handoff validado
- persistencia validada

## Resultado esperado do dia

- seed operacional real sincronizado
- Wi-Fi e regras operacionais sem placeholder
- QA principal da Aura executado ponta a ponta
- modo manual validado
- handoff humano validado
- persistencia em `Leads`, `kanban_cards` e `n8n_chat_histories` conferida
- Hospedin tratada como bloqueio externo, nao como pendencia invisivel
