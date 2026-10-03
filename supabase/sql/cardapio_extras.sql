-- ═══════════════════════════════════════════════════════════════
-- Personalização no cardápio do cliente (02/10)
-- O cardápio é aberto por clientes SEM login. A tabela biblioteca_extras só deixa a própria
-- confeiteira ler os itens dela, então pro cliente a lista vinha vazia (sem erro nenhum).
-- Esta função entrega só o que o cardápio precisa: nome, valor e os produtos de cada item.
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.cardapio_extras(p_loja uuid)
returns table (id uuid, nome text, valor numeric, categorias jsonb)
language sql security definer set search_path = public as $$
  select e.id, e.nome::text, coalesce(e.valor, 0)::numeric, to_jsonb(e.categorias) -- funciona com lista de texto ou JSON
  from biblioteca_extras e
  where e.user_id = p_loja
  order by e.nome
$$;

grant execute on function public.cardapio_extras(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
