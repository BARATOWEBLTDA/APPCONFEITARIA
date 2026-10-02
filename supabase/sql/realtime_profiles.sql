-- ═══════════════════════════════════════════════════════════════
-- Tempo real do perfil (02/10): quando o plano muda (admin, Hotmart), o app da
-- confeiteira percebe NA HORA (etiqueta PRO, Doo IA liberada, tela de Parabéns).
-- Sem isso, só atualizava saindo e entrando no app.
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
