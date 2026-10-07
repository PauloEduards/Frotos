-- Rotina diária: atualiza status dos itens, avisa mudanças, lembra o km e pedidos atrasados.
create extension if not exists pg_cron;

create or replace function public.rotina_diaria(p_hoje date default public.hoje_brt())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_label text;
  v_data text;
  v_corpo_dono text;
  v_corpo_mot text;
  v_prio text;
  v_motorista uuid;
begin
  -- 1. Status dos itens: atualiza e avisa somente na mudança para proximo/urgente/vencido
  for r in
    select i.id as item_id, i.status_atual as anterior, p.nome, p.status as novo, p.data_prevista,
           v.id as vehicle_id, v.placa, f.owner_id, f.modo_manutencao
    from public.vehicles v
    join public.fleets f on f.id = v.fleet_id
    join lateral public.previsao_itens_interna(v.id, p_hoje) p on true
    join public.vehicle_items i on i.id = p.vehicle_item_id
    where v.ativo and p.status is distinct from i.status_atual
  loop
    update public.vehicle_items set status_atual = r.novo where id = r.item_id;

    if r.novo in ('proximo', 'urgente', 'vencido') then
      v_label := case r.novo
        when 'proximo' then 'próximo do vencimento'
        when 'urgente' then 'urgente'
        else 'vencido' end;
      v_data := coalesce('até ' || to_char(r.data_prevista, 'DD/MM'), 'o quanto antes');
      v_prio := case when r.novo = 'vencido' then 'alta' else 'normal' end;

      if r.modo_manutencao = 'motoristas_levam' then
        v_corpo_dono := r.nome || ' do carro ' || r.placa || ' está ' || v_label || '. O motorista foi avisado.';
        v_corpo_mot := r.nome || ' está ' || v_label || '. Leve o carro ' || r.placa || ' à oficina ' || v_data || '.';
      else
        v_corpo_dono := r.nome || ' está ' || v_label || '. Agende a manutenção.';
        v_corpo_mot := r.nome || ' do carro ' || r.placa || ' está ' || v_label
                       || '. O proprietário vai combinar com você.';
      end if;

      perform public.notificar(r.owner_id, 'status_item', 'Manutenção: ' || r.placa, v_corpo_dono,
                               'vehicle_items', r.item_id, v_prio);

      select a.driver_id into v_motorista
      from public.assignments a
      where a.vehicle_id = r.vehicle_id and a.status = 'ativo';
      if v_motorista is not null then
        perform public.notificar(v_motorista, 'status_item', 'Manutenção: ' || r.placa, v_corpo_mot,
                                 'vehicle_items', r.item_id, v_prio);
      end if;
    end if;
  end loop;

  -- 2. Lembrete de km: vínculo ativo, última leitura há 7 dias ou mais, sem lembrete nos últimos 7 dias
  for r in
    select a.driver_id, v.id as vehicle_id, v.placa
    from public.assignments a
    join public.vehicles v on v.id = a.vehicle_id
    where a.status = 'ativo' and v.ativo
      and (coalesce((select max(o.capturado_em) from public.odometer_readings o where o.vehicle_id = v.id),
                    a.inicio_em) at time zone 'America/Sao_Paulo')::date <= p_hoje - 7
      and not exists (
        select 1 from public.notifications n
        where n.user_id = a.driver_id and n.tipo = 'lembrete_km' and n.ref_id = v.id
          and n.criada_em > now() - interval '7 days')
  loop
    perform public.notificar(r.driver_id, 'lembrete_km', 'Atualize o km',
                             'Atualize o km do carro ' || r.placa || '.', 'vehicles', r.vehicle_id);
  end loop;

  -- 3. Pedidos de manutenção com prazo vencido (uma vez só)
  for r in
    select q.id, q.driver_id, v.placa, f.owner_id
    from public.maintenance_requests q
    join public.vehicles v on v.id = q.vehicle_id
    join public.fleets f on f.id = v.fleet_id
    where q.status = 'aberto' and not q.prazo_notificado and q.prazo < p_hoje
  loop
    update public.maintenance_requests set prazo_notificado = true where id = r.id;
    perform public.notificar(r.owner_id, 'pedido_prazo', 'Pedido de manutenção atrasado',
                             'O pedido de manutenção do carro ' || r.placa || ' passou do prazo.',
                             'maintenance_requests', r.id);
    perform public.notificar(r.driver_id, 'pedido_prazo', 'Pedido de manutenção atrasado',
                             'O pedido de manutenção do carro ' || r.placa || ' passou do prazo.',
                             'maintenance_requests', r.id);
  end loop;
end;
$$;

revoke execute on function public.rotina_diaria(date) from public, anon, authenticated;

select cron.schedule('rotina-diaria', '0 11 * * *', $$select public.rotina_diaria()$$);
