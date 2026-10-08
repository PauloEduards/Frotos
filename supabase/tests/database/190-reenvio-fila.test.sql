-- Revisão final do bloco 1: reenvio da fila depois de resposta perdida não vira erro falso;
-- motorista não entra em duas frotas por candidatura.
begin;
select plan(10);

select tests.cenario_basico() as c \gset
select (:'c'::jsonb->>'dono')::uuid as dono,
       (:'c'::jsonb->>'frota')::uuid as f,
       (:'c'::jsonb->>'carro1')::uuid as c1,
       (:'c'::jsonb->>'carro2')::uuid as c2,
       (:'c'::jsonb->>'mot_ativo')::uuid as ma \gset
select i.id as it_oleo from public.vehicle_items i where i.vehicle_id = :'c1' and i.nome = 'Óleo do motor' \gset
update public.fleets set modo_manutencao = 'motoristas_levam' where id = :'f';

-- Retirada concluída e concluída de novo (resposta perdida)
select tests.entrar_como(:'ma');
select id as a1 from public.iniciar_retirada(:'c1', 10000) \gset
select public.registrar_fotos_inspecao(:'a1', 'retirada', jsonb_agg(jsonb_build_object(
  'posicao', p, 'path', tests.criar_foto(:'f', :'c1', case when p = 'painel' then 'painel' else 'inspecao' end), 'capturado_em', now())))
from unnest(array['frente','traseira','lateral_esq','lateral_dir','painel']) p;
select public.concluir_retirada(:'a1');
select is((select status::text from public.concluir_retirada(:'a1')), 'ativo', 'concluir de novo devolve o vínculo ativo');

-- Leitura de km reenviada
select tests.criar_foto(:'f', :'c1', 'painel') as painel \gset
select id as l1 from public.registrar_km(:'c1', 10100, 'atualizacao', :'painel') \gset
select is((select id from public.registrar_km(:'c1', 10100, 'atualizacao', :'painel')), :'l1'::uuid,
  'mesma leitura (mesma foto, mesmo km) devolve a existente');
select is((select count(*)::int from public.odometer_readings where foto_painel_path = :'painel'), 1, 'sem leitura duplicada');

-- Serviço reenviado
select tests.criar_foto(:'f', :'c1', 'nota') as nota \gset
select id as s1 from public.registrar_servico_offline(:'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_oleo')),
  10100, public.hoje_brt(), 180, null, null, :'nota') \gset
select is((select id from public.registrar_servico_offline(:'c1', jsonb_build_array(jsonb_build_object('vehicle_item_id', :'it_oleo')),
  10100, public.hoje_brt(), 180, null, null, :'nota')), :'s1'::uuid, 'mesmo serviço (mesma nota) devolve o existente');
select is((select count(*)::int from public.maintenance_records where nota_foto_path = :'nota'), 1, 'sem serviço duplicado');

-- Devolução reenviada
select public.registrar_fotos_inspecao(:'a1', 'devolucao', jsonb_agg(jsonb_build_object(
  'posicao', p, 'path', tests.criar_foto(:'f', :'c1', case when p = 'painel' then 'painel' else 'inspecao' end), 'capturado_em', now())))
from unnest(array['frente','traseira','lateral_esq','lateral_dir','painel']) p;
select public.devolver_carro(:'a1', 10200);
select is((select status::text from public.devolver_carro(:'a1', 10200)), 'encerrado', 'devolver de novo devolve o vínculo encerrado');
select throws_ok(format($$select public.devolver_carro(%L, 10300)$$, :'a1'), 'P0001', 'VINCULO_INVALIDO',
  'km diferente não é reenvio');
select tests.sair();

-- Duas frotas
update public.fleets set uf = 'SP', cidade = 'São Paulo' where id = :'f';
update public.vehicles set anunciado = true where id in (:'c1', :'c2');
select tests.criar_usuario('donoy@t.dev', 'proprietario', 'DonoY') as dy \gset
select tests.entrar_como(:'dy');
select id as fy from public.criar_frota('Frota Y') \gset
select tests.sair();
update public.fleets set uf = 'SP', cidade = 'São Paulo' where id = :'fy';
insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual, anunciado)
values (:'fy', 'YYY1Y11', 'Fiat', 'Mobi', 2021, 'Preto', 5000, true) returning id as cy \gset

select tests.criar_usuario('livre@t.dev', 'motorista', 'Livre') as l1 \gset
select tests.entrar_como(:'l1');
select id as cand_x from public.candidatar(:'c2') \gset
select id as cand_y from public.candidatar(:'cy') \gset
select tests.sair();

select tests.entrar_como(:'dono');
select public.responder_candidatura(:'cand_x', true);
select tests.sair();
select is((select status from public.candidaturas where id = :'cand_y'), 'cancelada', 'aceito numa frota: outras candidaturas canceladas');

select tests.entrar_como(:'dy');
select throws_ok(format($$select public.responder_candidatura(%L, true)$$, :'cand_y'), 'P0001', 'TRANSICAO_INVALIDA',
  'a outra frota não consegue mais aceitar');
select tests.sair();
select is((select visibilidade::text || '|' || anunciado from public.vehicles where id = :'cy'), 'todos|true',
  'carro da outra frota continua anunciado');

select * from finish();
rollback;
