-- Bloco 1: visibilidade do carro dentro da frota.
begin;
select plan(17);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma,
       (:'c'::jsonb->>'mot_ativo2')::uuid as mb,
       (:'c'::jsonb->>'mot_pendente')::uuid as mp,
       (:'c'::jsonb->>'membro_ativo')::uuid as m1,
       (:'c'::jsonb->>'membro_ativo2')::uuid as m2 \gset

select is((select visibilidade::text from public.vehicles where id = :'c1'), 'todos', 'padrão é todos');
select ok(public.pode_ver_carro(:'c1', :'ma') and public.pode_ver_carro(:'c1', :'mb'), 'todos: membros ativos veem');
select ok(not public.pode_ver_carro(:'c1', :'mp'), 'todos: pendente não vê');

-- definir_visibilidade: só o dono e com validações
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.definir_visibilidade(%L, 'um', array[%L]::uuid[])$$, :'c1', :'ma'),
  'P0001', 'SEM_ACESSO', 'motorista não define visibilidade');
select tests.sair();

select tests.entrar_como(:'dono');
select throws_ok(format($$select public.definir_visibilidade(%L, 'um', array[%L, %L]::uuid[])$$, :'c1', :'ma', :'mb'),
  'P0001', 'VISIBILIDADE_INVALIDA', 'um exige exatamente 1');
select throws_ok(format($$select public.definir_visibilidade(%L, 'alguns', array[]::uuid[])$$, :'c1'),
  'P0001', 'VISIBILIDADE_INVALIDA', 'alguns exige ao menos 1');
select throws_ok(format($$select public.definir_visibilidade(%L, 'alguns', array[%L]::uuid[])$$, :'c1', :'mp'),
  'P0001', 'VISIBILIDADE_INVALIDA', 'só membros ativos');
select lives_ok(format($$select public.definir_visibilidade(%L, 'um', array[%L]::uuid[])$$, :'c1', :'ma'),
  'reserva o carro1 para ma');
select tests.sair();

select ok(public.pode_ver_carro(:'c1', :'ma') and not public.pode_ver_carro(:'c1', :'mb'), 'um: só o escolhido vê');

-- Retirada respeita a visibilidade
select tests.entrar_como(:'mb');
select throws_ok(format($$select public.iniciar_retirada(%L, 10000)$$, :'c1'),
  'P0001', 'CARRO_INDISPONIVEL', 'mb não retira carro reservado para ma');
select is((select count(*)::int from public.carros_para_mim() where vehicle_id = :'c1'), 0, 'carros_para_mim esconde o reservado de mb');
select is((select count(*)::int from public.carros_para_mim() where vehicle_id = :'c2'), 1, 'carros_para_mim mostra o carro2 para mb');
select tests.sair();

-- Reserva persiste após devolução
select tests.entrar_como(:'ma');
select id as a1 from public.iniciar_retirada(:'c1', 10000) \gset
select tests.sair();
update public.assignments set status = 'encerrado', fim_em = now() where id = :'a1';
update public.vehicles set em_uso = false where id = :'c1';
select is((select visibilidade::text from public.vehicles where id = :'c1'), 'um', 'reserva persiste após devolução');

-- alguns
select tests.entrar_como(:'dono');
select lives_ok(format($$select public.definir_visibilidade(%L, 'alguns', array[%L]::uuid[])$$, :'c2', :'mb'), 'carro2 só para mb');
select tests.sair();
select ok(public.pode_ver_carro(:'c2', :'mb') and not public.pode_ver_carro(:'c2', :'ma'), 'alguns: só os marcados');

-- Remoção do motorista desfaz a reserva
select tests.entrar_como(:'dono');
select public.remover_motorista(:'m1');
select tests.sair();
select is((select visibilidade::text from public.vehicles where id = :'c1'), 'todos', 'carro reservado volta para todos');
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'visibilidade_alterada'), 1,
  'dono é avisado');

select * from finish();
rollback;
