-- (6.156) Aprovar orçamento dava erro (e a cliente nunca conseguia aprovar) quando a confeiteira tinha excluído o
-- cliente ou um produto do orçamento: o pedido herdava ids que não existem mais (chave estrangeira falhava).
-- Agora só usa o cliente/produto se ainda existir na loja; senão acha o cliente pelo telefone e o item fica sem produto.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.orcamento_responder(text,boolean,text)'::regprocedure);
  n := replace(d, 'v_cli := o.cliente_id;',
                  'v_cli := (select c.id from clientes c where c.id = o.cliente_id and c.user_id = o.user_id);');
  n := replace(n, 'nullif(i->>''produto_id'', '''')::uuid,',
                  '(select pr.id from produtos pr where pr.id::text = nullif(i->>''produto_id'', '''') and pr.user_id = o.user_id),');
  n := replace(n, 'cliente_id = coalesce(o.cliente_id, v_cli)', 'cliente_id = coalesce(v_cli, o.cliente_id)');
  if n = d or position('pr.user_id = o.user_id' in n) = 0 or position('c.id = o.cliente_id' in n) = 0 then
    raise exception 'orcamento_responder mudou: confira antes de aplicar';
  end if;
  execute n;
end $$;
