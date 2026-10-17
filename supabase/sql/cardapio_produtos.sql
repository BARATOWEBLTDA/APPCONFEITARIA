-- ═══════════════════════════════════════════════════════════════
-- Cardápio público: produtos e categorias para quem NÃO está logado (17/10)
--
-- Problema: a regra de acesso de "produtos" e "categorias" confere se a loja está publicada
-- lendo "profiles", que o visitante não pode ler. Resultado: o cardápio aparecia vazio
-- para clientes sem login (a dona, logada, via normalmente).
--
-- Correção: duas funções seguras que entregam só o que o cardápio precisa, já filtrado
-- (loja publicada + produto disponível). Os campos internos da ficha técnica
-- (custo, salário desejado, horas, % de custos invisíveis, tempo de preparo,
-- observações, rendimento, validade, embalagem, SKU) NÃO saem daqui.
--
-- As regras antigas de "produtos"/"categorias" continuam como estão (não abrem nada novo).
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.cardapio_produtos(p_loja uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           to_jsonb(p)
             - 'custo_producao' - 'salario_desejado' - 'horas_semanais' - 'cv_percentual'
             - 'tempo_preparo_min' - 'observacoes_ficha' - 'rendimento_qtd' - 'rendimento_peso'
             - 'validade_dias' - 'validade_tipo' - 'embalagem' - 'sku'
           order by p.created_at desc), '[]'::jsonb)
  from produtos p
  where p.user_id = p_loja
    and p.disponivel = true
    and exists (select 1 from profiles l where l.id = p_loja and l.codigo_publico is not null)
$$;

create or replace function public.cardapio_categorias(p_loja uuid)
returns table (nome text, imagem_url text)
language sql
stable
security definer
set search_path = public
as $$
  select c.nome, c.imagem_url
  from categorias c
  where c.user_id = p_loja
    and exists (select 1 from profiles l where l.id = p_loja and l.codigo_publico is not null)
  order by c.ordem, c.nome
$$;

revoke all on function public.cardapio_produtos(uuid) from public;
revoke all on function public.cardapio_categorias(uuid) from public;
grant execute on function public.cardapio_produtos(uuid) to anon, authenticated;
grant execute on function public.cardapio_categorias(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
