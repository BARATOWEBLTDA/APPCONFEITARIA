-- (31/10 · 5.84) Complementos é recurso PRO: no cardápio só aparecem quando a loja é PRO.
-- Rodar no SQL Editor do Supabase. Não apaga nada: quem assinar o PRO volta a ver os complementos.
CREATE OR REPLACE FUNCTION public.cardapio_extras_v4(p_loja uuid)
 RETURNS TABLE(id uuid, nome text, valor numeric, descricao text, categorias jsonb, pede_referencia boolean, categorias_cardapio jsonb, pede_frase boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.id, e.nome::text, coalesce(e.valor, 0)::numeric, nullif(trim(coalesce(e.descricao, '')), ''),
         coalesce(to_jsonb(e.categorias), '[]'::jsonb), coalesce(e.pede_referencia, false),
         coalesce(to_jsonb(e.categorias_cardapio), '[]'::jsonb), coalesce(e.pede_frase, false)
  from biblioteca_extras e
  where e.user_id = p_loja
    and exists (select 1 from profiles l where l.id = p_loja and l.codigo_publico is not null
                and l.plano = 'pro' and (l.pro_expira_em is null or l.pro_expira_em > now()))
  order by e.nome
$function$;
