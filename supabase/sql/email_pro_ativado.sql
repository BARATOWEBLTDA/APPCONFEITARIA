-- 27/10 · E-mail "Seu Doonly PRO está ativo" + texto novo do aviso (aplicado em produção)
alter table public.profiles add column if not exists pro_email_enviado_em timestamptz;

create or replace function public.notif_pro_ativado() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if new.plano = 'pro' and coalesce(old.plano, '') <> 'pro' then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link, chave)
    values (new.id, 'pro', 'Seu PRO está ativo',
            'Tudo do Doonly PRO já está liberado: produtos sem limite, lucratividade, Doo IA com imagens e o cardápio do seu jeito.',
            '/inicio', 'pro-ativado-' || to_char(now(), 'YYYYMMDD'))
    on conflict do nothing;

    -- e-mail "Seu Doonly PRO está ativo" (a função não repete se já mandou há pouco)
    begin
      select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_pessoal_secret';
      perform net.http_post(
        url     := 'https://epixsranjplmltzmdsbo.supabase.co/functions/v1/send-pro-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
        body    := jsonb_build_object('user_id', new.id)
      );
    exception when others then null;
    end;
  end if;
  return new;
exception when others then return new;
end $$;
