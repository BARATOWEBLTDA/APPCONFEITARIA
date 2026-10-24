-- ═══════════════════════════════════════════════════════════════
-- (24/10) Novidades: excluir arrastando para o lado e "Gostei" inicial
-- Pode rodar de novo.
-- ═══════════════════════════════════════════════════════════════

-- a confeiteira pode tirar uma novidade da lista dela (arrastando para o lado)
alter table public.noticias_lidas add column if not exists excluida_em timestamptz;

-- "Gostei" inicial: novidade nova entra com 10 a 30 (quando o admin não escreveu outro número)
create or replace function public.noticia_gostei_inicial()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if coalesce(new.likes_base, 0) = 0 then new.likes_base := 10 + floor(random() * 21)::int; end if;
  return new;
end $$;
drop trigger if exists trg_noticia_gostei_inicial on public.admin_noticias;
create trigger trg_noticia_gostei_inicial before insert on public.admin_noticias
  for each row execute function public.noticia_gostei_inicial();

-- as que já existem: a mais nova começa com 187; as outras, de 30 para cima
with ordem as (select id, row_number() over (order by publicado_em desc nulls last, created_at desc) as n from public.admin_noticias)
update public.admin_noticias a
   set likes_base = case when o.n = 1 then 187 else 30 + floor(random() * 61)::int end
  from ordem o where o.id = a.id;
