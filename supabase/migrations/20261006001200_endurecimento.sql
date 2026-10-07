-- Endurecimento (revisão final do backend):
-- fotos precisam existir no storage, storage por carro, perfis sem token de push,
-- previsão sem critério, pedidos com nulls, auto-vínculo do dono, aviso de salto e CHECKs.

-- ---------- Fotos: o caminho precisa existir no storage ----------
-- Verdadeiro só se o caminho começa com '<fleet_id>/<vehicle_id>/' e o objeto existe no bucket 'fotos'.
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
    ),
    false);
$$;

revoke execute on function public.foto_valida(text, uuid, uuid) from public, anon, authenticated;

create or replace function public.validar_foto_inspecao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fleet_id uuid;
  v_vehicle_id uuid;
begin
  select v.fleet_id, v.id into v_fleet_id, v_vehicle_id
  from public.assignments a
  join public.vehicles v on v.id = a.vehicle_id
  where a.id = new.assignment_id;

  if not public.foto_valida(new.path, v_fleet_id, v_vehicle_id) then
    perform public.erro('FOTO_INVALIDA', 'A foto não foi encontrada. Envie a foto novamente.');
  end if;
  return new;
end;
$$;

create or replace function public.validar_foto_ocorrencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fleet_id uuid;
  v_vehicle_id uuid;
begin
  select v.fleet_id, v.id into v_fleet_id, v_vehicle_id
  from public.incidents i
  join public.vehicles v on v.id = i.vehicle_id
  where i.id = new.incident_id;

  if not public.foto_valida(new.path, v_fleet_id, v_vehicle_id) then
    perform public.erro('FOTO_INVALIDA', 'A foto não foi encontrada. Envie a foto novamente.');
  end if;
  return new;
end;
$$;

revoke execute on function public.validar_foto_inspecao() from public, anon, authenticated;
revoke execute on function public.validar_foto_ocorrencia() from public, anon, authenticated;

create trigger inspection_photos_validar_foto
  before insert or update of path, assignment_id on public.inspection_photos
  for each row execute function public.validar_foto_inspecao();

create trigger incident_photos_validar_foto
  before insert or update of path, incident_id on public.incident_photos
  for each row execute function public.validar_foto_ocorrencia();

-- ---------- incident_photos.recebido_em ----------
alter table public.incident_photos
  add column recebido_em timestamptz not null default now();

-- ---------- Storage: segundo segmento é o carro ----------
-- Segundo segmento do caminho como uuid; null se não for um uuid válido (evita 22P02 nas políticas).
create or replace function public.vehicle_id_do_objeto(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(p_name))[2])::uuid
  end;
$$;

grant execute on function public.vehicle_id_do_objeto(text) to authenticated;

drop policy fotos_select on storage.objects;
drop policy fotos_insert on storage.objects;

-- Leitura: dono da frota, quem enviou o objeto, ou membro ativo com vínculo aberto no carro da pasta.
create policy fotos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (
      public.e_dono_frota(public.fleet_id_do_objeto(name))
      or owner_id = (select auth.uid())::text
      or owner = (select auth.uid())
      or (public.e_membro_ativo(public.fleet_id_do_objeto(name))
          and public.tem_vinculo_ativo(public.vehicle_id_do_objeto(name)))
    )
  );

-- Envio: dono da frota, ou membro ativo com vínculo aberto no carro da pasta.
create policy fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (
      public.e_dono_frota(public.fleet_id_do_objeto(name))
      or (public.e_membro_ativo(public.fleet_id_do_objeto(name))
          and public.tem_vinculo_ativo(public.vehicle_id_do_objeto(name)))
    )
  );

-- ---------- Perfis: o token de push não é legível pelos usuários ----------
revoke select on public.profiles from authenticated;
grant select (id, nome, telefone, papel, criado_em) on public.profiles to authenticated;

-- Só membros ATIVOS enxergam o perfil do dono.
create or replace function public.e_membro_do_dono(p_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.fleet_members m
    join public.fleets f on f.id = m.fleet_id
    where f.owner_id = p_owner_id and m.driver_id = auth.uid() and m.status = 'ativo'
  );
$$;

-- ---------- CHECKs ----------
alter table public.vehicle_items
  add constraint vehicle_items_intervalo_km_positivo check (intervalo_km is null or intervalo_km > 0) not valid,
  add constraint vehicle_items_intervalo_meses_positivo check (intervalo_meses is null or intervalo_meses > 0) not valid,
  add constraint vehicle_items_custo_nao_negativo check (custo_estimado >= 0) not valid;
alter table public.vehicle_items validate constraint vehicle_items_intervalo_km_positivo;
alter table public.vehicle_items validate constraint vehicle_items_intervalo_meses_positivo;
alter table public.vehicle_items validate constraint vehicle_items_custo_nao_negativo;

alter table public.fleets
  add constraint fleets_limite_salto_positivo check (limite_salto_km_dia > 0) not valid,
  add constraint fleets_limiar_amarelo_km_nao_negativo check (limiar_amarelo_km >= 0) not valid,
  add constraint fleets_limiar_amarelo_dias_nao_negativo check (limiar_amarelo_dias >= 0) not valid,
  add constraint fleets_limiar_laranja_km_nao_negativo check (limiar_laranja_km >= 0) not valid;
alter table public.fleets validate constraint fleets_limite_salto_positivo;
alter table public.fleets validate constraint fleets_limiar_amarelo_km_nao_negativo;
alter table public.fleets validate constraint fleets_limiar_amarelo_dias_nao_negativo;
alter table public.fleets validate constraint fleets_limiar_laranja_km_nao_negativo;

-- ---------- registrar_km: foto do painel no servidor; sem aviso quando o autor é o dono ----------
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
  if v_foto is not null and not public.foto_valida(v_foto, v_veiculo.fleet_id, p_vehicle_id) then
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

-- ---------- registrar_servico: nota no servidor; dono vincula o único pedido aberto ----------
create or replace function public.registrar_servico(
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
  v_veiculo public.vehicles;
  v_dono_id uuid;
  v_dono boolean;
  v_permissao text;
  v_elem jsonb;
  v_vi uuid;
  v_nome text;
  v_valor numeric;
  v_registro public.maintenance_records;
  v_linhas jsonb := '[]'::jsonb;
  v_pedido_id uuid := p_request_id;
  v_nota text := nullif(btrim(coalesce(p_nota_foto_path, '')), '');
begin
  select * into v_veiculo from public.vehicles where id = p_vehicle_id for update;
  if not found then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  select owner_id into v_dono_id from public.fleets where id = v_veiculo.fleet_id;
  v_dono := v_dono_id = auth.uid();

  -- 1 permissão
  v_permissao := public.permissao_registro(p_vehicle_id, p_request_id);
  if v_permissao = 'negado' then
    perform public.erro('SEM_PERMISSAO', 'Você não tem permissão para registrar serviços neste carro.');
  end if;

  -- 2 pedido
  if p_request_id is not null and not exists (
    select 1 from public.maintenance_requests
    where id = p_request_id and vehicle_id = p_vehicle_id and status = 'aberto'
      and (driver_id = auth.uid() or v_dono)
  ) then
    perform public.erro('PEDIDO_INVALIDO', 'Este pedido de manutenção não está mais disponível.');
  end if;

  -- Sem pedido informado: o motorista vincula o pedido aberto mais antigo dele no carro;
  -- o dono vincula o pedido aberto do carro somente se houver exatamente um.
  if v_pedido_id is null and not v_dono then
    select id into v_pedido_id from public.maintenance_requests
    where vehicle_id = p_vehicle_id and driver_id = auth.uid() and status = 'aberto'
    order by criado_em, id
    limit 1;
  elsif v_pedido_id is null and v_dono then
    select (array_agg(id))[1] into v_pedido_id from public.maintenance_requests
    where vehicle_id = p_vehicle_id and status = 'aberto'
    having count(*) = 1;
  end if;

  -- 3 itens
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    perform public.erro('ITENS_OBRIGATORIOS', 'Selecione pelo menos um item do serviço.');
  end if;

  -- 4 itens do carro
  for v_elem in select * from jsonb_array_elements(p_itens) loop
    v_vi := null; v_nome := null; v_valor := null;
    begin
      if jsonb_typeof(v_elem) <> 'object' then
        raise exception 'item';
      end if;
      v_vi := nullif(v_elem->>'vehicle_item_id', '')::uuid;
      v_nome := nullif(btrim(coalesce(v_elem->>'nome_outro', '')), '');
      v_valor := nullif(v_elem->>'valor', '')::numeric;
    exception when others then
      perform public.erro('ITEM_INVALIDO', 'Item de serviço inválido.');
    end;
    if v_vi is null and v_nome is null then
      perform public.erro('ITEM_INVALIDO', 'Item de serviço inválido.');
    end if;
    if v_vi is not null and not exists (
      select 1 from public.vehicle_items where id = v_vi and vehicle_id = p_vehicle_id
    ) then
      perform public.erro('ITEM_INVALIDO', 'Um dos itens não pertence a este carro.');
    end if;
    if v_valor is not null and v_valor < 0 then
      perform public.erro('VALOR_INVALIDO', 'Informe um valor válido.');
    end if;
    v_linhas := v_linhas || jsonb_build_object('vehicle_item_id', v_vi, 'nome_outro', v_nome, 'valor', v_valor);
  end loop;

  -- 5 data
  if p_data is null or p_data > public.hoje_brt() then
    perform public.erro('DATA_FUTURA', 'A data do serviço não pode ser no futuro.');
  end if;

  -- 6 nota (obrigatória para o motorista; se informada, precisa existir no storage)
  if not v_dono and v_nota is null then
    perform public.erro('FOTO_NOTA_OBRIGATORIA', 'Tire uma foto da nota ou do serviço feito.');
  end if;
  if v_nota is not null and not public.foto_valida(v_nota, v_veiculo.fleet_id, p_vehicle_id) then
    perform public.erro('FOTO_INVALIDA', 'A foto não foi encontrada. Envie a foto novamente.');
  end if;

  if p_km is null or p_km < 0 or p_valor_total is null or p_valor_total < 0 then
    perform public.erro('VALOR_INVALIDO', 'Informe um km e um valor válidos.');
  end if;

  -- Efeitos
  if p_km > v_veiculo.km_atual then
    perform public.registrar_km(p_vehicle_id, p_km, 'manutencao', p_foto_painel_path);
  end if;

  insert into public.maintenance_records
    (vehicle_id, autor_id, request_id, oficina, km, data, valor_total, nota_foto_path, status)
  values
    (p_vehicle_id, auth.uid(), v_pedido_id, p_oficina, p_km, p_data, p_valor_total, v_nota,
     v_permissao::public.status_servico)
  returning * into v_registro;

  insert into public.maintenance_record_items (record_id, vehicle_item_id, nome_outro, valor)
  select v_registro.id, nullif(l->>'vehicle_item_id', '')::uuid, l->>'nome_outro', nullif(l->>'valor', '')::numeric
  from jsonb_array_elements(v_linhas) l;

  if v_registro.status = 'aprovado' then
    perform public.recalcular_itens_do_servico(v_registro.id);
    if v_pedido_id is not null then
      update public.maintenance_requests set status = 'concluido' where id = v_pedido_id;
    end if;
  end if;

  if not v_dono then
    if v_registro.status = 'aprovado' then
      perform public.notificar(
        v_dono_id, 'servico_registrado', 'Serviço registrado',
        format('Um motorista registrou um serviço no %s %s.', v_veiculo.modelo, v_veiculo.placa),
        'maintenance_records', v_registro.id);
    else
      perform public.notificar(
        v_dono_id, 'servico_pendente', 'Serviço aguardando aprovação',
        format('Um motorista registrou um serviço no %s %s. Confira e aprove.', v_veiculo.modelo, v_veiculo.placa),
        'maintenance_records', v_registro.id, 'alta');
    end if;
  end if;

  return v_registro;
end;
$$;

-- ---------- criar_pedido: rejeita nulls na lista de itens ----------
create or replace function public.criar_pedido(
  p_vehicle_id uuid,
  p_itens uuid[],
  p_prazo date,
  p_observacao text default null
)
returns public.maintenance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veiculo public.vehicles;
  v_motorista uuid;
  v_pedido public.maintenance_requests;
begin
  select * into v_veiculo from public.vehicles where id = p_vehicle_id for update;
  if not found or not public.e_dono_do_veiculo(p_vehicle_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  select driver_id into v_motorista from public.assignments
  where vehicle_id = p_vehicle_id and status = 'ativo';
  if v_motorista is null then
    perform public.erro('CARRO_SEM_MOTORISTA', 'Este carro está sem motorista no momento.');
  end if;

  if p_itens is null or coalesce(array_length(p_itens, 1), 0) = 0 then
    perform public.erro('ITENS_OBRIGATORIOS', 'Selecione pelo menos um item do pedido.');
  end if;
  if array_position(p_itens, null) is not null then
    perform public.erro('ITEM_INVALIDO', 'Item de pedido inválido.');
  end if;
  if (select count(*) from public.vehicle_items where vehicle_id = p_vehicle_id and id = any (p_itens))
     <> (select count(distinct x) from unnest(p_itens) x) then
    perform public.erro('ITEM_INVALIDO', 'Um dos itens não pertence a este carro.');
  end if;
  if p_prazo is null then
    perform public.erro('VALOR_INVALIDO', 'Informe o prazo do pedido.');
  end if;

  insert into public.maintenance_requests (vehicle_id, driver_id, itens, prazo, observacao)
  values (p_vehicle_id, v_motorista, p_itens, p_prazo, p_observacao)
  returning * into v_pedido;

  perform public.notificar(
    v_motorista, 'pedido_novo', 'Novo pedido de manutenção',
    format('O proprietário pediu manutenção no %s %s até %s.', v_veiculo.modelo, v_veiculo.placa,
      to_char(p_prazo, 'DD/MM/YYYY')),
    'maintenance_requests', v_pedido.id, 'alta');

  return v_pedido;
end;
$$;

-- ---------- Previsão: item sem critério utilizável é sem_historico ----------
create or replace function public.previsao_itens_interna(p_vehicle_id uuid, p_hoje date)
returns table (
  vehicle_item_id uuid, nome text, proximo_km int, km_restante int,
  data_prevista date, status public.status_item, custo_estimado numeric
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    x.id, x.nome, x.proximo_km, x.km_restante, x.data_prevista,
    case
      when x.ultimo_km is null and x.ultima_data is null then 'sem_historico'::public.status_item
      -- há histórico, mas nem km nem data previstos podem ser calculados (ex.: só data e intervalo só em km)
      when x.proximo_km is null and x.data_prevista is null then 'sem_historico'::public.status_item
      when x.km_restante <= 0 or x.data_prevista <= p_hoje then 'vencido'::public.status_item
      when x.km_restante < x.limiar_laranja_km then 'urgente'::public.status_item
      when x.km_restante <= x.limiar_amarelo_km
        or x.data_prevista <= p_hoje + x.limiar_amarelo_dias then 'proximo'::public.status_item
      else 'em_dia'::public.status_item
    end,
    x.custo_estimado
  from (
    select
      i.id, i.nome, i.ultimo_km, i.ultima_data, i.custo_estimado,
      fl.limiar_laranja_km, fl.limiar_amarelo_km, fl.limiar_amarelo_dias,
      k.proximo_km, k.proximo_km - v.km_atual as km_restante,
      case
        when i.ultimo_km is null and i.ultima_data is null then null
        else least(
          case when k.proximo_km is not null and m.media > 0
               then p_hoje + (case when k.proximo_km - v.km_atual > 0
                               then ceil((k.proximo_km - v.km_atual) / m.media)
                               else floor((k.proximo_km - v.km_atual) / m.media) end)::int end,
          case when i.ultima_data is not null and i.intervalo_meses is not null
               then (i.ultima_data + make_interval(months => i.intervalo_meses))::date end
        )
      end as data_prevista
    from public.vehicle_items i
    join public.vehicles v on v.id = i.vehicle_id
    join public.fleets fl on fl.id = v.fleet_id
    cross join lateral public.media_km_dia_interna(p_vehicle_id, p_hoje) m
    cross join lateral (
      select case when i.intervalo_km is not null and i.ultimo_km is not null
                  then i.ultimo_km + i.intervalo_km end as proximo_km
    ) k
    where i.vehicle_id = p_vehicle_id and i.ativo
  ) x
  order by x.data_prevista nulls last, x.nome;
$$;

-- Projeção: "revisão recomendada" (data null) para todo item com status sem_historico.
create or replace function public.projecao_gastos(p_fleet_id uuid, p_dias int, p_hoje date default public.hoje_brt())
returns table (
  vehicle_id uuid, placa text, vehicle_item_id uuid, item_nome text, data date, valor numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  r record;
  d date;
  ciclo_km int;
  meses int;
begin
  if not public.e_dono_frota(p_fleet_id) then
    perform public.erro('SEM_ACESSO', 'Somente o proprietário vê a projeção de gastos.');
  end if;
  if p_dias is null or p_dias not in (30, 60, 90) then
    perform public.erro('PERIODO_INVALIDO', 'Escolha um período de 30, 60 ou 90 dias.');
  end if;

  for r in
    select v.id as vid, v.placa as vplaca, i.id as iid, i.nome as inome, i.intervalo_km, i.intervalo_meses,
           p.data_prevista, p.custo_estimado as custo, m.media,
           (p.status = 'sem_historico') as sem_hist
    from public.vehicles v
    join public.vehicle_items i on i.vehicle_id = v.id and i.ativo
    cross join lateral public.previsao_itens_interna(v.id, p_hoje) p
    cross join lateral public.media_km_dia_interna(v.id, p_hoje) m
    where v.fleet_id = p_fleet_id and v.ativo and p.vehicle_item_id = i.id
    order by v.placa, i.nome
  loop
    if r.sem_hist then
      vehicle_id := r.vid; placa := r.vplaca; vehicle_item_id := r.iid; item_nome := r.inome;
      data := null; valor := r.custo;
      return next;
      continue;
    end if;

    d := greatest(r.data_prevista, p_hoje);   -- data_prevista null → d null → pula
    ciclo_km := case when r.intervalo_km is not null and r.media > 0
                     then greatest(1, floor(r.intervalo_km / r.media))::int end;
    meses := case when r.intervalo_meses > 0 then r.intervalo_meses end;

    while d is not null and d <= p_hoje + p_dias loop
      vehicle_id := r.vid; placa := r.vplaca; vehicle_item_id := r.iid; item_nome := r.inome;
      data := d; valor := r.custo;
      return next;
      d := least(
        case when ciclo_km is not null then d + ciclo_km end,
        case when meses is not null then (d + make_interval(months => meses))::date end
      );
    end loop;
  end loop;
end;
$$;
