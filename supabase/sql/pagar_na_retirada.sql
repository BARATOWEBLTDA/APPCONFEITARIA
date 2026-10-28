-- (28/10) Cardápio: a confeiteira pode aceitar pagamento na retirada/entrega, sem antecipar pelo Pix.
alter table public.profiles add column if not exists pagar_na_retirada boolean not null default false;

-- cardapio_criar_pedido: com a opção ligada e a cliente escolhendo "Pagar na retirada", o pedido não fica como Pix pelo cardápio
do $x$
declare d text; a text := $a$'pix_online', coalesce((to_jsonb(v_loja)->>'pix_online')::boolean, false) and lower(coalesce(p_pedido->>'forma_pagamento', '')) = 'pix',$a$;
b text := $b$'pix_online', coalesce((to_jsonb(v_loja)->>'pix_online')::boolean, false) and lower(coalesce(p_pedido->>'forma_pagamento', '')) = 'pix'
      and not (coalesce((to_jsonb(v_loja)->>'pagar_na_retirada')::boolean, false) and coalesce((p_pedido->>'pagar_na_retirada')::boolean, false)),$b$;
begin
  d := pg_get_functiondef('public.cardapio_criar_pedido(uuid,jsonb,jsonb)'::regprocedure);
  if position(b in d) > 0 then return; end if;
  if position(a in d) = 0 then raise exception 'trecho nao achado'; end if;
  execute replace(d, a, b);
end $x$;
