-- Bloco 1: visibilidade do carro dentro da frota (todos / alguns / um).

create type public.visibilidade_carro as enum ('todos', 'alguns', 'um');

alter table public.vehicles
  add column visibilidade public.visibilidade_carro not null default 'todos';

create table public.vehicle_visibility (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  primary key (vehicle_id, driver_id)
);

alter table public.vehicle_visibility enable row level security;
revoke all on public.vehicle_visibility from anon, authenticated;
grant select on public.vehicle_visibility to authenticated;

create policy vehicle_visibility_select on public.vehicle_visibility
  for select to authenticated
  using (driver_id = auth.uid() or public.e_dono_do_veiculo(vehicle_id));

-- ---------- Regra: quem pode ver/retirar o carro ----------
create or replace function public.pode_ver_carro(p_vehicle_id uuid, p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vehicles v
    join public.fleet_members m on m.fleet_id = v.fleet_id
      and m.driver_id = p_driver_id and m.status = 'ativo'
    where v.id = p_vehicle_id
      and (
        v.visibilidade = 'todos'
        or exists (select 1 from public.vehicle_visibility vv
                   where vv.vehicle_id = v.id and vv.driver_id = p_driver_id)
      )
  );
$$;

revoke execute on function public.pode_ver_carro(uuid, uuid) from public, anon, authenticated;

-- ---------- Dono define a visibilidade ----------
create or replace function public.definir_visibilidade(
  p_vehicle_id uuid,
  p_modo public.visibilidade_carro,
  p_motoristas uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_veiculo public.vehicles;
  v_lista uuid[] := coalesce((select array_agg(distinct x) from unnest(p_motoristas) x where x is not null), array[]::uuid[]);
  v_qtd int;
begin
  select * into v_veiculo from public.vehicles where id = p_vehicle_id for update;
  if not found or not public.e_dono_frota(v_veiculo.fleet_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  v_qtd := coalesce(array_length(v_lista, 1), 0);
  if p_modo = 'um' and v_qtd <> 1 then
    perform public.erro('VISIBILIDADE_INVALIDA', 'Escolha um motorista.');
  end if;
  if p_modo = 'alguns' and v_qtd < 1 then
    perform public.erro('VISIBILIDADE_INVALIDA', 'Escolha um motorista.');
  end if;
  if p_modo <> 'todos' and exists (
    select 1 from unnest(v_lista) x
    where not exists (select 1 from public.fleet_members m
                      where m.fleet_id = v_veiculo.fleet_id and m.driver_id = x and m.status = 'ativo')
  ) then
    perform public.erro('VISIBILIDADE_INVALIDA', 'Escolha motoristas da sua frota.');
  end if;

  delete from public.vehicle_visibility where vehicle_id = p_vehicle_id;
  if p_modo <> 'todos' then
    insert into public.vehicle_visibility (vehicle_id, driver_id)
    select p_vehicle_id, x from unnest(v_lista) x;
  end if;
  update public.vehicles set visibilidade = p_modo where id = p_vehicle_id;
end;
$$;

revoke execute on function public.definir_visibilidade(uuid, public.visibilidade_carro, uuid[]) from public, anon;
grant execute on function public.definir_visibilidade(uuid, public.visibilidade_carro, uuid[]) to authenticated;

-- ---------- Carros que o motorista pode pegar ----------
-- foto_path chega na migração da vitrine; aqui retorna null.
create or replace function public.carros_para_mim()
returns table (
  vehicle_id uuid, placa text, marca text, modelo text, ano_modelo int, cor text, foto_path text, em_uso boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.placa, v.marca, v.modelo, v.ano_modelo, v.cor, null::text, v.em_uso
  from public.vehicles v
  join public.fleet_members m on m.fleet_id = v.fleet_id and m.driver_id = auth.uid() and m.status = 'ativo'
  where v.ativo and public.pode_ver_carro(v.id, auth.uid())
  order by v.em_uso, v.placa;
$$;

revoke execute on function public.carros_para_mim() from public, anon;
grant execute on function public.carros_para_mim() to authenticated;

-- ---------- iniciar_retirada: checa a visibilidade ----------
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

  perform public.registrar_km(p_vehicle_id, p_km, 'retirada', p_foto_painel_path, p_capturado_em);

  return v_vinculo;
end;
$$;

-- ---------- remover_motorista: limpa a visibilidade ----------
create or replace function public.remover_motorista(p_member_id uuid)
returns public.fleet_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.fleet_members;
  v_vinculo record;
  v_carro record;
begin
  select m.* into v_membro from public.fleet_members m
  join public.fleets f on f.id = m.fleet_id
  where m.id = p_member_id and f.owner_id = auth.uid()
  for update of m;
  if not found then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  if v_membro.status = 'removido' then
    perform public.erro('TRANSICAO_INVALIDA', 'Este motorista já foi removido.');
  end if;

  for v_vinculo in
    select a.id, a.vehicle_id from public.assignments a
    join public.vehicles v on v.id = a.vehicle_id
    where a.driver_id = v_membro.driver_id and v.fleet_id = v_membro.fleet_id and a.status <> 'encerrado'
  loop
    update public.assignments a
    set status = 'encerrado', fim_em = now(),
        km_fim = (select km_atual from public.vehicles where id = a.vehicle_id)
    where a.id = v_vinculo.id;
    update public.vehicles set em_uso = false where id = v_vinculo.vehicle_id;
  end loop;

  -- Visibilidade: tira o motorista das listas; carro que ficou sem ninguém volta para "todos".
  for v_carro in
    select v.id, v.placa from public.vehicles v
    join public.vehicle_visibility vv on vv.vehicle_id = v.id
    where vv.driver_id = v_membro.driver_id and v.fleet_id = v_membro.fleet_id
  loop
    delete from public.vehicle_visibility where vehicle_id = v_carro.id and driver_id = v_membro.driver_id;
    if not exists (select 1 from public.vehicle_visibility where vehicle_id = v_carro.id) then
      update public.vehicles set visibilidade = 'todos' where id = v_carro.id;
      perform public.notificar(auth.uid(), 'visibilidade_alterada', 'Carro liberado',
        format('O carro %s voltou a ficar disponível para todos da frota.', v_carro.placa),
        'vehicles', v_carro.id);
    end if;
  end loop;

  update public.fleet_members set status = 'removido' where id = p_member_id
  returning * into v_membro;
  return v_membro;
end;
$$;
