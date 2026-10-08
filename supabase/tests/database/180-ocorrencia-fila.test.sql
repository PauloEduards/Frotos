-- Bloco 1: ocorrência com fotos numa chamada só e idempotente (fila offline).
begin;
select plan(6);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma \gset

select tests.entrar_como(:'ma');
select public.iniciar_retirada(:'c1', 10000);
select tests.criar_foto(:'f', :'c1', 'ocorrencia') as foto1 \gset
select tests.criar_foto(:'f', :'c1', 'ocorrencia') as foto2 \gset

select is((select id::text from public.relatar_ocorrencia(:'c1', 'acidente_leve', 'Raspão na porta',
  '00000000-0000-0000-0000-00000000aa01',
  jsonb_build_array(jsonb_build_object('path', :'foto1', 'capturado_em', now()),
                    jsonb_build_object('path', :'foto2', 'capturado_em', now())))),
  '00000000-0000-0000-0000-00000000aa01', 'usa o id do celular');
select is((select count(*)::int from public.incident_photos where incident_id = '00000000-0000-0000-0000-00000000aa01'), 2,
  'grava as fotos junto');

-- Repetir (resposta perdida e nova tentativa da fila) não duplica nada
select lives_ok($$select public.relatar_ocorrencia((select vehicle_id from public.incidents where id = '00000000-0000-0000-0000-00000000aa01'),
  'acidente_leve', 'Raspão na porta', '00000000-0000-0000-0000-00000000aa01', '[]'::jsonb)$$, 'repetir não falha');
select is((select count(*)::int from public.incidents where id = '00000000-0000-0000-0000-00000000aa01'), 1, 'não duplica a ocorrência');
select tests.sair();
select is((select count(*)::int from public.notifications where user_id = :'dono' and tipo = 'ocorrencia'), 1,
  'dono avisado uma vez só');

-- Chamada antiga (3 argumentos) continua funcionando
select tests.entrar_como(:'ma');
select ok((select id is not null from public.relatar_ocorrencia(:'c1', 'outro', 'Pneu murcho')), 'assinatura antiga funciona');
select tests.sair();

select * from finish();
rollback;
