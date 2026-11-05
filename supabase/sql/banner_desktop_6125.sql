-- (6.125) Banner do Início no computador (um para o grátis e um para o PRO), separado do banner do celular. Já aplicado em 05/11.
alter table public.admin_banner drop constraint admin_banner_audiencia_check;
alter table public.admin_banner add constraint admin_banner_audiencia_check check (audiencia = any (array['free','pro','free_desktop','pro_desktop']));
insert into public.admin_banner (audiencia, ativo, link_destino) values ('free_desktop', false, '/assinar'), ('pro_desktop', false, '/assinar') on conflict (audiencia) do nothing;
