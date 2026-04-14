-- Fase 1 - Controle operacional da Aura
-- Data: 2026-04-04
-- Objetivo:
-- 1) Criar a tabela singleton assistant_settings
-- 2) Inserir configuracao inicial
-- 3) Permitir alternar entre auto, manual e hybrid sem editar o workflow

begin;

create table if not exists public.assistant_settings (
  id integer primary key,
  assistant_enabled boolean not null default true,
  mode text not null default 'auto',
  human_handoff_enabled boolean not null default true,
  default_handoff_message text not null default 'Atendimento em modo manual. A Aura nao respondera automaticamente.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_settings_singleton check (id = 1),
  constraint assistant_settings_mode_check check (mode in ('auto', 'manual', 'hybrid'))
);

insert into public.assistant_settings (
  id,
  assistant_enabled,
  mode,
  human_handoff_enabled,
  default_handoff_message
)
values (
  1,
  true,
  'auto',
  true,
  'Atendimento em modo manual. A Aura nao respondera automaticamente.'
)
on conflict (id) do update
set
  assistant_enabled = excluded.assistant_enabled,
  mode = excluded.mode,
  human_handoff_enabled = excluded.human_handoff_enabled,
  default_handoff_message = excluded.default_handoff_message,
  updated_at = now();

create or replace function public.set_assistant_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_assistant_settings_updated_at on public.assistant_settings;

create trigger set_assistant_settings_updated_at
before update on public.assistant_settings
for each row
execute function public.set_assistant_settings_updated_at();

commit;
