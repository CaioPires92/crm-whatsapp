-- Migração incremental da tabela kanban_cards
-- Data: 2026-04-03
-- Objetivo:
-- 1) Adicionar colunas origem e prioridade
-- 2) Garantir defaults e regras de integridade
-- 3) Deduplicar lead_id mantendo o card mais recente
-- 4) Garantir UNIQUE em lead_id

begin;

-- 1) Novas colunas (idempotente)
alter table public.kanban_cards
  add column if not exists origem text;

alter table public.kanban_cards
  add column if not exists prioridade text;

-- 2) Backfill de dados existentes
update public.kanban_cards
set origem = 'WhatsApp'
where origem is null or btrim(origem) = '';

update public.kanban_cards
set prioridade = 'media'
where prioridade is null or btrim(prioridade) = '';

-- 3) Defaults + not null
alter table public.kanban_cards
  alter column origem set default 'WhatsApp';

alter table public.kanban_cards
  alter column origem set not null;

alter table public.kanban_cards
  alter column prioridade set default 'media';

alter table public.kanban_cards
  alter column prioridade set not null;

-- 4) Regra de domínio para prioridade
alter table public.kanban_cards
  drop constraint if exists kanban_cards_prioridade_check;

alter table public.kanban_cards
  add constraint kanban_cards_prioridade_check
  check (prioridade in ('alta', 'media', 'baixa'));

-- 5) Deduplicação por lead_id:
-- Mantém o card mais recente por lead_id (ultima_interacao, created_at, id)
with ranked as (
  select
    id,
    row_number() over (
      partition by lead_id
      order by ultima_interacao desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.kanban_cards
)
delete from public.kanban_cards as k
using ranked as r
where k.id = r.id
  and r.rn > 1;

-- 6) Unique em lead_id (idempotente com bloco DO)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'kanban_cards'
      and c.conname = 'kanban_cards_lead_id_key'
  ) then
    alter table public.kanban_cards
      add constraint kanban_cards_lead_id_key unique (lead_id);
  end if;
end
$$;

commit;
