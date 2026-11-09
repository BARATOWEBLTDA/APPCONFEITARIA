-- (09/11) Notificações da confeiteira: Pix informado pelo cliente e orçamento (pedido pelo link / aprovado / recusado).
-- Já aplicado no Supabase de produção em 09/11. As "entregas de hoje" e "pedido atrasado" são criadas pelo app (lib/notifConfeiteira.ts).
create or replace function public.notif_pix_informado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pix_informado_em is null or (old.pix_informado_em is not null and old.pix_informado_em = new.pix_informado_em) then return new; end if;
  insert into public.notificacoes (user_id, tipo, titulo, mensagem, link, chave)
  values (new.user_id, 'pix', 'Pix pra conferir',
          'O cliente avisou que pagou' || case when coalesce(new.pix_informado_valor,0) > 0 then ' R$ ' || replace(to_char(new.pix_informado_valor, 'FM999G990D00'), '.', ',') else '' end || '. Confira e confirme.',
          '/pedidos/' || new.id || '/editar', 'pix-' || new.id || '-' || extract(epoch from new.pix_informado_em)::bigint)
  on conflict do nothing;
  return new;
exception when others then return new;
end $$;
drop trigger if exists trg_notif_pix_informado on public.pedidos;
create trigger trg_notif_pix_informado after update of pix_informado_em on public.pedidos
  for each row execute function public.notif_pix_informado();

create or replace function public.notif_orcamento() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_t text; v_ch text;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.origem, '') <> 'link' then return new; end if;
    v_t := 'Pedido de orçamento'; v_ch := 'orc-novo-' || new.id;
  else
    if new.status is not distinct from old.status or new.status not in ('aprovado', 'recusado') then return new; end if;
    v_t := case when new.status = 'aprovado' then 'Orçamento aprovado' else 'Orçamento recusado' end;
    v_ch := 'orc-' || new.status || '-' || new.id;
  end if;
  insert into public.notificacoes (user_id, tipo, titulo, mensagem, link, chave)
  values (new.user_id, 'orcamento', v_t, coalesce(nullif(trim(new.cliente_nome), ''), 'Um cliente'), '/orcamentos/' || new.id, v_ch)
  on conflict do nothing;
  return new;
exception when others then return new;
end $$;
drop trigger if exists trg_notif_orcamento_ins on public.orcamentos;
create trigger trg_notif_orcamento_ins after insert on public.orcamentos for each row execute function public.notif_orcamento();
drop trigger if exists trg_notif_orcamento_upd on public.orcamentos;
create trigger trg_notif_orcamento_upd after update of status on public.orcamentos for each row execute function public.notif_orcamento();
-- notif_enviar_push passou a enviar também 'pix' e 'orcamento' (ver push_pessoal.sql)
