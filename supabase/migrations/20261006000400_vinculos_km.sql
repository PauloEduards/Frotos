-- Vínculos motorista-carro, leituras de km, fotos de inspeção e storage.

create type public.status_vinculo as enum ('aguardando_fotos', 'ativo', 'encerrado');
create type public.origem_km as enum ('retirada', 'devolucao', 'atualizacao', 'manutencao', 'correcao_dono');
create type public.momento_foto as enum ('retirada', 'devolucao');
create type public.posicao_foto as enum ('frente', 'traseira', 'lateral_esq', 'lateral_dir', 'extra');

-- ---------- Tabelas ----------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  status public.status_vinculo not null default 'aguardando_fotos',
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  km_inicio int not null,
  km_fim int
);

create unique index assignments_vehicle_aberto_uidx on public.assignments (vehicle_id) where status <> 'encerrado';
create unique index assignments_driver_aberto_uidx on public.assignments (driver_id) where status <> 'encerrado';

create table public.odometer_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  autor_id uuid not null references public.profiles (id) on delete cascade,
  km int not null,
  origem public.origem_km not null,
  foto_painel_path text,
  salto_suspeito boolean not null default false,
  capturado_em timestamptz not null,
  recebido_em timestamptz not null default now()
);

create index odometer_readings_vehicle_idx on public.odometer_readings (vehicle_id, capturado_em desc);
create index odometer_readings_autor_idx on public.odometer_readings (autor_id);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  momento public.momento_foto not null,
  posicao public.posicao_foto not null,
  path text not null,
  capturado_em timestamptz not null,
  recebido_em timestamptz not null default now()
);

create index inspection_photos_assignment_idx on public.inspection_photos (assignment_id);

alter table public.assignments enable row level security;
alter table public.odometer_readings enable row level security;
alter table public.inspection_photos enable row level security;

-- ---------- Auxiliar de RLS ----------
create or replace function public.tem_vinculo_ativo(p_vehicle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.assignments a
    where a.vehicle_id = p_vehicle_id
      and a.driver_id = auth.uid()
      and a.status in ('aguardando_fotos', 'ativo')
  );
$$;

revoke execute on function public.tem_vinculo_ativo(uuid) from public, anon;
grant execute on function public.tem_vinculo_ativo(uuid) to authenticated;

-- ---------- RLS ----------
create policy vehicle_items_motorista_select on public.vehicle_items
  for select to authenticated using (public.tem_vinculo_ativo(vehicle_id));

create policy assignments_select on public.assignments
  for select to authenticated
  using (driver_id = auth.uid() or public.e_dono_do_veiculo(vehicle_id));

create policy odometer_readings_select on public.odometer_readings
  for select to authenticated
  using (
    public.e_dono_do_veiculo(vehicle_id)
    or autor_id = auth.uid()
    or public.tem_vinculo_ativo(vehicle_id)
  );

create policy inspection_photos_select on public.inspection_photos
  for select to authenticated
  using (exists (
    select 1 from public.assignments a
    where a.id = assignment_id
      and (a.driver_id = auth.uid() or public.e_dono_do_veiculo(a.vehicle_id))
  ));

create policy inspection_photos_insert on public.inspection_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.assignments a
    where a.id = assignment_id and a.driver_id = auth.uid() and a.status <> 'encerrado'
  ));

revoke all on public.assignments from anon, authenticated;
revoke all on public.odometer_readings from anon, authenticated;
revoke all on public.inspection_photos from anon, authenticated;
grant select on public.assignments to authenticated;
grant select on public.odometer_readings to authenticated;
grant select on public.inspection_photos to authenticated;
grant insert (assignment_id, momento, posicao, path, capturado_em) on public.inspection_photos to authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
on conflict (id) do nothing;

-- Primeiro segmento do caminho como uuid; null se não for um uuid válido (evita 22P02 nas políticas).
create or replace function public.fleet_id_do_objeto(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(p_name))[1])::uuid
  end;
$$;

grant execute on function public.fleet_id_do_objeto(text) to authenticated;

create policy fotos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (public.e_dono_frota(public.fleet_id_do_objeto(name))
         or public.e_membro_ativo(public.fleet_id_do_objeto(name)))
  );

create policy fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (public.e_dono_frota(public.fleet_id_do_objeto(name))
         or public.e_membro_ativo(public.fleet_id_do_objeto(name)))
  );

-- ---------- Funções ----------
-- Confere as 4 fotos obrigatórias do momento; senão levanta FOTOS_FALTANDO listando as que faltam.
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
    ('frente'::public.posicao_foto, 'frente', 1),
    ('traseira'::public.posicao_foto, 'traseira', 2),
    ('lateral_esq'::public.posicao_foto, 'lateral esquerda', 3),
    ('lateral_dir'::public.posicao_foto, 'lateral direita', 4)
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

revoke execute on function public.exigir_fotos_inspecao(uuid, public.momento_foto) from public, anon, authenticated;

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

  if p_origem <> 'correcao_dono' then
    if p_km < v_veiculo.km_atual then
      perform public.erro('KM_MENOR', format('O km informado (%s) é menor que o último registro (%s).',
        public.fmt_km(p_km), public.fmt_km(v_veiculo.km_atual)));
    end if;

    select max(capturado_em) into v_ultima from public.odometer_readings where vehicle_id = p_vehicle_id;
    if v_ultima is not null then
      v_dias := greatest(1, extract(epoch from v_capturado - v_ultima) / 86400.0);
      if p_km - v_veiculo.km_atual > v_frota.limite_salto_km_dia * v_dias then
        if p_foto_painel_path is null then
          perform public.erro('FOTO_PAINEL_OBRIGATORIA',
            format('O km subiu %s desde o último registro. Tire uma foto do painel para confirmar.',
              public.fmt_km(p_km - v_veiculo.km_atual)));
        end if;
        v_suspeito := true;
      end if;
    end if;
  end if;

  insert into public.odometer_readings (vehicle_id, autor_id, km, origem, foto_painel_path, salto_suspeito, capturado_em)
  values (p_vehicle_id, auth.uid(), p_km, p_origem, p_foto_painel_path, v_suspeito, v_capturado)
  returning * into v_leitura;

  update public.vehicles set km_atual = p_km where id = p_vehicle_id;

  if v_suspeito then
    perform public.notificar(
      v_frota.owner_id, 'km_foto_painel', 'Salto de km com foto do painel',
      format('O %s %s subiu %s km desde o último registro. Confira a foto do painel.',
        v_veiculo.modelo, v_veiculo.placa, public.fmt_km(p_km - v_veiculo.km_atual)),
      'odometer_readings', v_leitura.id, 'alta');
  end if;

  return v_leitura;
end;
$$;

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

create or replace function public.concluir_retirada(p_assignment_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculo public.assignments;
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

  update public.assignments set status = 'ativo' where id = p_assignment_id
  returning * into v_vinculo;
  return v_vinculo;
end;
$$;

create or replace function public.cancelar_retirada(p_assignment_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vinculo public.assignments;
begin
  select * into v_vinculo from public.assignments where id = p_assignment_id for update;
  if not found or not (v_vinculo.driver_id = auth.uid() or public.e_dono_do_veiculo(v_vinculo.vehicle_id)) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  if v_vinculo.status <> 'aguardando_fotos' then
    perform public.erro('TRANSICAO_INVALIDA', 'Só é possível cancelar uma retirada que aguarda fotos.');
  end if;

  update public.assignments set status = 'encerrado', fim_em = now() where id = p_assignment_id
  returning * into v_vinculo;
  update public.vehicles set em_uso = false where id = v_vinculo.vehicle_id;
  return v_vinculo;
end;
$$;

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
begin
  select * into v_vinculo from public.assignments
  where id = p_assignment_id and driver_id = auth.uid() and status = 'ativo'
  for update;
  if not found then
    perform public.erro('VINCULO_INVALIDO', 'Você não tem este carro em uso.');
  end if;

  perform public.exigir_fotos_inspecao(p_assignment_id, 'devolucao');
  perform public.registrar_km(v_vinculo.vehicle_id, p_km, 'devolucao', p_foto_painel_path, p_capturado_em);

  update public.assignments set status = 'encerrado', fim_em = now(), km_fim = p_km
  where id = p_assignment_id
  returning * into v_vinculo;
  update public.vehicles set em_uso = false where id = v_vinculo.vehicle_id;
  return v_vinculo;
end;
$$;

create or replace function public.remover_motorista(p_member_id uuid)
returns public.fleet_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.fleet_members;
  v_vinculo record;
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

  update public.fleet_members set status = 'removido' where id = p_member_id
  returning * into v_membro;
  return v_membro;
end;
$$;

revoke execute on function public.registrar_km(uuid, int, public.origem_km, text, timestamptz) from public, anon;
revoke execute on function public.iniciar_retirada(uuid, int, text, timestamptz) from public, anon;
revoke execute on function public.concluir_retirada(uuid) from public, anon;
revoke execute on function public.cancelar_retirada(uuid) from public, anon;
revoke execute on function public.devolver_carro(uuid, int, text, timestamptz) from public, anon;
revoke execute on function public.remover_motorista(uuid) from public, anon;
grant execute on function public.registrar_km(uuid, int, public.origem_km, text, timestamptz) to authenticated;
grant execute on function public.iniciar_retirada(uuid, int, text, timestamptz) to authenticated;
grant execute on function public.concluir_retirada(uuid) to authenticated;
grant execute on function public.cancelar_retirada(uuid) to authenticated;
grant execute on function public.devolver_carro(uuid, int, text, timestamptz) to authenticated;
grant execute on function public.remover_motorista(uuid) to authenticated;
