-- Bloco 1: relatar ocorrência com fotos numa chamada só, idempotente (fila offline do motorista).
-- O celular gera o id; repetir a chamada com o mesmo id não duplica a ocorrência nem o aviso.

drop function public.relatar_ocorrencia(uuid, public.tipo_ocorrencia, text);

create or replace function public.relatar_ocorrencia(
  p_vehicle_id uuid,
  p_tipo public.tipo_ocorrencia,
  p_descricao text,
  p_id uuid default null,
  p_fotos jsonb default '[]'::jsonb
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_desc text := btrim(coalesce(p_descricao, ''));
  v_placa text;
  v_dono uuid;
  v_inc public.incidents;
  v_rotulo text;
  v_foto jsonb;
begin
  if p_id is not null then
    select * into v_inc from public.incidents where id = p_id;
    if found then
      if v_inc.driver_id <> v_uid then
        perform public.erro('SEM_ACESSO', 'Você não está com este carro.');
      end if;
      return v_inc;
    end if;
  end if;

  if v_uid is null or not public.tem_vinculo_ativo(p_vehicle_id) then
    perform public.erro('SEM_ACESSO', 'Você não está com este carro.');
  end if;
  if v_desc = '' then
    perform public.erro('DESCRICAO_OBRIGATORIA', 'Descreva o que aconteceu.');
  end if;

  insert into public.incidents (id, vehicle_id, driver_id, tipo, descricao)
  values (coalesce(p_id, gen_random_uuid()), p_vehicle_id, v_uid, p_tipo, v_desc)
  returning * into v_inc;

  for v_foto in select * from jsonb_array_elements(coalesce(p_fotos, '[]'::jsonb)) loop
    insert into public.incident_photos (incident_id, path, capturado_em)
    values (v_inc.id, v_foto->>'path', coalesce((v_foto->>'capturado_em')::timestamptz, now()));
  end loop;

  select v.placa, f.owner_id into v_placa, v_dono
  from public.vehicles v join public.fleets f on f.id = v.fleet_id
  where v.id = p_vehicle_id;

  v_rotulo := case p_tipo
    when 'mecanico' then 'Barulho/mecânico'
    when 'acidente_leve' then 'Acidente leve'
    when 'acidente_grave' then 'Acidente grave'
    else 'Outro'
  end;

  perform public.notificar(
    v_dono, 'ocorrencia', 'Ocorrência: ' || v_placa,
    v_rotulo || ' — ' || left(v_desc, 80),
    'incidents', v_inc.id,
    case when p_tipo = 'acidente_grave' then 'alta' else 'normal' end
  );

  return v_inc;
end;
$$;

revoke execute on function public.relatar_ocorrencia(uuid, public.tipo_ocorrencia, text, uuid, jsonb) from public, anon;
grant execute on function public.relatar_ocorrencia(uuid, public.tipo_ocorrencia, text, uuid, jsonb) to authenticated;
