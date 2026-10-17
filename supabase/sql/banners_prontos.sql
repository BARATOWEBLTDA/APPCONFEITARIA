-- ═══════════════════════════════════════════════════════════════
-- Banners prontos pro cardápio (17/10)
-- Galeria que a equipe monta pelo painel admin (/admin/banners-prontos).
-- A confeiteira escolhe um deles em Aparência > Banners de promoção (sem precisar ter o próprio).
-- As imagens ficam no bucket "admin-banners" (só admin grava, todo mundo lê).
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.banners_prontos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  categoria text not null default 'Bolos',
  imagem_url text not null,
  ativo boolean not null default true,
  so_pro boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists banners_prontos_ativo_ordem on public.banners_prontos (ativo, ordem, created_at);

alter table public.banners_prontos enable row level security;

-- (sem "drop": a regra só é criada se ainda não existir)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'banners_prontos' and policyname = 'banners_prontos_ler') then
    create policy banners_prontos_ler on public.banners_prontos for select to authenticated using (ativo or public.eh_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'banners_prontos' and policyname = 'banners_prontos_admin') then
    create policy banners_prontos_admin on public.banners_prontos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
  end if;
end $$;

-- Primeiro banner (fica dentro do próprio app, em /banners/galeria/)
insert into public.banners_prontos (titulo, categoria, imagem_url, ordem)
select 'Oferta especial de bolos', 'Bolos', '/banners/galeria/bolos-oferta-especial.webp', 1
where not exists (select 1 from public.banners_prontos where imagem_url = '/banners/galeria/bolos-oferta-especial.webp');

notify pgrst, 'reload schema';
