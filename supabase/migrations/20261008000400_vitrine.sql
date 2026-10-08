-- Bloco 1: foto do carro, anúncio na busca, busca de carros (sem placa) e candidaturas.

-- ---------- Veículos ----------
alter table public.vehicles
  add column foto_path text,
  add column anunciado boolean not null default false;

grant update (foto_path, anunciado) on public.vehicles to authenticated;

-- ---------- Bucket das fotos dos carros (legível por qualquer usuário logado) ----------
insert into storage.buckets (id, name, public) values ('carros', 'carros', false)
on conflict (id) do nothing;

create policy carros_select on storage.objects
  for select to authenticated
  using (bucket_id = 'carros');

create policy carros_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'carros' and public.e_dono_frota(public.fleet_id_do_objeto(name)));

-- ---------- Candidaturas ----------
create table public.candidaturas (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  fleet_id uuid not null references public.fleets (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  mensagem text check (mensagem is null or char_length(mensagem) <= 300),
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada', 'cancelada')),
  criada_em timestamptz not null default now(),
  respondida_em timestamptz
);

create unique index candidaturas_pendente_uidx on public.candidaturas (driver_id, vehicle_id)
  where status = 'pendente';
create index candidaturas_frota_idx on public.candidaturas (fleet_id, status);

alter table public.candidaturas enable row level security;
revoke all on public.candidaturas from anon, authenticated;
grant select on public.candidaturas to authenticated;

create policy candidaturas_select on public.candidaturas
  for select to authenticated
  using (driver_id = auth.uid() or public.e_dono_frota(fleet_id));

-- ---------- Donos leem perfis de candidatos ----------
create or replace function public.e_dono_do_motorista(p_driver_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.fleet_members m
    join public.fleets f on f.id = m.fleet_id
    where m.driver_id = p_driver_id and f.owner_id = auth.uid()
  ) or exists (
    select 1 from public.candidaturas c
    join public.fleets f on f.id = c.fleet_id
    where c.driver_id = p_driver_id and f.owner_id = auth.uid()
  );
$$;

-- ---------- Carro elegível para a busca ----------
create or replace function public.carro_na_vitrine(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    join public.fleets f on f.id = v.fleet_id
    where v.id = p_vehicle_id
      and v.anunciado and v.ativo and not v.em_uso and v.visibilidade = 'todos'
      and f.uf is not null and f.cidade is not null
  );
$$;

revoke execute on function public.carro_na_vitrine(uuid) from public, anon, authenticated;

-- ---------- Busca (nunca retorna a placa) ----------
create or replace function public.buscar_carros(p_uf text, p_cidade text)
returns table (
  vehicle_id uuid, marca text, modelo text, ano_modelo int, cor text, foto_path text,
  frota_nome text, cidade text, uf text
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.marca, v.modelo, v.ano_modelo, v.cor, v.foto_path, f.nome, f.cidade, f.uf::text
  from public.vehicles v
  join public.fleets f on f.id = v.fleet_id
  where auth.uid() is not null
    and public.carro_na_vitrine(v.id)
    and f.uf = upper(trim(p_uf))
    and public.normalizar_cidade(f.cidade) = public.normalizar_cidade(p_cidade)
  order by v.criado_em desc;
$$;

revoke execute on function public.buscar_carros(text, text) from public, anon;
grant execute on function public.buscar_carros(text, text) to authenticated;

-- ---------- Candidatar ----------
create or replace function public.candidatar(p_vehicle_id uuid, p_mensagem text default null)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.profiles;
  v_veiculo public.vehicles;
  v_frota public.fleets;
  v_cand public.candidaturas;
begin
  select * into v_perfil from public.profiles where id = auth.uid();
  if not found or v_perfil.papel <> 'motorista' then
    perform public.erro('APENAS_MOTORISTA', 'Somente motoristas podem se candidatar.');
  end if;
  if not v_perfil.tem_cnh then
    perform public.erro('SEM_CNH', 'Você precisa ter CNH para se candidatar.');
  end if;
  if exists (select 1 from public.fleet_members where driver_id = auth.uid() and status = 'ativo') then
    perform public.erro('JA_EM_FROTA', 'Você já faz parte de uma frota.');
  end if;
  if not public.carro_na_vitrine(p_vehicle_id) then
    perform public.erro('CARRO_INDISPONIVEL', 'Este carro não está disponível para você.');
  end if;
  if exists (select 1 from public.candidaturas
             where driver_id = auth.uid() and vehicle_id = p_vehicle_id and status = 'pendente') then
    perform public.erro('JA_CANDIDATO', 'Você já se candidatou para este carro.');
  end if;

  select * into v_veiculo from public.vehicles where id = p_vehicle_id;
  select * into v_frota from public.fleets where id = v_veiculo.fleet_id;

  insert into public.candidaturas (vehicle_id, fleet_id, driver_id, mensagem)
  values (p_vehicle_id, v_frota.id, auth.uid(), nullif(left(btrim(coalesce(p_mensagem, '')), 300), ''))
  returning * into v_cand;

  perform public.notificar(v_frota.owner_id, 'candidatura_nova', 'Novo candidato',
    format('Novo candidato para o carro %s %s', v_veiculo.marca, v_veiculo.modelo),
    'candidaturas', v_cand.id);
  return v_cand;
end;
$$;

-- ---------- Cancelar ----------
create or replace function public.cancelar_candidatura(p_id uuid)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cand public.candidaturas;
begin
  select * into v_cand from public.candidaturas where id = p_id and driver_id = auth.uid() for update;
  if not found then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
  if v_cand.status <> 'pendente' then
    perform public.erro('TRANSICAO_INVALIDA', 'Esta candidatura já foi respondida.');
  end if;
  update public.candidaturas set status = 'cancelada', respondida_em = now() where id = p_id
  returning * into v_cand;
  return v_cand;
end;
$$;

-- ---------- Responder (atômico) ----------
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
begin
  select c.* into v_cand from public.candidaturas c
  join public.fleets f on f.id = c.fleet_id
  where c.id = p_id and f.owner_id = auth.uid()
  for update of c;
  if not found then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;
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

  perform 1 from public.vehicles where id = v_cand.vehicle_id for update;

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

  for v_outra in
    select * from public.candidaturas
    where vehicle_id = v_cand.vehicle_id and status = 'pendente' and id <> p_id
    for update
  loop
    update public.candidaturas set status = 'recusada', respondida_em = now() where id = v_outra.id;
    perform public.notificar(v_outra.driver_id, 'candidatura_recusada', 'Candidatura',
      'Sua candidatura foi recusada', 'candidaturas', v_outra.id);
  end loop;

  return v_cand;
end;
$$;

revoke execute on function public.candidatar(uuid, text) from public, anon;
revoke execute on function public.cancelar_candidatura(uuid) from public, anon;
revoke execute on function public.responder_candidatura(uuid, boolean) from public, anon;
grant execute on function public.candidatar(uuid, text) to authenticated;
grant execute on function public.cancelar_candidatura(uuid) to authenticated;
grant execute on function public.responder_candidatura(uuid, boolean) to authenticated;

-- ---------- carros_para_mim agora com a foto ----------
create or replace function public.carros_para_mim()
returns table (
  vehicle_id uuid, placa text, marca text, modelo text, ano_modelo int, cor text, foto_path text, em_uso boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.placa, v.marca, v.modelo, v.ano_modelo, v.cor, v.foto_path, v.em_uso
  from public.vehicles v
  join public.fleet_members m on m.fleet_id = v.fleet_id and m.driver_id = auth.uid() and m.status = 'ativo'
  where v.ativo and public.pode_ver_carro(v.id, auth.uid())
  order by v.em_uso, v.placa;
$$;
