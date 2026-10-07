begin;
select plan(21);

select tests.criar_usuario('v-dono@t.com', 'proprietario', 'Dono') as dono \gset
select tests.criar_usuario('v-dono2@t.com', 'proprietario', 'Dono2') as dono2 \gset
select tests.criar_usuario('v-mot1@t.com', 'motorista', 'Mot1') as mot1 \gset
select tests.criar_usuario('v-mot2@t.com', 'motorista', 'Mot2') as mot2 \gset
select tests.criar_usuario('v-mot3@t.com', 'motorista', 'Mot3') as mot3 \gset

-- Cenário: dono cria frota; mot1 e mot3 ativos; mot2 pendente
select tests.entrar_como(:'dono');
select id as f, codigo_convite as cod from public.criar_frota('Frota V') \gset
select tests.sair();
select tests.entrar_como(:'mot1');
select id as m1 from public.entrar_na_frota(:'cod') \gset
select tests.sair();
select tests.entrar_como(:'mot2');
select id as m2 from public.entrar_na_frota(:'cod') \gset
select tests.sair();
select tests.entrar_como(:'mot3');
select id as m3 from public.entrar_na_frota(:'cod') \gset
select tests.sair();
select tests.entrar_como(:'dono');
select public.responder_entrada(:'m1', true);
select public.responder_entrada(:'m3', true);

-- 1
select is(
  (select count(*)::int from public.maintenance_catalog where nome in (
    'Óleo do motor','Filtro de óleo','Filtro de ar','Filtro de combustível',
    'Filtro de cabine (ar-condicionado)','Pastilhas de freio','Fluido de freio',
    'Pneus (rodízio e alinhamento)','Correia dentada','Velas de ignição','Líquido de arrefecimento')),
  11, 'catálogo tem 11 itens');

-- 2
insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
values (:'f', 'AAA1A11', 'Fiat', 'Argo', 2022, 'Branco', 40000) returning id as c1 \gset
select is((select count(*)::int from public.vehicle_items where vehicle_id = :'c1'), 11, '11 itens criados');
select is((select count(*)::int from public.vehicle_items where vehicle_id = :'c1' and status_atual = 'sem_historico'), 11, 'todos sem_historico');
select is(
  (select count(*)::int from public.vehicle_items i join public.maintenance_catalog c on c.id = i.catalog_id
   where i.vehicle_id = :'c1' and i.custo_estimado = c.custo_sugerido), 11, 'custo = sugerido');

-- 3
insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
values (:'f', 'abc-1d23', 'VW', 'Gol', 2020, 'Preto', 1000) returning id as c2 \gset
select is((select placa from public.vehicles where id = :'c2'), 'ABC1D23', 'placa normalizada');
select throws_ok(
  format($q$insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual) values (%L, 'AB12', 'X', 'Y', 2020, 'Z', 0)$q$, :'f'),
  '23514', null, 'placa inválida');

-- 4
select throws_ok(
  format($q$insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual) values (%L, 'aaa-1a11', 'X', 'Y', 2020, 'Z', 0)$q$, :'f'),
  '23505', null, 'placa duplicada na frota');

insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
values (:'f', 'CCC3C33', 'Chevrolet', 'Onix', 2021, 'Prata', 5000) returning id as c3 \gset

select id as o1 from public.vehicle_items where vehicle_id = :'c1' and nome = 'Óleo do motor' \gset
select id as o2 from public.vehicle_items where vehicle_id = :'c2' and nome = 'Óleo do motor' \gset
select id as o3 from public.vehicle_items where vehicle_id = :'c3' and nome = 'Óleo do motor' \gset

-- Outra frota (com item personalizado Bateria)
select tests.sair();
select tests.entrar_como(:'dono2');
select id as f2 from public.criar_frota('Frota Outra') \gset
insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
values (:'f2', 'DDD4D44', 'Fiat', 'Uno', 2019, 'Cinza', 100) returning id as cx \gset
select id as ox from public.vehicle_items where vehicle_id = :'cx' and nome = 'Óleo do motor' \gset
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, custo_estimado)
values (:'cx', 'Bateria', 40000, 36, 400) returning id as bx \gset
select tests.sair();
select tests.entrar_como(:'dono');

-- 5
select is(public.atualizar_item(:'o1', 8000, 6, 200, false), 1, 'atualizar só um');
select results_eq(
  format($q$select intervalo_km, intervalo_meses, custo_estimado from public.vehicle_items where id = %L$q$, :'o1'),
  $q$values (8000, 6, 200.00::numeric)$q$, 'carro1 mudou');
select results_eq(
  format($q$select intervalo_km, intervalo_meses, custo_estimado from public.vehicle_items where id in (%L, %L)$q$, :'o2', :'o3'),
  $q$values (10000, 6, 180.00::numeric), (10000, 6, 180.00::numeric)$q$, 'outros não mudaram');

-- 6
select is(public.atualizar_item(:'o1', 8000, 6, 200, true), 3, 'aplicar em todos');
select is(
  (select count(*)::int from public.vehicle_items
   where id in (:'o1', :'o2', :'o3') and intervalo_km = 8000 and intervalo_meses = 6 and custo_estimado = 200), 3, 'óleo dos 3 carros');
select tests.sair();
select tests.entrar_como(:'dono2');
select results_eq(
  format($q$select intervalo_km, custo_estimado from public.vehicle_items where id = %L$q$, :'ox'),
  $q$values (10000, 180.00::numeric)$q$, 'outra frota intacta');
select tests.sair();
select tests.entrar_como(:'dono');

-- 7
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, custo_estimado)
values (:'c1', 'Bateria', 40000, 36, 400) returning id as b1 \gset
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, custo_estimado)
values (:'c2', 'Bateria', 40000, 36, 400);
select is(public.atualizar_item(:'b1', 50000, 48, 500, true), 2, 'item personalizado casa por nome');
select tests.sair();
select tests.entrar_como(:'dono2');
select is((select intervalo_km from public.vehicle_items where id = :'bx'), 40000, 'Bateria de outra frota intacta');
select tests.sair();
select tests.entrar_como(:'dono');

-- 8
select results_eq(
  format($q$select km_inicial, ultimo_km, data_inicial, ultima_data from public.definir_historico_inicial(%L, 40000, '2026-08-01')$q$, :'o1'),
  $q$values (40000, 40000, '2026-08-01'::date, '2026-08-01'::date)$q$, 'histórico inicial');

-- 9
select tests.sair();
select tests.entrar_como(:'mot1');
select is((select count(*)::int from public.vehicles where id in (:'c1', :'c2', :'c3')), 3, 'motorista ativo vê 3 veículos');
select throws_ok(
  format($q$insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual) values (%L, 'EEE5E55', 'X', 'Y', 2020, 'Z', 0)$q$, :'f'),
  '42501', null, 'motorista não insere veículo');

-- 11
select throws_ok(format($q$select public.atualizar_item(%L, 1, 1, 1, false)$q$, :'o1'), 'P0001', 'SEM_ACESSO', 'motorista não atualiza item');

-- 10
select tests.sair();
select tests.entrar_como(:'mot2');
select is((select count(*)::int from public.vehicles where id in (:'c1', :'c2', :'c3')), 0, 'pendente vê 0 veículos');
select tests.sair();
select tests.entrar_como(:'mot3');
select is((select count(*)::int from public.vehicle_items where vehicle_id in (:'c1', :'c2', :'c3')), 0, 'ativo sem vínculo vê 0 itens');
select tests.sair();

select * from finish();
rollback;
