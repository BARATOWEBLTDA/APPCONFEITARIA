-- (21/10) SKU nunca repete dentro da mesma loja (nem duplicando produto).
-- O app já confere antes de salvar e gera um código novo na cópia; isto é a garantia final no banco.
-- Não mexe nos produtos que já existem: só barra gravações novas com código repetido.

create index if not exists produtos_user_sku_idx
  on public.produtos (user_id, lower(btrim(sku)))
  where sku is not null and btrim(sku) <> '';

create or replace function public.produtos_sku_unico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sku is null or btrim(new.sku) = '' then
    new.sku := null;
    return new;
  end if;
  new.sku := upper(btrim(new.sku));
  if tg_op = 'UPDATE' and old.sku is not distinct from new.sku and old.user_id = new.user_id then
    return new; -- não mexeu no código
  end if;
  if exists (
    select 1 from public.produtos p
    where p.user_id = new.user_id
      and p.id <> new.id
      and p.sku is not null
      and lower(btrim(p.sku)) = lower(new.sku)
  ) then
    raise exception 'SKU repetido: o código % já está em outro produto.', new.sku
      using errcode = '23505', hint = 'sku_repetido';
  end if;
  return new;
end;
$$;

drop trigger if exists produtos_sku_unico on public.produtos;
create trigger produtos_sku_unico
  before insert or update of sku, user_id on public.produtos
  for each row execute function public.produtos_sku_unico();
