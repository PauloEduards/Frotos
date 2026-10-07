begin;
select plan(14);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma,
       (:'c'::jsonb->>'mot_ativo2')::uuid as mb \gset

-- setup: ma retira carro1, mb retira carro2
select tests.entrar_como(:'ma');
select public.iniciar_retirada(:'c1', 10000);
select tests.sair();
select tests.entrar_como(:'mb');
select public.iniciar_retirada(:'c2', 10000);
select tests.sair();

-- 1 relata mecanico
select tests.entrar_como(:'ma');
select id as i1 from public.relatar_ocorrencia(:'c1', 'mecanico', 'Barulho na roda dianteira') \gset
select is((select status::text from public.incidents where id = :'i1'), 'aberta', '1 ocorrência aberta');
select tests.sair();
select is((select prioridade from public.notifications
           where user_id = :'dono' and tipo = 'ocorrencia' and ref_id = :'i1'), 'normal', '1b notificação normal ao dono');

-- 2 acidente grave
select tests.entrar_como(:'ma');
select id as i2 from public.relatar_ocorrencia(:'c1', 'acidente_grave', 'Colisão traseira') \gset
select tests.sair();
select is((select prioridade from public.notifications
           where user_id = :'dono' and tipo = 'ocorrencia' and ref_id = :'i2'), 'alta', '2 acidente grave prioridade alta');
select is((select corpo from public.notifications where ref_id = :'i2' and tipo = 'ocorrencia'),
          'Acidente grave — Colisão traseira', '2b corpo com rótulo');

-- 3 sem vínculo / descrição vazia
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.relatar_ocorrencia(%L, 'outro', 'x')$$, :'c2'), 'P0001', 'SEM_ACESSO', '3 sem vínculo');
select throws_ok(format($$select public.relatar_ocorrencia(%L, 'outro', '   ')$$, :'c1'), 'P0001', 'DESCRICAO_OBRIGATORIA', '3b descrição vazia');

-- 4 fotos
select lives_ok(format($$insert into public.incident_photos (incident_id, path, capturado_em) values (%L, 'a/b.jpg', now())$$, :'i1'), '4 foto na própria');
select tests.sair();
select tests.entrar_como(:'mb');
select throws_ok(format($$insert into public.incident_photos (incident_id, path, capturado_em) values (%L, 'a/c.jpg', now())$$, :'i1'), '42501', null, '4b foto na de outro');

-- 5 resolver
select throws_ok(format($$select public.resolver_ocorrencia(%L)$$, :'i1'), 'P0001', 'SEM_ACESSO', '5 motorista não resolve');
select tests.sair();
select tests.entrar_como(:'dono');
select is((select status::text from public.resolver_ocorrencia(:'i1')), 'resolvida', '5b dono resolve');
select isnt((select resolvida_em from public.incidents where id = :'i1'), null, '5c resolvida_em');

-- 6 RLS
select is((select count(*)::int from public.incidents where id in (:'i1', :'i2')), 2, '6 dono vê todas');
select is((select count(*)::int from public.incident_photos where incident_id = :'i1'), 1, '6b dono vê fotos');
select tests.sair();
select tests.entrar_como(:'mb');
select is((select count(*)::int from public.incidents where id in (:'i1', :'i2')), 0, '6c outro motorista não vê');
select tests.sair();

select * from finish();
rollback;
