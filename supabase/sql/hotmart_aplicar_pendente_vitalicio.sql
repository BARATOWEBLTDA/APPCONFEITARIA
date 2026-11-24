-- (24/11) Hotmart vitalício: ao criar conta, pessoa que comprou o Doonly vitalício
-- antes do cadastro ganha PRO pra sempre (pro_expira_em = NULL).
-- Mantém os casos já existentes (sem_conta / teste_sem_conta).
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

  -- Procura evento pendente: vitalício primeiro (não expira), depois assinatura ainda válida
  select * into v_ev from public.hotmart_eventos
  where lower(email) = lower(v_email)
    and resultado in ('sem_conta', 'teste_sem_conta', 'vitalicio_sem_conta')
    and (resultado = 'vitalicio_sem_conta' or pro_expira_em > now())
  order by
    case when resultado = 'vitalicio_sem_conta' then 0 else 1 end,  -- vitalício vence
    pro_expira_em desc nulls first,
    recebido_em desc
  limit 1;

  if found then
    update public.profiles
      set plano = 'pro',
          pro_expira_em = case when v_ev.resultado = 'vitalicio_sem_conta' then null else v_ev.pro_expira_em end,
          assinatura_origem = 'hotmart',
          assinatura_status = case
            when v_ev.resultado = 'vitalicio_sem_conta' then 'vitalicia'
            when v_ev.resultado = 'teste_sem_conta' then 'teste'
            else 'ativa'
          end,
          hotmart_assinante = v_ev.assinante,
          hotmart_transacao = v_ev.transacao
      where id = new.id;
    update public.hotmart_eventos
      set resultado = case
        when v_ev.resultado = 'vitalicio_sem_conta' then 'vitalicio_ativado_no_cadastro'
        else 'pro_ativado_no_cadastro'
      end, user_id = new.id
      where id = v_ev.id;
  end if;
  return new;
end $function$;
