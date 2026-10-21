-- Acompanhar o pedido (21/10): o cliente vê a linha do tempo com a hora de cada etapa e o Pix certo.

-- 1) Hora de cada mudança de situação, gravada pelo próprio banco (vale pra qualquer tela que mude a situação)
alter table public.pedidos add column if not exists status_tempos jsonb not null default '{}'::jsonb;

create or replace function public.pedidos_marca_status_tempo()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.status_tempos := coalesce(new.status_tempos, '{}'::jsonb) || jsonb_build_object(coalesce(new.status, 'novo'), now());
  elsif new.status is distinct from old.status and new.status is not null then
    new.status_tempos := coalesce(old.status_tempos, '{}'::jsonb) || jsonb_build_object(new.status, now());
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'pedidos_status_tempo' and tgrelid = 'public.pedidos'::regclass) then
    create trigger pedidos_status_tempo before insert or update of status on public.pedidos
    for each row execute function public.pedidos_marca_status_tempo();
  end if;
end $$;

-- 2) Pedidos do cliente: agora com o que já foi pago, o Pix (a conferir / confirmado) e as horas de cada etapa
create or replace function public.cardapio_pedidos_do_cliente(p_loja uuid, p_telefone text, p_token text)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare v_tel text := public.tel_digitos(p_telefone);
begin
  if p_loja is null or length(v_tel) < 10 or not public.cliente_acesso_valido(p_loja, v_tel, p_token) then
    return '[]'::json;
  end if;
  return coalesce((
    select json_agg(x order by x.created_at desc) from (
      select p.id, p.numero, p.status, p.created_at, p.valor_total, p.forma_pagamento,
             p.status_pagamento, p.valor_recebido, p.tipo_entrega, p.data_entrega, p.horario_entrega,
             p.endereco_rua, p.endereco_numero, p.endereco_complemento,
             p.endereco_bairro, p.endereco_cidade, p.endereco_cep,
             p.pix_online, p.pix_informado_valor, p.pix_informado_tipo, p.pix_informado_em, p.status_tempos,
             (select min(g.created_at) from pagamentos g where g.pedido_id = p.id and g.estornado_em is null) as pago_em,
             coalesce((
               select json_agg(json_build_object(
                 'nome_produto', i.nome_produto, 'quantidade', i.quantidade,
                 'valor_unitario', i.valor_unitario,
                 -- (21/10) escolhas e adicionais pro cliente ver; a foto de referência fica só como "tem foto"
                 'personalizacoes', coalesce(i.personalizacoes, '{}'::jsonb) - 'foto_referencia',
                 'tem_foto_referencia', coalesce(i.personalizacoes ? 'foto_referencia', false),
                 'snapshot_version', i.snapshot_version, 'observacoes', i.observacoes,
                 'produtos', json_build_object('imagem_url', pr.imagem_url, 'forma_venda', pr.forma_venda)))
               from pedido_itens i left join produtos pr on pr.id = i.produto_id
               where i.pedido_id = p.id
             ), '[]'::json) as pedido_itens
      from pedidos p
      where p.user_id = p_loja
        and (public.tel_digitos(p.cliente_telefone) = v_tel or public.tel_digitos(p.cliente_whatsapp) = v_tel)
      order by p.created_at desc
      limit 60
    ) x
  ), '[]'::json);
end $function$;
