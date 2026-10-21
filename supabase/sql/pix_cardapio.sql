-- Pix pelo cardápio (20/10)
-- A loja liga "Receber Pix pelo cardápio" em Pagamento e coloca a chave, o nome e a cidade.
-- O cliente escolhe Pix, toca em "Ir para o pagamento", o pedido é criado e aparece o QR Code / copia e cola
-- (gerado no navegador, sem intermediário). Ele toca em "Já paguei" → o pedido fica "Pix a conferir".
-- A confeiteira confere no banco e toca em "Confirmar" (vira um recebimento normal na tabela pagamentos).

-- 1) Configuração da loja (o cardápio público lê pelo cardapio_loja, que já entrega as colunas novas)
alter table public.profiles add column if not exists pix_online boolean not null default false;
alter table public.profiles add column if not exists pix_chave text;
alter table public.profiles add column if not exists pix_nome text;
alter table public.profiles add column if not exists pix_cidade text;
alter table public.profiles add column if not exists pix_modo text not null default 'escolha';
alter table public.profiles add column if not exists pix_sinal_pct int not null default 50;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_pix_modo_chk') then
    alter table public.profiles add constraint profiles_pix_modo_chk check (pix_modo in ('sinal', 'total', 'escolha'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_pix_sinal_pct_chk') then
    alter table public.profiles add constraint profiles_pix_sinal_pct_chk check (pix_sinal_pct between 10 and 90);
  end if;
end $$;

-- 2) No pedido: veio com Pix pelo cardápio? O cliente disse que pagou quanto?
alter table public.pedidos add column if not exists pix_online boolean not null default false;
alter table public.pedidos add column if not exists pix_informado_valor numeric;
alter table public.pedidos add column if not exists pix_informado_tipo text;
alter table public.pedidos add column if not exists pix_informado_em timestamptz;

-- 3) cardapio_criar_pedido: o banco decide o pix_online (loja com Pix ligado + cliente escolheu Pix)
--    e não aceita os campos "informado" vindos do navegador.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'cardapio_criar_pedido';
  if d is null then raise notice 'cardapio_criar_pedido não existe'; return; end if;
  if position('pix_informado_valor' in d) > 0 then raise notice 'já tem o Pix'; return; end if;
  d := replace(d,
    $a$- 'bairro_taxa') || jsonb_build_object($a$,
    $b$- 'bairro_taxa' - 'pix_online' - 'pix_informado_valor' - 'pix_informado_tipo' - 'pix_informado_em') || jsonb_build_object(
    'pix_online', coalesce((to_jsonb(v_loja)->>'pix_online')::boolean, false) and lower(coalesce(p_pedido->>'forma_pagamento', '')) = 'pix',$b$);
  if position('pix_informado_valor' in d) = 0 then raise exception 'não achei o trecho do pedido em cardapio_criar_pedido'; end if;
  execute d;
end $$;

-- 4) "Já paguei" (cliente sem login). O valor sai do banco (sinal ou total), nunca do navegador.
create or replace function public.cardapio_pix_informado(p_pedido uuid, p_tipo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_ped pedidos;
  v_loja profiles;
  v_tipo text;
  v_valor numeric;
begin
  select * into v_ped from pedidos where id = p_pedido;
  if not found or v_ped.origem <> 'cardapio' or not coalesce(v_ped.pix_online, false) then
    raise exception 'pedido_invalido' using errcode = 'P0001';
  end if;
  if v_ped.status = 'cancelado' or coalesce(v_ped.status_pagamento, 'pendente') <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro', 'ja_conferido');
  end if;
  select * into v_loja from profiles where id = v_ped.user_id;
  v_tipo := case coalesce(v_loja.pix_modo, 'escolha')
    when 'sinal' then 'sinal'
    when 'total' then 'total'
    else case when p_tipo = 'sinal' then 'sinal' else 'total' end end;
  v_valor := case when v_tipo = 'sinal'
    then round(coalesce(v_ped.valor_total, 0) * least(90, greatest(10, coalesce(v_loja.pix_sinal_pct, 50))) / 100, 2)
    else round(coalesce(v_ped.valor_total, 0), 2) end;
  update pedidos set pix_informado_valor = v_valor, pix_informado_tipo = v_tipo, pix_informado_em = now() where id = p_pedido;
  return jsonb_build_object('ok', true, 'tipo', v_tipo, 'valor', v_valor);
end $$;
revoke all on function public.cardapio_pix_informado(uuid, text) from public;
grant execute on function public.cardapio_pix_informado(uuid, text) to anon, authenticated;
