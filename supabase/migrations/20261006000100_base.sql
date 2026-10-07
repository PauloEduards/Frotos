-- Base: utilitários, perfis e notificações.

-- ---------- Utilitários ----------
create or replace function public.erro(p_codigo text, p_detalhe text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_codigo, detail = p_detalhe;
end;
$$;

create or replace function public.fmt_km(p_km int)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(to_char(p_km, 'FM999,999,999'), ',', '.');
$$;

create or replace function public.hoje_brt()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

revoke execute on function public.erro(text, text) from public, anon, authenticated;

-- ---------- Perfis ----------
create type public.papel_usuario as enum ('proprietario', 'motorista');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  telefone text,
  papel public.papel_usuario not null,
  expo_push_token text,
  criado_em timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nome, telefone, expo_push_token) on public.profiles to authenticated;

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_papel text := v_meta->>'papel';
begin
  if v_papel is null or v_papel = '' then
    perform public.erro('PAPEL_OBRIGATORIO', 'Escolha se você é proprietário ou motorista.');
  end if;

  insert into public.profiles (id, nome, telefone, papel)
  values (
    new.id,
    coalesce(v_meta->>'nome', split_part(new.email, '@', 1)),
    v_meta->>'telefone',
    v_papel::public.papel_usuario
  );
  return new;
end;
$$;

revoke execute on function public.criar_perfil() from public, anon, authenticated;

create trigger trg_criar_perfil
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------- Notificações ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text not null,
  prioridade text not null default 'normal' check (prioridade in ('normal', 'alta')),
  ref_tabela text,
  ref_id uuid,
  lida boolean not null default false,
  push_enviado_em timestamptz,
  criada_em timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, criada_em desc);

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (lida) on public.notifications to authenticated;

create or replace function public.notificar(
  p_user_id uuid,
  p_tipo text,
  p_titulo text,
  p_corpo text,
  p_ref_tabela text default null,
  p_ref_id uuid default null,
  p_prioridade text default 'normal'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, tipo, titulo, corpo, ref_tabela, ref_id, prioridade)
  values (p_user_id, p_tipo, p_titulo, p_corpo, p_ref_tabela, p_ref_id, p_prioridade);
$$;

revoke execute on function public.notificar(uuid, text, text, text, text, uuid, text)
  from public, anon, authenticated;
