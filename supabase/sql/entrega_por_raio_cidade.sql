-- (28/10 · 4.49) Taxa de entrega por raio (km) e por cidade, além da taxa única e da por bairro.
-- profiles: modo escolhido, faixas de raio, lista de cidades, valor fora da área e o ponto da loja no mapa.
-- O ponto da loja NÃO vai pro cardápio (a loja pode esconder o endereço): o cardápio pergunta a taxa
-- pra função cardapio_taxa_entrega, que devolve só o valor e os km.

alter table public.profiles
  add column if not exists entrega_modo text,                                   -- 'fixa' | 'bairro' | 'raio' | 'cidade' (vazio = como antes)
  add column if not exists entrega_por_raio jsonb not null default '[]'::jsonb, -- [{ "km": 3, "valor": 6 }, ...]
  add column if not exists entrega_por_cidade jsonb not null default '[]'::jsonb, -- [{ "cidade": "Curitiba", "valor": 8 }, ...]
  add column if not exists entrega_fora_valor numeric,                          -- fora do último raio / outra cidade (vazio = não entrega)
  add column if not exists loja_lat double precision,
  add column if not exists loja_lng double precision;

-- distância em linha reta entre dois pontos (km)
create or replace function public.distancia_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns numeric language sql immutable as $$
  select round((6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::numeric, 2)
$$;

-- taxa de uma loja para um ponto (raio) ou uma cidade. Devolve { ok, valor, km } ou { ok: false, erro }
create or replace function public.taxa_entrega_da_loja(v_loja profiles, p_lat float8, p_lng float8, p_cidade text)
returns jsonb language plpgsql stable as $$
declare
  v_modo text := coalesce(nullif(v_loja.entrega_modo, ''),
    case when jsonb_typeof(v_loja.entrega_por_bairro) = 'array' and jsonb_array_length(v_loja.entrega_por_bairro) > 0 then 'bairro' else 'fixa' end);
  v_dist numeric;
  v_valor numeric;
begin
  if v_modo = 'raio' then
    if p_lat is null or p_lng is null then return jsonb_build_object('ok', false, 'erro', 'sem_local'); end if;
    if v_loja.loja_lat is null or v_loja.loja_lng is null then return jsonb_build_object('ok', false, 'erro', 'loja_sem_local'); end if;
    v_dist := public.distancia_km(v_loja.loja_lat, v_loja.loja_lng, p_lat, p_lng);
    select (f->>'valor')::numeric into v_valor
      from jsonb_array_elements(coalesce(v_loja.entrega_por_raio, '[]'::jsonb)) f
     where nullif(f->>'km', '')::numeric >= v_dist and coalesce((f->>'ativo')::boolean, true) -- (28/10) faixa desmarcada não vale
     order by nullif(f->>'km', '')::numeric limit 1;
    if v_valor is null then v_valor := v_loja.entrega_fora_valor; end if;
    if v_valor is null then return jsonb_build_object('ok', false, 'erro', 'fora_area', 'km', v_dist); end if;
    return jsonb_build_object('ok', true, 'valor', greatest(0, v_valor), 'km', v_dist, 'modo', v_modo);
  elsif v_modo = 'cidade' then
    select (c->>'valor')::numeric into v_valor
      from jsonb_array_elements(coalesce(v_loja.entrega_por_cidade, '[]'::jsonb)) c
     where coalesce((c->>'ativo')::boolean, true)
       and translate(lower(trim(c->>'cidade')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
         = translate(lower(trim(coalesce(p_cidade, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') limit 1;
    if v_valor is null then v_valor := v_loja.entrega_fora_valor; end if;
    if v_valor is null then return jsonb_build_object('ok', false, 'erro', 'fora_area'); end if;
    return jsonb_build_object('ok', true, 'valor', greatest(0, v_valor), 'modo', v_modo);
  end if;
  return jsonb_build_object('ok', true, 'valor', greatest(0, coalesce(v_loja.valor_entrega_propria, 0)), 'modo', v_modo);
end $$;

-- o cardápio pergunta a taxa (sem ver o ponto da loja)
create or replace function public.cardapio_taxa_entrega(p_loja uuid, p_lat float8, p_lng float8, p_cidade text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_loja profiles;
begin
  select * into v_loja from profiles where id = p_loja and codigo_publico is not null;
  if not found then return jsonb_build_object('ok', false, 'erro', 'loja_invalida'); end if;
  return public.taxa_entrega_da_loja(v_loja, p_lat, p_lng, p_cidade);
end $$;
grant execute on function public.cardapio_taxa_entrega(uuid, float8, float8, text) to anon, authenticated;

-- o ponto da loja não sai pelo cardápio
create or replace function public.cardapio_loja(p_chave text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select (to_jsonb(p)
    - 'is_admin' - 'hotmart_assinante' - 'hotmart_transacao' - 'assinatura_status' - 'assinatura_origem'
    - 'indicado_por' - 'codigo_indicacao' - 'desconto_primeiro_mes' - 'confeiteira_destaque'
    - 'welcome_email_sent_at' - 'caixa_saldo_inicial' - 'caixa_inicio_em' - 'meta_mensal'
    - 'onboarding_trabalha_confeitaria' - 'onboarding_insumo' - 'onboarding_receita'
    - 'tutorial_visto' - 'tour_visto' - 'cupons_desconto' - 'mensagens_whatsapp' - 'custos_invisiveis_pct'
    - 'endereco' - 'loja_lat' - 'loja_lng')
    || jsonb_build_object(
         'endereco', case when coalesce(p.mostrar_localizacao, false) or coalesce(p.mostrar_apenas_cidade, false) then to_jsonb(p) -> 'endereco' end,
         'mensagens_whatsapp', jsonb_build_object('pedido_cardapio', to_jsonb(p) -> 'mensagens_whatsapp' -> 'pedido_cardapio'))
  from profiles p
  where p.codigo_publico is not null
    and (lower(p.codigo_publico) = lower(trim(p_chave)) or p.id::text = trim(p_chave))
  limit 1
$function$;

-- criar pedido pelo cardápio: a taxa por raio/cidade é refeita aqui (o mesmo cálculo da função acima)
do $patch$
declare d text;
begin
  d := pg_get_functiondef('public.cardapio_criar_pedido(uuid,jsonb,jsonb)'::regprocedure);
  if position('taxa_entrega_da_loja' in d) > 0 then return; end if; -- já aplicado
  d := replace(d, $a$      v_bairros := coalesce(to_jsonb(v_loja)->'entrega_por_bairro', '[]'::jsonb);
      if jsonb_typeof(v_bairros) = 'array' and jsonb_array_length(v_bairros) > 0 then$a$,
$b$      v_bairros := coalesce(to_jsonb(v_loja)->'entrega_por_bairro', '[]'::jsonb);
      -- (28/10) por raio ou por cidade
      if coalesce(v_loja.entrega_modo, '') in ('raio', 'cidade') then
        declare v_r jsonb; v_la float8; v_lo float8;
        begin
          begin
            v_la := nullif(p_pedido->>'cliente_lat', '')::float8; v_lo := nullif(p_pedido->>'cliente_lng', '')::float8;
          exception when others then v_la := null; v_lo := null;
          end;
          v_r := public.taxa_entrega_da_loja(v_loja, v_la, v_lo, p_pedido->>'endereco_cidade');
          if not coalesce((v_r->>'ok')::boolean, false) then
            raise exception 'entrega_fora_area' using errcode = 'P0001', detail = coalesce(v_r->>'erro', 'fora_area');
          end if;
          v_valor_bairro := (v_r->>'valor')::numeric;
        end;
      elsif jsonb_typeof(v_bairros) = 'array' and jsonb_array_length(v_bairros) > 0 and coalesce(v_loja.entrega_modo, 'bairro') = 'bairro' then$b$);
  if position('taxa_entrega_da_loja' in d) = 0 then raise exception 'não achei o trecho da taxa na função cardapio_criar_pedido'; end if;
  execute d;
end $patch$;

notify pgrst, 'reload schema';
