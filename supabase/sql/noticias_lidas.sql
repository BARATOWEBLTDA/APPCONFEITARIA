-- (21/10) Novidades: quais a confeiteira já leu (a bolinha rosa some depois que ela abre)
create table if not exists public.noticias_lidas (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  noticia_id uuid not null references public.admin_noticias(id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (user_id, noticia_id)
);
alter table public.noticias_lidas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'noticias_lidas' and policyname = 'noticias_lidas_propria') then
    create policy noticias_lidas_propria on public.noticias_lidas for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
grant select, insert, update on public.noticias_lidas to authenticated;
