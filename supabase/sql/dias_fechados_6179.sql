-- (6.179) modo férias e dias fechados (feriado): períodos em que a loja não entrega nem retira
-- profiles.dias_fechados = [{ "inicio": "2026-12-20", "fim": "2027-01-05", "tipo": "ferias" | "feriado", "nome": "Natal" }]
-- O cardápio risca esses dias; o banco recusa pedido para eles (pedido_data_ok → data_fechada).
alter table public.profiles add column if not exists dias_fechados jsonb not null default '[]'::jsonb;

create or replace function public.data_fechada(v_loja profiles, p_data date)
 returns boolean language sql stable set search_path to 'public' as $function$
  select exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(to_jsonb(v_loja)->'dias_fechados') = 'array' then to_jsonb(v_loja)->'dias_fechados' else '[]'::jsonb end) e
    where nullif(e->>'inicio', '') is not null
      and p_data between (e->>'inicio')::date and coalesce(nullif(e->>'fim', '')::date, (e->>'inicio')::date))
$function$;

do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.pedido_data_ok(profiles,date,text,numeric)'::regprocedure);
  if position('data_fechada' in d) > 0 then return; end if;
  n := replace(d, '  if p_data is null then return true; end if;',
    '  if p_data is null then return true; end if;' || chr(10) || '  if public.data_fechada(v_loja, p_data) then return false; end if; -- (6.179) férias ou feriado fechado');
  if n = d then raise exception 'pedido_data_ok mudou: confira antes de aplicar'; end if;
  execute n;
end $$;
