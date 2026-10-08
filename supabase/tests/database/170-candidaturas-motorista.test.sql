-- Bloco 1: o motorista sem frota vê as próprias candidaturas e pedidos de entrada (sem placa).
begin;
select plan(7);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1 \gset

update public.fleets set uf = 'SP', cidade = 'São Paulo' where id = :'f';
update public.vehicles set anunciado = true where id = :'c1';
select codigo_convite as cod from public.fleets where id = :'f' \gset
select marca as marca_c1 from public.vehicles where id = :'c1' \gset

select tests.criar_usuario('livre@t.dev', 'motorista', 'Livre') as l1 \gset
select tests.criar_usuario('outro@t.dev', 'motorista', 'Outro') as l2 \gset

select tests.entrar_como(:'l1');
select public.candidatar(:'c1', 'Oi');
select public.entrar_na_frota(:'cod');

select is((select count(*)::int from public.minhas_candidaturas()), 1, 'vê a própria candidatura');
select is((select status || '|' || marca || '|' || frota_nome from public.minhas_candidaturas()),
  'pendente|' || :'marca_c1' || '|Frota Cenário', 'traz carro e frota');
select ok(not exists (
  select 1 from information_schema.routines r
  join information_schema.parameters p on p.specific_name = r.specific_name
  where r.routine_schema = 'public' and r.routine_name = 'minhas_candidaturas' and p.parameter_name = 'placa'),
  'minhas_candidaturas não expõe placa');
select is((select status || '|' || frota_nome from public.meus_pedidos_entrada()), 'pendente|Frota Cenário',
  'vê o pedido de entrada pendente com o nome da frota');
select tests.sair();

select tests.entrar_como(:'l2');
select is((select count(*)::int from public.minhas_candidaturas()), 0, 'outro motorista não vê');
select is((select count(*)::int from public.meus_pedidos_entrada()), 0, 'outro motorista não vê pedidos');
select tests.sair();

select is((select count(*)::int from public.minhas_candidaturas()), 0, 'sem login: nada');

select * from finish();
rollback;
