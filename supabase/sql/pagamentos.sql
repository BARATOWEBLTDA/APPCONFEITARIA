-- ═══════════════════════════════════════════════════════════════════════════
-- Financeiro · Passo 1 — PAGAMENTOS (03/10)
--
-- Antes: o pedido guardava o recebido como UM número (valor_recebido), sem data e sem forma,
-- e cada edição podia sobrescrevê-lo.
-- Agora: cada recebimento é uma linha em "pagamentos" (valor, forma, data, tipo). O valor_recebido
-- e o status_pagamento do pedido passam a ser a SOMA dessas linhas, mantida por este gatilho —
-- então as telas atuais (que leem valor_recebido) continuam funcionando igual.
--
-- Nada se apaga: um pagamento errado é ESTORNADO (estornado_em), e continua no histórico.
--
-- Rodar no SQL Editor do Supabase. Pode rodar mais de uma vez (não duplica nada).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Tabela ────────────────────────────────────────────────────────────────
create table if not exists public.pagamentos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  pedido_id     uuid references public.pedidos(id) on delete set null, -- pedido excluído: o dinheiro recebido continua registrado
  valor         numeric(12,2) not null check (valor > 0),
  forma         text,                                                  -- pix, dinheiro, credito, debito…
  recebido_em   date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  tipo          text not null default 'pagamento'
                check (tipo in ('sinal','parcial','restante','total','pagamento','migracao')),
  origem        text not null default 'app',                           -- app, doo, cardapio, migracao
  observacao    text,
  estornado_em  timestamptz,                                           -- preenchido = não conta mais
  created_at    timestamptz not null default now()
);

create index if not exists pagamentos_user_data_idx on public.pagamentos (user_id, recebido_em);
create index if not exists pagamentos_pedido_idx   on public.pagamentos (pedido_id);
-- o preenchimento inicial (abaixo) nunca cria dois registros pro mesmo pedido
create unique index if not exists pagamentos_migracao_unica on public.pagamentos (pedido_id) where origem = 'migracao';

-- 2) Segurança: cada confeiteira só vê e mexe nos dela. Sem política de DELETE = ninguém apaga.
alter table public.pagamentos enable row level security;

drop policy if exists pagamentos_ver       on public.pagamentos;
drop policy if exists pagamentos_criar     on public.pagamentos;
drop policy if exists pagamentos_atualizar on public.pagamentos;
create policy pagamentos_ver       on public.pagamentos for select using (auth.uid() = user_id);
create policy pagamentos_criar     on public.pagamentos for insert with check (auth.uid() = user_id);
create policy pagamentos_atualizar on public.pagamentos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Recalcula o pedido a partir dos pagamentos ativos ─────────────────────
create or replace function public.pagamentos_recalcular_pedido(p_pedido uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_soma   numeric;
  v_total  numeric;
  v_status text;
begin
  if p_pedido is null then return; end if;
  select coalesce(valor_total, 0), status_pagamento into v_total, v_status from pedidos where id = p_pedido;
  if not found then return; end if;
  select coalesce(sum(valor), 0) into v_soma from pagamentos where pedido_id = p_pedido and estornado_em is null;

  if v_status = 'estornado' then
    -- estorno do pedido é uma decisão dela: só atualiza o número, não a situação
    update pedidos set valor_recebido = v_soma where id = p_pedido;
  else
    update pedidos set
      valor_recebido   = v_soma,
      status_pagamento = case
        when v_soma > 0 and v_soma >= v_total - 0.009 then 'pago'
        when v_soma > 0 then 'parcial'
        else 'pendente' end
    where id = p_pedido;
  end if;
end $$;

-- 4) Gatilho nos pagamentos: qualquer mudança recalcula o pedido ───────────
create or replace function public.pagamentos_apos_mudanca()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then perform pagamentos_recalcular_pedido(new.pedido_id); end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.pedido_id is distinct from new.pedido_id) then
    perform pagamentos_recalcular_pedido(old.pedido_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_pagamentos_recalcular on public.pagamentos;
create trigger trg_pagamentos_recalcular
  after insert or update or delete on public.pagamentos
  for each row execute function public.pagamentos_apos_mudanca();

-- 5) Gatilho no pedido: mudou o total → recalcula a situação (ex.: pago de R$ 300 que virou R$ 600 = parcial)
--    Só pra pedidos que já têm pagamento registrado (os outros continuam como estão).
create or replace function public.pedidos_apos_mudar_total()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.valor_total is distinct from old.valor_total
     and exists (select 1 from pagamentos where pedido_id = new.id) then
    perform pagamentos_recalcular_pedido(new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_pedidos_recalcular_total on public.pedidos;
create trigger trg_pedidos_recalcular_total
  after update of valor_total on public.pedidos
  for each row execute function public.pedidos_apos_mudar_total();

-- 6) Preenchimento inicial: um pagamento por pedido que já tinha dinheiro recebido ─
--    · pago ............................ o total
--    · parcial (sinal) ................. o que foi recebido
--    · sem situação + entregue (antigo) . o total (a mesma regra que o Financeiro já usava)
--    Cancelados e estornados ficam de fora. A data é a do pedido (a melhor que existe hoje).
insert into public.pagamentos (user_id, pedido_id, valor, forma, recebido_em, tipo, origem, observacao)
select
  p.user_id,
  p.id,
  case when p.status_pagamento = 'parcial' then p.valor_recebido else p.valor_total end,
  nullif(lower(trim(p.forma_pagamento)), ''),
  coalesce((p.created_at at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date),
  'migracao',
  'migracao',
  'Registrado a partir do pedido (antes da tabela de pagamentos)'
from public.pedidos p
where p.status is distinct from 'cancelado'
  and coalesce(p.status_pagamento, '') <> 'estornado'
  and (
        (p.status_pagamento = 'pago'    and coalesce(p.valor_total, 0)    > 0)
     or (p.status_pagamento = 'parcial' and coalesce(p.valor_recebido, 0) > 0)
     or (p.status_pagamento is null and p.status = 'entregue' and coalesce(p.valor_total, 0) > 0)
      )
  and not exists (select 1 from public.pagamentos g where g.pedido_id = p.id)
on conflict do nothing;

notify pgrst, 'reload schema';

-- Conferência (opcional): quantos pagamentos foram criados e o total
-- select origem, count(*), sum(valor) from public.pagamentos group by origem;
