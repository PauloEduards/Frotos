begin;
select plan(15);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma \gset

-- setup: carro1 com média 200 km/dia e só o óleo (previsto para 2026-10-16)
delete from public.odometer_readings where vehicle_id in (:'c1', :'c2');
delete from public.vehicle_items where vehicle_id in (:'c1', :'c2');
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em) values
  (:'c1', :'dono', 16000, 'atualizacao', '2026-09-26 15:00+00'),
  (:'c1', :'dono', 18000, 'atualizacao', '2026-10-06 15:00+00');
update public.vehicles set km_atual = 18000 where id = :'c1';
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, ultimo_km, ultima_data, custo_estimado)
values (:'c1', 'Óleo teste', 10000, 6, 10000, '2026-09-01', 180) returning id as oleo \gset

select tests.entrar_como(:'dono');

-- 1
select is((select array_agg(g.data order by g.data) from public.projecao_gastos(:'f', 30, '2026-10-06') g where g.vehicle_item_id = :'oleo'),
  array['2026-10-16']::date[], '1 30 dias: óleo em 2026-10-16');
select is((select g.valor from public.projecao_gastos(:'f', 30, '2026-10-06') g where g.vehicle_item_id = :'oleo'),
  180::numeric, '1 valor 180');

-- 2
select is((select array_agg(g.data order by g.data) from public.projecao_gastos(:'f', 90, '2026-10-06') g where g.vehicle_item_id = :'oleo'),
  array['2026-10-16', '2026-12-05']::date[], '2 90 dias: 2 ocorrências do óleo');

-- 3 vencido (data_prevista 2026-09-20) → primeira ocorrência em hoje
select tests.sair();
update public.vehicle_items set ultima_data = '2026-03-20' where id = :'oleo';
select tests.entrar_como(:'dono');
select is((select min(g.data) from public.projecao_gastos(:'f', 30, '2026-10-06') g where g.vehicle_item_id = :'oleo'),
  '2026-10-06'::date, '3 vencido começa hoje');
select is((select placa from public.projecao_gastos(:'f', 30, '2026-10-06') g where g.vehicle_item_id = :'oleo' limit 1),
  'ABC1D23', '3 placa');

-- 4 sem histórico → 1 linha com data null
select tests.sair();
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, custo_estimado)
values (:'c1', 'Sem hist', 10000, 6, 90) returning id as sh \gset
select tests.entrar_como(:'dono');
select is((select count(*)::int from public.projecao_gastos(:'f', 30, '2026-10-06') g where g.vehicle_item_id = :'sh'), 1, '4 uma linha');
select is((select g.data from public.projecao_gastos(:'f', 90, '2026-10-06') g where g.vehicle_item_id = :'sh'), null::date, '4 data null');
select is((select count(*)::int from public.projecao_gastos(:'f', 90, '2026-10-06') g where g.vehicle_item_id = :'sh'), 1, '4 uma linha em 90 dias');

-- 5 carro inativo não entra
select tests.sair();
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, ultimo_km, ultima_data, custo_estimado)
values (:'c2', 'Item c2', 10000, 1000, '2026-03-20', 50);
update public.vehicles set ativo = false where id = :'c2';
select tests.entrar_como(:'dono');
select is((select count(*)::int from public.projecao_gastos(:'f', 90, '2026-10-06') g where g.vehicle_id = :'c2'), 0, '5 carro inativo fora');

-- 6 validações
select throws_ok(format('select * from public.projecao_gastos(%L, 45, %L)', :'f', '2026-10-06'), 'P0001', 'PERIODO_INVALIDO', '6 período inválido');
select throws_ok(format('select * from public.gastos_realizados(%L, 45, %L)', :'f', '2026-10-06'), 'P0001', 'PERIODO_INVALIDO', '6 período inválido (realizado)');
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format('select * from public.projecao_gastos(%L, 30, %L)', :'f', '2026-10-06'), 'P0001', 'SEM_ACESSO', '6 motorista sem acesso');
select throws_ok(format('select * from public.gastos_realizados(%L, 30, %L)', :'f', '2026-10-06'), 'P0001', 'SEM_ACESSO', '6 motorista sem acesso (realizado)');
select tests.sair();

-- 7 gastos realizados
insert into public.maintenance_records (vehicle_id, autor_id, km, data, valor_total, status) values
  (:'c1', :'dono', 17000, '2026-09-20', 300, 'aprovado') returning id as r_ok \gset
insert into public.maintenance_records (vehicle_id, autor_id, km, data, valor_total, status) values
  (:'c1', :'dono', 17000, '2026-09-21', 10, 'pendente'),
  (:'c1', :'dono', 17000, '2026-09-22', 20, 'recusado'),
  (:'c1', :'dono', 17000, '2026-09-23', 30, 'contestado'),
  (:'c1', :'dono', 17000, '2026-08-01', 40, 'aprovado');
insert into public.maintenance_record_items (record_id, vehicle_item_id, nome_outro) values
  (:'r_ok', :'oleo', null),
  (:'r_ok', null, 'Lavagem');
select tests.entrar_como(:'dono');
select is((select array_agg(g.valor_total order by g.data) from public.gastos_realizados(:'f', 30, '2026-10-06') g where g.vehicle_id = :'c1'),
  array[300]::numeric[], '7 só o aprovado dentro da janela');
select is((select g.itens from public.gastos_realizados(:'f', 30, '2026-10-06') g where g.record_id = :'r_ok'),
  array['Lavagem', 'Óleo teste']::text[], '8 itens = nomes + nome_outro');
select tests.sair();

select * from finish();
rollback;
