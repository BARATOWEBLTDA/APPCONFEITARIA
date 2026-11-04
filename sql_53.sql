-- (6.82) Pix "Combinar pelo WhatsApp": o pedido não fica marcado como Pix online (sem "Falta pagar o Pix" no acompanhamento).
-- O cardápio manda p_pedido.pix_combinar = true quando a cliente escolhe combinar o Pix pelo WhatsApp.
do $$ declare d text; n text; begin
select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='cardapio_criar_pedido';
n := replace(d,
  $a$      and not (coalesce((to_jsonb(v_loja)->>'pagar_na_retirada')::boolean, false) and coalesce((p_pedido->>'pagar_na_retirada')::boolean, false)),$a$,
  $b$      and not (coalesce((to_jsonb(v_loja)->>'pagar_na_retirada')::boolean, false) and coalesce((p_pedido->>'pagar_na_retirada')::boolean, false))
      and not coalesce((p_pedido->>'pix_combinar')::boolean, false),$b$);
if n = d then raise exception 'trecho não encontrado'; end if;
execute n;
end $$;
