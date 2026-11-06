-- (6.171) pedido "pago" sem nenhum pagamento (desconto de 100%) que depois teve o total aumentado: volta a recalcular
create or replace function public.pedidos_apos_mudar_total()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.valor_total is distinct from old.valor_total
     and (exists (select 1 from pagamentos where pedido_id = new.id)
          or (coalesce(new.status_pagamento, '') in ('pago', 'parcial') and coalesce(old.valor_recebido, 0) <= 0.009
              and coalesce(new.valor_total, 0) > coalesce(old.valor_total, 0))) then
    perform pagamentos_recalcular_pedido(new.id);
  end if;
  return null;
end $function$;
-- (6.171) orçamento aprovado cujo pedido foi excluído: o link para o pedido some junto
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orcamentos_pedido_id_fkey') then
    alter table public.orcamentos add constraint orcamentos_pedido_id_fkey foreign key (pedido_id) references public.pedidos(id) on delete set null;
  end if;
end $$;
-- (6.171) pedido de orçamento pelo link: data do evento no passado, valor ou pessoas negativos são recusados
-- (aplicado com replace() em orcamento_solicitar, antes do "select ... into v_fotos")
