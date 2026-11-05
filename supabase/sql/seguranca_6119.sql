-- (6.119) Ajustes de segurança apontados pelo Supabase (já aplicados no banco em 05/11).
alter function public.insumos_marcar_preco() set search_path = public;
-- funções de gatilho não precisam ser chamadas pela API
revoke execute on function public.notify_sugestao_mudou() from public, anon, authenticated;
revoke execute on function public.orcamentos_numero_da_loja() from public, anon, authenticated;
