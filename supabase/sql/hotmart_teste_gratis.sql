-- (31/10 · 5.97) PRO com 7 dias grátis na Hotmart: quem começa o teste antes de criar a conta
-- (evento "teste_sem_conta") ganha o PRO do teste no cadastro, com o status "teste".
create or replace function public.hotmart_aplicar_pendente()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  v_email text;
  v_ev    record;
begin
  select email into v_email from auth.users where id = new.id;
  if v_email is null then return new; end if;

  select * into v_ev from public.hotmart_eventos
  where lower(email) = lower(v_email) and resultado in ('sem_conta', 'teste_sem_conta') and pro_expira_em > now()
  order by pro_expira_em desc, recebido_em desc limit 1;

  if found then
    update public.profiles
      set plano = 'pro', pro_expira_em = v_ev.pro_expira_em,
          assinatura_origem = 'hotmart',
          assinatura_status = case when v_ev.resultado = 'teste_sem_conta' then 'teste' else 'ativa' end,
          hotmart_assinante = v_ev.assinante, hotmart_transacao = v_ev.transacao
      where id = new.id;
    update public.hotmart_eventos set resultado = 'pro_ativado_no_cadastro', user_id = new.id where id = v_ev.id;
  end if;
  return new;
end $function$;
