-- (19/10) "Foto de referência" no cardápio só nos produtos em que a confeitaria habilitar
-- (bom pra personalizados, como topos de bolo). Vem desligado. A função cardapio_produtos já devolve a coluna.
alter table public.produtos add column if not exists aceita_referencia boolean not null default false;
