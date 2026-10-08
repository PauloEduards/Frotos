-- Bloco 1: telas do motorista sem frota. Ele ainda não é membro, então o RLS esconde carros e
-- frotas; estas funções devolvem só o necessário (sem placa) das próprias candidaturas e pedidos.

create or replace function public.minhas_candidaturas()
returns table (
  id uuid, status text, criada_em timestamptz, vehicle_id uuid,
  marca text, modelo text, ano_modelo int, cor text, foto_path text,
  frota_nome text, cidade text, uf text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.status, c.criada_em, v.id, v.marca, v.modelo, v.ano_modelo, v.cor, v.foto_path,
         f.nome, f.cidade, f.uf::text
  from public.candidaturas c
  join public.vehicles v on v.id = c.vehicle_id
  join public.fleets f on f.id = c.fleet_id
  where c.driver_id = auth.uid()
  order by c.criada_em desc;
$$;

create or replace function public.meus_pedidos_entrada()
returns table (id uuid, status text, frota_nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.status::text, f.nome
  from public.fleet_members m
  join public.fleets f on f.id = m.fleet_id
  where m.driver_id = auth.uid() and m.status = 'pendente'
  order by m.criado_em desc;
$$;

revoke execute on function public.minhas_candidaturas() from public, anon;
revoke execute on function public.meus_pedidos_entrada() from public, anon;
grant execute on function public.minhas_candidaturas() to authenticated;
grant execute on function public.meus_pedidos_entrada() to authenticated;
