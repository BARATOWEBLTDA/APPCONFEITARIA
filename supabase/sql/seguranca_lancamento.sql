-- (01/11 · 5.99) Ajustes de segurança antes do lançamento (relatório do Supabase).
-- Pode rodar mais de uma vez.

-- 1) Lista de usuários do admin: a view lia auth.users com o poder do dono (o Supabase marca como ERRO).
--    Vira uma função que só devolve algo para o admin.
create or replace function public.admin_usuarios()
returns table(id uuid, email text, created_at timestamptz, nome text, nome_loja text, telefone text, foto_url text, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select au.id, au.email::text, au.created_at, p.nome::text, p.nome_loja::text, p.telefone::text, p.foto_url::text, coalesce(p.is_admin, false)
    from auth.users au left join public.profiles p on p.id = au.id
   where public.eh_admin()
$$;
revoke all on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;
-- a view antiga sai depois que o app novo estiver no ar (ver o fim do arquivo)

-- 2) "É PRO?" só responde sobre a própria conta (ou para o admin e as funções internas).
--    Antes, quem estava logado conseguia perguntar sobre qualquer loja.
create or replace function public.conta_eh_pro(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = p_user and plano = 'pro' and (pro_expira_em is null or pro_expira_em > now())
       and (p_user = auth.uid() or public.eh_admin() or coalesce(auth.role(), '') not in ('anon', 'authenticated'))
  )
$$;

-- 3) Taxa da maquininha: só o próprio banco usa (gatilho dos pagamentos). Ninguém de fora chama mais.
revoke execute on function public.taxa_pct_da_forma(uuid, text) from public, anon, authenticated;

-- 4) Funções de gatilho não são para ser chamadas pela internet (o gatilho continua funcionando igual).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and pg_get_function_result(p.oid) = 'trigger' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end $$;

-- 5) search_path fixo nas duas funções da taxa de entrega
alter function public.distancia_km(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.taxa_entrega_da_loja(public.profiles, double precision, double precision, text) set search_path = public;

-- 6) Visitas do cardápio: qualquer um podia gravar qualquer coisa. Agora só uma visita de agora, de uma loja que existe.
alter table public.cardapio_visitas alter column user_id set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cardapio_visitas_user_fk') then
    alter table public.cardapio_visitas add constraint cardapio_visitas_user_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
  end if;
end $$;
alter policy "Permitir insert público de visitas" on public.cardapio_visitas
  with check (user_id is not null and created_at between now() - interval '1 minute' and now() + interval '1 minute');
create policy "Visita de agora" on public.cardapio_visitas for insert to anon, authenticated
  with check (user_id is not null and created_at between now() - interval '1 minute' and now() + interval '1 minute');

-- ════ Até aqui já foi aplicado (01/11). ════
-- PARA RODAR NO SQL EDITOR DO SUPABASE (apagar regras não passa pela ferramenta que eu uso):
-- regras repetidas (cada uma era conferida duas vezes em toda leitura) e a view antiga do admin,
-- esta só depois que a versão 5.99 estiver no ar.
drop policy if exists "Visita de agora" on public.cardapio_visitas;
drop policy if exists "users can delete own subscriptions" on public.push_subscriptions;
drop policy if exists "users can insert own subscriptions" on public.push_subscriptions;
drop policy if exists "users can view own subscriptions" on public.push_subscriptions;
drop policy if exists "users can update own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own suggestions" on public.sugestoes;
drop policy if exists "Users can view own suggestions" on public.sugestoes;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admin vê todas indicações" on public.indicacoes;
drop view if exists public.admin_users;
