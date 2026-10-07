begin;
select plan(23);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma \gset

-- setup: carro1 só com o item de teste, vínculo ativo do motorista A, sem leituras
delete from public.odometer_readings where vehicle_id = :'c1';
delete from public.vehicle_items where vehicle_id = :'c1';
insert into public.vehicle_items (vehicle_id, nome, intervalo_km, intervalo_meses, ultimo_km, ultima_data, custo_estimado)
values (:'c1', 'Óleo do motor', 10000, 6, 10000, '2026-09-01', 250) returning id as it \gset
insert into public.assignments (vehicle_id, driver_id, status, km_inicio) values (:'c1', :'ma', 'ativo', 10000);
update public.vehicles set km_atual = 19200, km_dia_estimado = 300, em_uso = true where id = :'c1';
update public.vehicle_items set status_atual = 'em_dia' where id = :'it';

-- 1 muda de em_dia para proximo
select public.rotina_diaria('2026-10-06');
select is((select status_atual::text from public.vehicle_items where id = :'it'), 'proximo', '1 status_atual atualizado');
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'status_item' and ref_id = :'it'), 1, '1 dono recebe 1');
select is((select count(*)::int from public.notifications where user_id = :'ma' and tipo = 'status_item' and ref_id = :'it'), 1, '1 motorista recebe 1');

-- 2 idempotente
select public.rotina_diaria('2026-10-06');
select is((select count(*)::int from public.notifications where tipo = 'status_item' and ref_id = :'it'), 2, '2 nada novo no mesmo dia');

-- 3 modo proprietario_leva
select is((select corpo from public.notifications where user_id = :'dono' and tipo = 'status_item' and ref_id = :'it'),
          'Óleo do motor está próximo do vencimento. Agende a manutenção.', '3 corpo do dono');
select is((select corpo from public.notifications where user_id = :'ma' and tipo = 'status_item' and ref_id = :'it'),
          'Óleo do motor do carro ABC1D23 está próximo do vencimento. O proprietário vai combinar com você.', '3 corpo do motorista');

-- 4 modo motoristas_levam
delete from public.notifications where ref_id = :'it';
update public.vehicle_items set status_atual = 'em_dia' where id = :'it';
update public.fleets set modo_manutencao = 'motoristas_levam' where id = :'f';
select public.rotina_diaria('2026-10-06');
select is((select corpo from public.notifications where user_id = :'dono' and tipo = 'status_item' and ref_id = :'it'),
          'Óleo do motor do carro ABC1D23 está próximo do vencimento. O motorista foi avisado.', '4 corpo do dono');
select is((select corpo from public.notifications where user_id = :'ma' and tipo = 'status_item' and ref_id = :'it'),
          'Óleo do motor está próximo do vencimento. Leve o carro ABC1D23 à oficina até '
          || (select to_char(data_prevista, 'DD/MM') from public.previsao_itens_interna(:'c1', '2026-10-06')) || '.',
          '4 corpo do motorista');
update public.fleets set modo_manutencao = 'proprietario_leva' where id = :'f';

-- 5 vencido = alta; em_dia e sem_historico não avisam
delete from public.notifications where ref_id = :'it';
update public.vehicles set km_atual = 20000 where id = :'c1';
select public.rotina_diaria('2026-10-06');
select is((select status_atual::text from public.vehicle_items where id = :'it'), 'vencido', '5 vencido');
select is((select prioridade from public.notifications where user_id = :'dono' and tipo = 'status_item' and ref_id = :'it'), 'alta', '5 prioridade alta');
delete from public.notifications where ref_id = :'it';
update public.vehicles set km_atual = 13000 where id = :'c1';
select public.rotina_diaria('2026-10-06');
select is((select status_atual::text from public.vehicle_items where id = :'it'), 'em_dia', '5 volta a em_dia');
select is((select count(*)::int from public.notifications where ref_id = :'it'), 0, '5 em_dia sem aviso');
update public.vehicle_items set ultimo_km = null, ultima_data = null where id = :'it';
select public.rotina_diaria('2026-10-06');
select is((select status_atual::text from public.vehicle_items where id = :'it'), 'sem_historico', '5 sem_historico');
select is((select count(*)::int from public.notifications where ref_id = :'it'), 0, '5 sem_historico sem aviso');

-- 6 lembrete de km
insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em)
values (:'c1', :'dono', 13000, 'atualizacao', '2026-09-28 15:00+00');
select public.rotina_diaria('2026-10-06');
select is((select count(*)::int from public.notifications where user_id = :'ma' and tipo = 'lembrete_km' and ref_id = :'c1'), 1, '6 lembrete enviado');
select is((select corpo from public.notifications where user_id = :'ma' and tipo = 'lembrete_km' and ref_id = :'c1'),
          'Atualize o km do carro ABC1D23.', '6 corpo do lembrete');
select public.rotina_diaria('2026-10-07');
select is((select count(*)::int from public.notifications where user_id = :'ma' and tipo = 'lembrete_km' and ref_id = :'c1'), 1, '6 não repete');

-- 7 pedido com prazo vencido
insert into public.maintenance_requests (vehicle_id, driver_id, itens, prazo)
values (:'c1', :'ma', array[:'it'::uuid], '2026-10-05') returning id as rq \gset
select public.rotina_diaria('2026-10-06');
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'pedido_prazo' and ref_id = :'rq'), 1, '7 dono avisado');
select is((select count(*)::int from public.notifications where user_id = :'ma' and tipo = 'pedido_prazo' and ref_id = :'rq'), 1, '7 motorista avisado');
select is((select prazo_notificado from public.maintenance_requests where id = :'rq'), true, '7 prazo_notificado');
select public.rotina_diaria('2026-10-06');
select is((select count(*)::int from public.notifications where tipo = 'pedido_prazo' and ref_id = :'rq'), 2, '7 não repete');

-- 8 authenticated não executa
select tests.entrar_como(:'dono');
select throws_ok($$select public.rotina_diaria()$$, '42501', null, '8 sem execute para authenticated');
select tests.sair();

-- 9 agendamento
select is((select schedule from cron.job where jobname = 'rotina-diaria'), '0 11 * * *', '9 job agendado às 11:00 UTC');

select * from finish();
rollback;
