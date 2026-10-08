-- Utilitários de teste compartilhados. Este arquivo NÃO faz rollback:
-- deixa o schema `tests` instalado para os arquivos seguintes.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

-- Gera um CPF aleatório com dígitos verificadores válidos (só dígitos).
create or replace function tests.cpf_aleatorio()
returns text
language plpgsql
as $$
declare
  d int[] := array[]::int[];
  s int;
  i int;
begin
  for i in 1..9 loop d := d || (floor(random() * 10))::int; end loop;
  s := 0; for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  d := d || (case when (s * 10) % 11 = 10 then 0 else (s * 10) % 11 end);
  s := 0; for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  d := d || (case when (s * 10) % 11 = 10 then 0 else (s * 10) % 11 end);
  return array_to_string(d, '');
end;
$$;

-- Cria um usuário em auth.users. Se p_papel for null, a chave "papel" fica de fora.
-- Motoristas recebem um CPF válido aleatório (obrigatório desde o bloco 1) e tem_cnh = true.
create or replace function tests.criar_usuario(p_email text, p_papel text, p_nome text default 'Teste')
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_meta jsonb := jsonb_build_object('nome', p_nome);
begin
  if p_papel is not null then
    v_meta := v_meta || jsonb_build_object('papel', p_papel);
  end if;
  if p_papel = 'motorista' then
    v_meta := v_meta || jsonb_build_object('cpf', tests.cpf_aleatorio(), 'tem_cnh', true);
  end if;

  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (v_id, p_email, 'authenticated', 'authenticated', v_meta);

  return v_id;
end;
$$;

-- Passa a executar como o usuário autenticado p_uid (vale até o fim da transação).
create or replace function tests.entrar_como(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

-- Volta ao papel original e limpa os claims do JWT.
create or replace function tests.sair()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Cria um objeto no bucket 'fotos' em '<frota>/<carro>/<categoria>/<uuid>.jpg' e devolve o caminho.
-- security definer: funciona mesmo chamado com o papel authenticated (simula o upload já feito).
create or replace function tests.criar_foto(p_fleet uuid, p_vehicle uuid, p_categoria text default 'inspecao')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := p_fleet::text || '/' || p_vehicle::text || '/' || p_categoria || '/' || gen_random_uuid()::text || '.jpg';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('fotos', v_path, auth.uid()::text);
  return v_path;
end;
$$;

grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

select plan(2);
select has_function('tests', 'criar_usuario', array['text', 'text', 'text']);
select has_function('tests', 'criar_foto', array['uuid', 'uuid', 'text']);
select * from finish();
