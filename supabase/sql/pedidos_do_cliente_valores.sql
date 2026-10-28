-- (28/10) Meus pedidos (cliente): manda também desconto, cupom, entrega e acréscimo, para a conta fechar com o total
do $x$
declare d text;
begin
  d := pg_get_functiondef('public.cardapio_pedidos_do_cliente(uuid,text,text)'::regprocedure);
  if position('p.cupom_codigo' in d) > 0 then return; end if;
  if position('p.status_tempos,' in d) = 0 then raise exception 'trecho nao achado'; end if;
  execute replace(d, 'p.status_tempos,', 'p.status_tempos, p.valor_produtos, p.desconto, p.cupom_codigo, p.cupom_desconto, p.taxa_entrega, p.acrescimo,');
end $x$;
