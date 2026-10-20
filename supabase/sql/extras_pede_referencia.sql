-- (19/10) Complemento que pede foto de referência (ex.: Topo de bolo): ao marcar no cardápio, o cliente pode anexar a foto.
-- Função nova (v2) pra não precisar apagar a cardapio_extras: o cardápio usa a v2 e, se não existir, cai na antiga.
alter table public.biblioteca_extras add column if not exists pede_referencia boolean not null default false;
create or replace function public.cardapio_extras_v2(p_loja uuid)
returns table (id uuid, nome text, valor numeric, descricao text, categorias jsonb, pede_referencia boolean)
language sql stable security definer set search_path = public
as $$
  select e.id, e.nome::text, coalesce(e.valor, 0)::numeric, nullif(trim(coalesce(e.descricao, '')), ''),
         coalesce(to_jsonb(e.categorias), '[]'::jsonb), coalesce(e.pede_referencia, false)
  from biblioteca_extras e
  where e.user_id = p_loja
    and exists (select 1 from profiles l where l.id = p_loja and l.codigo_publico is not null)
  order by e.nome
$$;
revoke all on function public.cardapio_extras_v2(uuid) from public;
grant execute on function public.cardapio_extras_v2(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
