-- ═══════════════════════════════════════════════════════════════
-- Pedido do cardápio: o servidor confere preço, taxa, data e quantidade (17/10 · BUG-002, 003, 004)
--
-- BUG-002  O preço mínimo de cada item agora leva em conta o TAMANHO escolhido (antes valia o do menor
--          tamanho pra qualquer um) e os complementos marcados (com o valor do banco, não o do navegador).
--          A taxa de entrega é refeita no servidor com a mesma regra do cardápio (entrega própria:
--          valor do bairro escolhido ou a taxa fixa; retirada e outras formas: 0).
-- BUG-003  Data de entrega no passado é recusada (fuso de São Paulo).
-- BUG-004  Quantidade quebrada só vale em produto vendido por kg sem tamanho (de 0,5 em 0,5);
--          o resto é número inteiro. Máximo de 50 por item, igual ao cardápio.
--
-- Pedido enviado por uma versão antiga do app (sem forma_entrega): a taxa continua como chegou.
-- Recusas novas: data_invalida, entrega_invalida (o app explica cada uma).
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════

-- Menor preço aceitável de UM item, olhando o tamanho escolhido e os complementos marcados.
-- É uma trava (fica sempre do lado de aceitar): quando há dúvida sobre a regra, usa o menor valor possível.
create or replace function public.preco_minimo_item(pr produtos, it jsonb)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  j jsonb := to_jsonb(pr);
  pers jsonb := coalesce(it->'personalizacoes', '{}'::jsonb);
  minimo numeric := public.preco_minimo_produto(pr);
  pct numeric := 0;
  base numeric := nullif(coalesce((j->>'preco_normal')::numeric, 0), 0);
  promo numeric;
  menor_sabor numeric;
  op jsonb;
  peso numeric;
  piso numeric;
  extras numeric := 0;
begin
  if coalesce((j->>'promocao')::boolean, false) then
    pct := least(100, greatest(0, coalesce((j->>'desconto_percentual')::numeric, 0)));
    promo := nullif(coalesce((j->>'preco_promocional')::numeric, 0), 0);
    if promo is not null and (base is null or promo < base) then base := promo; end if;
  end if;

  -- sabor com preço próprio pode substituir o preço base: considera o menor
  if coalesce((j->'grupo_sabores'->>'ativo')::boolean, false) then
    select min((o->>'preco')::numeric) into menor_sabor
    from jsonb_array_elements(coalesce(j->'grupo_sabores'->'opcoes', '[]')) o
    where coalesce((o->>'preco')::numeric, 0) > 0;
  end if;

  -- tamanho escolhido (sem kit): o piso passa a ser o preço daquele tamanho
  if coalesce((j->'grupo_tamanhos'->>'ativo')::boolean, false)
     and not coalesce((j->'kit_qtd'->>'ativo')::boolean, false)
     and jsonb_typeof(pers->'tamanho') = 'object' then
    select o into op
    from jsonb_array_elements(coalesce(j->'grupo_tamanhos'->'opcoes', '[]')) o
    where (nullif(pers->'tamanho'->>'id', '') is not null and o->>'id' = pers->'tamanho'->>'id')
       or (nullif(pers->'tamanho'->>'id', '') is null and o->>'nome' = pers->'tamanho'->>'nome')
    limit 1;
    if op is not null then
      if j->'grupo_tamanhos'->>'modo_preco_tamanho' = 'por_peso' then
        peso := coalesce(nullif((op->>'peso_kg')::numeric, 0), public.peso_do_nome(op->>'nome'));
        if peso > 0 and coalesce(least(base, menor_sabor), base, menor_sabor) is not null then
          piso := round(coalesce(least(base, menor_sabor), base, menor_sabor) * peso, 2);
        end if;
      elsif coalesce((op->>'preco')::numeric, 0) > 0 then
        piso := (op->>'preco')::numeric;
        if menor_sabor is not null and menor_sabor < piso then piso := menor_sabor; end if;
      end if;
      if piso is not null then
        piso := round(piso * (1 - pct / 100), 2);
        if piso > minimo then minimo := piso; end if;
      end if;
    end if;
  end if;

  -- complementos marcados: soma o valor cadastrado no banco (pelo id ou, sem id, pelo nome)
  if jsonb_typeof(pers->'extras') = 'array' then
    select coalesce(sum(coalesce(e.valor, 0)), 0) into extras
    from jsonb_array_elements(pers->'extras') x
    join biblioteca_extras e on e.user_id = pr.user_id
     and ((nullif(x->>'id', '') is not null and e.id::text = x->>'id') or (nullif(x->>'id', '') is null and e.nome = x->>'nome'));
    minimo := minimo + round(extras * (1 - pct / 100), 2);
  end if;

  return minimo;
end $$;

create or replace function public.cardapio_criar_pedido(p_loja uuid, p_pedido jsonb, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid := coalesce(nullif(p_pedido->>'id', '')::uuid, gen_random_uuid());
  v_ped pedidos;
  v_loja profiles;
  v_subtotal numeric := 0;
  v_desconto numeric := 0;
  v_taxa numeric := greatest(0, coalesce(nullif(p_pedido->>'taxa_entrega', '')::numeric, 0));
  v_forma text := nullif(trim(coalesce(p_pedido->>'forma_entrega', '')), '');
  v_bairro text := nullif(trim(coalesce(p_pedido->>'bairro_taxa', '')), '');
  v_bairros jsonb;
  v_valor_bairro numeric;
  v_data date;
  v_cupom json;
  v_codigo text := nullif(trim(coalesce(p_pedido->>'cupom_codigo', '')), '');
  v_numero int;
  v_json jsonb;
  v_itens jsonb;
  v_cols text;
  v_tel text := coalesce(nullif(p_pedido->>'cliente_whatsapp', ''), p_pedido->>'cliente_telefone');
  v_token text;
begin
  select * into v_loja from profiles where id = p_loja and codigo_publico is not null;
  if not found then
    raise exception 'loja_invalida' using errcode = 'P0001';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'sem_itens' using errcode = 'P0001';
  end if;

  -- nova tentativa do mesmo pedido: devolve o que já foi gravado
  select * into v_ped from pedidos where id = v_id;
  if found then
    if v_ped.user_id <> p_loja then raise exception 'pedido_invalido' using errcode = 'P0001'; end if;
    if length(public.tel_digitos(v_tel)) >= 10 then v_token := public.cliente_novo_acesso(p_loja, v_tel); end if;
    return jsonb_build_object('id', v_ped.id, 'numero', to_jsonb(v_ped) -> 'numero', 'repetido', true, 'acesso', v_token);
  end if;

  -- (17/10 · BUG-003) data de entrega no passado (fuso de São Paulo)
  begin
    v_data := nullif(p_pedido->>'data_entrega', '')::date;
  exception when others then
    raise exception 'data_invalida' using errcode = 'P0001';
  end;
  if v_data is not null and v_data < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'data_invalida' using errcode = 'P0001';
  end if;

  -- cada item: produto desta loja, disponível, quantidade válida e preço não menor que o mínimo
  -- (17/10 · BUG-002/004) mínimo pelo tamanho e complementos escolhidos; quantidade inteira
  -- (ou de 0,5 em 0,5 no produto por kg sem tamanho e sem kit), até 50
  if exists (
    select 1 from jsonb_array_elements(p_itens) it
    left join produtos pr on pr.id = nullif(it->>'produto_id', '')::uuid and pr.user_id = p_loja
    where pr.id is null
       or coalesce(pr.disponivel, true) = false
       or coalesce(nullif(it->>'quantidade', '')::numeric, 0) <= 0
       or coalesce(nullif(it->>'quantidade', '')::numeric, 0) > 50
       or (
            case when to_jsonb(pr)->>'forma_venda' = 'kg'
                   and not coalesce((to_jsonb(pr)->'grupo_tamanhos'->>'ativo')::boolean, false)
                   and not coalesce((to_jsonb(pr)->'kit_qtd'->>'ativo')::boolean, false)
                 then (coalesce(nullif(it->>'quantidade', '')::numeric, 0) * 2) % 1 <> 0
                 else coalesce(nullif(it->>'quantidade', '')::numeric, 0) % 1 <> 0
            end
          )
       or coalesce(nullif(it->>'valor_unitario', '')::numeric, -1) < 0
       or coalesce(nullif(it->>'valor_unitario', '')::numeric, 0) < round(public.preco_minimo_item(pr, it) * 0.98, 2) - 0.01
  ) then
    raise exception 'item_invalido' using errcode = 'P0001';
  end if;

  -- (17/10 · BUG-002) taxa de entrega refeita aqui, com a mesma regra do cardápio
  if v_forma is not null then
    if not (coalesce(to_jsonb(v_loja)->'formas_entrega', '["retirada"]'::jsonb) ? v_forma) then
      raise exception 'entrega_invalida' using errcode = 'P0001';
    end if;
    if v_forma = 'entrega_propria' then
      v_bairros := coalesce(to_jsonb(v_loja)->'entrega_por_bairro', '[]'::jsonb);
      if jsonb_typeof(v_bairros) = 'array' and jsonb_array_length(v_bairros) > 0 then
        if v_bairro is null then raise exception 'entrega_invalida' using errcode = 'P0001'; end if;
        select (b->>'valor')::numeric into v_valor_bairro
        from jsonb_array_elements(v_bairros) b where b->>'bairro' = v_bairro limit 1;
      end if;
      v_taxa := greatest(0, coalesce(v_valor_bairro, nullif(to_jsonb(v_loja)->>'valor_entrega_propria', '')::numeric, 0));
    else
      v_taxa := 0;
    end if;
  end if;

  select coalesce(sum(round(coalesce(nullif(it->>'valor_unitario', '')::numeric, 0) * coalesce(nullif(it->>'quantidade', '')::numeric, 1), 2)), 0)
    into v_subtotal from jsonb_array_elements(p_itens) it;

  if v_codigo is not null then
    v_cupom := public.cardapio_validar_cupom(p_loja, v_codigo, v_subtotal);
    if coalesce((v_cupom->>'ok')::boolean, false) then
      v_desconto := case when v_cupom->>'tipo' = 'percentual'
        then round(v_subtotal * least(100, greatest(0, (v_cupom->>'valor')::numeric)) / 100, 2)
        else round(greatest(0, (v_cupom->>'valor')::numeric), 2) end;
      v_desconto := least(v_desconto, v_subtotal);
      v_codigo := v_cupom->>'codigo';
    else
      v_codigo := null; v_desconto := 0;
    end if;
  end if;

  v_json := (p_pedido - 'numero' - 'created_at' - 'valor_recebido' - 'forma_entrega' - 'bairro_taxa') || jsonb_build_object(
    'id', v_id, 'user_id', p_loja,
    'status', 'novo', 'origem', 'cardapio', 'status_pagamento', 'pendente',
    'valor_produtos', v_subtotal, 'taxa_entrega', v_taxa,
    'cupom_codigo', v_codigo, 'cupom_desconto', v_desconto, 'desconto', v_desconto,
    'valor_total', greatest(0, v_subtotal - v_desconto + v_taxa));
  select string_agg(quote_ident(k), ',') into v_cols
  from jsonb_object_keys(v_json) k
  where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'pedidos' and c.column_name = k and c.is_generated = 'NEVER' and c.is_identity = 'NO');
  execute format('insert into public.pedidos (%1$s) select %1$s from jsonb_populate_record(null::public.pedidos, $1)', v_cols) using v_json;

  select jsonb_agg((it - 'id' - 'created_at') || jsonb_build_object('pedido_id', v_id, 'user_id', p_loja, 'desconto', 0))
    into v_itens from jsonb_array_elements(p_itens) it;
  select string_agg(distinct quote_ident(k), ',') into v_cols
  from jsonb_array_elements(v_itens) it, jsonb_object_keys(it) k
  where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'pedido_itens' and c.column_name = k and c.is_generated = 'NEVER' and c.is_identity = 'NO');
  execute format('insert into public.pedido_itens (%1$s) select %1$s from jsonb_populate_recordset(null::public.pedido_itens, $1)', v_cols) using v_itens;

  select (to_jsonb(p) ->> 'numero')::int into v_numero from pedidos p where p.id = v_id;
  if length(public.tel_digitos(v_tel)) >= 10 then v_token := public.cliente_novo_acesso(p_loja, v_tel); end if;
  return jsonb_build_object('id', v_id, 'numero', v_numero, 'valor_total', greatest(0, v_subtotal - v_desconto + v_taxa), 'acesso', v_token);
end $function$;

notify pgrst, 'reload schema';
