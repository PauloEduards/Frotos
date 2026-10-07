begin;
select plan(8);

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

insert into ids values
  ('a', tests.criar_usuario('a010@t.dev', 'motorista', 'Ana')),
  ('b', tests.criar_usuario('b010@t.dev', 'proprietario', 'Beto'));

-- 1
select is(
  (select papel::text || '/' || nome from public.profiles where id = (select v from ids where k = 'a')),
  'motorista/Ana',
  'usuário gera profile com papel e nome do metadata');

-- 2
select throws_ok(
  $$select tests.criar_usuario('x010@t.dev', null)$$,
  'P0001', 'PAPEL_OBRIGATORIO',
  'papel é obrigatório');

-- 3
select ok(public.fmt_km(45200) = '45.200' and public.fmt_km(1234567) = '1.234.567', 'fmt_km formata com pontos');

select public.notificar((select v from ids where k = 'a'), 't', 't', 'c');
select public.notificar((select v from ids where k = 'b'), 't', 't', 'c');

select tests.entrar_como((select v from ids where k = 'a'));

-- 4
select is(
  (select count(*)::int from public.profiles where id = (select v from ids where k = 'b')),
  0, 'A não enxerga o profile de B');

-- 5
select throws_ok(
  format($$update public.profiles set papel = 'proprietario' where id = %L$$, (select v from ids where k = 'a')),
  '42501', null, 'A não pode alterar o papel');

-- 6
select lives_ok(
  format($$update public.profiles set nome = 'Novo', expo_push_token = 'ExponentPushToken[x]' where id = %L$$, (select v from ids where k = 'a')),
  'A pode alterar nome e token');

-- 7
select throws_ok(
  format($$select public.notificar(%L, 't', 't', 'c')$$, (select v from ids where k = 'a')),
  '42501', null, 'notificar não é executável por authenticated');

-- 8
with u as (update public.notifications set lida = true returning 1)
select is(
  (select count(*)::int from public.notifications) || '/' || (select count(*) from u),
  '1/1', 'A vê só a própria notificação e marca como lida');

select * from finish();
rollback;
