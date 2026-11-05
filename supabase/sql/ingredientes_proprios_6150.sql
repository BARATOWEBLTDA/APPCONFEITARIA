-- (6.150) Conversor de medidas: ingredientes que a confeiteira cadastra (o que não está na lista do app)
create table if not exists public.ingredientes_proprios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  gramas_xicara numeric not null check (gramas_xicara > 0 and gramas_xicara < 2000),
  created_at timestamptz not null default now()
);
create index if not exists ingredientes_proprios_user_idx on public.ingredientes_proprios (user_id);
alter table public.ingredientes_proprios enable row level security;
drop policy if exists "ingredientes_proprios_dono" on public.ingredientes_proprios;
create policy "ingredientes_proprios_dono" on public.ingredientes_proprios
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.ingredientes_proprios to authenticated;
