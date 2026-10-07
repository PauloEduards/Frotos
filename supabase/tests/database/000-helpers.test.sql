-- Utilitários de teste compartilhados. Este arquivo NÃO faz rollback:
-- deixa o schema `tests` instalado para os arquivos seguintes.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

-- Cria um usuário em auth.users. Se p_papel for null, a chave "papel" fica de fora.
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

grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

select plan(1);
select has_function('tests', 'criar_usuario', array['text', 'text', 'text']);
select * from finish();
