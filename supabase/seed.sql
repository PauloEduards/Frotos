-- Dados de exemplo: "Frota Piloto". Todos os usuários usam a senha 'senha123'.
-- Tudo é relativo a hoje_brt()/now(), então o seed continua realista a cada reset.
do $seed$
declare
  v_hoje date := public.hoje_brt();
  v_dono uuid := gen_random_uuid();
  v_ana uuid := gen_random_uuid();
  v_bruno uuid := gen_random_uuid();
  v_caio uuid := gen_random_uuid();
  v_frota uuid;
  v_onix uuid; v_hb20 uuid; v_argo uuid; v_kwid uuid; v_mobi uuid;
  v_vinc_ana uuid; v_vinc_bruno uuid;
  v_servico uuid; v_ocorrencia uuid;
  d int;
  u record;
  v record;
  p text;
  v_path text;
begin
  -- ---------- Usuários (login por e-mail e senha no GoTrue local) ----------
  for u in
    select * from (values
      (v_dono,  'dono@frotos.dev',  'Carlos', 'proprietario', null),
      (v_ana,   'ana@frotos.dev',   'Ana',    'motorista', '52998224725'),
      (v_bruno, 'bruno@frotos.dev', 'Bruno',  'motorista', '11144477735'),
      (v_caio,  'caio@frotos.dev',  'Caio',   'motorista', '39053344705')
    ) t (id, email, nome, papel, cpf)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      crypt('senha123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', u.nome, 'papel', u.papel, 'email_verified', true)
        || case when u.cpf is null then '{}'::jsonb
                else jsonb_build_object('cpf', u.cpf, 'tem_cnh', true, 'uf', 'SP', 'cidade', 'São Paulo') end,
      now(), now(), '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
      now(), now(), now()
    );
  end loop;

  -- ---------- Frota e membros ----------
  insert into public.fleets (owner_id, nome, codigo_convite, uf, cidade)
  values (v_dono, 'Frota Piloto', 'FRT-TEST', 'SP', 'São Paulo')
  returning id into v_frota;

  insert into public.fleet_members (fleet_id, driver_id, status, nivel_manutencao) values
    (v_frota, v_ana, 'ativo', 'confiavel'),
    (v_frota, v_bruno, 'ativo', 'com_aprovacao'),
    (v_frota, v_caio, 'pendente', 'com_aprovacao');

  -- ---------- Carros (os itens do catálogo nascem por trigger) ----------
  -- Onix e HB20 em uso (km_atual = última leitura dos últimos 30 dias, ~300 km/dia).
  insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual, em_uso)
  values (v_frota, 'ABC1D23', 'Chevrolet', 'Onix', 2022, 'Prata', 45200, true)
  returning id into v_onix;
  insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual, em_uso)
  values (v_frota, 'BCD2E34', 'Hyundai', 'HB20', 2021, 'Branco', 62000, true)
  returning id into v_hb20;
  insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
  values (v_frota, 'CDE3F45', 'Fiat', 'Argo', 2023, 'Vermelho', 18000)
  returning id into v_argo;
  insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
  values (v_frota, 'DEF4G56', 'Renault', 'Kwid', 2022, 'Branco', 33000)
  returning id into v_kwid;
  insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
  values (v_frota, 'EFG5H67', 'Fiat', 'Mobi', 2021, 'Preto', 71000)
  returning id into v_mobi;

  -- ---------- Histórico inicial dos itens ----------
  -- Base: última troca há 20 dias, 6.000 km atrás (coerente com 300 km/dia). Kwid fica sem histórico.
  update public.vehicle_items i
  set km_inicial = c.km_atual - 6000, data_inicial = v_hoje - 20
  from public.vehicles c
  where c.id = i.vehicle_id and c.fleet_id = v_frota and c.id <> v_kwid;

  -- Onix: óleo e filtro de óleo a 800 km do prazo -> "próximo"
  update public.vehicle_items set km_inicial = 36000, data_inicial = v_hoje - 120
  where vehicle_id = v_onix and nome in ('Óleo do motor', 'Filtro de óleo');
  -- HB20: óleo 1.000 km além do prazo -> "vencido"
  update public.vehicle_items set km_inicial = 51000, data_inicial = v_hoje - 150
  where vehicle_id = v_hb20 and nome = 'Óleo do motor';
  -- Mobi: óleo a 150 km do prazo -> "urgente"
  update public.vehicle_items set km_inicial = 61150, data_inicial = v_hoje - 100
  where vehicle_id = v_mobi and nome = 'Óleo do motor';

  -- ---------- Vínculos ativos com as 4 fotos de retirada ----------
  -- Fotos ficam em '<frota>/<carro>/...' e precisam existir em storage.objects (bucket 'fotos').
  insert into public.assignments (vehicle_id, driver_id, status, inicio_em, km_inicio)
  values (v_onix, v_ana, 'ativo', ((v_hoje - 29)::timestamp + interval '8 hours') at time zone 'America/Sao_Paulo', 45200 - 29 * 300)
  returning id into v_vinc_ana;
  insert into public.assignments (vehicle_id, driver_id, status, inicio_em, km_inicio)
  values (v_hb20, v_bruno, 'ativo', ((v_hoje - 29)::timestamp + interval '8 hours') at time zone 'America/Sao_Paulo', 62000 - 29 * 300)
  returning id into v_vinc_bruno;

  for v in
    select * from (values (v_vinc_ana, v_onix, v_ana), (v_vinc_bruno, v_hb20, v_bruno)) t (vinculo, carro, motorista)
  loop
    foreach p in array array['frente', 'traseira', 'lateral_esq', 'lateral_dir'] loop
      v_path := v_frota || '/' || v.carro || '/inspecao/' || v.vinculo || '-retirada-' || p || '.jpg';
      insert into storage.objects (bucket_id, name, owner_id) values ('fotos', v_path, v.motorista::text);
      insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
      values (v.vinculo, 'retirada', p::public.posicao_foto, v_path,
              ((v_hoje - 29)::timestamp + interval '8 hours') at time zone 'America/Sao_Paulo');
    end loop;
  end loop;

  -- ---------- Leituras de km: 30 dias, ~300 km/dia ----------
  for v in
    select * from (values (v_onix, v_ana, 45200), (v_hb20, v_bruno, 62000)) t (carro, motorista, km_final)
  loop
    for d in reverse 29..0 loop
      insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em)
      values (
        v.carro, v.motorista, v.km_final - d * 300,
        case when d = 29 then 'retirada'::public.origem_km else 'atualizacao'::public.origem_km end,
        least(((v_hoje - d)::timestamp + interval '8 hours') at time zone 'America/Sao_Paulo', now())
      );
    end loop;
  end loop;

  -- ---------- Serviço aprovado (Ana, confiável): filtro de ar do Onix ----------
  v_path := v_frota || '/' || v_onix || '/notas/filtro-ar-onix.jpg';
  insert into storage.objects (bucket_id, name, owner_id) values ('fotos', v_path, v_ana::text);
  insert into public.maintenance_records (vehicle_id, autor_id, oficina, km, data, valor_total, nota_foto_path, status)
  values (v_onix, v_ana, 'Auto Center Silva', 45200 - 14 * 300, v_hoje - 14, 60,
          v_path, 'aprovado')
  returning id into v_servico;
  insert into public.maintenance_record_items (record_id, vehicle_item_id, valor)
  select v_servico, id, 60 from public.vehicle_items where vehicle_id = v_onix and nome = 'Filtro de ar';

  -- ---------- Serviço pendente do Bruno (com aprovação): rodízio de pneus do HB20 ----------
  v_path := v_frota || '/' || v_hb20 || '/notas/pneus-hb20.jpg';
  insert into storage.objects (bucket_id, name, owner_id) values ('fotos', v_path, v_bruno::text);
  insert into public.maintenance_records (vehicle_id, autor_id, oficina, km, data, valor_total, nota_foto_path, status)
  values (v_hb20, v_bruno, 'Pneus Express', 62000 - 3 * 300, v_hoje - 3, 120,
          v_path, 'pendente')
  returning id into v_servico;
  insert into public.maintenance_record_items (record_id, vehicle_item_id, valor)
  select v_servico, id, 120 from public.vehicle_items where vehicle_id = v_hb20 and nome = 'Pneus (rodízio e alinhamento)';

  -- ---------- Pedido aberto para o Bruno: óleo e filtro de óleo ----------
  insert into public.maintenance_requests (vehicle_id, driver_id, itens, prazo, observacao)
  select v_hb20, v_bruno, array_agg(id order by nome), v_hoje + 5, 'Leve na oficina de sempre, por favor.'
  from public.vehicle_items where vehicle_id = v_hb20 and nome in ('Óleo do motor', 'Filtro de óleo');

  -- ---------- Ocorrência aberta (Ana, Onix) ----------
  insert into public.incidents (vehicle_id, driver_id, tipo, descricao, criada_em)
  values (v_onix, v_ana, 'mecanico', 'Barulho na suspensão dianteira ao passar em buracos.', now() - interval '2 days')
  returning id into v_ocorrencia;
  v_path := v_frota || '/' || v_onix || '/ocorrencias/' || v_ocorrencia || '-foto-1.jpg';
  insert into storage.objects (bucket_id, name, owner_id) values ('fotos', v_path, v_ana::text);
  insert into public.incident_photos (incident_id, path, capturado_em)
  values (v_ocorrencia, v_path, now() - interval '2 days');

  -- ---------- Notificação de pedido de entrada (Caio) ----------
  perform public.notificar(v_dono, 'entrada_pedida', 'Novo pedido de entrada',
    'Caio quer entrar na frota Frota Piloto.', 'fleet_members',
    (select id from public.fleet_members where driver_id = v_caio));

  -- ---------- Deriva ultimo_km/ultima_data e preenche status_atual ----------
  for v in
    select i.id from public.vehicle_items i
    join public.vehicles c on c.id = i.vehicle_id where c.fleet_id = v_frota
  loop
    perform public.recalcular_ultima_troca(v.id);
  end loop;
  perform public.rotina_diaria();
end;
$seed$;
