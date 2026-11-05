-- (6.167) Trocar o e-mail pelo painel admin sem perder a ligação com a Hotmart.
-- O e-mail antigo fica em profiles.emails_anteriores; o aviso da Hotmart acha a conta pelo e-mail atual OU por um antigo.
alter table public.profiles add column if not exists emails_anteriores text[] not null default '{}';

-- a própria confeiteira não mexe nessa lista (só o servidor/admin)
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.profiles_proteger_campos()'::regprocedure);
  if position('emails_anteriores' in d) > 0 then return; end if;
  n := replace(d, 'new.hotmart_transacao := old.hotmart_transacao;', 'new.hotmart_transacao := old.hotmart_transacao;' || chr(10) || '  new.emails_anteriores := old.emails_anteriores;');
  if n = d then raise exception 'profiles_proteger_campos mudou: confira antes de aplicar'; end if;
  execute n;
end $$;

-- e-mail atual primeiro; se ninguém usa esse e-mail hoje, procura nos antigos
create or replace function public.hotmart_usuario_por_email(p_email text)
returns uuid language sql security definer set search_path to 'public', 'auth' as $function$
  select coalesce(
    (select id from auth.users where lower(email) = lower(trim(p_email)) limit 1),
    (select id from public.profiles where lower(trim(p_email)) = any(emails_anteriores) order by updated_at desc nulls last limit 1)
  );
$function$;
