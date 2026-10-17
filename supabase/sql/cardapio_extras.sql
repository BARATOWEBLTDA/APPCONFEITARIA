-- ═══════════════════════════════════════════════════════════════
-- Complementos no cardápio do cliente (02/10, revisado 17/10 · BUG-005)
-- O cardápio é aberto por clientes SEM login. A tabela biblioteca_extras só deixa a própria
-- confeiteira ler os itens dela, então pro cliente a lista vinha vazia (sem erro nenhum).
-- Esta função entrega só o que o cardápio precisa: nome, valor, descrição e os produtos de cada item,
-- e só de loja com cardápio publicado (mesma regra de cardapio_produtos).
-- Só leitura. Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
drop function if exists public.cardapio_extras(uuid);

create function public.cardapio_extras(p_loja uuid)
returns table (id uuid, nome text, valor numeric, descricao text, categorias jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.nome::text, coalesce(e.valor, 0)::numeric, nullif(trim(coalesce(e.descricao, '')), ''),
         coalesce(to_jsonb(e.categorias), '[]'::jsonb)
  from biblioteca_extras e
  where e.user_id = p_loja
    and exists (select 1 from profiles l where l.id = p_loja and l.codigo_publico is not null)
  order by e.nome
$$;

revoke all on function public.cardapio_extras(uuid) from public;
grant execute on function public.cardapio_extras(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
