-- ═══════════════════════════════════════════════════════════════
-- Recebimento em dobro e edição em dois aparelhos (17/10 · R06, R09)
--
-- R06  Antes de gravar um recebimento, o banco trava o pedido (um recebimento por vez) e confere:
--        · a soma dos recebimentos ativos + o novo não passa do total do pedido (1 centavo de folga);
--          pedido ainda sem valor (total 0) não entra nessa conta;
--        · o mesmo recebimento (mesmo pedido, valor e forma) repetido em menos de 15 segundos é recusado
--          (dois toques, duas abas, nova tentativa depois de a internet cair).
--      Recusas: recebido_acima_do_total, pagamento_repetido (o app explica cada uma).
-- R09  updated_at do pedido passa a mudar sozinho a cada alteração. O Editar pedido usa isso pra avisar
--      quando o pedido mudou em outro aparelho depois de aberto, em vez de salvar por cima calado.
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.pagamentos_conferir_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_soma numeric;
begin
  if new.pedido_id is null or coalesce(new.valor, 0) <= 0 then return new; end if;

  -- um recebimento por vez no mesmo pedido (a segunda aba espera a primeira terminar)
  select coalesce(valor_total, 0) into v_total from pedidos where id = new.pedido_id for update;
  if not found then return new; end if;

  if exists (
    select 1 from pagamentos
    where pedido_id = new.pedido_id and estornado_em is null
      and valor = new.valor and coalesce(forma, '') = coalesce(new.forma, '')
      and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'pagamento_repetido' using errcode = 'P0001';
  end if;

  if v_total > 0 then
    select coalesce(sum(valor), 0) into v_soma from pagamentos where pedido_id = new.pedido_id and estornado_em is null;
    if v_soma + new.valor > v_total + 0.01 then
      raise exception 'recebido_acima_do_total' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;


create or replace function public.pedidos_marcar_alteracao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- (sem "drop": o gatilho só é criado se ainda não existir)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_pagamentos_conferir' and tgrelid = 'public.pagamentos'::regclass) then
    create trigger trg_pagamentos_conferir before insert on public.pagamentos
      for each row execute function public.pagamentos_conferir_antes();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_pedidos_updated_at' and tgrelid = 'public.pedidos'::regclass) then
    create trigger trg_pedidos_updated_at before update on public.pedidos
      for each row execute function public.pedidos_marcar_alteracao();
  end if;
end $$;
