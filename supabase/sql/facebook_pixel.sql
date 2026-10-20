-- (19/10) Marketing › Pixel do Facebook: o ID do pixel da loja (só números). O cardápio público carrega o pixel com ele.
-- A função cardapio_loja já devolve a coluna (to_jsonb do perfil).
alter table public.profiles add column if not exists facebook_pixel_id text;
alter table public.profiles drop constraint if exists profiles_facebook_pixel_id_chk;
alter table public.profiles add constraint profiles_facebook_pixel_id_chk check (facebook_pixel_id is null or facebook_pixel_id ~ '^[0-9]{10,20}$');
