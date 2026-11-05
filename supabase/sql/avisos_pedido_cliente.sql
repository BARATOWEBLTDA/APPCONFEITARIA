-- (6.119) Avisos do pedido no celular do CLIENTE: ele liga no "Acompanhar o pedido" e recebe quando o pedido anda.
-- Precisa da função push-cliente publicada (supabase/functions/push-cliente) e usa o mesmo segredo do push-pessoal.
create table if not exists public.cliente_push (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (pedido_id, endpoint)
);
alter table public.cliente_push enable row level security;
-- sem políticas: só as funções abaixo (e a função do servidor, com a chave de serviço) mexem aqui
create index if not exists cliente_push_pedido_idx on public.cliente_push (pedido_id);

create or replace function public.cardapio_avisos_pedido(p_pedido uuid, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = public as $$
declare st text; criado timestamptz;
begin
  if p_pedido is null or coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then return false; end if;
  select status, created_at into st, criado from pedidos where id = p_pedido;
  if st is null or st in ('entregue', 'concluido', 'cancelado', 'recusado') or criado < now() - interval '60 days' then return false; end if;
  if (select count(*) from cliente_push where pedido_id = p_pedido) >= 5
     and not exists (select 1 from cliente_push where pedido_id = p_pedido and endpoint = p_endpoint) then return false; end if;
  insert into cliente_push (pedido_id, endpoint, p256dh, auth) values (p_pedido, p_endpoint, p_p256dh, p_auth)
  on conflict (pedido_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
  return true;
end $$;
revoke all on function public.cardapio_avisos_pedido(uuid, text, text, text) from public;
grant execute on function public.cardapio_avisos_pedido(uuid, text, text, text) to anon, authenticated;

create or replace function public.cardapio_avisos_pedido_ligado(p_pedido uuid, p_endpoint text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from cliente_push where pedido_id = p_pedido and endpoint = p_endpoint)
$$;
revoke all on function public.cardapio_avisos_pedido_ligado(uuid, text) from public;
grant execute on function public.cardapio_avisos_pedido_ligado(uuid, text) to anon, authenticated;

-- quando a situação muda e o cliente ligou os avisos, chama a função push-cliente (mesmo segredo do push-pessoal)
create or replace function public.pedido_avisar_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if not exists (select 1 from cliente_push where pedido_id = new.id) then return new; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_pessoal_secret';
  perform net.http_post(
    url     := 'https://epixsranjplmltzmdsbo.supabase.co/functions/v1/push-cliente',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('pedido_id', new.id, 'status', new.status)
  );
  return new;
exception when others then return new;
end $$;
revoke execute on function public.pedido_avisar_cliente() from public, anon, authenticated;
drop trigger if exists pedido_avisar_cliente on public.pedidos;
create trigger pedido_avisar_cliente after update of status on public.pedidos
  for each row execute function public.pedido_avisar_cliente();
