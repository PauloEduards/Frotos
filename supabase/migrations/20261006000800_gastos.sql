-- Projeção de gastos e gastos realizados (spec §6.4)

create or replace function public.projecao_gastos(p_fleet_id uuid, p_dias int, p_hoje date default public.hoje_brt())
returns table (
  vehicle_id uuid, placa text, vehicle_item_id uuid, item_nome text, data date, valor numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  r record;
  d date;
  ciclo_km int;
  meses int;
  media_v numeric;
begin
  if not public.e_dono_frota(p_fleet_id) then
    perform public.erro('SEM_ACESSO', 'Somente o proprietário vê a projeção de gastos.');
  end if;
  if p_dias is null or p_dias not in (30, 60, 90) then
    perform public.erro('PERIODO_INVALIDO', 'Escolha um período de 30, 60 ou 90 dias.');
  end if;

  for r in
    select v.id as vid, v.placa as vplaca, i.id as iid, i.nome as inome, i.intervalo_km, i.intervalo_meses,
           p.data_prevista, p.custo_estimado as custo, m.media,
           (i.ultimo_km is null and i.ultima_data is null) as sem_hist
    from public.vehicles v
    join public.vehicle_items i on i.vehicle_id = v.id and i.ativo
    cross join lateral public.previsao_itens_interna(v.id, p_hoje) p
    cross join lateral public.media_km_dia_interna(v.id, p_hoje) m
    where v.fleet_id = p_fleet_id and v.ativo and p.vehicle_item_id = i.id
    order by v.placa, i.nome
  loop
    if r.sem_hist then
      vehicle_id := r.vid; placa := r.vplaca; vehicle_item_id := r.iid; item_nome := r.inome;
      data := null; valor := r.custo;
      return next;
      continue;
    end if;

    d := greatest(r.data_prevista, p_hoje);   -- data_prevista null → d null → pula
    ciclo_km := case when r.intervalo_km is not null and r.media > 0
                     then greatest(1, floor(r.intervalo_km / r.media))::int end;
    meses := case when r.intervalo_meses > 0 then r.intervalo_meses end;

    while d is not null and d <= p_hoje + p_dias loop
      vehicle_id := r.vid; placa := r.vplaca; vehicle_item_id := r.iid; item_nome := r.inome;
      data := d; valor := r.custo;
      return next;
      d := least(
        case when ciclo_km is not null then d + ciclo_km end,
        case when meses is not null then (d + make_interval(months => meses))::date end
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.gastos_realizados(p_fleet_id uuid, p_dias int, p_hoje date default public.hoje_brt())
returns table (
  record_id uuid, vehicle_id uuid, placa text, data date, valor_total numeric, itens text[]
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.e_dono_frota(p_fleet_id) then
    perform public.erro('SEM_ACESSO', 'Somente o proprietário vê os gastos.');
  end if;
  if p_dias is null or p_dias not in (30, 60, 90) then
    perform public.erro('PERIODO_INVALIDO', 'Escolha um período de 30, 60 ou 90 dias.');
  end if;
  return query
    select mr.id, mr.vehicle_id, v.placa, mr.data, mr.valor_total,
           coalesce((
             select array_agg(coalesce(vi.nome, mi.nome_outro) order by coalesce(vi.nome, mi.nome_outro))
             from public.maintenance_record_items mi
             left join public.vehicle_items vi on vi.id = mi.vehicle_item_id
             where mi.record_id = mr.id
           ), array[]::text[])
    from public.maintenance_records mr
    join public.vehicles v on v.id = mr.vehicle_id
    where v.fleet_id = p_fleet_id
      and mr.status = 'aprovado'
      and mr.data > p_hoje - p_dias and mr.data <= p_hoje
    order by mr.data, v.placa;
end;
$$;

revoke execute on function public.projecao_gastos(uuid, int, date) from public, anon;
revoke execute on function public.gastos_realizados(uuid, int, date) from public, anon;
grant execute on function public.projecao_gastos(uuid, int, date) to authenticated;
grant execute on function public.gastos_realizados(uuid, int, date) to authenticated;
