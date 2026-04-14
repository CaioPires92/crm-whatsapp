do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'kanban_stage'::regtype
      and enumlabel = 'Aguardando Humano'
  ) then
    alter type kanban_stage add value 'Aguardando Humano' after 'Novo Lead';
  end if;
end $$;
