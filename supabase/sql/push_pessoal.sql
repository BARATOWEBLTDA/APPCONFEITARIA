-- (23/10) Aviso no celular de cada confeiteira: pedido novo pelo cardápio e plano PRO.
-- Rodar uma vez no SQL Editor do Supabase. A função push-pessoal já está publicada.
alter table public.notificacoes add column if not exists push_enviado_em timestamptz;

-- segredo do gatilho -> função de envio (fica só no Vault, ninguém precisa digitar)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_pessoal_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_pessoal_secret', 'gatilho de notificacoes -> edge function push-pessoal');
  end if;
end $$;

-- a função de envio confere o segredo por aqui (só a chave de serviço pode chamar)
create or replace function public.push_segredo_ok(s text) returns boolean
language sql security definer set search_path = public as $$
  select coalesce(length(s) > 0 and s = (select decrypted_secret from vault.decrypted_secrets where name = 'push_pessoal_secret'), false)
$$;
revoke all on function public.push_segredo_ok(text) from public, anon, authenticated;
grant execute on function public.push_segredo_ok(text) to service_role;

-- toda notificação pessoal de pedido ou de plano vira aviso no celular
create or replace function public.notif_enviar_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if new.user_id is null or coalesce(new.tipo, '') not in ('pedido', 'pro', 'pro_vencendo', 'pro_atrasado') then return new; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_pessoal_secret';
  perform net.http_post(
    url     := 'https://epixsranjplmltzmdsbo.supabase.co/functions/v1/push-pessoal',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('id', new.id)
  );
  return new;
exception when others then return new; -- nunca impede a notificação (nem o pedido) de ser salva
end $$;

drop trigger if exists trg_notif_enviar_push on public.notificacoes;
create trigger trg_notif_enviar_push after insert on public.notificacoes
  for each row execute function public.notif_enviar_push();

-- pedido novo: título sem emoji e o toque abre o próprio pedido
create or replace function public.notif_novo_pedido() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare v_cliente text;
begin
  if coalesce(new.origem, 'cardapio') <> 'cardapio' then return new; end if;
  select nome into v_cliente from public.clientes where id = new.cliente_id;
  insert into public.notificacoes (user_id, tipo, titulo, mensagem, link, chave)
  values (new.user_id, 'pedido', 'Novo pedido',
          coalesce(v_cliente, 'Um cliente') || ' fez um pedido' ||
            case when coalesce(new.valor_total, 0) > 0 then ' de R$ ' || replace(to_char(new.valor_total, 'FM999G990D00'), '.', ',') else '' end || '. Toque para ver.',
          '/pedidos/' || new.id || '/editar', 'pedido-' || new.id)
  on conflict do nothing;
  return new;
exception when others then return new;
end $function$;

-- o aparelho passa a ser desta conta (antes, quem entrava com outra conta no mesmo celular não conseguia
-- registrar: a linha do aparelho era da conta anterior e a regra de acesso barrava a troca)
create or replace function public.registrar_aparelho_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
revoke all on function public.registrar_aparelho_push(text, text, text) from public, anon;
grant execute on function public.registrar_aparelho_push(text, text, text) to authenticated;
