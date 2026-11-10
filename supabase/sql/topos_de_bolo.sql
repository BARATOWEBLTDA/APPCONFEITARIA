-- (09/11) Topos de bolo: o admin sobe topos (capa + PNG/JPG/PDF/Studio) em categorias com imagem;
-- a confeiteira vê tudo e só a PRO baixa os arquivos (bucket privado, link assinado).

create table if not exists public.topos_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  imagem_url text,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.topos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.topos_categorias(id) on delete set null,
  titulo text not null default '',
  capa_url text,
  -- [{ "caminho": "...", "nome": "arquivo.png", "formato": "PNG", "tamanho": 12345 }]
  arquivos jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists topos_categoria_idx on public.topos (categoria_id, ordem);

alter table public.topos_categorias enable row level security;
alter table public.topos enable row level security;

drop policy if exists topos_cat_ler on public.topos_categorias;
create policy topos_cat_ler on public.topos_categorias for select to authenticated using (ativo or public.eh_admin());
drop policy if exists topos_cat_admin on public.topos_categorias;
create policy topos_cat_admin on public.topos_categorias for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists topos_ler on public.topos;
create policy topos_ler on public.topos for select to authenticated using (ativo or public.eh_admin());
drop policy if exists topos_admin on public.topos;
create policy topos_admin on public.topos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- capas e imagens das categorias: públicas; arquivos: privados (só PRO e admin leem)
insert into storage.buckets (id, name, public, file_size_limit)
values ('topos-capas', 'topos-capas', true, 10485760)
on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public, file_size_limit)
values ('topos-arquivos', 'topos-arquivos', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "topos capas: leitura" on storage.objects;
create policy "topos capas: leitura" on storage.objects for select using (bucket_id = 'topos-capas');
drop policy if exists "topos capas: admin" on storage.objects;
create policy "topos capas: admin" on storage.objects for all to authenticated
  using (bucket_id = 'topos-capas' and public.eh_admin()) with check (bucket_id = 'topos-capas' and public.eh_admin());

drop policy if exists "topos arquivos: pro baixa" on storage.objects;
create policy "topos arquivos: pro baixa" on storage.objects for select to authenticated
  using (bucket_id = 'topos-arquivos' and (public.eh_admin() or public.conta_eh_pro(auth.uid())));
drop policy if exists "topos arquivos: admin" on storage.objects;
create policy "topos arquivos: admin" on storage.objects for all to authenticated
  using (bucket_id = 'topos-arquivos' and public.eh_admin()) with check (bucket_id = 'topos-arquivos' and public.eh_admin());

-- (09/11) tags só pra busca (não aparecem pra confeiteira)
alter table public.topos add column if not exists tags text[] not null default '{}';

-- (09/11) link do modelo no Canva (opcional; só PRO abre)
alter table public.topos add column if not exists canva_url text;

-- (09/11) miniatura leve (480 px) pra grade e pras bolinhas; a capa grande só abre no detalhe
alter table public.topos add column if not exists capa_mini_url text;
alter table public.topos_categorias add column if not exists imagem_mini_url text;
