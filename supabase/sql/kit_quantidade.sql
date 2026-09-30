-- Kit por quantidade (docinhos, salgados...): o cliente escolhe quantos de cada sabor.
-- Rodar ANTES de subir o código. Pode rodar mais de uma vez.
alter table public.produtos add column if not exists kit_qtd jsonb;
notify pgrst, 'reload schema';
