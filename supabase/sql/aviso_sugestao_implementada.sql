-- ═══════════════════════════════════════════════════════════════
-- (23/10) Aviso "Sua ideia virou realidade" no celular da confeiteira
-- Antes: o gatilho chamava a função notify-sugestao, que nunca foi publicada (nenhum aviso chegava).
-- Agora: o gatilho cria um aviso pessoal (tabela notificacoes, tipo 'sugestao') e o gatilho dessa tabela
-- manda pelo push-pessoal (a mesma função do "Novo pedido"). O toque abre "Minhas ideias".
-- Partes 1 e 2 já aplicadas em produção (23/10). Pode rodar de novo.
-- ═══════════════════════════════════════════════════════════════

-- 1) o push-pessoal também manda os avisos de ideia implementada
create or replace function public.notif_enviar_push()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_secret text;
begin
  if new.user_id is null or coalesce(new.tipo, '') not in ('pedido', 'pro', 'pro_vencendo', 'pro_atrasado', 'sugestao') then return new; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_pessoal_secret';
  perform net.http_post(
    url     := 'https://epixsranjplmltzmdsbo.supabase.co/functions/v1/push-pessoal',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('id', new.id)
  );
  return new;
exception when others then return new;
end $function$;

-- 2) ideia virou "implementada": cria o aviso pessoal (uma vez por ideia)
create or replace function public.notify_sugestao_implementada()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nome text;
  v_chave text := 'sugestao-' || new.id::text;
begin
  if new.user_id is null then return new; end if;
  if exists (select 1 from public.notificacoes where user_id = new.user_id and chave = v_chave) then return new; end if;
  v_nome := btrim(coalesce(nullif(btrim(new.titulo), ''), new.descricao, ''));
  if length(v_nome) > 60 then v_nome := rtrim(left(v_nome, 60)) || '…'; end if;
  insert into public.notificacoes (user_id, tipo, titulo, mensagem, link, chave)
  values (
    new.user_id, 'sugestao', 'Sua ideia virou realidade',
    case when v_nome <> '' then '“' || v_nome || '” já está no Doonly. Obrigado por ajudar!'
         else 'Uma ideia sua já está no Doonly. Obrigado por ajudar!' end,
    '/solicitar-recurso?aba=minhas', v_chave
  );
  return new;
exception when others then return new; -- o aviso nunca impede de salvar a ideia
end $function$;

-- o gatilho continua o mesmo (trg_notify_sugestao_implementada: quando o status muda para 'implementada')

-- 3) o segredo da função antiga (notify_sugestao_secret, no Vault) não é mais usado.
--    Pode ser apagado à mão em Project Settings › Vault; deixar lá não atrapalha nada.
