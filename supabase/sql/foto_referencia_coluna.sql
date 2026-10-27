-- 27/10 · Foto de referência em coluna própria (aplicado em produção)
-- As listas de pedidos (Pedidos, Início, Agenda) leem "personalizacoes"; com a foto lá dentro, baixavam todas as fotos.
alter table public.pedido_itens add column if not exists foto_referencia text;

create or replace function public.pedido_itens_separar_foto() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.personalizacoes is not null and jsonb_typeof(new.personalizacoes) = 'object' and new.personalizacoes ? 'foto_referencia' then
    if coalesce(new.personalizacoes->>'foto_referencia', '') <> '' then
      new.foto_referencia := new.personalizacoes->>'foto_referencia';
    end if;
    new.personalizacoes := new.personalizacoes - 'foto_referencia';
  end if;
  return new;
end $$;

create trigger trg_pedido_itens_separar_foto before insert or update of personalizacoes on public.pedido_itens
  for each row execute function public.pedido_itens_separar_foto();

update public.pedido_itens set personalizacoes = personalizacoes where personalizacoes ? 'foto_referencia';

-- cardapio_pedidos_do_cliente: "tem_foto_referencia" passa a olhar a coluna nova (ver migração foto_referencia_coluna_propria)
