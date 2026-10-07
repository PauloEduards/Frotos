-- Frotas, membros e convites.

create type public.modo_manutencao as enum ('proprietario_leva', 'motoristas_levam');
create type public.status_membro as enum ('pendente', 'ativo', 'removido');
create type public.nivel_manutencao as enum ('sem_permissao', 'com_aprovacao', 'confiavel');

-- ---------- Tabelas ----------
create table public.fleets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  nome text not null,
  codigo_convite text not null unique,
  modo_manutencao public.modo_manutencao not null default 'proprietario_leva',
  limite_salto_km_dia int not null default 350,
  limiar_amarelo_km int not null default 1000,
  limiar_amarelo_dias int not null default 7,
  limiar_laranja_km int not null default 300,
  criada_em timestamptz not null default now()
);

create table public.fleet_members (
  id uuid primary key default gen_random_uuid(),
  fleet_id uuid not null references public.fleets (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  status public.status_membro not null default 'pendente',
  nivel_manutencao public.nivel_manutencao not null default 'com_aprovacao',
  criado_em timestamptz not null default now(),
  unique (fleet_id, driver_id)
);

create index fleet_members_driver_idx on public.fleet_members (driver_id);

alter table public.fleets enable row level security;
alter table public.fleet_members enable row level security;

-- ---------- Auxiliares de RLS ----------
create or replace function public.e_dono_frota(p_fleet_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.fleets f
    where f.id = p_fleet_id and f.owner_id = auth.uid()
  );
$$;

create or replace function public.e_membro_ativo(p_fleet_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.fleet_members m
    where m.fleet_id = p_fleet_id and m.driver_id = auth.uid() and m.status = 'ativo'
  );
$$;

-- Auxiliares para as políticas de profiles (evitam recursão de RLS).
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
  );
$$;

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
    where f.owner_id = p_owner_id and m.driver_id = auth.uid()
  );
$$;

revoke execute on function public.e_dono_frota(uuid) from public, anon;
revoke execute on function public.e_membro_ativo(uuid) from public, anon;
revoke execute on function public.e_dono_do_motorista(uuid) from public, anon;
revoke execute on function public.e_membro_do_dono(uuid) from public, anon;
grant execute on function public.e_dono_frota(uuid) to authenticated;
grant execute on function public.e_membro_ativo(uuid) to authenticated;
grant execute on function public.e_dono_do_motorista(uuid) to authenticated;
grant execute on function public.e_membro_do_dono(uuid) to authenticated;

-- ---------- RLS ----------
create policy fleets_select on public.fleets
  for select to authenticated
  using (public.e_dono_frota(id) or public.e_membro_ativo(id));
create policy fleets_update on public.fleets
  for update to authenticated
  using (public.e_dono_frota(id)) with check (public.e_dono_frota(id));

create policy fleet_members_select on public.fleet_members
  for select to authenticated
  using (public.e_dono_frota(fleet_id) or driver_id = auth.uid());
create policy fleet_members_update on public.fleet_members
  for update to authenticated
  using (public.e_dono_frota(fleet_id)) with check (public.e_dono_frota(fleet_id));

create policy profiles_select_dono_ve_membros on public.profiles
  for select to authenticated using (public.e_dono_do_motorista(id));
create policy profiles_select_membro_ve_dono on public.profiles
  for select to authenticated using (public.e_membro_do_dono(id));

revoke all on public.fleets from anon, authenticated;
revoke all on public.fleet_members from anon, authenticated;
grant select on public.fleets to authenticated;
grant update (nome, modo_manutencao, limite_salto_km_dia, limiar_amarelo_km, limiar_amarelo_dias, limiar_laranja_km)
  on public.fleets to authenticated;
grant select on public.fleet_members to authenticated;
grant update (nivel_manutencao) on public.fleet_members to authenticated;

-- ---------- Código de convite ----------
create or replace function public.gerar_codigo_convite()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  i int;
begin
  loop
    v_codigo := 'FRT-';
    for i in 1..4 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.fleets where codigo_convite = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

revoke execute on function public.gerar_codigo_convite() from public, anon, authenticated;

-- ---------- RPCs ----------
create or replace function public.criar_frota(p_nome text)
returns public.fleets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel public.papel_usuario;
  v_frota public.fleets;
begin
  select papel into v_papel from public.profiles where id = auth.uid();
  if v_papel is distinct from 'proprietario' then
    perform public.erro('APENAS_PROPRIETARIO', 'Somente proprietários podem criar frotas.');
  end if;

  if exists (select 1 from public.fleets where owner_id = auth.uid()) then
    perform public.erro('FROTA_JA_EXISTE', 'Você já tem uma frota cadastrada.');
  end if;

  insert into public.fleets (owner_id, nome, codigo_convite)
  values (auth.uid(), p_nome, public.gerar_codigo_convite())
  returning * into v_frota;

  return v_frota;
end;
$$;

create or replace function public.gerar_novo_codigo(p_fleet_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if not public.e_dono_frota(p_fleet_id) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  update public.fleets
  set codigo_convite = public.gerar_codigo_convite()
  where id = p_fleet_id
  returning codigo_convite into v_codigo;

  return v_codigo;
end;
$$;

create or replace function public.entrar_na_frota(p_codigo text)
returns public.fleet_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel public.papel_usuario;
  v_frota public.fleets;
  v_membro public.fleet_members;
begin
  select papel into v_papel from public.profiles where id = auth.uid();
  if v_papel is distinct from 'motorista' then
    perform public.erro('APENAS_MOTORISTA', 'Somente motoristas podem entrar em uma frota.');
  end if;

  select * into v_frota from public.fleets where codigo_convite = upper(trim(p_codigo));
  if not found then
    perform public.erro('CODIGO_INVALIDO', 'Código de frota não encontrado. Confira com o proprietário.');
  end if;

  select * into v_membro from public.fleet_members
  where fleet_id = v_frota.id and driver_id = auth.uid()
  for update;

  if found then
    if v_membro.status <> 'removido' then
      perform public.erro('JA_MEMBRO', 'Você já pediu para entrar nesta frota.');
    end if;
    update public.fleet_members
    set status = 'pendente', nivel_manutencao = 'com_aprovacao'
    where id = v_membro.id
    returning * into v_membro;
  else
    insert into public.fleet_members (fleet_id, driver_id)
    values (v_frota.id, auth.uid())
    returning * into v_membro;
  end if;

  perform public.notificar(
    v_frota.owner_id, 'entrada_pedida', 'Novo pedido de entrada',
    (select nome from public.profiles where id = auth.uid()) || ' quer entrar na frota ' || v_frota.nome || '.',
    'fleet_members', v_membro.id
  );

  return v_membro;
end;
$$;

create or replace function public.responder_entrada(p_member_id uuid, p_aprovar boolean)
returns public.fleet_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.fleet_members;
  v_frota public.fleets;
begin
  select m.* into v_membro from public.fleet_members m
  join public.fleets f on f.id = m.fleet_id
  where m.id = p_member_id and f.owner_id = auth.uid()
  for update of m;
  if not found then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a esta informação.');
  end if;

  if v_membro.status <> 'pendente' then
    perform public.erro('TRANSICAO_INVALIDA', 'Este pedido já foi respondido.');
  end if;

  update public.fleet_members
  set status = case when p_aprovar then 'ativo'::public.status_membro else 'removido'::public.status_membro end
  where id = v_membro.id
  returning * into v_membro;

  if p_aprovar then
    select * into v_frota from public.fleets where id = v_membro.fleet_id;
    perform public.notificar(
      v_membro.driver_id, 'entrada_aprovada', 'Entrada aprovada',
      'Você agora faz parte da frota ' || v_frota.nome || '.',
      'fleet_members', v_membro.id
    );
  end if;

  return v_membro;
end;
$$;

revoke execute on function public.criar_frota(text) from public, anon;
revoke execute on function public.gerar_novo_codigo(uuid) from public, anon;
revoke execute on function public.entrar_na_frota(text) from public, anon;
revoke execute on function public.responder_entrada(uuid, boolean) from public, anon;
grant execute on function public.criar_frota(text) to authenticated;
grant execute on function public.gerar_novo_codigo(uuid) to authenticated;
grant execute on function public.entrar_na_frota(text) to authenticated;
grant execute on function public.responder_entrada(uuid, boolean) to authenticated;
