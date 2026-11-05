-- (6.157) Conferência do pedido do cardápio no servidor (só barra quem mexe no pedido por fora do app;
-- o cardápio já mostra as mesmas regras para a cliente).
--  · kit: o piso é o preço do kit escolhido (antes era o kit mais barato da loja)
--  · tamanho que não existe ou esgotado, adicional (complemento) que não é da loja: recusa
--  · promoção em valor (preço promocional) com sabor de preço próprio: o desconto proporcional entra no piso
--    (antes recusava um pedido certo: normal 100, promo 80, sabor 30 → cliente pagava 24 e o piso era 30)
--  · bairro fora da lista: recusa (antes caía na taxa fixa)
--  · cardápio ainda não liberado: recusa
--  · dia fechado, horário fora do expediente ou antes da antecedência dos produtos: recusa (com folga de 90 min)

create or replace function public.preco_minimo_produto(p produtos)
returns numeric language plpgsql stable set search_path = public as $$
declare
  j jsonb := to_jsonb(p);
  base numeric := nullif(coalesce((j->>'preco_normal')::numeric, 0), 0);
  cands numeric[] := array[]::numeric[];
  menor numeric;
  pct numeric := 0;
  fator numeric := 1;
  promo numeric;
begin
  if base is not null then cands := cands || base; end if;
  if coalesce((j->'kit_qtd'->>'ativo')::boolean, false) then
    select cands || coalesce(array_agg((k->>'preco')::numeric) filter (where (k->>'preco')::numeric > 0), '{}')
      into cands from jsonb_array_elements(coalesce(j->'kit_qtd'->'kits', '[]')) k;
    if coalesce((j->'kit_qtd'->'livre'->>'preco_cento')::numeric, 0) > 0 then
      cands := cands || round((j->'kit_qtd'->'livre'->>'preco_cento')::numeric * greatest(1, coalesce((j->'kit_qtd'->'livre'->>'min')::numeric, 1)) / 100, 2);
    end if;
  end if;
  if coalesce((j->'grupo_tamanhos'->>'ativo')::boolean, false) then
    if j->'grupo_tamanhos'->>'modo_preco_tamanho' = 'por_peso' and base is not null then
      select cands || coalesce(array_agg(round(base * coalesce(nullif((o->>'peso_kg')::numeric, 0), public.peso_do_nome(o->>'nome')), 2))
               filter (where coalesce(nullif((o->>'peso_kg')::numeric, 0), public.peso_do_nome(o->>'nome')) > 0), '{}')
        into cands from jsonb_array_elements(coalesce(j->'grupo_tamanhos'->'opcoes', '[]')) o;
    else
      select cands || coalesce(array_agg((o->>'preco')::numeric) filter (where (o->>'preco')::numeric > 0), '{}')
        into cands from jsonb_array_elements(coalesce(j->'grupo_tamanhos'->'opcoes', '[]')) o;
    end if;
  end if;
  if coalesce((j->'grupo_sabores'->>'ativo')::boolean, false) then
    select cands || coalesce(array_agg((o->>'preco')::numeric) filter (where (o->>'preco')::numeric > 0), '{}')
      into cands from jsonb_array_elements(coalesce(j->'grupo_sabores'->'opcoes', '[]')) o;
  end if;
  if coalesce((j->>'promocao')::boolean, false) then
    promo := nullif(coalesce((j->>'preco_promocional')::numeric, 0), 0);
    if promo is not null then
      cands := cands || promo;
      if base is not null and promo < base then fator := promo / base; end if;
    end if;
    pct := least(100, greatest(0, coalesce((j->>'desconto_percentual')::numeric, 0)));
  end if;
  select min(x) into menor from unnest(cands) x where x > 0;
  if menor is null then return 0; end if;
  return round(menor * fator * (1 - pct / 100), 2);
end $$;

create or replace function public.preco_minimo_item(pr produtos, it jsonb)
returns numeric language plpgsql stable set search_path = public as $$
declare
  j jsonb := to_jsonb(pr);
  pers jsonb := coalesce(it->'personalizacoes', '{}'::jsonb);
  minimo numeric := public.preco_minimo_produto(pr);
  pct numeric := 0;
  fator numeric := 1;
  normal numeric := nullif(coalesce((j->>'preco_normal')::numeric, 0), 0);
  base numeric := nullif(coalesce((j->>'preco_normal')::numeric, 0), 0);
  promo numeric;
  menor_sabor numeric;
  op jsonb;
  kit jsonb;
  peso numeric;
  piso numeric;
  extras numeric := 0;
  n_extras int := 0;
  n_achados int := 0;
begin
  if coalesce((j->>'promocao')::boolean, false) then
    pct := least(100, greatest(0, coalesce((j->>'desconto_percentual')::numeric, 0)));
    promo := nullif(coalesce((j->>'preco_promocional')::numeric, 0), 0);
    if promo is not null and (base is null or promo < base) then base := promo; end if;
    if promo is not null and normal is not null and promo < normal then fator := promo / normal; end if;
  end if;

  if coalesce((j->'grupo_sabores'->>'ativo')::boolean, false) then
    select min((o->>'preco')::numeric) into menor_sabor
    from jsonb_array_elements(coalesce(j->'grupo_sabores'->'opcoes', '[]')) o
    where coalesce((o->>'preco')::numeric, 0) > 0;
  end if;

  -- kit: o preço do kit escolhido
  if coalesce((j->'kit_qtd'->>'ativo')::boolean, false) and jsonb_typeof(pers->'kit') = 'object' then
    kit := j->'kit_qtd';
    if coalesce(pers->'kit'->>'modo', kit->>'modo') = 'livre' then
      if coalesce((kit->'livre'->>'preco_cento')::numeric, 0) > 0 and coalesce((pers->'kit'->>'total')::numeric, 0) > 0 then
        piso := round((kit->'livre'->>'preco_cento')::numeric * (pers->'kit'->>'total')::numeric / 100, 2);
      end if;
    else
      select (k->>'preco')::numeric into piso from jsonb_array_elements(coalesce(kit->'kits', '[]')) k
       where coalesce((k->>'qtd')::numeric, 0) = coalesce((pers->'kit'->>'total')::numeric, -1) and coalesce((k->>'preco')::numeric, 0) > 0
       order by (k->>'preco')::numeric limit 1;
      if piso is null then raise exception 'item_invalido' using errcode = 'P0001'; end if;
    end if;
    if piso is not null then
      piso := round(piso * fator * (1 - pct / 100), 2);
      if piso > minimo then minimo := piso; end if;
    end if;
    piso := null;
  end if;

  if coalesce((j->'grupo_tamanhos'->>'ativo')::boolean, false)
     and not coalesce((j->'kit_qtd'->>'ativo')::boolean, false)
     and jsonb_typeof(pers->'tamanho') = 'object' then
    select o into op
    from jsonb_array_elements(coalesce(j->'grupo_tamanhos'->'opcoes', '[]')) o
    where (nullif(pers->'tamanho'->>'id', '') is not null and o->>'id' = pers->'tamanho'->>'id')
       or (nullif(pers->'tamanho'->>'id', '') is null and o->>'nome' = pers->'tamanho'->>'nome')
    limit 1;
    -- tamanho que não existe (ou esgotado) não passa
    if op is null or coalesce((op->>'esgotado')::boolean, false) then raise exception 'item_invalido' using errcode = 'P0001'; end if;
    if j->'grupo_tamanhos'->>'modo_preco_tamanho' = 'por_peso' then
      peso := coalesce(nullif((op->>'peso_kg')::numeric, 0), public.peso_do_nome(op->>'nome'));
      if peso > 0 and coalesce(least(normal, menor_sabor), normal, menor_sabor) is not null then
        piso := round(coalesce(least(normal, menor_sabor), normal, menor_sabor) * peso, 2);
      end if;
    elsif coalesce((op->>'preco')::numeric, 0) > 0 then
      piso := (op->>'preco')::numeric;
      if menor_sabor is not null and menor_sabor < piso then piso := menor_sabor; end if;
    end if;
    if piso is not null then
      piso := round(piso * fator * (1 - pct / 100), 2);
      if piso > minimo then minimo := piso; end if;
    end if;
  end if;

  -- complementos: todos têm que ser da loja
  if jsonb_typeof(pers->'extras') = 'array' then
    select count(*) into n_extras from jsonb_array_elements(pers->'extras');
    select coalesce(sum(coalesce(e.valor, 0)), 0), count(e.id) into extras, n_achados
    from jsonb_array_elements(pers->'extras') x
    join biblioteca_extras e on e.user_id = pr.user_id
     and ((nullif(x->>'id', '') is not null and e.id::text = x->>'id') or (nullif(x->>'id', '') is null and e.nome = x->>'nome'));
    if n_achados < n_extras then raise exception 'item_invalido' using errcode = 'P0001'; end if;
    minimo := minimo + round(extras * (1 - pct / 100), 2);
  end if;

  return minimo;
end $$;

-- dia e horário de entrega dentro do expediente e da antecedência (o mesmo que o cardápio mostra)
create or replace function public.pedido_data_ok(v_loja profiles, p_data date, p_hora text, p_horas numeric)
returns boolean language plpgsql stable set search_path = public as $$
declare
  h jsonb;
  dia int;
  dias jsonb;
  a text; f text;
  abre int; fecha int; m int;
  quando timestamp;
  agora timestamp := (now() at time zone 'America/Sao_Paulo');
  nomes text[] := array['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
begin
  if p_data is null then return true; end if;
  begin
    h := case jsonb_typeof(to_jsonb(v_loja)->'horario') when 'string' then (to_jsonb(v_loja)->>'horario')::jsonb else to_jsonb(v_loja)->'horario' end;
  exception when others then h := null; end;
  h := '{"dias":["Segunda","Terça","Quarta","Quinta","Sexta"],"abertura":"08:00","fechamento":"18:00","abre_sabado":false,"abre_domingo":false}'::jsonb || coalesce(h, '{}'::jsonb);
  dia := extract(dow from p_data)::int;
  if dia = 6 then
    if not coalesce((h->>'abre_sabado')::boolean, false) then return false; end if;
    a := coalesce(nullif(h->>'sabado_abertura', ''), h->>'abertura'); f := coalesce(nullif(h->>'sabado_fechamento', ''), h->>'fechamento');
  elsif dia = 0 then
    if not coalesce((h->>'abre_domingo')::boolean, false) then return false; end if;
    a := coalesce(nullif(h->>'domingo_abertura', ''), h->>'abertura'); f := coalesce(nullif(h->>'domingo_fechamento', ''), h->>'fechamento');
  else
    dias := coalesce(h->'dias', '[]'::jsonb);
    if not (dias ? nomes[dia + 1]) then return false; end if;
    a := h->>'abertura'; f := h->>'fechamento';
  end if;
  abre := nullif(split_part(a, ':', 1), '')::int * 60 + coalesce(nullif(left(split_part(a, ':', 2), 2), '')::int, 0);
  fecha := nullif(split_part(f, ':', 1), '')::int * 60 + coalesce(nullif(left(split_part(f, ':', 2), 2), '')::int, 0);
  if fecha = 0 then fecha := 1440; end if;
  if abre is null or fecha is null or fecha <= abre then return true; end if; -- horário mal configurado: não barra
  if nullif(trim(coalesce(p_hora, '')), '') is not null and p_hora ~ '^\s*\d{1,2}:\d{2}' then
    m := split_part(trim(p_hora), ':', 1)::int * 60 + left(split_part(trim(p_hora), ':', 2), 2)::int;
    if m < abre or m > fecha then return false; end if;
  else
    m := fecha; -- sem horário: vale o fim do expediente
  end if;
  quando := p_data::timestamp + make_interval(mins => m);
  return quando >= agora + make_interval(hours => greatest(0, coalesce(p_horas, 0))::int) - interval '90 minutes';
exception when others then return true; -- dado estranho no horário da loja: não barra o pedido
end $$;
revoke all on function public.pedido_data_ok(profiles, date, text, numeric) from public, anon, authenticated;

do $$
declare d text; n text; v_ant text;
begin
  d := pg_get_functiondef('public.cardapio_criar_pedido(uuid,jsonb,jsonb)'::regprocedure);
  n := d;
  -- cardápio ainda não liberado
  n := replace(n, $a$  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then$a$,
    $a$  if coalesce(to_jsonb(v_loja)->>'cardapio_liberado', 'true') = 'false' then
    raise exception 'loja_em_preparacao' using errcode = 'P0001';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then$a$);
  -- bairro fora da lista
  n := replace(n, $a$        from jsonb_array_elements(v_bairros) b where b->>'bairro' = v_bairro limit 1;
      end if;$a$,
    $a$        from jsonb_array_elements(v_bairros) b where b->>'bairro' = v_bairro limit 1;
        if v_valor_bairro is null then raise exception 'entrega_invalida' using errcode = 'P0001'; end if;
      end if;$a$);
  -- dia, horário e antecedência
  n := replace(n, $a$  if exists (
    select 1 from jsonb_array_elements(p_itens) it
    left join produtos pr$a$,
    $a$  if v_data is not null and not public.pedido_data_ok(v_loja, v_data, p_pedido->>'horario_entrega',
       (select max(case when lower(coalesce(pr2.antecedencia, '')) ~ '^\s*\d+\s*h\s*$' then substring(pr2.antecedencia from '\d+')::numeric
                        when lower(coalesce(pr2.antecedencia, '')) ~ '^\s*\d+\s*d\s*$' then substring(pr2.antecedencia from '\d+')::numeric * 24 else 0 end)
          from jsonb_array_elements(p_itens) it2 join produtos pr2 on pr2.id::text = it2->>'produto_id' and pr2.user_id = p_loja)) then
    raise exception 'data_invalida' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_itens) it
    left join produtos pr$a$);
  if n = d or position('loja_em_preparacao' in n) = 0 or position('pedido_data_ok' in n) = 0
     or position('if v_valor_bairro is null then raise' in n) = 0 then
    raise exception 'cardapio_criar_pedido mudou: confira antes de aplicar';
  end if;
  execute n;
end $$;

-- (6.157) peso livre (por kg, sem tamanho e sem kit): o complemento entra uma vez na linha, então no valor_unitario vem
-- dividido pelos kg (o app passou a cobrar o topo uma vez, e não por kg). Aplicado no preco_minimo_item logo depois da
-- conferência dos complementos:
--    if j->>'forma_venda' = 'kg' and not (tamanhos ativos) and not (kit ativo) and quantidade > 0 then
--      extras := extras / quantidade;
--    end if;
