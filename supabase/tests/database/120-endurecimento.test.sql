-- Endurecimento: fotos no servidor, storage por carro, perfis, remoção, previsão, pedidos e checks.
begin;
select plan(50);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma,
       (:'c'::jsonb->>'mot_ativo2')::uuid as mb,
       (:'c'::jsonb->>'mot_pendente')::uuid as mp,
       (:'c'::jsonb->>'membro_ativo')::uuid as m1 \gset
select public.hoje_brt() as hoje \gset
select i.id as it_oleo from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Óleo do motor' \gset
select i.id as it_ar from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Filtro de ar' \gset

-- ========== 1 Fotos precisam existir no servidor ==========
select has_function('public', 'foto_valida', array['text', 'uuid', 'uuid'], '1 foto_valida existe');
select ok(not coalesce(has_function_privilege('authenticated', to_regprocedure('public.foto_valida(text, uuid, uuid)'), 'execute'), true),
  '1 foto_valida é interna');

select tests.criar_foto(:'f', :'c2', 'inspecao') as foto_c2 \gset
select tests.entrar_como(:'ma');
select id as a1 from public.iniciar_retirada(:'c1', 10000) \gset
select throws_ok(format($$insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
  values (%L, 'retirada', 'frente', %L, now())$$, :'a1', :'f' || '/' || :'c1' || '/inspecao/fantasma.jpg'),
  'P0001', 'FOTO_INVALIDA', '1 inspeção: caminho sem objeto no storage');
select throws_ok(format($$insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
  values (%L, 'retirada', 'frente', %L, now())$$, :'a1', :'foto_c2'),
  'P0001', 'FOTO_INVALIDA', '1 inspeção: objeto existe mas é de outro carro');
insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
select :'a1', 'retirada', p, tests.criar_foto(:'f', :'c1', 'inspecao'), now()
from unnest(array['frente','traseira','lateral_esq','lateral_dir','painel']::public.posicao_foto[]) p;
select is((select status::text from public.concluir_retirada(:'a1')), 'ativo', '1 inspeção com fotos reais conclui');

-- registrar_km: foto do painel inexistente
select throws_ok(format($$select public.registrar_km(%L, 20000, 'atualizacao', %L)$$, :'c1', :'f' || '/' || :'c1' || '/painel/nao-existe.jpg'),
  'P0001', 'FOTO_INVALIDA', '1 registrar_km: painel inexistente');
select throws_ok(format($$select public.registrar_km(%L, 10100, 'atualizacao', %L)$$, :'c1', :'foto_c2'),
  'P0001', 'FOTO_INVALIDA', '1 registrar_km: foto de outro carro, mesmo sem salto');
select tests.sair();

-- registrar_servico: nota inexistente
update public.fleets set modo_manutencao = 'motoristas_levam' where id = :'f';
update public.fleet_members set nivel_manutencao = 'confiavel' where id = :'m1';
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.registrar_servico(%L, '[{"nome_outro":"Lâmpada"}]'::jsonb, 10000, %L::date, 20, null, null, %L)$$,
  :'c1', :'hoje', :'f' || '/' || :'c1' || '/notas/nao-existe.jpg'),
  'P0001', 'FOTO_INVALIDA', '1 registrar_servico: nota inexistente');
select tests.criar_foto(:'f', :'c1', 'notas') as nota_ok \gset
select lives_ok(format($$select public.registrar_servico(%L, '[{"nome_outro":"Lâmpada"}]'::jsonb, 10000, %L::date, 20, null, null, %L)$$,
  :'c1', :'hoje', :'nota_ok'), '1 registrar_servico: nota real aceita');

-- incident_photos
select id as inc1 from public.relatar_ocorrencia(:'c1', 'mecanico', 'Barulho') \gset
select throws_ok(format($$insert into public.incident_photos (incident_id, path, capturado_em) values (%L, %L, now())$$,
  :'inc1', :'f' || '/' || :'c1' || '/ocorrencias/nao-existe.jpg'),
  'P0001', 'FOTO_INVALIDA', '1 ocorrência: foto inexistente');
select tests.criar_foto(:'f', :'c1', 'ocorrencias') as foto_inc \gset
select lives_ok(format($$insert into public.incident_photos (incident_id, path, capturado_em) values (%L, %L, now())$$,
  :'inc1', :'foto_inc'), '1 ocorrência: foto real aceita');
select tests.sair();

-- ========== 11 incident_photos.recebido_em ==========
select col_not_null('public', 'incident_photos', 'recebido_em', '11 recebido_em not null');
select ok((select recebido_em is not null from public.incident_photos where incident_id = :'inc1'), '11 recebido_em preenchido');

-- ========== 2 Storage segue as regras das tabelas ==========
insert into storage.objects (bucket_id, name) values
  ('fotos', :'f' || '/' || :'c2' || '/inspecao/so-c2.jpg'),
  ('fotos', :'f' || '/' || :'c1' || '/inspecao/so-c1.jpg'),
  ('fotos', :'f' || '/lixo/inspecao/x.jpg');
insert into storage.objects (bucket_id, name, owner_id) values
  ('fotos', :'f' || '/' || :'c1' || '/inspecao/do-mb.jpg', :'mb');
select tests.entrar_como(:'ma');
select is((select count(*)::int from storage.objects where name = :'f' || '/' || :'c2' || '/inspecao/so-c2.jpg'), 0,
  '2 motorista com vínculo no carro1 não lê pasta do carro2');
select is((select count(*)::int from storage.objects where name = :'f' || '/' || :'c1' || '/inspecao/so-c1.jpg'), 1,
  '2 motorista lê pasta do próprio carro');
select is((select count(*)::int from storage.objects where name = :'f' || '/lixo/inspecao/x.jpg'), 0,
  '2 segundo segmento malformado não é visível nem quebra');
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner_id) values ('fotos', %L, %L)$$,
  :'f' || '/' || :'c2' || '/inspecao/up.jpg', :'ma'), '42501', null, '2 motorista não envia para a pasta do carro2');
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner_id) values ('fotos', %L, %L)$$,
  :'f' || '/lixo/inspecao/up.jpg', :'ma'), '42501', null, '2 segundo segmento malformado bloqueado');
select lives_ok(format($$insert into storage.objects (bucket_id, name, owner_id) values ('fotos', %L, %L)$$,
  :'f' || '/' || :'c1' || '/inspecao/up.jpg', :'ma'), '2 motorista envia para a pasta do próprio carro');
select tests.sair();
select tests.entrar_como(:'mb');
select is((select count(*)::int from storage.objects where name = :'f' || '/' || :'c1' || '/inspecao/do-mb.jpg'), 1,
  '2 quem enviou continua lendo o próprio objeto');
select is((select count(*)::int from storage.objects where name = :'f' || '/' || :'c1' || '/inspecao/so-c1.jpg'), 0,
  '2 membro sem vínculo não lê a pasta do carro');
select tests.sair();
select tests.entrar_como(:'dono');
select is((select count(*)::int from storage.objects where name like :'f' || '/%' and name not like '%/lixo/%'
           and name in (:'f' || '/' || :'c2' || '/inspecao/so-c2.jpg', :'f' || '/' || :'c1' || '/inspecao/so-c1.jpg')), 2,
  '2 dono lê todas as pastas');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('fotos', %L)$$,
  :'f' || '/' || :'c2' || '/inspecao/dono.jpg'), '2 dono envia para qualquer carro da frota');
select tests.sair();

-- ========== 3 Perfis ==========
select tests.entrar_como(:'ma');
select throws_ok(format($$select expo_push_token from public.profiles where id = %L$$, :'ma'),
  '42501', null, '3 expo_push_token não é legível');
select is((select nome from public.profiles where id = :'ma'), 'Motorista A', '3 colunas públicas legíveis');
select lives_ok($$update public.profiles set expo_push_token = 'ExponentPushToken[y]' where id = auth.uid()$$,
  '3 atualiza o próprio token');
select is((select count(*)::int from public.profiles where id = :'dono'), 1, '3 membro ativo vê o dono');
select tests.sair();
select is((select expo_push_token from public.profiles where id = :'ma'), 'ExponentPushToken[y]', '3 token gravado');
select tests.entrar_como(:'mp');
select is((select count(*)::int from public.profiles where id = :'dono'), 0, '3 pendente não vê o dono');
select tests.sair();

-- ========== 9 registrar_km do dono não notifica ==========
select tests.entrar_como(:'dono');
select id as leit_dono from public.registrar_km(:'c1', 15000, 'atualizacao', tests.criar_foto(:'f', :'c1', 'painel')) \gset
select tests.sair();
select is((select salto_suspeito from public.odometer_readings where id = :'leit_dono'), true, '9 salto do dono marcado');
select is((select count(*)::int from public.notifications where tipo = 'km_foto_painel' and ref_id = :'leit_dono'), 0,
  '9 dono não recebe aviso do próprio salto');

-- ========== 7 criar_pedido com nulls ==========
select tests.entrar_como(:'dono');
select throws_ok(format($$select public.criar_pedido(%L, array[%L, null]::uuid[], %L::date + 5)$$, :'c1', :'it_oleo', :'hoje'),
  'P0001', 'ITEM_INVALIDO', '7 array com null');
select throws_ok(format($$select public.criar_pedido(%L, array[null]::uuid[], %L::date + 5)$$, :'c1', :'hoje'),
  'P0001', 'ITEM_INVALIDO', '7 array só com null');
select throws_ok(format($$select public.criar_pedido(%L, '{}'::uuid[], %L::date + 5)$$, :'c1', :'hoje'),
  'P0001', 'ITENS_OBRIGATORIOS', '7 array vazio');

-- ========== 8 serviço do dono vincula o único pedido aberto ==========
select id as ped from public.criar_pedido(:'c1', array[:'it_oleo']::uuid[], :'hoje'::date + 5) \gset
select id as r_dono from public.registrar_servico(:'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_oleo')),
  15000, :'hoje'::date, 180) \gset
select tests.sair();
select is((select request_id from public.maintenance_records where id = :'r_dono'), :'ped'::uuid, '8 pedido vinculado');
select is((select status::text from public.maintenance_requests where id = :'ped'), 'concluido', '8 pedido concluído');
-- com dois pedidos abertos, não adivinha
insert into public.maintenance_requests (vehicle_id, driver_id, itens, prazo) values
  (:'c1', :'ma', array[:'it_oleo']::uuid[], :'hoje'::date + 5),
  (:'c1', :'ma', array[:'it_ar']::uuid[], :'hoje'::date + 5);
select tests.entrar_como(:'dono');
select id as r_dono2 from public.registrar_servico(:'c1', '[{"nome_outro":"Lavagem"}]'::jsonb, 15000, :'hoje'::date, 30) \gset
select tests.sair();
select is((select request_id from public.maintenance_records where id = :'r_dono2'), null, '8 dois pedidos abertos: sem vínculo');

-- ========== 6 item sem critério utilizável ==========
-- tem data mas só intervalo em km (sem km de referência): nenhuma data/km previstos
update public.vehicle_items set intervalo_km = 10000, intervalo_meses = null, km_inicial = null, data_inicial = :'hoje'::date - 30,
  ultimo_km = null, ultima_data = :'hoje'::date - 30 where id = :'it_ar';
select is((select status::text from public.previsao_itens_interna(:'c1', :'hoje'::date) where vehicle_item_id = :'it_ar'),
  'sem_historico', '6 sem critério utilizável é sem_historico');
select tests.entrar_como(:'dono');
select is((select count(*)::int from public.projecao_gastos(:'f', 30, :'hoje'::date) g
           where g.vehicle_item_id = :'it_ar' and g.data is null), 1, '6 projeção lista como revisão recomendada');
select tests.sair();

-- ========== 10 CHECKs ==========
select throws_ok(format($$update public.vehicle_items set intervalo_km = 0 where id = %L$$, :'it_oleo'), '23514', null, '10 intervalo_km > 0');
select throws_ok(format($$update public.vehicle_items set intervalo_meses = 0 where id = %L$$, :'it_oleo'), '23514', null, '10 intervalo_meses > 0');
select throws_ok(format($$update public.vehicle_items set custo_estimado = -1 where id = %L$$, :'it_oleo'), '23514', null, '10 custo_estimado >= 0');
select throws_ok(format($$update public.fleets set limite_salto_km_dia = 0 where id = %L$$, :'f'), '23514', null, '10 limite_salto_km_dia > 0');
select throws_ok(format($$update public.fleets set limiar_amarelo_km = -1 where id = %L$$, :'f'), '23514', null, '10 limiar_amarelo_km >= 0');
select throws_ok(format($$update public.fleets set limiar_amarelo_dias = -1 where id = %L$$, :'f'), '23514', null, '10 limiar_amarelo_dias >= 0');
select throws_ok(format($$update public.fleets set limiar_laranja_km = -1 where id = %L$$, :'f'), '23514', null, '10 limiar_laranja_km >= 0');

-- ========== 5 motorista removido perde o acesso ==========
select tests.entrar_como(:'dono');
select public.remover_motorista(:'m1');
select tests.sair();
select tests.entrar_como(:'ma');
select is((select count(*)::int from public.vehicles where fleet_id = :'f'), 0, '5 removido não vê carros da frota');
select is((select count(*)::int from public.vehicle_items where vehicle_id in (:'c1', :'c2')), 0, '5 removido não vê itens');
select throws_ok(format($$select * from public.previsao_itens(%L)$$, :'c1'), 'P0001', 'SEM_ACESSO', '5 removido sem previsão');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos' and name like :'f' || '/%'
           and (owner_id is distinct from :'ma'::text)), 0, '5 removido não lê objetos da frota');
select tests.sair();

select * from finish();
rollback;
