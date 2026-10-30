-- (30/10 · 5.42) capa (foto) do complemento. Sem esta coluna o app usa só o desenho pelo nome.
alter table public.biblioteca_extras add column if not exists imagem_url text;
notify pgrst, 'reload schema';
