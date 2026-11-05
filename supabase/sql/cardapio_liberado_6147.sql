-- (6.147) cardápio público só abre depois dos Primeiros passos (já aplicado em 05/11).
-- O app liga sozinho quando os passos acabam (src/lib/primeirosPassos.ts). Lojas com produto disponível já foram liberadas.
alter table public.profiles add column if not exists cardapio_liberado boolean not null default false;
update public.profiles p set cardapio_liberado = true where exists (select 1 from produtos x where x.user_id = p.id and coalesce(x.disponivel, true));
