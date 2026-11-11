-- (10/11) Ideias: o admin marca "Recusada", mas o banco só aceitava recebida/em_analise/planejada/implementada/nao_prevista.
-- Marcar como recusada dava erro e a confeiteira não recebia o aviso. Agora "recusada" vale.
alter table public.sugestoes drop constraint if exists sugestoes_status_check;
alter table public.sugestoes add constraint sugestoes_status_check
  check (status = any (array['recebida','em_analise','planejada','implementada','nao_prevista','recusada']));

-- (10/11) Ideia já respondida (com recado) não conta mais como "nova" no Painel do admin.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.admin_painel'::regproc);
  d := replace(d,
    '(select count(*) from sugestoes where status is null or status = ''recebida'')',
    '(select count(*) from sugestoes where (status is null or status = ''recebida'') and nullif(btrim(coalesce(resposta, '''')), '''') is null)');
  execute d;
end $$;
