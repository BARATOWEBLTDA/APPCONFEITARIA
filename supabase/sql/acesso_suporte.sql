-- (11/11) Acesso de suporte: a equipe Doonly pede acesso, a confeiteira aprova no app (7 dias), tudo fica registrado.
-- Nada de senha: quem entra na loja é a função suporte-acesso (servidor), só com o acesso aprovado e dentro do prazo.

create table if not exists public.acessos_suporte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- a loja
  pedido_por text not null,                                          -- e-mail de quem pediu (equipe Doonly)
  motivo text not null default 'Personalizar seu cardápio',
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'revogado', 'cancelado')),
  pedido_em timestamptz not null default now(),
  respondido_em timestamptz,
  expira_em timestamptz,
  ultimo_acesso_em timestamptz
);
create index if not exists acessos_suporte_user_idx on public.acessos_suporte (user_id, pedido_em desc);

create table if not exists public.acessos_suporte_log (
  id uuid primary key default gen_random_uuid(),
  acesso_id uuid not null references public.acessos_suporte(id) on delete cascade,
  user_id uuid not null,
  evento text not null check (evento in ('pedido', 'aprovado', 'recusado', 'entrou', 'saiu', 'revogado', 'venceu')),
  em timestamptz not null default now()
);
create index if not exists acessos_suporte_log_idx on public.acessos_suporte_log (user_id, em desc);

alter table public.acessos_suporte enable row level security;
alter table public.acessos_suporte_log enable row level security;

-- a confeiteira vê os pedidos e o histórico da própria loja (quem escreve é o servidor ou as funções abaixo)
drop policy if exists acessos_suporte_dona_le on public.acessos_suporte;
create policy acessos_suporte_dona_le on public.acessos_suporte for select to authenticated using (user_id = auth.uid());
drop policy if exists acessos_suporte_log_dona_le on public.acessos_suporte_log;
create policy acessos_suporte_log_dona_le on public.acessos_suporte_log for select to authenticated using (user_id = auth.uid());

-- responder o pedido (Permitir por 7 dias / Recusar)
create or replace function public.responder_acesso_suporte(p_id uuid, p_permitir boolean)
returns public.acessos_suporte language plpgsql security definer set search_path = public as $$
declare r public.acessos_suporte;
begin
  update public.acessos_suporte
     set status = case when p_permitir then 'aprovado' else 'recusado' end,
         respondido_em = now(),
         expira_em = case when p_permitir then now() + interval '7 days' else null end
   where id = p_id and user_id = auth.uid() and status = 'pendente'
  returning * into r;
  if r.id is null then raise exception 'pedido_nao_encontrado'; end if;
  insert into public.acessos_suporte_log (acesso_id, user_id, evento) values (r.id, r.user_id, case when p_permitir then 'aprovado' else 'recusado' end);
  return r;
end $$;

-- tirar o acesso antes do prazo
create or replace function public.revogar_acesso_suporte(p_id uuid)
returns public.acessos_suporte language plpgsql security definer set search_path = public as $$
declare r public.acessos_suporte;
begin
  update public.acessos_suporte set status = 'revogado', expira_em = now()
   where id = p_id and user_id = auth.uid() and status = 'aprovado'
  returning * into r;
  if r.id is null then raise exception 'acesso_nao_encontrado'; end if;
  insert into public.acessos_suporte_log (acesso_id, user_id, evento) values (r.id, r.user_id, 'revogado');
  return r;
end $$;

revoke all on function public.responder_acesso_suporte(uuid, boolean) from public, anon;
revoke all on function public.revogar_acesso_suporte(uuid) from public, anon;
grant execute on function public.responder_acesso_suporte(uuid, boolean) to authenticated;
grant execute on function public.revogar_acesso_suporte(uuid) to authenticated;

-- o pedido de acesso também chega como aviso no celular
create or replace function public.notif_enviar_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if new.user_id is null or coalesce(new.tipo, '') not in ('pedido', 'pix', 'orcamento', 'pro', 'pro_vencendo', 'pro_atrasado', 'sugestao', 'suporte') then return new; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_pessoal_secret';
  perform net.http_post(
    url     := 'https://epixsranjplmltzmdsbo.supabase.co/functions/v1/push-pessoal',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('id', new.id)
  );
  return new;
exception when others then return new;
end $$;
