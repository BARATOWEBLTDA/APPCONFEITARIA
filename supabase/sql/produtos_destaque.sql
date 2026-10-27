-- 27/10 · Destaques do cardápio (aplicado em produção)
alter table public.produtos add column if not exists destaque boolean not null default false;

-- até 6 por loja; produto fora do cardápio sai do destaque e libera a vaga
create or replace function public.produtos_destaque_limite() returns trigger
language plpgsql set search_path = public as $$
declare v_qtd int;
begin
  if coalesce(new.disponivel, true) = false then
    new.destaque := false;
  end if;
  if new.destaque and (tg_op = 'INSERT' or coalesce(old.destaque, false) = false) then
    select count(*) into v_qtd from public.produtos
     where user_id = new.user_id and destaque and id is distinct from new.id;
    if v_qtd >= 6 then
      raise exception 'limite_destaques' using errcode = 'P0001', hint = 'Você já tem 6 destaques. Tire um para destacar este.';
    end if;
  end if;
  return new;
end $$;

create trigger trg_produtos_destaque before insert or update of destaque, disponivel on public.produtos
  for each row execute function public.produtos_destaque_limite();

create index if not exists produtos_destaque_idx on public.produtos (user_id) where destaque;
