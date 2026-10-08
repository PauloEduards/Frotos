-- Revisão final do bloco 1.
-- 1) Reenvio da fila offline depois de resposta perdida: devolver o que já foi feito, sem erro falso.
-- 2) Candidatura: aceito numa frota, o motorista sai das outras; nenhuma frota aceita quem já está em outra.

-- ---------- concluir_retirada: já ativo para este motorista → devolve ----------
create or replace function public.concluir_retirada(p_assignment_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculo public.assignments;
  v_painel public.inspection_photos;
begin
  select * into v_vinculo from public.assignments
  where id = p_assignment_id and driver_id = auth.uid()
  for update;
  if not found then
    perform public.erro('VINCULO_INVALIDO', 'Retirada não encontrada.');
  end if;
  if v_vinculo.status = 'ativo' then
    return v_vinculo;
  end if;
  if v_vinculo.status <> 'aguardando_fotos' then
    perform public.erro('TRANSICAO_INVALIDA', 'Esta retirada não está aguardando fotos.');
  end if;

  perform public.exigir_fotos_inspecao(p_assignment_id, 'retirada');
  v_painel := public.foto_painel_do_momento(p_assignment_id, 'retirada');
  perform public.registrar_km_interno(v_vinculo.vehicle_id, v_vinculo.km_inicio, 'retirada',
    v_painel.path, v_painel.capturado_em, false);

  update public.assignments set status = 'ativo' where id = p_assignment_id
  returning * into v_vinculo;
  return v_vinculo;
end;
$$;

-- ---------- devolver_carro: já encerrado por este motorista com o mesmo km → devolve ----------
create or replace function public.devolver_carro(
  p_assignment_id uuid,
  p_km int,
  p_foto_painel_path text default null,
  p_capturado_em timestamptz default now()
)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculo public.assignments;
  v_painel public.inspection_photos;
begin
  select * into v_vinculo from public.assignments
  where id = p_assignment_id and driver_id = auth.uid()
  for update;
  if found and v_vinculo.status = 'encerrado' and v_vinculo.km_fim = p_km then
    return v_vinculo;
  end if;
  if not found or v_vinculo.status <> 'ativo' then
    perform public.erro('VINCULO_INVALIDO', 'Você não tem este carro em uso.');
  end if;

  perform public.exigir_fotos_inspecao(p_assignment_id, 'devolucao');
  v_painel := public.foto_painel_do_momento(p_assignment_id, 'devolucao');
  perform public.registrar_km_interno(v_vinculo.vehicle_id, p_km, 'devolucao',
    v_painel.path, v_painel.capturado_em, false);

  update public.assignments set status = 'encerrado', fim_em = now(), km_fim = p_km
  where id = p_assignment_id
  returning * into v_vinculo;
  update public.vehicles set em_uso = false where id = v_vinculo.vehicle_id;
  return v_vinculo;
end;
$$;

-- ---------- registrar_km: mesma foto + mesmo km + mesmo autor → devolve a leitura existente ----------
create or replace function public.registrar_km(
  p_vehicle_id uuid,
  p_km int,
  p_origem public.origem_km default 'atualizacao',
  p_foto_painel_path text default null,
  p_capturado_em timestamptz default now()
)
returns public.odometer_readings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente public.odometer_readings;
begin
  if p_origem in ('retirada', 'devolucao') then
    perform public.erro('ORIGEM_INVALIDA', 'Use a retirada ou a devolução do carro para este registro.');
  end if;
  if nullif(btrim(p_foto_painel_path), '') is not null then
    select * into v_existente from public.odometer_readings
    where foto_painel_path = p_foto_painel_path and autor_id = auth.uid()
      and vehicle_id = p_vehicle_id and km = p_km;
    if found then
      return v_existente;
    end if;
  end if;
  return public.registrar_km_interno(p_vehicle_id, p_km, p_origem, p_foto_painel_path, p_capturado_em, true);
end;
$$;

-- ---------- Serviço pela fila: mesma nota + mesmo autor → devolve o registro existente ----------
create or replace function public.registrar_servico_offline(
  p_vehicle_id uuid,
  p_itens jsonb,
  p_km int,
  p_data date,
  p_valor_total numeric,
  p_request_id uuid default null,
  p_oficina text default null,
  p_nota_foto_path text default null,
  p_foto_painel_path text default null
)
returns public.maintenance_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente public.maintenance_records;
begin
  if nullif(btrim(p_nota_foto_path), '') is not null then
    select * into v_existente from public.maintenance_records
    where nota_foto_path = p_nota_foto_path and autor_id = auth.uid() and vehicle_id = p_vehicle_id;
    if found then
      return v_existente;
    end if;
  end if;
  return public.registrar_servico(p_vehicle_id, p_itens, p_km, p_data, p_valor_total,
    p_request_id, p_oficina, p_nota_foto_path, p_foto_painel_path);
end;
$$;

revoke execute on function public.registrar_servico_offline(uuid, jsonb, int, date, numeric, uuid, text, text, text) from public, anon;
grant execute on function public.registrar_servico_offline(uuid, jsonb, int, date, numeric, uuid, text, text, text) to authenticated;

-- ---------- responder_candidatura: uma frota por motorista ----------
create or replace function public.responder_candidatura(p_id uuid, p_aceitar boolean)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cand public.candidaturas;
  v_outra public.candidaturas;
  v_frota_nome text;
  v_vehicle uuid;
begin
  -- O carro primeiro: dois aceites ao mesmo tempo para o mesmo carro ficam em fila, sem deadlock.
  select c.vehicle_id into v_vehicle from public.candidaturas c
  join public.fleets f on f.id = c.fleet_id
  where c.id = p_id and f.owner_id = auth.uid();
  if not found then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  perform 1 from public.vehicles where id = v_vehicle for update;

  select * into v_cand from public.candidaturas where id = p_id for update;
  if v_cand.status <> 'pendente' then
    perform public.erro('TRANSICAO_INVALIDA', 'Esta candidatura já foi respondida.');
  end if;
  select nome into v_frota_nome from public.fleets where id = v_cand.fleet_id;

  if not p_aceitar then
    update public.candidaturas set status = 'recusada', respondida_em = now() where id = p_id
    returning * into v_cand;
    perform public.notificar(v_cand.driver_id, 'candidatura_recusada', 'Candidatura',
      'Sua candidatura foi recusada', 'candidaturas', v_cand.id);
    return v_cand;
  end if;

  if exists (select 1 from public.fleet_members
             where driver_id = v_cand.driver_id and status = 'ativo' and fleet_id <> v_cand.fleet_id) then
    update public.candidaturas set status = 'cancelada', respondida_em = now() where id = p_id;
    perform public.erro('JA_EM_FROTA', 'Este motorista já entrou em outra frota.');
  end if;

  insert into public.fleet_members (fleet_id, driver_id, status, nivel_manutencao)
  values (v_cand.fleet_id, v_cand.driver_id, 'ativo', 'com_aprovacao')
  on conflict (fleet_id, driver_id) do update set status = 'ativo', nivel_manutencao = 'com_aprovacao';

  delete from public.vehicle_visibility where vehicle_id = v_cand.vehicle_id;
  insert into public.vehicle_visibility (vehicle_id, driver_id) values (v_cand.vehicle_id, v_cand.driver_id);
  update public.vehicles set visibilidade = 'um', anunciado = false where id = v_cand.vehicle_id;

  update public.candidaturas set status = 'aceita', respondida_em = now() where id = p_id
  returning * into v_cand;
  perform public.notificar(v_cand.driver_id, 'candidatura_aceita', 'Candidatura aceita',
    format('Sua candidatura foi aceita. Bem-vindo à %s!', v_frota_nome), 'candidaturas', v_cand.id);

  -- Concorrentes ao mesmo carro: recusadas.
  for v_outra in
    select * from public.candidaturas
    where vehicle_id = v_cand.vehicle_id and status = 'pendente' and id <> p_id
    for update
  loop
    update public.candidaturas set status = 'recusada', respondida_em = now() where id = v_outra.id;
    perform public.notificar(v_outra.driver_id, 'candidatura_recusada', 'Candidatura',
      'Sua candidatura foi recusada', 'candidaturas', v_outra.id);
  end loop;

  -- O motorista aceito sai das candidaturas a carros de outras frotas.
  update public.candidaturas set status = 'cancelada', respondida_em = now()
  where driver_id = v_cand.driver_id and status = 'pendente' and id <> p_id;

  return v_cand;
end;
$$;
