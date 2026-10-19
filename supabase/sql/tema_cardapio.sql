-- ═══════════════════════════════════════════════════════════════
-- Tema do cardápio (18/10)
-- tema_cardapio: 'normal' ou 'natal' (outros temas depois: pascoa, maes...)
-- tema_aviso: texto curto embaixo do nome da loja ("Encomendas de Natal até 20/12")
-- tema_auto + tema_inicio/tema_fim: liga e desliga sozinho nesse período
-- A função cardapio_loja já devolve as colunas novas (usa to_jsonb do perfil).
-- Pode rodar mais de uma vez.
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists tema_cardapio text not null default 'normal';
alter table public.profiles add column if not exists tema_aviso text;
alter table public.profiles add column if not exists tema_auto boolean not null default false;
alter table public.profiles add column if not exists tema_inicio date;
alter table public.profiles add column if not exists tema_fim date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_tema_cardapio_check') then
    alter table public.profiles add constraint profiles_tema_cardapio_check check (tema_cardapio in ('normal', 'natal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_tema_aviso_tam') then
    alter table public.profiles add constraint profiles_tema_aviso_tam check (tema_aviso is null or char_length(tema_aviso) <= 60);
  end if;
end $$;

-- (18/10) Natal vira "catálogo": imagem grande da capa (da loja ou da biblioteca do admin, categoria "Capa de Natal")
alter table public.profiles add column if not exists tema_capa_url text;
