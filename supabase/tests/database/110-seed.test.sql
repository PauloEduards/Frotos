-- Dados de exemplo (seed) da Frota Piloto.
begin;
select plan(12);

-- 1 frota do dono tem 5 veículos e código 'FRT-TEST'
select is(
  (select count(*)::int from public.vehicles v
   join public.fleets f on f.id = v.fleet_id
   join auth.users u on u.id = f.owner_id
   where u.email = 'dono@frotos.dev' and f.codigo_convite = 'FRT-TEST'),
  5, 'frota de dono@frotos.dev tem 5 veículos e código FRT-TEST');

-- 2 membros
select is(
  (select m.status::text || '/' || m.nivel_manutencao::text from public.fleet_members m
   join auth.users u on u.id = m.driver_id where u.email = 'ana@frotos.dev'),
  'ativo/confiavel', 'ana: ativa e confiável');
select is(
  (select m.status::text || '/' || m.nivel_manutencao::text from public.fleet_members m
   join auth.users u on u.id = m.driver_id where u.email = 'bruno@frotos.dev'),
  'ativo/com_aprovacao', 'bruno: ativo e com aprovação');
select is(
  (select m.status::text from public.fleet_members m
   join auth.users u on u.id = m.driver_id where u.email = 'caio@frotos.dev'),
  'pendente', 'caio: pendente');

-- 3 status dos carros
create temp table _st on commit drop as
select v.placa, v.modelo, s.status
from public.vehicles v
join public.fleets f on f.id = v.fleet_id and f.codigo_convite = 'FRT-TEST'
cross join lateral public.status_carro_interna(v.id, public.hoje_brt()) s;

select ok(exists (select 1 from _st where status = 'em_dia'), 'há carro em_dia');
select ok(exists (select 1 from _st where status = 'proximo'), 'há carro proximo');
select ok(exists (select 1 from _st where status = 'vencido'), 'há carro vencido');
select ok(exists (select 1 from _st where status = 'sem_historico'), 'há carro sem_historico');

-- 4 serviço pendente, pedido aberto e ocorrência aberta
select is(
  (select count(*)::int from public.maintenance_records r
   join auth.users u on u.id = r.autor_id
   where u.email = 'bruno@frotos.dev' and r.status = 'pendente'),
  1, 'um serviço pendente do Bruno');
select is(
  (select count(*)::int from public.maintenance_requests q
   join auth.users u on u.id = q.driver_id
   where u.email = 'bruno@frotos.dev' and q.status = 'aberto'),
  1, 'um pedido aberto para o Bruno');
select is(
  (select count(*)::int from public.incidents i
   join public.vehicles v on v.id = i.vehicle_id
   join public.fleets f on f.id = v.fleet_id and f.codigo_convite = 'FRT-TEST'
   where i.status = 'aberta'),
  1, 'uma ocorrência aberta');

-- 5 login
select ok(
  (select encrypted_password = crypt('senha123', encrypted_password)
   from auth.users where email = 'ana@frotos.dev'),
  'senha de ana confere');

select * from finish();
rollback;
