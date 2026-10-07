-- Previsão de manutenção e status (spec §6.1 a §6.3)

-- ---------- Média diária de km (interna) ----------
create or replace function public.media_km_dia_interna(p_vehicle_id uuid, p_hoje date)
returns table (media numeric, estimada boolean)
language sql
security definer
stable
set search_path = ''
as $$
  with r as (
    select o.km, o.capturado_em
    from public.odometer_readings o
    where o.vehicle_id = p_vehicle_id
      and (o.capturado_em at time zone 'America/Sao_Paulo')::date between p_hoje - 30 and p_hoje
  ),
  f as (select r.km, r.capturado_em from r order by r.capturado_em asc, r.km asc limit 1),
  u as (select r.km, r.capturado_em from r order by r.capturado_em desc, r.km desc limit 1),
  c as (
    select (u.km - f.km)::numeric as delta,
           extract(epoch from (u.capturado_em - f.capturado_em)) / 86400.0 as dias
    from f, u
  )
  select
    case when c.dias >= 3 and c.delta >= 0 then c.delta / c.dias else v.km_dia_estimado::numeric end,
    not (c.dias >= 3 and c.delta >= 0)
  from public.vehicles v
  left join c on true
  where v.id = p_vehicle_id;
$$;

-- ---------- Previsão por item (interna) ----------
create or replace function public.previsao_itens_interna(p_vehicle_id uuid, p_hoje date)
returns table (
  vehicle_item_id uuid, nome text, proximo_km int, km_restante int,
  data_prevista date, status public.status_item, custo_estimado numeric
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    x.id, x.nome, x.proximo_km, x.km_restante, x.data_prevista,
    case
      when x.ultimo_km is null and x.ultima_data is null then 'sem_historico'::public.status_item
      when x.km_restante <= 0 or x.data_prevista <= p_hoje then 'vencido'::public.status_item
      when x.km_restante < x.limiar_laranja_km then 'urgente'::public.status_item
      when x.km_restante <= x.limiar_amarelo_km
        or x.data_prevista <= p_hoje + x.limiar_amarelo_dias then 'proximo'::public.status_item
      else 'em_dia'::public.status_item
    end,
    x.custo_estimado
  from (
    select
      i.id, i.nome, i.ultimo_km, i.ultima_data, i.custo_estimado,
      fl.limiar_laranja_km, fl.limiar_amarelo_km, fl.limiar_amarelo_dias,
      k.proximo_km, k.proximo_km - v.km_atual as km_restante,
      case
        when i.ultimo_km is null and i.ultima_data is null then null
        else least(
          case when k.proximo_km is not null and m.media > 0
               then p_hoje + (case when k.proximo_km - v.km_atual > 0
                               then ceil((k.proximo_km - v.km_atual) / m.media)
                               else floor((k.proximo_km - v.km_atual) / m.media) end)::int end,
          case when i.ultima_data is not null and i.intervalo_meses is not null
               then (i.ultima_data + make_interval(months => i.intervalo_meses))::date end
        )
      end as data_prevista
    from public.vehicle_items i
    join public.vehicles v on v.id = i.vehicle_id
    join public.fleets fl on fl.id = v.fleet_id
    cross join lateral public.media_km_dia_interna(p_vehicle_id, p_hoje) m
    cross join lateral (
      select case when i.intervalo_km is not null and i.ultimo_km is not null
                  then i.ultimo_km + i.intervalo_km end as proximo_km
    ) k
    where i.vehicle_id = p_vehicle_id and i.ativo
  ) x
  order by x.data_prevista nulls last, x.nome;
$$;

-- ---------- Status do carro (interna) ----------
create or replace function public.status_carro_interna(p_vehicle_id uuid, p_hoje date)
returns table (status public.status_item, proxima_data date, proximo_item text, media numeric, estimada boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select
    coalesce(
      (select p.status from public.previsao_itens_interna(p_vehicle_id, p_hoje) p
       order by case p.status
         when 'vencido' then 5 when 'urgente' then 4 when 'sem_historico' then 3
         when 'proximo' then 2 else 1 end desc
       limit 1),
      'sem_historico'::public.status_item),
    n.data_prevista,
    n.nome,
    m.media,
    m.estimada
  from public.media_km_dia_interna(p_vehicle_id, p_hoje) m
  left join lateral (
    select p.data_prevista, p.nome
    from public.previsao_itens_interna(p_vehicle_id, p_hoje) p
    where p.data_prevista is not null
    order by p.data_prevista, p.nome
    limit 1
  ) n on true;
$$;

-- ---------- Públicas ----------
create or replace function public.previsao_itens(p_vehicle_id uuid, p_hoje date default public.hoje_brt())
returns table (
  vehicle_item_id uuid, nome text, proximo_km int, km_restante int,
  data_prevista date, status public.status_item, custo_estimado numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (public.e_dono_do_veiculo(p_vehicle_id) or public.tem_vinculo_ativo(p_vehicle_id)) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a este carro.');
  end if;
  return query select * from public.previsao_itens_interna(p_vehicle_id, p_hoje);
end;
$$;

create or replace function public.status_carro(p_vehicle_id uuid, p_hoje date default public.hoje_brt())
returns table (status public.status_item, proxima_data date, proximo_item text, media numeric, estimada boolean)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not (public.e_dono_do_veiculo(p_vehicle_id) or public.tem_vinculo_ativo(p_vehicle_id)) then
    perform public.erro('SEM_ACESSO', 'Você não tem acesso a este carro.');
  end if;
  return query select * from public.status_carro_interna(p_vehicle_id, p_hoje);
end;
$$;

create or replace function public.resumo_frota(p_fleet_id uuid, p_hoje date default public.hoje_brt())
returns table (
  vehicle_id uuid, placa text, marca text, modelo text, status public.status_item,
  proxima_data date, proximo_item text, estimada boolean, motorista_nome text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.e_dono_frota(p_fleet_id) then
    perform public.erro('SEM_ACESSO', 'Somente o proprietário vê o resumo da frota.');
  end if;
  return query
    select v.id, v.placa, v.marca, v.modelo, s.status, s.proxima_data, s.proximo_item, s.estimada,
           (select pr.nome from public.assignments a
            join public.profiles pr on pr.id = a.driver_id
            where a.vehicle_id = v.id and a.status <> 'encerrado'
            limit 1)
    from public.vehicles v
    cross join lateral public.status_carro_interna(v.id, p_hoje) s
    where v.fleet_id = p_fleet_id and v.ativo
    order by v.placa;
end;
$$;

revoke execute on function public.media_km_dia_interna(uuid, date) from public, anon, authenticated;
revoke execute on function public.previsao_itens_interna(uuid, date) from public, anon, authenticated;
revoke execute on function public.status_carro_interna(uuid, date) from public, anon, authenticated;
revoke execute on function public.previsao_itens(uuid, date) from public, anon;
revoke execute on function public.status_carro(uuid, date) from public, anon;
revoke execute on function public.resumo_frota(uuid, date) from public, anon;
grant execute on function public.previsao_itens(uuid, date) to authenticated;
grant execute on function public.status_carro(uuid, date) to authenticated;
grant execute on function public.resumo_frota(uuid, date) to authenticated;
