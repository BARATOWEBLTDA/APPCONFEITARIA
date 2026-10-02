-- ═══════════════════════════════════════════════════════════════
-- Cardápio (02/10): o "Modelo 1" vira o padrão de todas as lojas;
-- o layout "Padrão" passa a ser exclusivo PRO.
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles alter column cardapio_modelo set default 'modelo1';

-- Lojas que NÃO são PRO e estavam no "Padrão" (ou sem modelo) passam pro Modelo 1
update public.profiles
set cardapio_modelo = 'modelo1'
where coalesce(cardapio_modelo, 'padrao') = 'padrao'
  and not (plano = 'pro' and (pro_expira_em is null or pro_expira_em > now()));

notify pgrst, 'reload schema';
