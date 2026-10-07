begin;
select plan(41);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma,
       (:'c'::jsonb->>'mot_ativo2')::uuid as mb,
       (:'c'::jsonb->>'mot_pendente')::uuid as mp,
       (:'c'::jsonb->>'membro_ativo')::uuid as m1 \gset

-- 1
select tests.entrar_como(:'ma');
select id as a1, status::text as st1 from public.iniciar_retirada(:'c1', 10000) \gset
select is(:'st1'::text, 'aguardando_fotos', '1 retirada inicia aguardando_fotos');
select is((select em_uso from public.vehicles where id = :'c1'), true, '1 carro em uso');
select is((select count(*)::int from public.odometer_readings where vehicle_id = :'c1' and origem = 'retirada'), 1, '1 leitura retirada');

-- 2
select tests.sair();
select tests.entrar_como(:'mb');
select throws_ok(format($$select public.iniciar_retirada(%L, 10000)$$, :'c1'), 'P0001', 'CARRO_OCUPADO', '2 carro ocupado');

-- 3 corrida simulada: vínculo aberto de outro usuário com em_uso false
select tests.sair();
insert into public.assignments (vehicle_id, driver_id, km_inicio) values (:'c2', :'mp', 10000);
select tests.entrar_como(:'mb');
select throws_ok(format($$select public.iniciar_retirada(%L, 10000)$$, :'c2'), 'P0001', 'CARRO_OCUPADO', '3 unique_violation vira CARRO_OCUPADO');
select tests.sair();
delete from public.assignments where vehicle_id = :'c2';

-- 4
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.iniciar_retirada(%L, 10000)$$, :'c2'), 'P0001', 'JA_TEM_CARRO', '4 já tem carro');
select tests.sair();
select tests.entrar_como(:'mp');
select throws_ok(format($$select public.iniciar_retirada(%L, 10000)$$, :'c2'), 'P0001', 'SEM_ACESSO', '4 pendente sem acesso');

-- 5
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.concluir_retirada(%L)$$, :'a1'), 'P0001', 'FOTOS_FALTANDO', '5 sem fotos');
insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
select :'a1', 'retirada', p, tests.criar_foto(:'f', :'c1', 'inspecao'), now()
from unnest(array['frente','traseira','lateral_esq','lateral_dir']::public.posicao_foto[]) p;
select is((select status::text from public.concluir_retirada(:'a1')), 'ativo', '5 com fotos fica ativo');

-- 6
select throws_ok(format($$select public.registrar_km(%L, 9999)$$, :'c1'), 'P0001', 'KM_MENOR', '6 km menor');

-- 7
select throws_ok(format($$select public.registrar_km(%L, 10351)$$, :'c1'), 'P0001', 'FOTO_PAINEL_OBRIGATORIA', '7 salto sem foto');
select lives_ok(format($$select public.registrar_km(%L, 10350)$$, :'c1'), '7 no limite ok');

-- 8 última leitura há 5 dias
select tests.sair();
update public.odometer_readings set capturado_em = now() - interval '5 days' where vehicle_id = :'c1';
select tests.entrar_como(:'ma');
select is((select salto_suspeito from public.registrar_km(:'c1', 12100)), false, '8 +1750 em 5 dias sem foto ok');

-- 9
select is((select salto_suspeito from public.registrar_km(:'c1', 17100, 'atualizacao', tests.criar_foto(:'f', :'c1', 'painel'))), true, '9 salto com foto é suspeito');
select tests.sair();
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'km_foto_painel'), 1, '9 dono notificado');

-- 10
select is((select km_atual from public.vehicles where id = :'c1'), 17100, '10 km_atual atualizado');

-- 11
select tests.entrar_como(:'dono');
select lives_ok(format($$select public.registrar_km(%L, 9000, 'correcao_dono')$$, :'c1'), '11 dono corrige');
select is((select km_atual from public.vehicles where id = :'c1'), 9000, '11 km_atual corrigido');
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.registrar_km(%L, 8000, 'correcao_dono')$$, :'c1'), 'P0001', 'SEM_ACESSO', '11 motorista sem correção');

-- 12
select tests.sair();
select tests.entrar_como(:'mb');
select throws_ok(format($$select public.registrar_km(%L, 10100)$$, :'c2'), 'P0001', 'SEM_ACESSO', '12 sem vínculo');

-- 13
select tests.sair();
select tests.entrar_como(:'ma');
select is((select count(*)::int from public.vehicle_items where vehicle_id = :'c1'), 11, '13 vê itens do carro1');
select is((select count(*)::int from public.vehicle_items where vehicle_id = :'c2'), 0, '13 não vê itens do carro2');

-- 14
select throws_ok(format($$select public.devolver_carro(%L, 9300)$$, :'a1'), 'P0001', 'FOTOS_FALTANDO', '14 devolução sem fotos');
insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
select :'a1', 'devolucao', p, tests.criar_foto(:'f', :'c1', 'inspecao'), now()
from unnest(array['frente','traseira','lateral_esq','lateral_dir']::public.posicao_foto[]) p;
select is((select status::text from public.devolver_carro(:'a1', 9300)), 'encerrado', '14 devolvido');
select tests.sair();
select ok((select fim_em is not null and km_fim = 9300 from public.assignments where id = :'a1'), '14 fim_em e km_fim');
select is((select em_uso from public.vehicles where id = :'c1'), false, '14 carro livre');

-- 15
select tests.entrar_como(:'ma');
select id as a2 from public.iniciar_retirada(:'c1', 9300) \gset
select is((select status::text from public.cancelar_retirada(:'a2')), 'encerrado', '15 cancela aguardando_fotos');
select tests.sair();
select is((select em_uso from public.vehicles where id = :'c1'), false, '15 carro livre após cancelar');
select tests.entrar_como(:'ma');
select id as a3 from public.iniciar_retirada(:'c1', 9300) \gset
insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
select :'a3', 'retirada', p, tests.criar_foto(:'f', :'c1', 'inspecao'), now()
from unnest(array['frente','traseira','lateral_esq','lateral_dir']::public.posicao_foto[]) p;
select public.concluir_retirada(:'a3');
select throws_ok(format($$select public.cancelar_retirada(%L)$$, :'a3'), 'P0001', 'TRANSICAO_INVALIDA', '15 vínculo ativo não cancela');

-- 16
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.remover_motorista(%L)$$, :'m1'), 'P0001', 'SEM_ACESSO', '16 só o dono remove');
select tests.sair();
select tests.entrar_como(:'dono');
select is((select status::text from public.remover_motorista(:'m1')), 'removido', '16 membro removido');
select tests.sair();
select is((select status::text from public.assignments where id = :'a3'), 'encerrado', '16 vínculo encerrado');
select ok((select not em_uso and km_atual = 9300 from public.vehicles where id = :'c1')
  and (select km_fim = 9300 from public.assignments where id = :'a3'), '16 carro livre e km_fim');

-- 17 storage (mb ainda é membro ativo e retira o carro2)
select tests.entrar_como(:'mb');
select public.iniciar_retirada(:'c2', 10000);
select lives_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('fotos', %L, %L)$$,
  :'f' || '/' || :'c2' || '/inspecao/x.jpg', :'mb'), '17 upload na própria frota');
select throws_ok(format($$insert into storage.objects (bucket_id, name, owner) values ('fotos', %L, %L)$$,
  gen_random_uuid()::text || '/' || :'c2' || '/inspecao/x.jpg', :'mb'), '42501', null, '17 outra frota bloqueado');
select tests.sair();

-- 18 caminhos malformados e frota alheia
select tests.sair();
insert into storage.objects (bucket_id, name) values ('fotos', 'lixo/x.jpg');
select tests.criar_usuario('outro-dono@t.com', 'proprietario', 'Outro') as dono_b \gset
select tests.entrar_como(:'dono_b');
select id as fb from public.criar_frota('Frota B') \gset
select tests.sair();
insert into storage.objects (bucket_id, name) values ('fotos', :'fb' || '/x/inspecao/b.jpg');
select tests.entrar_como(:'mb');
select lives_ok($$select count(*) from storage.objects where bucket_id = 'fotos'$$, '18 objeto malformado não quebra a listagem');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos' and name = :'fb' || '/x/inspecao/b.jpg'), 0, '18 não vê objeto de outra frota');
select is((select count(*)::int from storage.objects where bucket_id = 'fotos' and name = :'f' || '/' || :'c2' || '/inspecao/x.jpg'), 1, '18 vê objeto da própria frota');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('fotos', 'lixo/y.jpg')$$, '42501', null, '18 insert malformado bloqueado');

-- 19 horário da leitura
select tests.sair();
select tests.entrar_como(:'dono');
select throws_ok(format($$select public.registrar_km(%L, 9400, 'atualizacao', null, now() + interval '200 days')$$, :'c1'), 'P0001', 'HORARIO_INVALIDO', '19 futuro rejeitado');
select ok((select capturado_em between now() - interval '1 minute' and now() + interval '1 minute' from public.registrar_km(:'c1', 9400, 'atualizacao', null, null)), '19 null vira now()');
select tests.sair();

select * from finish();
rollback;
