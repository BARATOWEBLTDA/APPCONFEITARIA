-- (6.156) Cupom do cardápio voltava "Cupom indisponível nesta loja" para todo cliente:
-- conta_eh_pro() só responde para a própria dona (trava de auth.role), e o cliente do cardápio é anon.
-- loja_eh_pro: a mesma conta, sem a trava, e SEM permissão para chamar de fora (só as funções do banco usam).
create or replace function public.loja_eh_pro(p_loja uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_loja and plano = 'pro' and (pro_expira_em is null or pro_expira_em > now()))
$$;
revoke all on function public.loja_eh_pro(uuid) from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array['public.cardapio_validar_cupom(uuid,text,numeric,text)', 'public.cardapio_cupons_vitrine(uuid)'] loop
    execute replace(pg_get_functiondef(f::regprocedure), 'public.conta_eh_pro(p_loja)', 'public.loja_eh_pro(p_loja)');
  end loop;
end $$;
