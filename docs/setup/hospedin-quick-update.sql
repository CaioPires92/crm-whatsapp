-- Atualizacao rapida da Hospedin no Supabase
-- `account_id` aqui guarda o slug da conta Hospedin.
-- Ajuste os valores abaixo e rode no SQL editor.

begin;

update public.hospedin_settings
set
  enabled = true,
  api_base_url = 'https://pms.hospedin.com/api/v2',
  account_id = 'COLOQUE_SEU_ACCOUNT_SLUG_AQUI',
  timeout_ms = 10000,
  availability_threshold = 3,
  cache_ttl_seconds = 900,
  fallback_message = 'No momento nao consegui confirmar a disponibilidade em tempo real. Posso seguir com a cotacao e a equipe confirma manualmente.',
  updated_at = now()
where id = 1;

insert into public.hospedin_room_mappings (
  room_type,
  place_type_id,
  place_type_title,
  active,
  notes
)
values
  (
    'Chale/Anexo',
    'COLOQUE_PLACE_TYPE_ID_AQUI',
    'COLOQUE_O_TITULO_AQUI',
    true,
    'Mapeado em lote para consulta em tempo real.'
  ),
  (
    'Apto Terreo',
    'COLOQUE_PLACE_TYPE_ID_AQUI',
    'COLOQUE_O_TITULO_AQUI',
    true,
    'Mapeado em lote para consulta em tempo real.'
  ),
  (
    'Apto Superior',
    'COLOQUE_PLACE_TYPE_ID_AQUI',
    'COLOQUE_O_TITULO_AQUI',
    true,
    'Mapeado em lote para consulta em tempo real.'
  )
on conflict (room_type) do update set
  place_type_id = excluded.place_type_id,
  place_type_title = excluded.place_type_title,
  active = excluded.active,
  notes = excluded.notes,
  updated_at = now();

commit;

-- Se quiser reverter a integracao rapidamente:
-- update public.hospedin_settings set enabled = false, updated_at = now() where id = 1;
