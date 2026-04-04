-- Fase 5 - Disponibilidade em tempo real via Hospedin
-- Objetivos:
-- 1) Centralizar configuracao nao sensivel da integracao em uma tabela singleton
-- 2) Mapear os tipos de acomodacao internos para os place_type_id da Hospedin
-- 3) Manter a integracao desativada por padrao ate validacao real da API

create table if not exists public.hospedin_settings (
  id integer primary key,
  enabled boolean not null default false,
  api_base_url text not null default 'https://pms.hospedin.com/api/v2',
  account_id text,
  timeout_ms integer not null default 10000,
  fallback_message text not null default 'No momento nao consegui confirmar a disponibilidade em tempo real. Posso seguir com a cotacao e a equipe confirma manualmente.',
  updated_at timestamptz not null default now(),
  constraint hospedin_settings_singleton check (id = 1),
  constraint hospedin_settings_timeout_range check (timeout_ms between 1000 and 60000)
);

insert into public.hospedin_settings (
  id,
  enabled,
  api_base_url,
  account_id,
  timeout_ms,
  fallback_message
)
values (
  1,
  false,
  'https://pms.hospedin.com/api/v2',
  null,
  10000,
  'No momento nao consegui confirmar a disponibilidade em tempo real. Posso seguir com a cotacao e a equipe confirma manualmente.'
)
on conflict (id) do update set
  api_base_url = excluded.api_base_url,
  timeout_ms = excluded.timeout_ms,
  fallback_message = excluded.fallback_message,
  updated_at = now();

create or replace function public.set_hospedin_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_hospedin_settings_updated_at on public.hospedin_settings;

create trigger set_hospedin_settings_updated_at
before update on public.hospedin_settings
for each row
execute function public.set_hospedin_settings_updated_at();

create table if not exists public.hospedin_room_mappings (
  id bigint generated always as identity primary key,
  room_type text not null,
  place_type_id text,
  place_type_title text,
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  constraint hospedin_room_mappings_room_type_unique unique (room_type)
);

insert into public.hospedin_room_mappings (
  room_type,
  place_type_id,
  place_type_title,
  active,
  notes
)
values
  ('Chale/Anexo', null, null, true, 'Preencher place_type_id real da Hospedin antes de ativar a integracao.'),
  ('Apto Terreo', null, null, true, 'Preencher place_type_id real da Hospedin antes de ativar a integracao.'),
  ('Apto Superior', null, null, true, 'Preencher place_type_id real da Hospedin antes de ativar a integracao.')
on conflict (room_type) do nothing;

create or replace function public.set_hospedin_room_mappings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_hospedin_room_mappings_updated_at on public.hospedin_room_mappings;

create trigger set_hospedin_room_mappings_updated_at
before update on public.hospedin_room_mappings
for each row
execute function public.set_hospedin_room_mappings_updated_at();
