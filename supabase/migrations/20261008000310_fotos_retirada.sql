-- Bloco 1: retirada e devolução com 5 fotos (painel obrigatório) e fotos antifraude.

-- ---------- Foto válida: existe, é do carro, foi enviada por quem chama e ainda não foi usada ----------
-- Sem auth.uid() (seed/manutenção pelo banco), a checagem de autoria não se aplica.
create or replace function public.foto_valida(p_path text, p_fleet_id uuid, p_vehicle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    p_path is not null
    and starts_with(p_path, p_fleet_id::text || '/' || p_vehicle_id::text || '/')
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'fotos' and o.name = p_path
        and (auth.uid() is null or o.owner_id = auth.uid()::text or o.owner = auth.uid())
    )
    and not exists (select 1 from public.inspection_photos x where x.path = p_path)
    and not exists (select 1 from public.incident_photos x where x.path = p_path)
    and not exists (select 1 from public.odometer_readings x where x.foto_painel_path = p_path)
    and not exists (select 1 from public.maintenance_records x where x.nota_foto_path = p_path),
    false);
$$;

revoke execute on function public.foto_valida(text, uuid, uuid) from public, anon, authenticated;

-- ---------- Fotos obrigatórias: as 5 posições ----------
create or replace function public.exigir_fotos_inspecao(p_assignment_id uuid, p_momento public.momento_foto)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_faltam text;
begin
  select string_agg(r.rotulo, ', ' order by r.ordem) into v_faltam
  from (values
    ('frente'::public.posicao_foto, 'Frente', 1),
    ('traseira'::public.posicao_foto, 'Traseira', 2),
    ('lateral_esq'::public.posicao_foto, 'Lateral esquerda', 3),
    ('lateral_dir'::public.posicao_foto, 'Lateral direita', 4),
    ('painel'::public.posicao_foto, 'Painel', 5)
  ) as r(posicao, rotulo, ordem)
  where not exists (
    select 1 from public.inspection_photos p
    where p.assignment_id = p_assignment_id and p.momento = p_momento and p.posicao = r.posicao
  );

  if v_faltam is not null then
    perform public.erro('FOTOS_FALTANDO', 'Faltam fotos: ' || v_faltam || '.');
  end if;
end;
$$;

-- ---------- Leitura de km: núcleo interno + RPC pública ----------
create or replace function public.registrar_km_interno(
  p_vehicle_id uuid,
  p_km int,
  p_origem public.origem_km,
  p_foto_painel_path text,
  p_capturado_em timestamptz,
  p_validar_foto boolean
)
returns public.odometer_readings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veiculo public.vehicles;
  v_frota public.fleets;
  v_dono boolean;
  v_ultima timestamptz;
  v_dias numeric;
  v_suspeito boolean := false;
  v_leitura public.odometer_readings;
  v_capturado timestamptz := coalesce(p_capturado_em, now());
  v_foto text := nullif(btrim(p_foto_painel_path), '');
begin
  select * into v_veiculo from public.vehicles where id = p_vehicle_id for update;
  if not found then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  select * into v_frota from public.fleets where id = v_veiculo.fleet_id;
  v_dono := v_frota.owner_id = auth.uid();

  if not (v_dono or public.tem_vinculo_ativo(p_vehicle_id)) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  if p_origem = 'correcao_dono' and not v_dono then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  if p_km is null or p_km < 0 then
    perform public.erro('VALOR_INVALIDO', 'Informe um km válido.');
  end if;
  if v_capturado > now() + interval '10 minutes' then
    perform public.erro('HORARIO_INVALIDO', 'O horário da leitura está no futuro. Confira o relógio do celular.');
  end if;
  if p_validar_foto and v_foto is not null and not public.foto_valida(v_foto, v_veiculo.fleet_id, p_vehicle_id) then
    perform public.erro('FOTO_INVALIDA', 'A foto não foi encontrada. Envie a foto novamente.');
  end if;

  if p_origem <> 'correcao_dono' then
    if p_km < v_veiculo.km_atual then
      perform public.erro('KM_MENOR', format('O km informado (%s) é menor que o último registro (%s).',
        public.fmt_km(p_km), public.fmt_km(v_veiculo.km_atual)));
    end if;

    select max(capturado_em) into v_ultima from public.odometer_readings where vehicle_id = p_vehicle_id;
    if v_ultima is not null then
      v_dias := greatest(1, extract(epoch from v_capturado - v_ultima) / 86400.0);
      if p_km - v_veiculo.km_atual > v_frota.limite_salto_km_dia * v_dias then
        if v_foto is null then
          perform public.erro('FOTO_PAINEL_OBRIGATORIA',
            format('O km subiu %s desde o último registro. Tire uma foto do painel para confirmar.',
              public.fmt_km(p_km - v_veiculo.km_atual)));
        end if;
        v_suspeito := true;
      end if;
    end if;
  end if;

  insert into public.odometer_readings (vehicle_id, autor_id, km, origem, foto_painel_path, salto_suspeito, capturado_em)
  values (p_vehicle_id, auth.uid(), p_km, p_origem, v_foto, v_suspeito, v_capturado)
  returning * into v_leitura;

  update public.vehicles set km_atual = p_km where id = p_vehicle_id;

  if v_suspeito and not v_dono then
    perform public.notificar(
      v_frota.owner_id, 'km_foto_painel', 'Salto de km com foto do painel',
      format('O %s %s subiu %s km desde o último registro. Confira a foto do painel.',
        v_veiculo.modelo, v_veiculo.placa, public.fmt_km(p_km - v_veiculo.km_atual)),
      'odometer_readings', v_leitura.id, 'alta');
  end if;

  return v_leitura;
end;
$$;

revoke execute on function public.registrar_km_interno(uuid, int, public.origem_km, text, timestamptz, boolean)
  from public, anon, authenticated;

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
begin
  if p_origem in ('retirada', 'devolucao') then
    perform public.erro('ORIGEM_INVALIDA', 'Use a retirada ou a devolução do carro para este registro.');
  end if;
  return public.registrar_km_interno(p_vehicle_id, p_km, p_origem, p_foto_painel_path, p_capturado_em, true);
end;
$$;

-- ---------- Fotos da inspeção em lote (idempotente, usado pela fila offline) ----------
create or replace function public.registrar_fotos_inspecao(
  p_assignment_id uuid,
  p_momento public.momento_foto,
  p_fotos jsonb
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculo public.assignments;
  v_foto jsonb;
begin
  select * into v_vinculo from public.assignments
  where id = p_assignment_id and driver_id = auth.uid() and status <> 'encerrado';
  if not found then
    perform public.erro('VINCULO_INVALIDO', 'Você não tem este carro em uso.');
  end if;
  if jsonb_typeof(p_fotos) is distinct from 'array' then
    perform public.erro('FOTOS_FALTANDO', 'Envie as fotos do carro.');
  end if;

  for v_foto in select * from jsonb_array_elements(p_fotos) loop
    if not exists (
      select 1 from public.inspection_photos
      where assignment_id = p_assignment_id and path = v_foto->>'path'
    ) then
      insert into public.inspection_photos (assignment_id, momento, posicao, path, capturado_em)
      values (p_assignment_id, p_momento, (v_foto->>'posicao')::public.posicao_foto, v_foto->>'path',
              coalesce((v_foto->>'capturado_em')::timestamptz, now()));
    end if;
  end loop;

  return (select count(distinct posicao)::int from public.inspection_photos
          where assignment_id = p_assignment_id and momento = p_momento);
end;
$$;

revoke execute on function public.registrar_fotos_inspecao(uuid, public.momento_foto, jsonb) from public, anon;
grant execute on function public.registrar_fotos_inspecao(uuid, public.momento_foto, jsonb) to authenticated;

-- Foto do painel mais recente de um momento.
create or replace function public.foto_painel_do_momento(p_assignment_id uuid, p_momento public.momento_foto)
returns public.inspection_photos
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.inspection_photos
  where assignment_id = p_assignment_id and momento = p_momento and posicao = 'painel'
  order by recebido_em desc
  limit 1;
$$;

revoke execute on function public.foto_painel_do_momento(uuid, public.momento_foto) from public, anon, authenticated;

-- ---------- iniciar_retirada: não grava leitura (ela vem com a foto do painel) ----------
create or replace function public.iniciar_retirada(
  p_vehicle_id uuid,
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
  v_veiculo public.vehicles;
  v_vinculo public.assignments;
  v_constraint text;
begin
  select * into v_veiculo from public.vehicles where id = p_vehicle_id for update;
  if not found or not public.e_membro_ativo(v_veiculo.fleet_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  if not public.pode_ver_carro(p_vehicle_id, auth.uid()) then
    perform public.erro('CARRO_INDISPONIVEL', 'Este carro não está disponível para você.');
  end if;
  if not v_veiculo.ativo or v_veiculo.em_uso then
    perform public.erro('CARRO_OCUPADO', 'Este carro já está em uso.');
  end if;
  if exists (select 1 from public.assignments where driver_id = auth.uid() and status <> 'encerrado') then
    perform public.erro('JA_TEM_CARRO', 'Você já está com um carro. Devolva-o antes de retirar outro.');
  end if;
  if p_km is null or p_km < 0 then
    perform public.erro('VALOR_INVALIDO', 'Informe um km válido.');
  end if;
  if p_km < v_veiculo.km_atual then
    perform public.erro('KM_MENOR', format('O km informado (%s) é menor que o último registro (%s).',
      public.fmt_km(p_km), public.fmt_km(v_veiculo.km_atual)));
  end if;

  begin
    insert into public.assignments (vehicle_id, driver_id, km_inicio)
    values (p_vehicle_id, auth.uid(), p_km)
    returning * into v_vinculo;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'assignments_driver_aberto_uidx' then
      perform public.erro('JA_TEM_CARRO', 'Você já está com um carro. Devolva-o antes de retirar outro.');
    end if;
    perform public.erro('CARRO_OCUPADO', 'Este carro já está em uso.');
  end;

  update public.vehicles set em_uso = true where id = p_vehicle_id;
  return v_vinculo;
end;
$$;

-- ---------- concluir_retirada: 5 fotos + leitura com a foto do painel ----------
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

-- ---------- devolver_carro: 5 fotos + leitura com a foto do painel ----------
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
  where id = p_assignment_id and driver_id = auth.uid() and status = 'ativo'
  for update;
  if not found then
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
