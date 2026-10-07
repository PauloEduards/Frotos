begin;
select plan(25);

select tests.criar_usuario('dono@t.com', 'proprietario', 'Dono') as dono \gset
select tests.criar_usuario('dono2@t.com', 'proprietario', 'Dono2') as dono2 \gset
select tests.criar_usuario('mot1@t.com', 'motorista', 'Mot1') as mot1 \gset
select tests.criar_usuario('mot2@t.com', 'motorista', 'Mot2') as mot2 \gset

-- 1
select tests.entrar_como(:'dono');
select id as f, codigo_convite as cod from public.criar_frota('Frota A') \gset
select ok(:'cod' ~ '^FRT-[A-HJ-NP-Z2-9]{4}$', 'codigo_convite no formato');
select results_eq(
  format($q$select limite_salto_km_dia, limiar_amarelo_km, limiar_amarelo_dias, limiar_laranja_km, modo_manutencao::text from public.fleets where id = %L$q$, :'f'),
  $q$values (350, 1000, 7, 300, 'proprietario_leva')$q$,
  'valores padrão');

-- 2, 3
select throws_ok($q$select public.criar_frota('Outra')$q$, 'P0001', 'FROTA_JA_EXISTE', 'segunda frota');
select tests.sair();
select tests.entrar_como(:'mot1');
select throws_ok($q$select public.criar_frota('X')$q$, 'P0001', 'APENAS_PROPRIETARIO', 'motorista não cria');

-- 4
select id as m1 from public.entrar_na_frota('  ' || lower(:'cod') || '  ') \gset
select results_eq(
  format($q$select status::text, nivel_manutencao::text from public.fleet_members where id = %L$q$, :'m1'),
  $q$values ('pendente', 'com_aprovacao')$q$, 'entrada pendente');

-- 6
select throws_ok(format($q$select public.entrar_na_frota(%L)$q$, :'cod'), 'P0001', 'JA_MEMBRO', 'já membro');
select throws_ok($q$select public.entrar_na_frota('FRT-ZZZZ')$q$, 'P0001', 'CODIGO_INVALIDO', 'código inválido');

-- 7
select is((select count(*)::int from public.fleets where id = :'f'), 0, 'pendente não vê frota');

-- 5, proprietário entrando
select tests.sair();
select tests.entrar_como(:'dono');
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'entrada_pedida'), 1, 'dono notificado');
select throws_ok(format($q$select public.entrar_na_frota(%L)$q$, :'cod'), 'P0001', 'APENAS_MOTORISTA', 'proprietário não entra');

-- 14 (dono vê perfil do motorista membro)
select is((select count(*)::int from public.profiles where id = :'mot1'), 1, 'dono vê perfil do motorista');

-- 8
select is((select status::text from public.responder_entrada(:'m1', true)), 'ativo', 'aprovado');
select tests.sair();
select tests.entrar_como(:'mot1');
select is((select count(*)::int from public.fleets where id = :'f'), 1, 'motorista ativo vê frota');
select is((select count(*)::int from public.notifications where user_id = :'mot1' and tipo = 'entrada_aprovada'), 1, 'motorista notificado');
select is((select count(*)::int from public.profiles where id = :'dono'), 1, 'motorista vê perfil do dono');

-- 11
update public.fleet_members set nivel_manutencao = 'confiavel' where id = :'m1';
select tests.sair();
select tests.entrar_como(:'dono');
select is((select nivel_manutencao::text from public.fleet_members where id = :'m1'), 'com_aprovacao', 'motorista não altera nível');

-- 12
update public.fleet_members set nivel_manutencao = 'confiavel' where id = :'m1';
select is((select nivel_manutencao::text from public.fleet_members where id = :'m1'), 'confiavel', 'dono altera nível');
update public.fleets set modo_manutencao = 'motoristas_levam' where id = :'f';
select is((select modo_manutencao::text from public.fleets where id = :'f'), 'motoristas_levam', 'dono altera modo');

-- 9
select tests.sair();
select tests.entrar_como(:'mot2');
select id as m2 from public.entrar_na_frota(:'cod') \gset
select tests.sair();
select tests.entrar_como(:'dono');
select is((select status::text from public.responder_entrada(:'m2', false)), 'removido', 'recusado');
select throws_ok(format($q$select public.responder_entrada(%L, true)$q$, :'m2'), 'P0001', 'TRANSICAO_INVALIDA', 'só pendente');
select tests.sair();
select tests.entrar_como(:'mot2');
select is((select status::text from public.entrar_na_frota(:'cod')), 'pendente', 'removido volta a pendente');

-- 13
select tests.sair();
select tests.entrar_como(:'dono2');
select is((select count(*)::int from public.fleets where id = :'f'), 0, 'outro dono não vê frota');
select throws_ok(format($q$select public.responder_entrada(%L, true)$q$, :'m2'), 'P0001', 'SEM_ACESSO', 'membro alheio');

-- 10
select tests.sair();
select tests.entrar_como(:'dono');
select gerar_novo_codigo as novo from public.gerar_novo_codigo(:'f') \gset
select isnt(:'novo'::text, :'cod'::text, 'código mudou');
select tests.sair();
select tests.entrar_como(:'mot1');
select throws_ok(format($q$select public.entrar_na_frota(%L)$q$, :'cod'), 'P0001', 'CODIGO_INVALIDO', 'código antigo inválido');

select * from finish();
rollback;
