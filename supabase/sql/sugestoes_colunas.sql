-- ═══════════════════════════════════════════════════════════════
-- Sugestões e problemas — colunas que as telas novas usam
-- Corrige o erro "Could not find the 'titulo' column of 'sugestoes'
-- in the schema cache" na tela "Sugerir uma melhoria".
-- Rodar UMA vez no SQL Editor ANTES do deploy. Pode rodar de novo.
-- ═══════════════════════════════════════════════════════════════
alter table public.sugestoes add column if not exists titulo      text;
alter table public.sugestoes add column if not exists impacto     text;
alter table public.sugestoes add column if not exists status      text default 'recebida';
alter table public.sugestoes add column if not exists tipo        text default 'sugestao';  -- 'sugestao' | 'problema'
alter table public.sugestoes add column if not exists area        text;
alter table public.sugestoes add column if not exists tela_origem text;
alter table public.sugestoes add column if not exists versao_app  text;
alter table public.sugestoes add column if not exists nome        text;
alter table public.sugestoes add column if not exists telefone    text;
alter table public.sugestoes add column if not exists email       text;

-- Recarrega o cache do Supabase (sem isso o erro continua por alguns minutos)
notify pgrst, 'reload schema';
