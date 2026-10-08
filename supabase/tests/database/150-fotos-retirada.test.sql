-- Bloco 1: retirada e devolução com 5 fotos (painel obrigatório) e fotos antifraude.
begin;
select plan(14);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma,
       (:'c'::jsonb->>'mot_ativo2')::uuid as mb \gset

select tests.entrar_como(:'ma');
select id as a1 from public.iniciar_retirada(:'c1', 12000) \gset
select is((select count(*)::int from public.odometer_readings where vehicle_id = :'c1' and origem = 'retirada'), 0,
  'iniciar_retirada não grava leitura');
select throws_ok(format($$select public.iniciar_retirada(%L, 1)$$, :'c1'), 'P0001', null, 'segunda retirada falha');

-- 4 fotos sem painel
select public.registrar_fotos_inspecao(:'a1', 'retirada', jsonb_agg(jsonb_build_object(
  'posicao', p, 'path', tests.criar_foto(:'f', :'c1', 'inspecao'), 'capturado_em', now())))
from unnest(array['frente','traseira','lateral_esq','lateral_dir']) p;
select throws_ok(format($$select public.concluir_retirada(%L)$$, :'a1'), 'P0001', 'FOTOS_FALTANDO', 'sem painel não conclui');

-- painel (idempotente)
select tests.criar_foto(:'f', :'c1', 'painel') as painel \gset
select is(public.registrar_fotos_inspecao(:'a1', 'retirada',
  jsonb_build_array(jsonb_build_object('posicao', 'painel', 'path', :'painel', 'capturado_em', now()))), 5,
  'registrar_fotos_inspecao retorna 5 posições');
select is(public.registrar_fotos_inspecao(:'a1', 'retirada',
  jsonb_build_array(jsonb_build_object('posicao', 'painel', 'path', :'painel', 'capturado_em', now()))), 5,
  'repetir as mesmas fotos não duplica');
select is((select count(*)::int from public.inspection_photos where assignment_id = :'a1'), 5, 'cinco fotos registradas');

select is((select status::text from public.concluir_retirada(:'a1')), 'ativo', 'conclui com as 5 fotos');
select is((select km || '|' || coalesce(foto_painel_path, '') from public.odometer_readings
  where vehicle_id = :'c1' and origem = 'retirada'), '12000|' || :'painel',
  'leitura da retirada usa o km inicial e a foto do painel (salto aceito com foto)');
select ok((select salto_suspeito from public.odometer_readings where vehicle_id = :'c1' and origem = 'retirada') is not null,
  'salto marcado conforme a regra');

-- registrar_km público não aceita origem de retirada/devolução
select throws_ok(format($$select public.registrar_km(%L, 13000, 'retirada')$$, :'c1'),
  'P0001', 'ORIGEM_INVALIDA', 'origem retirada é interna');

-- Antifraude: foto reutilizada e foto de outro usuário
select tests.criar_foto(:'f', :'c1', 'painel') as painel_ok \gset
select throws_ok(format($$select public.registrar_km(%L, 12100, 'atualizacao', %L)$$, :'c1', :'painel'),
  'P0001', 'FOTO_INVALIDA', 'foto já usada não vale de novo');
select tests.sair();

select tests.entrar_como(:'mb');
select tests.criar_foto(:'f', :'c1', 'painel') as foto_mb \gset
select tests.sair();
select tests.entrar_como(:'ma');
select throws_ok(format($$select public.registrar_km(%L, 12100, 'atualizacao', %L)$$, :'c1', :'foto_mb'),
  'P0001', 'FOTO_INVALIDA', 'foto enviada por outro usuário não vale');

-- Devolução com 5 fotos
select public.registrar_fotos_inspecao(:'a1', 'devolucao', jsonb_agg(jsonb_build_object(
  'posicao', p, 'path', tests.criar_foto(:'f', :'c1', case when p = 'painel' then 'painel' else 'inspecao' end), 'capturado_em', now())))
from unnest(array['frente','traseira','lateral_esq','lateral_dir','painel']) p;
select is((select status::text from public.devolver_carro(:'a1', 12500)), 'encerrado', 'devolução com 5 fotos');
select ok((select foto_painel_path is not null from public.odometer_readings where vehicle_id = :'c1' and origem = 'devolucao'),
  'leitura da devolução tem a foto do painel');
select tests.sair();

select * from finish();
rollback;
