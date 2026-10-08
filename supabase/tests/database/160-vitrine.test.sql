-- Bloco 1: foto do carro, anúncio, busca de carros (sem placa) e candidaturas.
begin;
select plan(25);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma \gset

update public.fleets set uf = 'SP', cidade = 'São Paulo' where id = :'f';

-- Motoristas sem frota
select tests.criar_usuario('livre1@t.dev', 'motorista', 'Livre1') as l1 \gset
select tests.criar_usuario('livre2@t.dev', 'motorista', 'Livre2') as l2 \gset
select tests.criar_usuario('semcnh@t.dev', 'motorista', 'SemCnh') as sc \gset
update public.profiles set tem_cnh = false where id = :'sc';

-- Dono anuncia o carro1 e define a foto
select tests.entrar_como(:'dono');
select lives_ok(format($$update public.vehicles set anunciado = true, foto_path = %L where id = %L$$,
  :'f' || '/' || :'c1' || '/x.jpg', :'c1'), 'dono anuncia e define foto');
select tests.sair();

-- Busca
select tests.entrar_como(:'l1');
select ok(not exists (
  select 1 from information_schema.routines r
  join information_schema.parameters p on p.specific_name = r.specific_name
  where r.routine_schema = 'public' and r.routine_name = 'buscar_carros' and p.parameter_name = 'placa'),
  'buscar_carros não expõe placa');
select is((select count(*)::int from public.buscar_carros('sp', 'SAO PAULO ') where vehicle_id = :'c1'), 1, 'busca casa cidade sem acento/maiúsculas');
select is((select frota_nome || '|' || coalesce(foto_path, '') from public.buscar_carros('SP', 'São Paulo') where vehicle_id = :'c1'),
  'Frota Cenário|' || :'f' || '/' || :'c1' || '/x.jpg', 'retorna frota e foto');
select is((select count(*)::int from public.buscar_carros('SP', 'Campinas')), 0, 'outra cidade: nada');
select tests.sair();

-- Carro reservado não aparece
select tests.entrar_como(:'dono');
select public.definir_visibilidade(:'c1', 'um', array[:'ma']::uuid[]);
select tests.sair();
select tests.entrar_como(:'l1');
select is((select count(*)::int from public.buscar_carros('SP', 'São Paulo') where vehicle_id = :'c1'), 0, 'reservado não aparece');
select tests.sair();
select tests.entrar_como(:'dono');
select public.definir_visibilidade(:'c1', 'todos', array[]::uuid[]);
select tests.sair();

-- Candidatar: erros
select tests.entrar_como(:'sc');
select throws_ok(format($$select public.candidatar(%L)$$, :'c1'), 'P0001', 'SEM_CNH', 'sem CNH não se candidata');
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.candidatar(%L)$$, :'c1'), 'P0001', 'JA_EM_FROTA', 'já em frota');
select tests.sair();
select tests.entrar_como(:'dono');
select throws_ok(format($$select public.candidatar(%L)$$, :'c1'), 'P0001', 'APENAS_MOTORISTA', 'dono não se candidata');
select tests.sair();
select tests.entrar_como(:'l1');
select throws_ok(format($$select public.candidatar(%L)$$, :'c2'), 'P0001', 'CARRO_INDISPONIVEL', 'carro não anunciado');
select id as cand1 from public.candidatar(:'c1', 'Tenho experiência') \gset
select throws_ok(format($$select public.candidatar(%L)$$, :'c1'), 'P0001', 'JA_CANDIDATO', 'candidatura repetida');
select tests.sair();
select tests.entrar_como(:'l2');
select id as cand2 from public.candidatar(:'c1') \gset
select tests.sair();

select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'candidatura_nova'), 2,
  'dono avisado de cada candidatura');

-- Leitura de CPF
select tests.entrar_como(:'dono');
select ok((select cpf is not null from public.profiles where id = :'l1'), 'dono lê CPF do candidato');
select is((select count(*)::int from public.candidaturas where fleet_id = :'f'), 2, 'dono vê candidaturas da frota');
select tests.sair();
select tests.entrar_como(:'l2');
select is((select count(*)::int from public.profiles where id = :'l1'), 0, 'outro motorista não lê o candidato');
select is((select count(*)::int from public.candidaturas), 1, 'motorista vê só a própria candidatura');
select tests.sair();

-- Cancelar
select tests.entrar_como(:'l1');
select throws_ok(format($$select public.cancelar_candidatura(%L)$$, :'cand2'), 'P0001', 'SEM_ACESSO', 'não cancela a de outro');
select tests.sair();

-- Aceitar: atômico
select tests.entrar_como(:'l1');
select throws_ok(format($$select public.responder_candidatura(%L, true)$$, :'cand1'), 'P0001', 'SEM_ACESSO', 'motorista não responde');
select tests.sair();
select tests.entrar_como(:'dono');
select is((select status from public.responder_candidatura(:'cand1', true)), 'aceita', 'aceita');
select tests.sair();

select is((select status::text from public.fleet_members where fleet_id = :'f' and driver_id = :'l1'), 'ativo', 'vira membro ativo');
select is((select visibilidade::text || '|' || anunciado from public.vehicles where id = :'c1'), 'um|false', 'carro reservado e sem anúncio');
select ok(public.pode_ver_carro(:'c1', :'l1') and not public.pode_ver_carro(:'c1', :'ma'), 'só o aceito vê o carro');
select is((select status from public.candidaturas where id = :'cand2'), 'recusada', 'concorrente recusada');
select is((select count(*)::int from public.notifications where user_id in (:'l1', :'l2')
  and tipo in ('candidatura_aceita', 'candidatura_recusada')), 2, 'aceito e recusado avisados');

select tests.entrar_como(:'dono');
select throws_ok(format($$select public.responder_candidatura(%L, true)$$, :'cand2'), 'P0001', 'TRANSICAO_INVALIDA',
  'recusada não pode ser aceita depois');
select tests.sair();

select * from finish();
rollback;
