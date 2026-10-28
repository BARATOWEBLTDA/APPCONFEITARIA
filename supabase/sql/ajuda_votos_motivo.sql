-- (28/10) APLICADO EM PRODUÇÃO.
-- O "O que faltou?" da Central de Ajuda gravava motivo e updated_at, que não existiam:
-- o voto caía no plano B (só o sim/não) e o motivo se perdia.
alter table public.ajuda_votos add column if not exists motivo text, add column if not exists updated_at timestamptz default now();
