-- ═══════════════════════════════════════════════════════════════
-- Limite diário da IA (17/10 · R05)
-- Descrição com IA: 100 por dia (grátis e PRO). Alto pra uso normal, mas trava quem chamar sem parar.
-- Os outros limites continuam: chat 150/dia (PRO), imagem 20/dia (PRO), buscar imagem 100/dia.
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.ia_usar(p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_pro boolean;
  v_limite int;
  v_qtd int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'erro', 'sem_login'); end if;
  v_pro := public.conta_eh_pro(v_user) or public.eh_admin();
  v_limite := case p_tipo
    when 'chat' then case when v_pro then 150 else 0 end
    when 'imagem' then case when v_pro then 20 else 0 end
    when 'descricao' then 100
    when 'buscar_imagem' then 100
    else 30 end;
  insert into ia_uso (user_id, dia, tipo, qtd) values (v_user, v_hoje, p_tipo, 1)
  on conflict (user_id, dia, tipo) do update set qtd = ia_uso.qtd + 1
  where ia_uso.qtd < v_limite
  returning qtd into v_qtd;
  if v_qtd is null then
    return jsonb_build_object('ok', false, 'erro', 'limite', 'limite', v_limite);
  end if;
  if v_qtd > v_limite then
    update ia_uso set qtd = qtd - 1 where user_id = v_user and dia = v_hoje and tipo = p_tipo;
    return jsonb_build_object('ok', false, 'erro', 'limite', 'limite', v_limite);
  end if;
  return jsonb_build_object('ok', true, 'usados', v_qtd, 'limite', v_limite);
end $function$;
