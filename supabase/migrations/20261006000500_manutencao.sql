-- Pedidos de manutenção, registro de serviços e permissões.

create type public.status_servico as enum ('pendente', 'aprovado', 'recusado', 'contestado');
create type public.status_pedido as enum ('aberto', 'concluido', 'cancelado');

-- ---------- Tabelas ----------
create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  itens uuid[] not null,
  prazo date not null,
  observacao text,
  status public.status_pedido not null default 'aberto',
  prazo_notificado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index maintenance_requests_vehicle_idx on public.maintenance_requests (vehicle_id);
create index maintenance_requests_driver_idx on public.maintenance_requests (driver_id);
create index maintenance_requests_abertos_idx on public.maintenance_requests (vehicle_id, driver_id)
  where status = 'aberto';

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  autor_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid references public.maintenance_requests (id) on delete set null,
  oficina text,
  km int not null,
  data date not null,
  valor_total numeric(10,2) not null check (valor_total >= 0),
  nota_foto_path text,
  status public.status_servico not null,
  revisado_por uuid references public.profiles (id) on delete set null,
  revisado_em timestamptz,
  motivo text,
  criado_em timestamptz not null default now()
);

create index maintenance_records_vehicle_idx on public.maintenance_records (vehicle_id, data desc);
create index maintenance_records_autor_idx on public.maintenance_records (autor_id);
create index maintenance_records_request_idx on public.maintenance_records (request_id);

create table public.maintenance_record_items (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.maintenance_records (id) on delete cascade,
  vehicle_item_id uuid references public.vehicle_items (id) on delete cascade,
  nome_outro text,
  valor numeric(10,2),
  check (vehicle_item_id is not null or nome_outro is not null)
);

create index maintenance_record_items_record_idx on public.maintenance_record_items (record_id);
create index maintenance_record_items_item_idx on public.maintenance_record_items (vehicle_item_id);

alter table public.maintenance_requests enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_record_items enable row level security;

-- ---------- RLS ----------
create policy maintenance_requests_select on public.maintenance_requests
  for select to authenticated
  using (driver_id = auth.uid() or public.e_dono_do_veiculo(vehicle_id));

create policy maintenance_records_select on public.maintenance_records
  for select to authenticated
  using (
    public.e_dono_do_veiculo(vehicle_id)
    or autor_id = auth.uid()
    or public.tem_vinculo_ativo(vehicle_id)
  );

create policy maintenance_record_items_select on public.maintenance_record_items
  for select to authenticated
  using (exists (select 1 from public.maintenance_records r where r.id = record_id));

revoke all on public.maintenance_requests from anon, authenticated;
revoke all on public.maintenance_records from anon, authenticated;
revoke all on public.maintenance_record_items from anon, authenticated;
grant select on public.maintenance_requests to authenticated;
grant select on public.maintenance_records to authenticated;
grant select on public.maintenance_record_items to authenticated;

-- ---------- Funções internas ----------
-- Último serviço aprovado do item; sem ele, volta ao histórico inicial.
create or replace function public.recalcular_ultima_troca(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_km int;
  v_data date;
  v_achou boolean := false;
begin
  select r.km, r.data, true into v_km, v_data, v_achou
  from public.maintenance_record_items ri
  join public.maintenance_records r on r.id = ri.record_id
  where ri.vehicle_item_id = p_item_id and r.status = 'aprovado'
  order by r.data desc, r.km desc
  limit 1;

  if v_achou then
    update public.vehicle_items set ultimo_km = v_km, ultima_data = v_data where id = p_item_id;
  else
    update public.vehicle_items set ultimo_km = km_inicial, ultima_data = data_inicial where id = p_item_id;
  end if;
end;
$$;

revoke execute on function public.recalcular_ultima_troca(uuid) from public, anon, authenticated;

create or replace function public.recalcular_itens_do_servico(p_record_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
begin
  for v_item in
    select distinct vehicle_item_id from public.maintenance_record_items
    where record_id = p_record_id and vehicle_item_id is not null
  loop
    perform public.recalcular_ultima_troca(v_item);
  end loop;
end;
$$;

revoke execute on function public.recalcular_itens_do_servico(uuid) from public, anon, authenticated;

-- Cancela os pedidos abertos quando o vínculo do motorista com o carro termina.
create or replace function public.cancelar_pedidos_do_vinculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_placa text;
  v_dono uuid;
begin
  if new.status <> 'encerrado' or old.status = 'encerrado' then
    return new;
  end if;

  select v.placa, f.owner_id into v_placa, v_dono
  from public.vehicles v join public.fleets f on f.id = v.fleet_id
  where v.id = new.vehicle_id;

  for v_pedido in
    update public.maintenance_requests
    set status = 'cancelado'
    where vehicle_id = new.vehicle_id and driver_id = new.driver_id and status = 'aberto'
    returning id
  loop
    perform public.notificar(
      v_dono, 'pedido_cancelado', 'Pedido de manutenção cancelado',
      format('O pedido de manutenção do carro %s foi cancelado porque o motorista devolveu o carro.', v_placa),
      'maintenance_requests', v_pedido.id);
  end loop;

  return new;
end;
$$;

revoke execute on function public.cancelar_pedidos_do_vinculo() from public, anon, authenticated;

create trigger assignments_cancelar_pedidos
  after update of status on public.assignments
  for each row execute function public.cancelar_pedidos_do_vinculo();

-- ---------- RPCs ----------
create or replace function public.permissao_registro(p_vehicle_id uuid, p_request_id uuid default null)
returns text
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_veiculo public.vehicles;
  v_frota public.fleets;
  v_nivel public.nivel_manutencao;
  v_pedido boolean;
begin
  select * into v_veiculo from public.vehicles where id = p_vehicle_id;
  if not found then
    return 'negado';
  end if;
  select * into v_frota from public.fleets where id = v_veiculo.fleet_id;
  if v_frota.owner_id = auth.uid() then
    return 'aprovado';
  end if;
  if not public.tem_vinculo_ativo(p_vehicle_id) then
    return 'negado';
  end if;

  select nivel_manutencao into v_nivel from public.fleet_members
  where fleet_id = v_veiculo.fleet_id and driver_id = auth.uid() and status = 'ativo';
  if not found then
    return 'negado';
  end if;

  select exists (
    select 1 from public.maintenance_requests
    where vehicle_id = p_vehicle_id and driver_id = auth.uid() and status = 'aberto'
  ) into v_pedido;

  if v_pedido then
    if v_veiculo.exige_aprovacao_sempre then return 'pendente'; end if;
    return case when v_nivel = 'confiavel' then 'aprovado' else 'pendente' end;
  end if;

  if v_frota.modo_manutencao = 'proprietario_leva' or v_nivel = 'sem_permissao' then
    return 'negado';
  end if;
  if v_veiculo.exige_aprovacao_sempre then return 'pendente'; end if;
  return case when v_nivel = 'confiavel' then 'aprovado' else 'pendente' end;
end;
$$;

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

  -- 6 nota
  if not v_dono and nullif(btrim(coalesce(p_nota_foto_path, '')), '') is null then
    perform public.erro('FOTO_NOTA_OBRIGATORIA', 'Tire uma foto da nota ou do serviço feito.');
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
    (p_vehicle_id, auth.uid(), p_request_id, p_oficina, p_km, p_data, p_valor_total, p_nota_foto_path,
     v_permissao::public.status_servico)
  returning * into v_registro;

  insert into public.maintenance_record_items (record_id, vehicle_item_id, nome_outro, valor)
  select v_registro.id, nullif(l->>'vehicle_item_id', '')::uuid, l->>'nome_outro', nullif(l->>'valor', '')::numeric
  from jsonb_array_elements(v_linhas) l;

  if v_registro.status = 'aprovado' then
    perform public.recalcular_itens_do_servico(v_registro.id);
    if p_request_id is not null then
      update public.maintenance_requests set status = 'concluido' where id = p_request_id;
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

create or replace function public.revisar_servico(
  p_record_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns public.maintenance_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registro public.maintenance_records;
  v_novo public.status_servico;
  v_placa text;
begin
  select * into v_registro from public.maintenance_records where id = p_record_id for update;
  if not found or not public.e_dono_do_veiculo(v_registro.vehicle_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  v_novo := case p_decisao
    when 'aprovar' then 'aprovado'
    when 'recusar' then 'recusado'
    when 'contestar' then 'contestado'
    else null
  end;
  if v_novo is null then
    perform public.erro('VALOR_INVALIDO', 'Decisão inválida.');
  end if;

  if not ((v_registro.status = 'pendente' and v_novo in ('aprovado', 'recusado'))
          or (v_registro.status = 'aprovado' and v_novo = 'contestado')) then
    perform public.erro('TRANSICAO_INVALIDA', 'Este serviço não pode mais receber essa decisão.');
  end if;

  update public.maintenance_records
  set status = v_novo, revisado_por = auth.uid(), revisado_em = now(), motivo = p_motivo
  where id = p_record_id
  returning * into v_registro;

  if v_novo in ('aprovado', 'contestado') then
    perform public.recalcular_itens_do_servico(p_record_id);
  end if;
  if v_novo = 'aprovado' and v_registro.request_id is not null then
    update public.maintenance_requests set status = 'concluido'
    where id = v_registro.request_id and status = 'aberto';
  end if;

  if v_registro.autor_id <> auth.uid() then
    select placa into v_placa from public.vehicles where id = v_registro.vehicle_id;
    perform public.notificar(
      v_registro.autor_id, 'servico_revisado', 'Serviço revisado',
      format('Seu serviço no carro %s foi %s.%s', v_placa,
        case v_novo when 'aprovado' then 'aprovado' when 'recusado' then 'recusado' else 'contestado' end,
        case when p_motivo is not null then ' Motivo: ' || p_motivo else '' end),
      'maintenance_records', v_registro.id);
  end if;

  return v_registro;
end;
$$;

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

create or replace function public.cancelar_pedido(p_request_id uuid)
returns public.maintenance_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.maintenance_requests;
begin
  select * into v_pedido from public.maintenance_requests where id = p_request_id for update;
  if not found or not public.e_dono_do_veiculo(v_pedido.vehicle_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  if v_pedido.status <> 'aberto' then
    perform public.erro('PEDIDO_INVALIDO', 'Este pedido não está mais aberto.');
  end if;

  update public.maintenance_requests set status = 'cancelado' where id = p_request_id
  returning * into v_pedido;
  return v_pedido;
end;
$$;

create or replace function public.custo_medio_item(p_item_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_vehicle_id uuid;
begin
  select vehicle_id into v_vehicle_id from public.vehicle_items where id = p_item_id;
  if not found or not (public.e_dono_do_veiculo(v_vehicle_id) or public.tem_vinculo_ativo(v_vehicle_id)) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  return (
    select round(avg(ri.valor), 2)
    from public.maintenance_record_items ri
    join public.maintenance_records r on r.id = ri.record_id
    where ri.vehicle_item_id = p_item_id and r.status = 'aprovado' and ri.valor is not null
  );
end;
$$;

revoke execute on function public.permissao_registro(uuid, uuid) from public, anon;
revoke execute on function public.registrar_servico(uuid, jsonb, int, date, numeric, uuid, text, text, text) from public, anon;
revoke execute on function public.revisar_servico(uuid, text, text) from public, anon;
revoke execute on function public.criar_pedido(uuid, uuid[], date, text) from public, anon;
revoke execute on function public.cancelar_pedido(uuid) from public, anon;
revoke execute on function public.custo_medio_item(uuid) from public, anon;
grant execute on function public.permissao_registro(uuid, uuid) to authenticated;
grant execute on function public.registrar_servico(uuid, jsonb, int, date, numeric, uuid, text, text, text) to authenticated;
grant execute on function public.revisar_servico(uuid, text, text) to authenticated;
grant execute on function public.criar_pedido(uuid, uuid[], date, text) to authenticated;
grant execute on function public.cancelar_pedido(uuid) to authenticated;
grant execute on function public.custo_medio_item(uuid) to authenticated;
