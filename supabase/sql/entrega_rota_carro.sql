-- (29/10 · 5.10) Taxa por raio pelo CAMINHO DE CARRO (antes: linha reta, que cobrava a menos).
-- A distância vem do OpenRouteService (grátis: 2.000 rotas por dia), chamado AQUI no banco: a cliente não manda os km,
-- então não dá para burlar a taxa. Cada endereço é consultado uma vez (guardado em rota_cache por 180 dias).
-- Sem a chave, sem internet ou passando do limite do dia: usa a linha reta + 30% (fica perto do caminho real).
-- A chave fica no Vault do Supabase com o nome 'ors_api_key':
--   select vault.create_secret('SUA_CHAVE_AQUI', 'ors_api_key');

create extension if not exists http with schema extensions;

create table if not exists public.rota_cache (
  loja_id uuid not null,
  lat4 numeric not null,       -- ponto da cliente, arredondado (~10 m)
  lng4 numeric not null,
  km numeric not null,
  criado_em timestamptz not null default now(),
  primary key (loja_id, lat4, lng4)
);
alter table public.rota_cache enable row level security; -- sem políticas: só as funções abaixo leem e gravam
revoke all on public.rota_cache from anon, authenticated;

-- km de carro da loja até o ponto (null = não deu; quem chama usa a linha reta + 30%)
create or replace function public.rota_km(p_loja uuid, lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns numeric language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_la numeric := round(lat2::numeric, 4);
  v_lo numeric := round(lng2::numeric, 4);
  v_km numeric; v_chave text; v_resp extensions.http_response; v_m numeric;
begin
  if lat1 is null or lng1 is null or lat2 is null or lng2 is null then return null; end if;
  select km into v_km from rota_cache where loja_id = p_loja and lat4 = v_la and lng4 = v_lo and criado_em > now() - interval '180 days';
  if found then return v_km; end if;
  begin
    select decrypted_secret into v_chave from vault.decrypted_secrets where name = 'ors_api_key' limit 1;
  exception when others then v_chave := null;
  end;
  if coalesce(v_chave, '') = '' then return null; end if;
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '3500');
    v_resp := extensions.http_get('https://api.openrouteservice.org/v2/directions/driving-car?api_key=' || v_chave
      || '&start=' || lng1::text || ',' || lat1::text || '&end=' || lng2::text || ',' || lat2::text);
    if v_resp.status = 200 then
      v_m := ((v_resp.content::jsonb) -> 'features' -> 0 -> 'properties' -> 'summary' ->> 'distance')::numeric;
    end if;
  exception when others then v_m := null;
  end;
  if v_m is null then return null; end if;
  v_km := round(v_m / 1000.0, 2);
  insert into rota_cache (loja_id, lat4, lng4, km) values (p_loja, v_la, v_lo, v_km)
    on conflict (loja_id, lat4, lng4) do update set km = excluded.km, criado_em = now();
  return v_km;
end $$;
revoke execute on function public.rota_km(uuid, float8, float8, float8, float8) from public, anon, authenticated;

-- a taxa por raio passa a usar o caminho de carro (e a reta + 30% quando a rota não vem)
do $patch$
declare d text;
begin
  d := pg_get_functiondef('public.taxa_entrega_da_loja(profiles,float8,float8,text)'::regprocedure);
  if position('rota_km' in d) = 0 then
    d := replace(d, 'v_dist := public.distancia_km(v_loja.loja_lat, v_loja.loja_lng, p_lat, p_lng);',
      'v_dist := coalesce(public.rota_km(v_loja.id, v_loja.loja_lat, v_loja.loja_lng, p_lat, p_lng), round(public.distancia_km(v_loja.loja_lat, v_loja.loja_lng, p_lat, p_lng) * 1.3, 2));');
    if position('rota_km' in d) = 0 then raise exception 'não achei a conta da distância em taxa_entrega_da_loja'; end if;
    d := replace(d, ' STABLE', ' VOLATILE');
    execute d;
  end if;
end $patch$;
alter function public.taxa_entrega_da_loja(profiles, float8, float8, text) volatile;
alter function public.cardapio_taxa_entrega(uuid, float8, float8, text) volatile;

-- a confeiteira, ao lançar um pedido com entrega (Nova venda / Editar pedido), vê a mesma taxa do cardápio
create or replace function public.minha_taxa_entrega(p_lat float8, p_lng float8, p_cidade text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_loja profiles;
begin
  select * into v_loja from profiles where id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'erro', 'loja_invalida'); end if;
  return public.taxa_entrega_da_loja(v_loja, p_lat, p_lng, p_cidade);
end $$;
revoke execute on function public.minha_taxa_entrega(float8, float8, text) from public, anon;
grant execute on function public.minha_taxa_entrega(float8, float8, text) to authenticated;

notify pgrst, 'reload schema';
