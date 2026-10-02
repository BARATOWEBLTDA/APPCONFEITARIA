-- ═══════════════════════════════════════════════════════════════
-- Primeiros passos (02/10): o passo "Colocar o logo da loja" só conta como feito quando
-- ela envia um logo OU escolhe "usar minha foto de perfil". Antes, abrir a Aparência
-- (ou ter a foto do Google) já marcava, mesmo sendo uma foto pessoal.
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists logo_confirmado boolean not null default false;
notify pgrst, 'reload schema';
