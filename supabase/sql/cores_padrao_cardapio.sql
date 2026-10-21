-- (21/10) Conta nova já nasce com as cores padrão do cardápio (antes: topo branco e nome cinza,
-- que no PRO viravam um topo roxo forte sem a loja escolher). Contas antigas com esses valores
-- são tratadas no app (lib/coresCardapio.ts: o valor do banco não conta como escolha).
alter table public.profiles alter column cor_navbar set default '#BF6B84';
alter table public.profiles alter column cor_nome set default '#2C1219';
