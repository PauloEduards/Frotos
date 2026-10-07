begin;
select plan(48);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma,
       (:'c'::jsonb->>'mot_ativo2')::uuid as mb,
       (:'c'::jsonb->>'membro_ativo')::uuid as m1 \gset

select i.id as it_oleo from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Óleo do motor' \gset
select i.id as it_foleo from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Filtro de óleo' \gset
select i.id as it_ar from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Filtro de ar' \gset
select i.id as it_comb from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Filtro de combustível' \gset
select i.id as it_velas from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Velas de ignição' \gset
select i.id as it_fluido from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Fluido de freio' \gset
select i.id as it_c2 from public.vehicle_items i where i.vehicle_id = :'c2' and i.nome = 'Óleo do motor' \gset
select public.hoje_brt() as hoje \gset

-- 0 setup: vínculo ativo de ma no carro1
select tests.entrar_como(:'ma');
select id as a1 from public.iniciar_retirada(:'c1', 10000) \gset
insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
select :'a1', 'retirada', p, :'f' || '/' || :'c1' || '/inspecao/r' || p || '.jpg', now()
from unnest(array['frente','traseira','lateral_esq','lateral_dir']::public.posicao_foto[]) p;
select public.concluir_retirada(:'a1');
select tests.sair();

-- 1 matriz de permissão (24 combinações)
select set_config('test.c1', :'c1', true), set_config('test.ma', :'ma', true),
       set_config('test.f', :'f', true), set_config('test.it', :'it_oleo', true) \gset
create temp table matriz (modo text, pedido boolean, nivel text, trava boolean, res text);
do $do$
declare
  v_modo text; v_ped boolean; v_niv text; v_trava boolean; v_res text;
  v_c1 uuid := current_setting('test.c1')::uuid;
  v_ma uuid := current_setting('test.ma')::uuid;
  v_f uuid := current_setting('test.f')::uuid;
  v_it uuid := current_setting('test.it')::uuid;
  v_pedido uuid;
begin
  foreach v_modo in array array['proprietario_leva', 'motoristas_levam'] loop
    foreach v_ped in array array[true, false] loop
      foreach v_niv in array array['sem_permissao', 'com_aprovacao', 'confiavel'] loop
        foreach v_trava in array array[true, false] loop
          update public.fleets set modo_manutencao = v_modo::public.modo_manutencao where id = v_f;
          update public.fleet_members set nivel_manutencao = v_niv::public.nivel_manutencao
            where fleet_id = v_f and driver_id = v_ma;
          update public.vehicles set exige_aprovacao_sempre = v_trava where id = v_c1;
          v_pedido := null;
          if v_ped then
            insert into public.maintenance_requests (vehicle_id, driver_id, itens, prazo)
            values (v_c1, v_ma, array[v_it], current_date + 7) returning id into v_pedido;
          end if;
          perform tests.entrar_como(v_ma);
          v_res := public.permissao_registro(v_c1);
          perform tests.sair();
          insert into matriz values (v_modo, v_ped, v_niv, v_trava, v_res);
          if v_pedido is not null then
            update public.maintenance_requests set status = 'cancelado' where id = v_pedido;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;
end
$do$;
select results_eq(
  $q$select modo, pedido, nivel, trava, res from matriz order by modo desc, pedido desc, nivel, trava desc$q$,
  $q$select * from (values
  ('proprietario_leva', true, 'sem_permissao', true, 'pendente'),
  ('proprietario_leva', true, 'sem_permissao', false, 'pendente'),
  ('proprietario_leva', true, 'com_aprovacao', true, 'pendente'),
  ('proprietario_leva', true, 'com_aprovacao', false, 'pendente'),
  ('proprietario_leva', true, 'confiavel', true, 'pendente'),
  ('proprietario_leva', true, 'confiavel', false, 'aprovado'),
  ('proprietario_leva', false, 'sem_permissao', true, 'negado'),
  ('proprietario_leva', false, 'sem_permissao', false, 'negado'),
  ('proprietario_leva', false, 'com_aprovacao', true, 'negado'),
  ('proprietario_leva', false, 'com_aprovacao', false, 'negado'),
  ('proprietario_leva', false, 'confiavel', true, 'negado'),
  ('proprietario_leva', false, 'confiavel', false, 'negado'),
  ('motoristas_levam', true, 'sem_permissao', true, 'pendente'),
  ('motoristas_levam', true, 'sem_permissao', false, 'pendente'),
  ('motoristas_levam', true, 'com_aprovacao', true, 'pendente'),
  ('motoristas_levam', true, 'com_aprovacao', false, 'pendente'),
  ('motoristas_levam', true, 'confiavel', true, 'pendente'),
  ('motoristas_levam', true, 'confiavel', false, 'aprovado'),
  ('motoristas_levam', false, 'sem_permissao', true, 'negado'),
  ('motoristas_levam', false, 'sem_permissao', false, 'negado'),
  ('motoristas_levam', false, 'com_aprovacao', true, 'pendente'),
  ('motoristas_levam', false, 'com_aprovacao', false, 'pendente'),
  ('motoristas_levam', false, 'confiavel', true, 'pendente'),
  ('motoristas_levam', false, 'confiavel', false, 'aprovado')
  ) as t(modo, pedido, nivel, trava, res) order by modo desc, pedido desc, nivel, trava desc$q$,
  '1 matriz de permissão');
select is((select count(*)::int from matriz), 24, '1 24 combinações');

-- 2 dono
update public.vehicles set exige_aprovacao_sempre = false where id = :'c1';
select tests.entrar_como(:'dono');
select is(public.permissao_registro(:'c1'), 'aprovado', '2 dono aprovado');
select tests.sair();

-- 3 confiável registra óleo
update public.fleets set modo_manutencao = 'motoristas_levam' where id = :'f';
update public.fleet_members set nivel_manutencao = 'confiavel' where id = :'m1';
select tests.entrar_como(:'ma');
select id as r1, status::text as st_r1 from public.registrar_servico(
  :'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_oleo', 'valor', 150.00)),
  10500, :'hoje'::date, 150, null, 'Oficina X', :'f' || '/' || :'c1' || '/notas/n1.jpg',
  :'f' || '/' || :'c1' || '/painel/p1.jpg') \gset
select tests.sair();
select is(:'st_r1'::text, 'aprovado', '3 confiável fica aprovado');
select is((select ultimo_km from public.vehicle_items where id = :'it_oleo'), 10500, '3 óleo ultimo_km 10500');
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'servico_registrado' and ref_id = :'r1'), 1, '3 dono recebeu servico_registrado');

-- 4 com_aprovacao registra
update public.fleet_members set nivel_manutencao = 'com_aprovacao' where id = :'m1';
select tests.entrar_como(:'ma');
select id as r2, status::text as st_r2 from public.registrar_servico(
  :'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_foleo', 'valor', 40)),
  10500, :'hoje'::date, 40, null, null, :'f' || '/' || :'c1' || '/notas/n2.jpg') \gset
select tests.sair();
select is(:'st_r2'::text, 'pendente', '4 com_aprovacao fica pendente');
select is((select ultimo_km from public.vehicle_items where id = :'it_foleo'), null, '4 item não muda');
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'servico_pendente' and ref_id = :'r2'), 1, '4 dono recebeu servico_pendente');

-- 5 dono aprova
select tests.entrar_como(:'dono');
select is((select status::text from public.revisar_servico(:'r2', 'aprovar')), 'aprovado', '5 aprovado');
select tests.sair();
select is((select ultimo_km from public.vehicle_items where id = :'it_foleo'), 10500, '5 item atualizado');
select is((select count(*)::int from public.notifications where user_id = :'ma' and tipo = 'servico_revisado' and ref_id = :'r2'), 1, '5 motorista recebeu servico_revisado');

-- 6 transições
select tests.entrar_como(:'dono');
select throws_ok(format($$select public.revisar_servico(%L, 'recusar')$$, :'r1'), 'P0001', 'TRANSICAO_INVALIDA', '6 recusar aprovado');
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.revisar_servico(%L, 'contestar')$$, :'r1'), 'P0001', 'SEM_ACESSO', '6 motorista não revisa');
select tests.sair();

-- 7 contestar desfaz
select tests.entrar_como(:'dono');
select public.definir_historico_inicial(:'it_ar', 8000, date '2025-01-10');
select tests.sair();
update public.fleet_members set nivel_manutencao = 'confiavel' where id = :'m1';
select tests.entrar_como(:'ma');
select id as r_ar from public.registrar_servico(
  :'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_ar')),
  10500, :'hoje'::date, 60, null, null, :'f' || '/' || :'c1' || '/notas/n3.jpg') \gset
select id as r_comb from public.registrar_servico(
  :'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_comb')),
  10500, :'hoje'::date, 80, null, null, :'f' || '/' || :'c1' || '/notas/n4.jpg') \gset
select tests.sair();
select is((select ultimo_km from public.vehicle_items where id = :'it_ar'), 10500, '7 ar aplicado');
select tests.entrar_como(:'dono');
select public.revisar_servico(:'r_ar', 'contestar', 'Valor errado');
select public.revisar_servico(:'r_comb', 'contestar');
select tests.sair();
select is((select ultimo_km from public.vehicle_items where id = :'it_ar'), 8000, '7 contestar volta ao histórico inicial');
select ok((select ultimo_km is null and ultima_data is null from public.vehicle_items where id = :'it_comb'), '7 sem histórico volta a null');

-- 8 nota obrigatória
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.registrar_servico(%L, '[{"nome_outro":"Lâmpada","valor":20}]'::jsonb, 10500, %L::date, 20)$$, :'c1', :'hoje'),
  'P0001', 'FOTO_NOTA_OBRIGATORIA', '8 motorista sem nota');
select tests.sair();
select tests.entrar_como(:'dono');
select lives_ok(format($$select public.registrar_servico(%L, jsonb_build_array(jsonb_build_object('vehicle_item_id', %L)), 10500, %L::date, 150)$$, :'c1', :'it_velas', :'hoje'),
  '8 dono sem nota ok');
select tests.sair();

-- 9 e 10 km
update public.vehicles set km_atual = 12000 where id = :'c1';
select count(*)::int as n_leit from public.odometer_readings where vehicle_id = :'c1' and origem = 'manutencao' \gset
select tests.entrar_como(:'dono');
select public.registrar_servico(:'c1', jsonb_build_array(jsonb_build_object('nome_outro', 'Lâmpada')), 11500, :'hoje'::date, 20);
select tests.sair();
select is((select count(*)::int from public.odometer_readings where vehicle_id = :'c1' and origem = 'manutencao'), :'n_leit'::int, '9 km menor não gera leitura');
select is((select km_atual from public.vehicles where id = :'c1'), 12000, '9 km_atual intacto');
select tests.entrar_como(:'dono');
select public.registrar_servico(:'c1', jsonb_build_array(jsonb_build_object('nome_outro', 'Lâmpada')), 12100, :'hoje'::date, 20);
select tests.sair();
select is((select count(*)::int from public.odometer_readings where vehicle_id = :'c1' and origem = 'manutencao' and km = 12100), 1, '10 leitura manutencao criada');
select is((select km_atual from public.vehicles where id = :'c1'), 12100, '10 km_atual 12100');

-- 11 validações
select tests.entrar_como(:'dono');
select throws_ok(format($$select public.registrar_servico(%L, jsonb_build_array(jsonb_build_object('vehicle_item_id', %L)), 12100, %L::date, 10)$$, :'c1', :'it_c2', :'hoje'),
  'P0001', 'ITEM_INVALIDO', '11 item de outro carro');
select throws_ok(format($$select public.registrar_servico(%L, '[]'::jsonb, 12100, %L::date, 10)$$, :'c1', :'hoje'),
  'P0001', 'ITENS_OBRIGATORIOS', '11 itens vazios');
select throws_ok(format($$select public.registrar_servico(%L, '[{"nome_outro":"x"}]'::jsonb, 12100, (%L::date + 1), 10)$$, :'c1', :'hoje'),
  'P0001', 'DATA_FUTURA', '11 data futura');
select tests.sair();

-- 12 sem pedido em proprietario_leva
update public.fleets set modo_manutencao = 'proprietario_leva' where id = :'f';
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.registrar_servico(%L, '[{"nome_outro":"x"}]'::jsonb, 12100, %L::date, 10, null, null, 'n.jpg')$$, :'c1', :'hoje'),
  'P0001', 'SEM_PERMISSAO', '12 proprietario_leva sem pedido');
select tests.sair();

-- 13 criar pedido
select tests.entrar_como(:'dono');
select throws_ok(format($$select public.criar_pedido(%L, array[%L]::uuid[], (%L::date + 7))$$, :'c2', :'it_c2', :'hoje'),
  'P0001', 'CARRO_SEM_MOTORISTA', '13 carro sem motorista');
select id as ped1 from public.criar_pedido(:'c1', array[:'it_oleo']::uuid[], :'hoje'::date + 7, 'Trocar') \gset
select tests.sair();
select is((select count(*)::int from public.notifications where user_id = :'ma' and tipo = 'pedido_novo' and ref_id = :'ped1'), 1, '13 motorista recebeu pedido_novo');

-- 14 sem_permissao via pedido
update public.fleet_members set nivel_manutencao = 'sem_permissao' where id = :'m1';
select tests.entrar_como(:'ma');
select id as r_ped, status::text as st_ped from public.registrar_servico(
  :'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_oleo', 'valor', 210)),
  12100, :'hoje'::date, 210, :'ped1', null, :'f' || '/' || :'c1' || '/notas/n5.jpg') \gset
select tests.sair();
select is(:'st_ped'::text, 'pendente', '14 via pedido fica pendente');
select is((select status::text from public.maintenance_requests where id = :'ped1'), 'aberto', '14 pedido segue aberto');
select tests.entrar_como(:'dono');
select public.revisar_servico(:'r_ped', 'aprovar');
select tests.sair();
select is((select status::text from public.maintenance_requests where id = :'ped1'), 'concluido', '14 pedido concluído ao aprovar');

-- 15 pedido inválido
update public.fleets set modo_manutencao = 'motoristas_levam' where id = :'f';
update public.fleet_members set nivel_manutencao = 'com_aprovacao' where id = :'m1';
insert into public.maintenance_requests (vehicle_id, driver_id, itens, prazo)
values (:'c1', :'mb', array[:'it_oleo']::uuid[], :'hoje'::date + 5) returning id as ped_mb \gset
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.registrar_servico(%L, '[{"nome_outro":"x"}]'::jsonb, 12100, %L::date, 10, %L, null, 'n.jpg')$$, :'c1', :'hoje', :'ped_mb'),
  'P0001', 'PEDIDO_INVALIDO', '15 pedido de outro motorista');
select throws_ok(format($$select public.registrar_servico(%L, '[{"nome_outro":"x"}]'::jsonb, 12100, %L::date, 10, %L, null, 'n.jpg')$$, :'c1', :'hoje', :'ped1'),
  'P0001', 'PEDIDO_INVALIDO', '15 pedido já concluído');
select tests.sair();

-- 17 cancelar pedido
select tests.entrar_como(:'dono');
select id as ped2 from public.criar_pedido(:'c1', array[:'it_foleo']::uuid[], :'hoje'::date + 3) \gset
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.cancelar_pedido(%L)$$, :'ped2'), 'P0001', 'SEM_ACESSO', '17 motorista não cancela');
select tests.sair();
select tests.entrar_como(:'dono');
select is((select status::text from public.cancelar_pedido(:'ped2')), 'cancelado', '17 dono cancela');
select throws_ok(format($$select public.cancelar_pedido(%L)$$, :'ped2'), 'P0001', 'PEDIDO_INVALIDO', '17 já cancelado');
select tests.sair();

-- 18 custo médio (óleo: aprovados com 150 e 210)
select tests.entrar_como(:'dono');
select is(public.custo_medio_item(:'it_oleo'), 180::numeric, '18 custo médio 180');
select is(public.custo_medio_item(:'it_fluido'), null, '18 sem serviço é null');
select tests.sair();

-- 19 RLS
select tests.entrar_como(:'ma');
select ok((select count(*) from public.maintenance_records where vehicle_id = :'c1') > 0, '19 motorista com vínculo vê serviços');
select ok((select count(*) from public.maintenance_record_items) > 0, '19 vê itens dos serviços');
select throws_ok(format($$insert into public.maintenance_records (vehicle_id, autor_id, km, data, valor_total, status) values (%L, %L, 1, %L, 1, 'aprovado')$$, :'c1', :'ma', :'hoje'),
  '42501', null, '19 sem insert direto');
select tests.sair();
select tests.entrar_como(:'mb');
select is((select count(*)::int from public.maintenance_records where vehicle_id = :'c1'), 0, '19 outro motorista não vê serviços');
select is((select count(*)::int from public.maintenance_requests where vehicle_id = :'c1' and driver_id = :'ma'), 0, '19 outro motorista não vê pedidos alheios');
select tests.sair();

-- 16 devolver carro cancela pedido aberto
select tests.entrar_como(:'dono');
select id as ped3 from public.criar_pedido(:'c1', array[:'it_foleo']::uuid[], :'hoje'::date + 3) \gset
select tests.sair();
select tests.entrar_como(:'ma');
insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
select :'a1', 'devolucao', p, :'f' || '/' || :'c1' || '/inspecao/d' || p || '.jpg', now()
from unnest(array['frente','traseira','lateral_esq','lateral_dir']::public.posicao_foto[]) p;
select public.devolver_carro(:'a1', 12100);
select tests.sair();
select is((select status::text from public.maintenance_requests where id = :'ped3'), 'cancelado', '16 devolver cancela pedido');
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'pedido_cancelado' and ref_id = :'ped3'), 1, '16 dono recebeu pedido_cancelado');
select is((select status::text from public.maintenance_requests where id = :'ped_mb'), 'aberto', '16 pedido de outro motorista segue aberto');

-- 16b remover motorista cancela pedido
select tests.entrar_como(:'ma');
select id as a2 from public.iniciar_retirada(:'c1', 12100) \gset
insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
select :'a2', 'retirada', p, :'f' || '/' || :'c1' || '/inspecao/q' || p || '.jpg', now()
from unnest(array['frente','traseira','lateral_esq','lateral_dir']::public.posicao_foto[]) p;
select public.concluir_retirada(:'a2');
select tests.sair();
select tests.entrar_como(:'dono');
select id as ped4 from public.criar_pedido(:'c1', array[:'it_foleo']::uuid[], :'hoje'::date + 3) \gset
select public.remover_motorista(:'m1');
select tests.sair();
select is((select status::text from public.maintenance_requests where id = :'ped4'), 'cancelado', '16 remover motorista cancela pedido');

select * from finish();
rollback;
