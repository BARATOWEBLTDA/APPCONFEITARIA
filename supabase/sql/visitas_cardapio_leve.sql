-- (11/11) Visitas do cardápio: a tela Métricas baixava cada visita (uma linha por visita) para contar no celular.
-- Agora o banco devolve os totais por hora dos últimos 60 dias (no máximo 1.440 linhas, seja qual for o movimento).
create or replace function public.cardapio_visitas_por_hora(p_dias int default 60)
returns table (hora timestamptz, n int)
language sql stable security invoker set search_path = public
as $$
  select date_trunc('hour', created_at) as hora, count(*)::int as n
    from public.cardapio_visitas
   where user_id = auth.uid()
     and created_at >= now() - make_interval(days => least(greatest(coalesce(p_dias, 60), 1), 90))
   group by 1
   order by 1
$$;
grant execute on function public.cardapio_visitas_por_hora(int) to authenticated;

-- índice certo para "visitas desta loja a partir de tal data"
create index if not exists idx_cardapio_visitas_user_criado on public.cardapio_visitas (user_id, created_at);

-- (11/11) Limpeza: visita com mais de 90 dias sai do banco todo dia às 3h (a tela usa no máximo 60 dias)
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'limpar-visitas-cardapio';
select cron.schedule('limpar-visitas-cardapio', '0 6 * * *', $$delete from public.cardapio_visitas where created_at < now() - interval '90 days'$$);
