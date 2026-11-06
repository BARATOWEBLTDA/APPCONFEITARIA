-- (6.183) quantas unidades a receita da ficha técnica rende (1 = a ficha é de 1 unidade)
alter table public.produtos add column if not exists ficha_rende numeric not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_ficha_rende_ok') then
    alter table public.produtos add constraint produtos_ficha_rende_ok check (ficha_rende >= 1 and ficha_rende <= 10000);
  end if;
end $$;
