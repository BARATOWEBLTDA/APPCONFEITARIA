-- (21/11) ficha técnica: quantas unidades da receita vão em cada venda do produto (1 = como era antes)
-- Ex.: a receita rende 100 salgados e o produto "100 Salgados Fritos" leva 100 em cada venda.
alter table public.produtos add column if not exists ficha_por_venda numeric not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_ficha_por_venda_ok') then
    alter table public.produtos add constraint produtos_ficha_por_venda_ok check (ficha_por_venda >= 1 and ficha_por_venda <= 10000);
  end if;
end $$;
