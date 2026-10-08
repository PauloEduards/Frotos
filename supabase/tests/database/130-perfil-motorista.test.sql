-- Bloco 1: perfil do motorista (CPF, CNH, cidade) e cidade da frota.
begin;
select plan(16);

-- CPF
select ok(public.cpf_valido('52998224725'), 'cpf válido');
select ok(not public.cpf_valido('11111111111'), 'cpf repetido é inválido');
select ok(not public.cpf_valido('52998224724'), 'cpf com dígito errado é inválido');
select ok(not public.cpf_valido('123'), 'cpf curto é inválido');
select is(public.normalizar_cidade(' São Paulo '), 'sao paulo', 'normaliza cidade');

-- Cadastro do motorista
select throws_ok($$insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (gen_random_uuid(), 'semcpf@t.dev', 'authenticated', 'authenticated', '{"nome":"X","papel":"motorista"}')$$,
  'P0001', 'CPF_INVALIDO', 'motorista sem CPF');
select throws_ok($$insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (gen_random_uuid(), 'cpfruim@t.dev', 'authenticated', 'authenticated', '{"nome":"X","papel":"motorista","cpf":"111.111.111-11"}')$$,
  'P0001', 'CPF_INVALIDO', 'motorista com CPF inválido');

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', 'mota@t.dev', 'authenticated', 'authenticated',
  '{"nome":"Mota","papel":"motorista","cpf":"123.456.789-09","tem_cnh":true,"uf":"sp","cidade":"São Paulo"}');
select is((select cpf || '|' || tem_cnh || '|' || uf || '|' || cidade from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  '12345678909|true|SP|São Paulo', 'grava cpf só com dígitos, CNH, UF maiúscula e cidade');

select throws_ok($$insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (gen_random_uuid(), 'dup@t.dev', 'authenticated', 'authenticated', '{"nome":"X","papel":"motorista","cpf":"12345678909"}')$$,
  'P0001', 'CPF_DUPLICADO', 'CPF repetido');

select lives_ok($$insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (gen_random_uuid(), 'dono-sem-cpf@t.dev', 'authenticated', 'authenticated', '{"nome":"D","papel":"proprietario"}')$$,
  'proprietário sem CPF é aceito');

-- Leitura e escrita
select tests.criar_usuario('motb@t.dev', 'motorista', 'MotB') as mb \gset
select tests.criar_usuario('donox@t.dev', 'proprietario', 'DonoX') as dx \gset

select tests.entrar_como(:'mb');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 0,
  'motorista não lê perfil (nem CPF) de outro motorista');
select lives_ok($$update public.profiles set tem_cnh = false, uf = 'RJ', cidade = 'Niterói' where id = auth.uid()$$,
  'motorista atualiza tem_cnh, uf e cidade');
select throws_ok($$update public.profiles set cpf = '52998224725' where id = auth.uid()$$, '42501', null,
  'motorista não altera o próprio CPF');
select is((select cpf is not null from public.profiles where id = auth.uid()), true, 'motorista lê o próprio CPF');
select tests.sair();

select tests.entrar_como(:'dx');
select id as fx from public.criar_frota('Frota X') \gset
select lives_ok(format($$update public.fleets set uf = 'SP', cidade = 'Campinas' where id = %L$$, :'fx'),
  'dono define UF e cidade da frota');
select is((select uf || '/' || cidade from public.fleets where id = :'fx'), 'SP/Campinas', 'cidade da frota gravada');
select tests.sair();

select * from finish();
rollback;
