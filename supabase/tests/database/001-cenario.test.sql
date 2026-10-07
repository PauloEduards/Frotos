-- Cenário básico compartilhado. Este arquivo NÃO faz rollback:
-- deixa tests.cenario_basico() instalada para os arquivos seguintes.
-- Deve ser chamado dentro da transação do teste (ele cria usuários e dados).
create or replace function tests.cenario_basico()
returns jsonb
language plpgsql
as $$
declare
  v_s text := replace(gen_random_uuid()::text, '-', '');
  v_dono uuid;
  v_mot_ativo uuid;
  v_mot_ativo2 uuid;
  v_mot_pendente uuid;
  v_frota uuid;
  v_cod text;
  v_carro1 uuid;
  v_carro2 uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_mp uuid;
begin
  v_dono := tests.criar_usuario('dono-' || v_s || '@t.com', 'proprietario', 'Dono');
  v_mot_ativo := tests.criar_usuario('ma-' || v_s || '@t.com', 'motorista', 'Motorista A');
  v_mot_ativo2 := tests.criar_usuario('mb-' || v_s || '@t.com', 'motorista', 'Motorista B');
  v_mot_pendente := tests.criar_usuario('mp-' || v_s || '@t.com', 'motorista', 'Motorista P');

  perform tests.entrar_como(v_dono);
  select id, codigo_convite into v_frota, v_cod from public.criar_frota('Frota Cenário');
  perform tests.sair();

  perform tests.entrar_como(v_mot_ativo);
  select id into v_m1 from public.entrar_na_frota(v_cod);
  perform tests.sair();
  perform tests.entrar_como(v_mot_ativo2);
  select id into v_m2 from public.entrar_na_frota(v_cod);
  perform tests.sair();
  perform tests.entrar_como(v_mot_pendente);
  select id into v_mp from public.entrar_na_frota(v_cod);
  perform tests.sair();

  perform tests.entrar_como(v_dono);
  perform public.responder_entrada(v_m1, true);
  perform public.responder_entrada(v_m2, true);
  insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
  values (v_frota, 'ABC1D23', 'Fiat', 'Argo', 2022, 'Branco', 10000) returning id into v_carro1;
  insert into public.vehicles (fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual)
  values (v_frota, 'XYZ9876', 'VW', 'Gol', 2021, 'Prata', 10000) returning id into v_carro2;
  perform tests.sair();

  insert into public.odometer_readings (vehicle_id, autor_id, km, origem, capturado_em)
  values (v_carro1, v_dono, 10000, 'atualizacao', now() - interval '1 day');

  return jsonb_build_object(
    'dono', v_dono, 'frota', v_frota, 'carro1', v_carro1, 'carro2', v_carro2,
    'mot_ativo', v_mot_ativo, 'mot_ativo2', v_mot_ativo2, 'mot_pendente', v_mot_pendente,
    'membro_ativo', v_m1, 'membro_ativo2', v_m2);
end;
$$;

grant execute on function tests.cenario_basico() to authenticated;

select plan(1);
select has_function('tests', 'cenario_basico', array[]::text[]);
select * from finish();
