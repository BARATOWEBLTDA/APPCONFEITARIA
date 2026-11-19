-- Doonly · 19/11/2026 · E-mails de reativação (função send-reativacao-email)
-- PARTE 1: colunas novas no perfil. Pode rodar à vontade (não mexe em dado nenhum).

alter table public.profiles
  add column if not exists reativacao_a_em timestamptz,
  add column if not exists reativacao_b_em timestamptz,
  add column if not exists email_reativacao_off boolean not null default false;

-- PARTE 2: prova. Troque o e-mail e rode: chegam os dois e-mails nele.
-- (só funciona depois da PARTE 1 e de a função estar publicada)
--
-- select net.http_post(
--   url     := 'https://epixsranjplmltzmdsbo.supabase.co/functions/v1/send-reativacao-email',
--   headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret',
--              (select decrypted_secret from vault.decrypted_secrets where name = 'push_pessoal_secret')),
--   body    := jsonb_build_object('modo', 'teste', 'email', 'SEU_EMAIL_AQUI', 'nome', 'Bruno')
-- );

-- PARTE 3: ligar o envio automático, de hora em hora. SÓ RODE DEPOIS DE APROVAR A PROVA.
-- "dias": 3 = só contas criadas nos últimos 3 dias; "limite": 30 = no máximo 30 e-mails por rodada.
--
-- select cron.schedule('email-reativacao', '7 * * * *', $$
--   select net.http_post(
--     url     := 'https://epixsranjplmltzmdsbo.supabase.co/functions/v1/send-reativacao-email',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret',
--                (select decrypted_secret from vault.decrypted_secrets where name = 'push_pessoal_secret')),
--     body    := jsonb_build_object('modo', 'rodar', 'dias', 3, 'limite', 30)
--   );
-- $$);
--
-- Para desligar:  select cron.unschedule('email-reativacao');
