-- Bloco 1: perfil do motorista (CPF, declaração de CNH, cidade) e cidade da frota.

create extension if not exists unaccent with schema extensions;

-- ---------- Utilitários ----------
create or replace function public.cpf_valido(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  s int;
  dv int;
  i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then
    return false;
  end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  dv := (s * 10) % 11; if dv = 10 then dv := 0; end if;
  if dv <> substr(d, 10, 1)::int then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  dv := (s * 10) % 11; if dv = 10 then dv := 0; end if;
  return dv = substr(d, 11, 1)::int;
end;
$$;

create or replace function public.normalizar_cidade(p text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(extensions.unaccent(trim(coalesce(p, ''))));
$$;

grant execute on function public.cpf_valido(text) to authenticated;
grant execute on function public.normalizar_cidade(text) to authenticated;

-- ---------- Colunas novas ----------
alter table public.profiles
  add column uf char(2),
  add column cidade text,
  add column cpf text unique check (cpf ~ '^\d{11}$'),
  add column tem_cnh boolean not null default false;

alter table public.fleets
  add column uf char(2),
  add column cidade text;

-- ---------- Cadastro: lê CPF, CNH e cidade do metadata ----------
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_papel text := v_meta->>'papel';
  v_cpf text := nullif(regexp_replace(coalesce(v_meta->>'cpf', ''), '\D', '', 'g'), '');
begin
  if v_papel is null or v_papel = '' then
    perform public.erro('PAPEL_OBRIGATORIO', 'Escolha se você é proprietário ou motorista.');
  end if;

  if v_papel = 'motorista' and (v_cpf is null or not public.cpf_valido(v_cpf)) then
    perform public.erro('CPF_INVALIDO', 'CPF inválido.');
  end if;
  if v_cpf is not null and not public.cpf_valido(v_cpf) then
    perform public.erro('CPF_INVALIDO', 'CPF inválido.');
  end if;
  if v_cpf is not null and exists (select 1 from public.profiles where cpf = v_cpf) then
    perform public.erro('CPF_DUPLICADO', 'Este CPF já está cadastrado.');
  end if;

  insert into public.profiles (id, nome, telefone, papel, uf, cidade, cpf, tem_cnh)
  values (
    new.id,
    coalesce(v_meta->>'nome', split_part(new.email, '@', 1)),
    v_meta->>'telefone',
    v_papel::public.papel_usuario,
    nullif(upper(trim(coalesce(v_meta->>'uf', ''))), ''),
    nullif(trim(coalesce(v_meta->>'cidade', '')), ''),
    v_cpf,
    coalesce((v_meta->>'tem_cnh')::boolean, false)
  );
  return new;
end;
$$;

revoke execute on function public.criar_perfil() from public, anon, authenticated;

-- ---------- Grants ----------
-- CPF fica legível pela coluna; o RLS limita as linhas (o próprio, donos com vínculo/candidatura).
grant select (uf, cidade, cpf, tem_cnh) on public.profiles to authenticated;
grant update (uf, cidade, tem_cnh) on public.profiles to authenticated;
grant update (uf, cidade) on public.fleets to authenticated;
