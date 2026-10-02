-- ═══════════════════════════════════════════════════════════════
-- Primeiros passos (02/10): "já compartilhou o link do cardápio" passa a ficar
-- guardado no banco (antes ficava só no celular e sumia ao trocar de aparelho).
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists cardapio_compartilhado boolean not null default false;
notify pgrst, 'reload schema';
