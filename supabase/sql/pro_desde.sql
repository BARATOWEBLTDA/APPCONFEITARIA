-- (21/10) "Assinante desde" de verdade: a data em que o PRO ligou pela primeira vez
-- (antes vinha da conquista "Virou PRO", que nem toda conta tinha).
alter table public.profiles add column if not exists pro_desde timestamptz;

-- Contas que já são/foram PRO: o 1º evento da Hotmart que ligou o PRO; sem ele, a conquista "Virou PRO"
update public.profiles p set pro_desde = coalesce(
  (select min(e.recebido_em) from public.hotmart_eventos e where e.user_id = p.id and e.pro_expira_em is not null),
  (select min(c.conquistada_em) from public.conquistas_usuario c where c.user_id = p.id and c.codigo = 'pro')
)
where p.pro_desde is null and p.plano = 'pro';

-- Daqui pra frente: grava sozinho na hora em que o plano vira PRO (só a primeira vez)
create or replace function public.profiles_marca_pro_desde()
returns trigger language plpgsql as $$
begin
  if new.plano = 'pro' and new.pro_desde is null and (tg_op = 'INSERT' or old.plano is distinct from 'pro') then
    new.pro_desde := now();
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_pro_desde' and tgrelid = 'public.profiles'::regclass) then
    create trigger profiles_pro_desde before insert or update of plano on public.profiles
    for each row execute function public.profiles_marca_pro_desde();
  end if;
end $$;
