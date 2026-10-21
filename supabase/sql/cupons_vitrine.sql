-- (20/10) Cupons no topo do cardápio (vitrine) e cupom só pro primeiro pedido.
-- 1) cardapio_validar_cupom ganha o telefone do cliente (cupom "primeiro pedido") e devolve o público.
--    Liberado pra loja grátis por enquanto (teste); pra voltar a exigir o PRO, descomente o bloco marcado.
-- 2) cardapio_criar_pedido passa o telefone pra validação.
-- 3) cardapio_cupons_vitrine: até 3 cupons ativos e valendo hoje, pra mostrar no cardápio.

begin;

create or replace function public.cardapio_validar_cupom(p_loja uuid, p_codigo text, p_subtotal numeric, p_telefone text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c jsonb;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  usos int;
  tel text := right(public.tel_digitos(coalesce(p_telefone, '')), 11);
begin
  if p_loja is null or coalesce(trim(p_codigo), '') = '' then
    return json_build_object('ok', false, 'erro', 'Digite o código do cupom');
  end if;

  -- PRO: liberado pra teste. Pra voltar a exigir o PRO, descomente:
  -- if not exists (select 1 from profiles p where p.id = p_loja and p.plano = 'pro' and (p.pro_expira_em is null or p.pro_expira_em > now())) then
  --   return json_build_object('ok', false, 'erro', 'Cupom indisponível nesta loja');
  -- end if;

  select x into c
  from loja_cupons lc, jsonb_array_elements(lc.cupons) x
  where lc.user_id = p_loja and upper(x->>'codigo') = upper(trim(p_codigo))
  limit 1;

  if c is null or not coalesce((c->>'ativo')::boolean, true) then
    return json_build_object('ok', false, 'erro', 'Cupom inválido');
  end if;
  if nullif(c->>'data_inicio', '') is not null and hoje < (c->>'data_inicio')::date then
    return json_build_object('ok', false, 'erro', 'Este cupom ainda não está valendo');
  end if;
  if nullif(c->>'data_fim', '') is not null and hoje > (c->>'data_fim')::date then
    return json_build_object('ok', false, 'erro', 'Este cupom expirou');
  end if;
  if nullif(c->>'valor_minimo', '') is not null and coalesce(p_subtotal, 0) < (c->>'valor_minimo')::numeric then
    return json_build_object('ok', false, 'erro',
      'Válido para pedidos a partir de R$ ' || replace(to_char((c->>'valor_minimo')::numeric, 'FM999999990.00'), '.', ','));
  end if;
  if nullif(c->>'limite_uso', '') is not null then
    select count(*) into usos from pedidos
    where user_id = p_loja and upper(coalesce(cupom_codigo, '')) = upper(c->>'codigo')
      and coalesce(status, '') <> 'cancelado';
    if usos >= (c->>'limite_uso')::int then
      return json_build_object('ok', false, 'erro', 'Este cupom esgotou');
    end if;
  end if;
  -- Só no primeiro pedido: o WhatsApp não pode ter pedido nesta loja (sem telefone ainda, confere ao enviar)
  if coalesce(c->>'publico', 'todos') = 'primeiro_pedido' and length(tel) >= 10 then
    if exists (
      select 1 from pedidos pe
      where pe.user_id = p_loja and coalesce(pe.status, '') <> 'cancelado'
        and right(public.tel_digitos(coalesce(nullif(pe.cliente_whatsapp, ''), pe.cliente_telefone, '')), 11) = tel
    ) then
      return json_build_object('ok', false, 'erro', 'Este cupom é só pro primeiro pedido');
    end if;
  end if;

  return json_build_object('ok', true, 'codigo', c->>'codigo', 'tipo', c->>'tipo',
                           'valor', coalesce((c->>'valor')::numeric, 0),
                           'publico', coalesce(c->>'publico', 'todos'));
end $function$;

-- a versão de 3 argumentos continua existindo e chama a nova sem telefone
create or replace function public.cardapio_validar_cupom(p_loja uuid, p_codigo text, p_subtotal numeric)
returns json
language sql
security definer
set search_path to 'public'
as $function$
  select public.cardapio_validar_cupom(p_loja, p_codigo, p_subtotal, null::text)
$function$;

grant execute on function public.cardapio_validar_cupom(uuid, text, numeric, text) to anon, authenticated;

-- o pedido passa o telefone pra validação (mesma função, só essa chamada muda)
do $do$
declare d text;
begin
  select pg_get_functiondef('public.cardapio_criar_pedido(uuid,jsonb,jsonb)'::regprocedure) into d;
  d := replace(d, 'public.cardapio_validar_cupom(p_loja, v_codigo, v_subtotal)', 'public.cardapio_validar_cupom(p_loja, v_codigo, v_subtotal, v_tel)');
  execute d;
end $do$;

create or replace function public.cardapio_cupons_vitrine(p_loja uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(v order by ord desc), '[]'::jsonb) from (
    select jsonb_build_object(
             'codigo', x->>'codigo', 'tipo', x->>'tipo', 'valor', coalesce((x->>'valor')::numeric, 0),
             'valor_minimo', nullif(x->>'valor_minimo', '')::numeric, 'data_fim', nullif(x->>'data_fim', ''),
             'publico', coalesce(x->>'publico', 'todos')) as v, ord
    from loja_cupons lc, jsonb_array_elements(lc.cupons) with ordinality as t(x, ord)
    where lc.user_id = p_loja
      and coalesce((x->>'ativo')::boolean, true)
      and (nullif(x->>'data_inicio', '') is null or (x->>'data_inicio')::date <= (now() at time zone 'America/Sao_Paulo')::date)
      and (nullif(x->>'data_fim', '') is null or (x->>'data_fim')::date >= (now() at time zone 'America/Sao_Paulo')::date)
      and (nullif(x->>'limite_uso', '') is null or (
            select count(*) from pedidos pe where pe.user_id = p_loja and coalesce(pe.status, '') <> 'cancelado'
              and upper(coalesce(pe.cupom_codigo, '')) = upper(x->>'codigo')) < (x->>'limite_uso')::int)
    order by ord desc
    limit 3
  ) s
$function$;

grant execute on function public.cardapio_cupons_vitrine(uuid) to anon, authenticated;

commit;
