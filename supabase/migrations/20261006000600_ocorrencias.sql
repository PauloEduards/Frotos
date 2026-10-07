-- Ocorrências relatadas por motoristas (mecânico, acidente, outro) e suas fotos.

create type public.tipo_ocorrencia as enum ('mecanico', 'acidente_leve', 'acidente_grave', 'outro');
create type public.status_ocorrencia as enum ('aberta', 'resolvida');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid not null references public.profiles (id),
  tipo public.tipo_ocorrencia not null,
  descricao text not null check (length(btrim(descricao)) > 0),
  status public.status_ocorrencia not null default 'aberta',
  criada_em timestamptz not null default now(),
  resolvida_em timestamptz
);

create index incidents_vehicle_idx on public.incidents (vehicle_id);
create index incidents_driver_idx on public.incidents (driver_id);

create table public.incident_photos (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  path text not null,
  capturado_em timestamptz not null
);

create index incident_photos_incident_idx on public.incident_photos (incident_id);

alter table public.incidents enable row level security;
alter table public.incident_photos enable row level security;

create policy incidents_select on public.incidents
  for select to authenticated
  using (driver_id = auth.uid() or public.e_dono_do_veiculo(vehicle_id));

create policy incident_photos_select on public.incident_photos
  for select to authenticated
  using (exists (
    select 1 from public.incidents i
    where i.id = incident_id
      and (i.driver_id = auth.uid() or public.e_dono_do_veiculo(i.vehicle_id))
  ));

create policy incident_photos_insert on public.incident_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.incidents i
    where i.id = incident_id and i.driver_id = auth.uid()
  ));

revoke all on public.incidents from anon, authenticated;
revoke all on public.incident_photos from anon, authenticated;
grant select on public.incidents to authenticated;
grant select on public.incident_photos to authenticated;
grant insert (incident_id, path, capturado_em) on public.incident_photos to authenticated;

-- ---------- Funções ----------
create or replace function public.relatar_ocorrencia(
  p_vehicle_id uuid,
  p_tipo public.tipo_ocorrencia,
  p_descricao text
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_desc text := btrim(coalesce(p_descricao, ''));
  v_placa text;
  v_dono uuid;
  v_inc public.incidents;
  v_rotulo text;
begin
  if v_uid is null or not public.tem_vinculo_ativo(p_vehicle_id) then
    perform public.erro('SEM_ACESSO', 'Você não está com este carro.');
  end if;
  if v_desc = '' then
    perform public.erro('DESCRICAO_OBRIGATORIA', 'Descreva o que aconteceu.');
  end if;

  insert into public.incidents (vehicle_id, driver_id, tipo, descricao)
  values (p_vehicle_id, v_uid, p_tipo, v_desc)
  returning * into v_inc;

  select v.placa, f.owner_id into v_placa, v_dono
  from public.vehicles v join public.fleets f on f.id = v.fleet_id
  where v.id = p_vehicle_id;

  v_rotulo := case p_tipo
    when 'mecanico' then 'Barulho/mecânico'
    when 'acidente_leve' then 'Acidente leve'
    when 'acidente_grave' then 'Acidente grave'
    else 'Outro'
  end;

  perform public.notificar(
    v_dono, 'ocorrencia', 'Ocorrência: ' || v_placa,
    v_rotulo || ' — ' || left(v_desc, 80),
    'incidents', v_inc.id,
    case when p_tipo = 'acidente_grave' then 'alta' else 'normal' end
  );

  return v_inc;
end;
$$;

create or replace function public.resolver_ocorrencia(p_incident_id uuid)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inc public.incidents;
begin
  select * into v_inc from public.incidents where id = p_incident_id for update;
  if not found or not public.e_dono_do_veiculo(v_inc.vehicle_id) then
    perform public.erro('SEM_ACESSO', 'Você não pode resolver esta ocorrência.');
  end if;

  update public.incidents
  set status = 'resolvida', resolvida_em = coalesce(resolvida_em, now())
  where id = p_incident_id
  returning * into v_inc;

  return v_inc;
end;
$$;

revoke execute on function public.relatar_ocorrencia(uuid, public.tipo_ocorrencia, text) from public, anon;
revoke execute on function public.resolver_ocorrencia(uuid) from public, anon;
grant execute on function public.relatar_ocorrencia(uuid, public.tipo_ocorrencia, text) to authenticated;
grant execute on function public.resolver_ocorrencia(uuid) to authenticated;
