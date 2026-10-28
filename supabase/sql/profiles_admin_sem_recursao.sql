-- (28/10) APLICADO EM PRODUÇÃO.
-- A regra "Admins podem atualizar qualquer profile" consultava a própria tabela profiles dentro da regra
-- (recursão infinita): toda gravação no perfil dava erro 500 (cores, banners, logo, dados da loja).
-- Passa a usar a função eh_admin() (security definer, não passa pela regra).
alter policy "Admins podem atualizar qualquer profile" on public.profiles
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));
