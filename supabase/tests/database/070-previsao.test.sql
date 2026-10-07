begin;
select plan(39);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma,
       (:'c'::jsonb->>'mot_ativo2')::uuid as mb \gset

-- setup: carro1 só com o item de teste e sem leituras
delete from public.odometer_readings where vehicle_id = :'c1';
delete from public.vehicle_items where vehicle_id = :'c1';
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, ultimo_km, ultima_data, custo_estimado)
values (:'c1', 'Óleo teste', 10000, 6, 10000, '2026-09-01', 250) returning id as it \gset
update public.vehicles set km_atual = 13000, km_dia_estimado = 300 where id = :'c1';

-- 1 média real
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em) values
  (:'c1', :'dono', 10000, 'atualizacao', '2026-09-26 15:00+00'),
  (:'c1', :'dono', 13000, 'atualizacao', '2026-10-06 15:00+00');
select is((select media from public.media_km_dia_interna(:'c1', '2026-10-06')), 300::numeric, '1 média 300');
select is((select estimada from public.media_km_dia_interna(:'c1', '2026-10-06')), false, '1 não estimada');

-- 2 menos de 3 dias → estimada
delete from public.odometer_readings where vehicle_id = :'c1';
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em) values
  (:'c1', :'dono', 12000, 'atualizacao', '2026-10-04 15:00+00'),
  (:'c1', :'dono', 13000, 'atualizacao', '2026-10-06 15:00+00');
update public.vehicles set km_dia_estimado = 300 where id = :'c1';
select is((select media from public.media_km_dia_interna(:'c1', '2026-10-06')), 300::numeric, '2 usa km_dia_estimado');
select is((select estimada from public.media_km_dia_interna(:'c1', '2026-10-06')), true, '2 estimada');

-- 3 leitura fora dos 30 dias é ignorada
delete from public.odometer_readings where vehicle_id = :'c1';
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em) values
  (:'c1', :'dono', 5000, 'atualizacao', '2026-08-01 15:00+00'),
  (:'c1', :'dono', 13000, 'atualizacao', '2026-10-05 15:00+00');
select is((select estimada from public.media_km_dia_interna(:'c1', '2026-10-06')), true, '3 leitura antiga ignorada (sobra 1 leitura)');
select is((select media from public.media_km_dia_interna(:'c1', '2026-10-06')), 300::numeric, '3 média estimada');

-- 4 previsão do óleo
delete from public.odometer_readings where vehicle_id = :'c1';
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em) values
  (:'c1', :'dono', 10000, 'atualizacao', '2026-09-26 15:00+00'),
  (:'c1', :'dono', 13000, 'atualizacao', '2026-10-06 15:00+00');
select is((select proximo_km from public.previsao_itens_interna(:'c1', '2026-10-06')), 20000, '4 proximo_km');
select is((select km_restante from public.previsao_itens_interna(:'c1', '2026-10-06')), 7000, '4 km_restante');
select is((select data_prevista from public.previsao_itens_interna(:'c1', '2026-10-06')), '2026-10-30'::date, '4 data_prevista');
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'em_dia', '4 em_dia');

-- 5 limiares de km
update public.vehicles set km_atual = 19200 where id = :'c1';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'proximo', '5 restante 800 proximo');
update public.vehicles set km_atual = 19750 where id = :'c1';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'urgente', '5 restante 250 urgente');
update public.vehicles set km_atual = 20000 where id = :'c1';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'vencido', '5 restante 0 vencido');

-- 6 vencido por tempo
update public.vehicles set km_atual = 13000 where id = :'c1';
update public.vehicle_items set ultima_data = '2026-03-01' where id = :'it';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'vencido', '6 vencido por data');

-- 7 próximo por data (km folgado, data em 2026-10-10)
update public.vehicles set km_atual = 15000 where id = :'c1';
update public.vehicle_items set ultima_data = '2026-04-10' where id = :'it';
select is((select data_prevista from public.previsao_itens_interna(:'c1', '2026-10-06')), '2026-10-10'::date, '7 data_prevista por tempo');
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'proximo', '7 proximo por data');

-- 8 só ultima_data conhecida
update public.vehicles set km_atual = 13000 where id = :'c1';
update public.vehicle_items set ultimo_km = null, ultima_data = '2026-09-01' where id = :'it';
select is((select proximo_km from public.previsao_itens_interna(:'c1', '2026-10-06')), null::int, '8 proximo_km null');
select is((select km_restante from public.previsao_itens_interna(:'c1', '2026-10-06')), null::int, '8 km_restante null');
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'em_dia', '8 status pela data');
update public.vehicle_items set ultima_data = '2026-03-01' where id = :'it';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'vencido', '8 vencido pela data');

-- 9 sem histórico
update public.vehicle_items set ultimo_km = null, ultima_data = null where id = :'it';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'sem_historico', '9 sem_historico');
select is((select data_prevista from public.previsao_itens_interna(:'c1', '2026-10-06')), null::date, '9 data_prevista null');

-- 10 média zero
delete from public.odometer_readings where vehicle_id = :'c1';
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em) values
  (:'c1', :'dono', 13000, 'atualizacao', '2026-09-26 15:00+00'),
  (:'c1', :'dono', 13000, 'atualizacao', '2026-10-06 15:00+00');
update public.vehicle_items set ultimo_km = 10000, ultima_data = '2026-09-01' where id = :'it';
select is((select media from public.media_km_dia_interna(:'c1', '2026-10-06')), 0::numeric, '10 média 0');
select is((select data_prevista from public.previsao_itens_interna(:'c1', '2026-10-06')), '2027-03-01'::date, '10 data por tempo sem erro');

-- 11 status do carro (média 300 km/dia)
delete from public.odometer_readings where vehicle_id = :'c1';
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em) values
  (:'c1', :'dono', 10000, 'atualizacao', '2026-09-26 15:00+00'),
  (:'c1', :'dono', 13000, 'atualizacao', '2026-10-06 15:00+00');
delete from public.vehicle_items where vehicle_id = :'c1';
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, ultimo_km, ultima_data) values
  (:'c1', 'A em dia', 10000, null, 10000, null),
  (:'c1', 'B sem hist', 10000, null, null, null),
  (:'c1', 'C proximo', 10000, null, 3800, null);
select is((select status::text from public.status_carro_interna(:'c1', '2026-10-06')), 'sem_historico', '11 {em_dia, sem_historico, proximo} = sem_historico');
update public.vehicle_items set ultimo_km = 3000 where vehicle_id = :'c1' and nome = 'C proximo';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06') where nome = 'C proximo'), 'vencido', '11 item vencido');
select is((select status::text from public.status_carro_interna(:'c1', '2026-10-06')), 'vencido', '11 vencido domina');
update public.vehicle_items set ultimo_km = 3250 where vehicle_id = :'c1' and nome = 'C proximo';
select is((select status::text from public.status_carro_interna(:'c1', '2026-10-06')), 'urgente', '11 {urgente, sem_historico} = urgente');
select is((select proximo_item from public.status_carro_interna(:'c1', '2026-10-06')), 'C proximo', '11 proximo_item');

-- 12 limiar_laranja_km da frota
delete from public.vehicle_items where vehicle_id = :'c1';
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, ultimo_km) values (:'c1', 'D', 10000, 3450);
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'proximo', '12 restante 450 com limiar padrão = proximo');
update public.fleets set limiar_laranja_km = 500 where id = :'f';
select is((select status::text from public.previsao_itens_interna(:'c1', '2026-10-06')), 'urgente', '12 restante 450 com limiar 500 = urgente');

-- 13 item inativo
update public.vehicle_items set ativo = false where vehicle_id = :'c1';
select is((select count(*)::int from public.previsao_itens_interna(:'c1', '2026-10-06')), 0, '13 item inativo não aparece');

-- 14 acesso
update public.vehicle_items set ativo = true where vehicle_id = :'c1';
insert into public.assignments (vehicle_id, driver_id, status, km_inicio) values (:'c1', :'ma', 'ativo', 13000);
select tests.entrar_como(:'mb');
select throws_ok(format($$select * from public.previsao_itens(%L, '2026-10-06')$$, :'c1'), 'P0001', 'SEM_ACESSO', '14 sem vínculo previsao_itens');
select throws_ok(format($$select * from public.status_carro(%L, '2026-10-06')$$, :'c1'), 'P0001', 'SEM_ACESSO', '14 sem vínculo status_carro');
select throws_ok(format($$select * from public.resumo_frota(%L, '2026-10-06')$$, :'f'), 'P0001', 'SEM_ACESSO', '14 motorista não vê resumo');
select throws_ok(format($$select * from public.status_carro_interna(%L, '2026-10-06')$$, :'c1'), '42501', null, '14 interna sem permissão');
select tests.sair();
select tests.entrar_como(:'ma');
select is((select count(*)::int from public.previsao_itens(:'c1', '2026-10-06')), 1, '14 motorista vinculado vê previsão');
select tests.sair();
select tests.entrar_como(:'dono');
select is((select motorista_nome from public.resumo_frota(:'f', '2026-10-06') where vehicle_id = :'c1'), 'Motorista A', '14 resumo traz o motorista atual');
select is((select status::text from public.resumo_frota(:'f', '2026-10-06') where vehicle_id = :'c1'), 'urgente', '14 resumo traz o status');
select tests.sair();

select * from finish();
rollback;
