-- ═══════════════════════════════════════════════════════════════════════
-- Notificações pessoais + leitura na conta + conquistas  (30/09)
-- Rodar UMA vez no SQL Editor ANTES do deploy. Pode rodar de novo.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Notificações: agora podem ser de uma confeiteira só (user_id) ou de todas (user_id vazio)
alter table public.notificacoes add column if not exists user_id    uuid references auth.users(id) on delete cascade;
alter table public.notificacoes add column if not exists tipo       text;   -- aviso | noticia | pedido | pro | pro_vencendo | pro_atrasado | conquista
alter table public.notificacoes add column if not exists link       text;   -- pra onde leva ao tocar
alter table public.notificacoes add column if not exists chave      text;   -- evita repetir a mesma notificação
create unique index if not exists notificacoes_user_chave_uk on public.notificacoes(user_id, chave) where chave is not null;
create index if not exists notificacoes_user_idx on public.notificacoes(user_id, created_at desc);

alter table public.notificacoes enable row level security;
drop policy if exists "notif_select" on public.notificacoes;
create policy "notif_select" on public.notificacoes for select to authenticated
  using (user_id is null or user_id = auth.uid());
drop policy if exists "notif_insert_propria" on public.notificacoes;
create policy "notif_insert_propria" on public.notificacoes for insert to authenticated
  with check (user_id = auth.uid() or (auth.jwt() ->> 'email') = 'gestao@doonly.com.br');
drop policy if exists "notif_admin_all" on public.notificacoes;
create policy "notif_admin_all" on public.notificacoes for all to authenticated
  using ((auth.jwt() ->> 'email') = 'gestao@doonly.com.br')
  with check ((auth.jwt() ->> 'email') = 'gestao@doonly.com.br');

-- 2) Lida / excluída — guardado na conta (vale no celular e no computador)
create table if not exists public.notificacoes_estado (
  user_id         uuid not null references auth.users(id) on delete cascade,
  notificacao_id  uuid not null references public.notificacoes(id) on delete cascade,
  lida_em         timestamptz,
  excluida        boolean not null default false,
  primary key (user_id, notificacao_id)
);
alter table public.notificacoes_estado enable row level security;
drop policy if exists "notif_estado_propria" on public.notificacoes_estado;
create policy "notif_estado_propria" on public.notificacoes_estado for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Novo pedido → notificação pra confeiteira
create or replace function public.notif_novo_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cliente text;
begin
  -- Só pedidos que chegam pelo cardápio (os que ela mesma lança não precisam de aviso)
  if coalesce(new.origem, 'cardapio') <> 'cardapio' then return new; end if;
  select nome into v_cliente from public.clientes where id = new.cliente_id;
  insert into public.notificacoes (user_id, tipo, titulo, mensagem, link, chave)
  values (new.user_id, 'pedido', 'Novo pedido! 🛍️',
          coalesce(v_cliente, 'Um cliente') || ' fez um pedido' ||
            case when coalesce(new.valor_total, 0) > 0 then ' de R$ ' || replace(to_char(new.valor_total, 'FM999G990D00'), '.', ',') else '' end || '.',
          '/pedidos', 'pedido-' || new.id)
  on conflict do nothing;
  return new;
exception when others then return new;  -- nunca impede o pedido de ser salvo
end $$;
drop trigger if exists trg_notif_novo_pedido on public.pedidos;
create trigger trg_notif_novo_pedido after insert on public.pedidos
  for each row execute function public.notif_novo_pedido();

-- 4) PRO ativado → notificação
create or replace function public.notif_pro_ativado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plano = 'pro' and coalesce(old.plano, '') <> 'pro' then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link, chave)
    values (new.id, 'pro', 'Bem-vinda ao PRO! 👑',
            'Seu assistente virtual, as fotos extras e todos os recursos PRO já estão liberados.',
            '/assistente-virtual', 'pro-ativado-' || to_char(now(), 'YYYYMMDD'))
    on conflict do nothing;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists trg_notif_pro_ativado on public.profiles;
create trigger trg_notif_pro_ativado after update of plano on public.profiles
  for each row execute function public.notif_pro_ativado();

-- 5) Conquistas da confeiteira (guardadas pra não sumirem)
create table if not exists public.conquistas_usuario (
  user_id         uuid not null references auth.users(id) on delete cascade,
  codigo          text not null,
  conquistada_em  timestamptz not null default now(),
  vista           boolean not null default false,  -- fechou o cartão do Início
  celebrada       boolean not null default false,  -- já viu a comemoração
  primary key (user_id, codigo)
);
alter table public.conquistas_usuario enable row level security;
drop policy if exists "conquistas_propria" on public.conquistas_usuario;
create policy "conquistas_propria" on public.conquistas_usuario for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
