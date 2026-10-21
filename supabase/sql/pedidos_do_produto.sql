-- (21/10) Prova social no cardápio: quantos pedidos levaram este produto nos últimos 30 dias.
-- Devolve só o número (nenhum dado de cliente ou de pedido). Pedido cancelado não conta.
create or replace function public.cardapio_pedidos_do_produto(p_loja uuid, p_produto uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select count(distinct p.id)::int
  from pedido_itens i
  join pedidos p on p.id = i.pedido_id
  where i.produto_id = p_produto
    and p.user_id = p_loja
    and p.created_at >= now() - interval '30 days'
    and coalesce(p.status, '') not in ('cancelado', 'recusado')
$$;
revoke all on function public.cardapio_pedidos_do_produto(uuid, uuid) from public;
grant execute on function public.cardapio_pedidos_do_produto(uuid, uuid) to anon, authenticated;
