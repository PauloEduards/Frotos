-- Catálogo de manutenção, veículos e itens de manutenção.

create type public.status_item as enum ('sem_historico', 'vencido', 'urgente', 'proximo', 'em_dia');

-- ---------- Tabelas ----------
create table public.maintenance_catalog (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  intervalo_km int,
  intervalo_meses int,
  custo_sugerido numeric(10,2),
  ordem int
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  fleet_id uuid not null references public.fleets (id) on delete cascade,
  placa text not null,
  marca text not null,
  modelo text not null,
  ano_modelo int not null,
  cor text not null,
  fipe_codigo text,
  km_atual int not null check (km_atual >= 0),
  km_dia_estimado int not null default 300 check (km_dia_estimado > 0),
  exige_aprovacao_sempre boolean not null default false,
  em_uso boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint vehicles_placa_formato check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  unique (fleet_id, placa)
);

create index vehicles_fleet_idx on public.vehicles (fleet_id);

create table public.vehicle_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  catalog_id uuid references public.maintenance_catalog (id),
  nome text not null,
  intervalo_km int,
  intervalo_meses int,
  km_inicial int,
  data_inicial date,
  ultimo_km int,
  ultima_data date,
  custo_estimado numeric(10,2) not null default 0,
  status_atual public.status_item not null default 'sem_historico',
  ativo boolean not null default true,
  check (intervalo_km is not null or intervalo_meses is not null)
);

create index vehicle_items_vehicle_idx on public.vehicle_items (vehicle_id);
create index vehicle_items_catalog_idx on public.vehicle_items (catalog_id);

alter table public.maintenance_catalog enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_items enable row level security;

-- ---------- Seed do catálogo (valores provisórios) ----------
insert into public.maintenance_catalog (nome, intervalo_km, intervalo_meses, custo_sugerido, ordem) values
  ('Óleo do motor', 10000, 6, 180, 1),
  ('Filtro de óleo', 10000, 6, 40, 2),
  ('Filtro de ar', 15000, 12, 60, 3),
  ('Filtro de combustível', 20000, 12, 80, 4),
  ('Filtro de cabine (ar-condicionado)', 15000, 12, 60, 5),
  ('Pastilhas de freio', 30000, 24, 250, 6),
  ('Fluido de freio', 30000, 24, 120, 7),
  ('Pneus (rodízio e alinhamento)', 10000, 6, 120, 8),
  ('Correia dentada', 50000, 48, 600, 9),
  ('Velas de ignição', 30000, 24, 150, 10),
  ('Líquido de arrefecimento', 40000, 24, 150, 11);

-- ---------- Triggers ----------
create or replace function public.normalizar_placa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.placa := upper(regexp_replace(new.placa, '[^A-Za-z0-9]', '', 'g'));
  return new;
end;
$$;

create trigger vehicles_normalizar_placa
  before insert or update on public.vehicles
  for each row execute function public.normalizar_placa();

create or replace function public.criar_itens_do_veiculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.vehicle_items (vehicle_id, catalog_id, nome, intervalo_km, intervalo_meses, custo_estimado)
  select new.id, c.id, c.nome, c.intervalo_km, c.intervalo_meses, coalesce(c.custo_sugerido, 0)
  from public.maintenance_catalog c
  order by c.ordem;
  return new;
end;
$$;

create trigger vehicles_criar_itens
  after insert on public.vehicles
  for each row execute function public.criar_itens_do_veiculo();

revoke execute on function public.normalizar_placa() from public, anon, authenticated;
revoke execute on function public.criar_itens_do_veiculo() from public, anon, authenticated;

-- ---------- RLS ----------
create or replace function public.e_dono_do_veiculo(p_vehicle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    join public.fleets f on f.id = v.fleet_id
    where v.id = p_vehicle_id and f.owner_id = auth.uid()
  );
$$;

revoke execute on function public.e_dono_do_veiculo(uuid) from public, anon;
grant execute on function public.e_dono_do_veiculo(uuid) to authenticated;

create policy catalog_select on public.maintenance_catalog
  for select to authenticated using (true);

create policy vehicles_select on public.vehicles
  for select to authenticated
  using (public.e_dono_frota(fleet_id) or public.e_membro_ativo(fleet_id));
create policy vehicles_insert on public.vehicles
  for insert to authenticated with check (public.e_dono_frota(fleet_id));
create policy vehicles_update on public.vehicles
  for update to authenticated
  using (public.e_dono_frota(fleet_id)) with check (public.e_dono_frota(fleet_id));

create policy vehicle_items_dono on public.vehicle_items
  for all to authenticated
  using (public.e_dono_do_veiculo(vehicle_id))
  with check (public.e_dono_do_veiculo(vehicle_id));

revoke all on public.maintenance_catalog from anon, authenticated;
revoke all on public.vehicles from anon, authenticated;
revoke all on public.vehicle_items from anon, authenticated;
grant select on public.maintenance_catalog to authenticated;
grant select on public.vehicles to authenticated;
grant insert (fleet_id, placa, marca, modelo, ano_modelo, cor, fipe_codigo, km_atual, km_dia_estimado, exige_aprovacao_sempre)
  on public.vehicles to authenticated;
grant update (placa, marca, modelo, ano_modelo, cor, fipe_codigo, km_dia_estimado, exige_aprovacao_sempre, ativo)
  on public.vehicles to authenticated;
grant select on public.vehicle_items to authenticated;
grant insert (vehicle_id, catalog_id, nome, intervalo_km, intervalo_meses, custo_estimado)
  on public.vehicle_items to authenticated;
grant update (nome, intervalo_km, intervalo_meses, custo_estimado, ativo)
  on public.vehicle_items to authenticated;

-- ---------- Funções ----------
-- Nesta task usa só o histórico inicial; a Task 6 a substitui.
create or replace function public.recalcular_ultima_troca(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vehicle_items
  set ultimo_km = km_inicial, ultima_data = data_inicial
  where id = p_item_id;
end;
$$;

revoke execute on function public.recalcular_ultima_troca(uuid) from public, anon, authenticated;

create or replace function public.atualizar_item(
  p_item_id uuid,
  p_intervalo_km int,
  p_intervalo_meses int,
  p_custo_estimado numeric,
  p_aplicar_em_todos boolean
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog_id uuid;
  v_nome text;
  v_fleet_id uuid;
  v_qtd int;
begin
  select i.catalog_id, i.nome, v.fleet_id into v_catalog_id, v_nome, v_fleet_id
  from public.vehicle_items i
  join public.vehicles v on v.id = i.vehicle_id
  where i.id = p_item_id;

  if not found or not public.e_dono_frota(v_fleet_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  if p_intervalo_km is null and p_intervalo_meses is null then
    perform public.erro('INTERVALO_INVALIDO', 'Informe o intervalo em km, em meses ou ambos.');
  end if;
  if coalesce(p_intervalo_km, 1) <= 0 or coalesce(p_intervalo_meses, 1) <= 0 or coalesce(p_custo_estimado, 0) < 0 then
    perform public.erro('VALOR_INVALIDO', 'Intervalos devem ser positivos e o custo não pode ser negativo.');
  end if;

  if p_aplicar_em_todos then
    update public.vehicle_items i
    set intervalo_km = p_intervalo_km,
        intervalo_meses = p_intervalo_meses,
        custo_estimado = coalesce(p_custo_estimado, 0)
    from public.vehicles v
    where v.id = i.vehicle_id
      and v.fleet_id = v_fleet_id
      and v.ativo
      and i.ativo
      and (
        (v_catalog_id is not null and i.catalog_id = v_catalog_id)
        or (v_catalog_id is null and i.catalog_id is null and i.nome = v_nome)
      );
  else
    update public.vehicle_items
    set intervalo_km = p_intervalo_km,
        intervalo_meses = p_intervalo_meses,
        custo_estimado = coalesce(p_custo_estimado, 0)
    where id = p_item_id;
  end if;
  get diagnostics v_qtd = row_count;

  return v_qtd;
end;
$$;

create or replace function public.definir_historico_inicial(
  p_item_id uuid,
  p_km_inicial int,
  p_data_inicial date
)
returns public.vehicle_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fleet_id uuid;
  v_item public.vehicle_items;
begin
  select v.fleet_id into v_fleet_id
  from public.vehicle_items i
  join public.vehicles v on v.id = i.vehicle_id
  where i.id = p_item_id;

  if not found or not public.e_dono_frota(v_fleet_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  if p_km_inicial is not null and p_km_inicial < 0 then
    perform public.erro('VALOR_INVALIDO', 'O km do histórico não pode ser negativo.');
  end if;

  update public.vehicle_items
  set km_inicial = p_km_inicial, data_inicial = p_data_inicial
  where id = p_item_id;

  perform public.recalcular_ultima_troca(p_item_id);

  select * into v_item from public.vehicle_items where id = p_item_id;
  return v_item;
end;
$$;

revoke execute on function public.atualizar_item(uuid, int, int, numeric, boolean) from public, anon;
revoke execute on function public.definir_historico_inicial(uuid, int, date) from public, anon;
grant execute on function public.atualizar_item(uuid, int, int, numeric, boolean) to authenticated;
grant execute on function public.definir_historico_inicial(uuid, int, date) to authenticated;
