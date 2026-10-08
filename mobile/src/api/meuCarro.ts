import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

export type CarroFrota = {
  vehicle_id: string;
  fleet_id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  cor: string;
  foto_path: string | null;
  km_atual: number;
  em_uso: boolean;
};

export type MeuVinculo = { id: string; status: 'aguardando_fotos' | 'ativo'; vehicle_id: string };

const COLUNAS_CARRO = 'id, fleet_id, placa, marca, modelo, ano_modelo, cor, foto_path, km_atual, em_uso';

type LinhaCarro = {
  id: string;
  fleet_id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  cor: string;
  foto_path: string | null;
  km_atual: number;
  em_uso: boolean;
};

function paraCarro(v: LinhaCarro): CarroFrota {
  return {
    vehicle_id: v.id,
    fleet_id: v.fleet_id,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    ano_modelo: v.ano_modelo,
    cor: v.cor,
    foto_path: v.foto_path,
    km_atual: v.km_atual,
    em_uso: v.em_uso,
  };
}

async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** O carro com que o motorista está (vínculo aberto) ou o carro reservado só para ele. */
export async function meuCarro(): Promise<{
  vinculo: MeuVinculo | null;
  carro: CarroFrota | null;
  reservado: CarroFrota | null;
}> {
  const uid = await usuarioAtual();
  if (!uid) return { vinculo: null, carro: null, reservado: null };

  const { data: vinculo, error } = await supabase
    .from('assignments')
    .select(`id, status, vehicle_id, vehicles(${COLUNAS_CARRO})`)
    .eq('driver_id', uid)
    .in('status', ['aguardando_fotos', 'ativo'])
    .maybeSingle();
  if (error) throw comoErroApp(error);
  if (vinculo) {
    const v = vinculo as unknown as { id: string; status: MeuVinculo['status']; vehicle_id: string; vehicles: LinhaCarro | null };
    return {
      vinculo: { id: v.id, status: v.status, vehicle_id: v.vehicle_id },
      carro: v.vehicles ? paraCarro(v.vehicles) : null,
      reservado: null,
    };
  }

  const { data: reservas, error: erroReserva } = await supabase
    .from('vehicle_visibility')
    .select(`vehicle_id, vehicles(${COLUNAS_CARRO}, visibilidade, ativo)`)
    .eq('driver_id', uid);
  if (erroReserva) throw comoErroApp(erroReserva);
  const reservado = ((reservas ?? []) as unknown as { vehicles: (LinhaCarro & { visibilidade: string; ativo: boolean }) | null }[])
    .map((r) => r.vehicles)
    .find((v) => v && v.visibilidade === 'um' && v.ativo && !v.em_uso);
  return { vinculo: null, carro: null, reservado: reservado ? paraCarro(reservado) : null };
}

/** Carros da frota que o motorista pode pegar (visibilidade), livres ou em uso. */
export async function carrosParaMim(): Promise<CarroFrota[]> {
  const { data, error } = await supabase.rpc('carros_para_mim');
  if (error) throw comoErroApp(error);
  const ids = (data ?? []).map((c) => c.vehicle_id);
  if (ids.length === 0) return [];
  const { data: extras, error: erroExtras } = await supabase.from('vehicles').select('id, fleet_id, km_atual').in('id', ids);
  if (erroExtras) throw comoErroApp(erroExtras);
  const porId = new Map((extras ?? []).map((e) => [e.id, e]));
  return (data ?? []).map((c) => ({
    vehicle_id: c.vehicle_id,
    fleet_id: porId.get(c.vehicle_id)?.fleet_id ?? '',
    placa: c.placa,
    marca: c.marca,
    modelo: c.modelo,
    ano_modelo: c.ano_modelo,
    cor: c.cor,
    foto_path: c.foto_path,
    km_atual: porId.get(c.vehicle_id)?.km_atual ?? 0,
    em_uso: c.em_uso,
  }));
}

/** Começa a retirada (precisa de internet): cria o vínculo e devolve o id. */
export async function iniciarRetirada(vehicleId: string, km: number): Promise<string> {
  const { data, error } = await supabase.rpc('iniciar_retirada', { p_vehicle_id: vehicleId, p_km: km });
  if (error) throw error;
  return (data as { id: string }).id;
}

export type PedidoDoMotorista = { id: string; itens: string[]; prazo: string; observacao: string | null };

export async function pedidosDoMotorista(vehicleId: string): Promise<PedidoDoMotorista[]> {
  const uid = await usuarioAtual();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('id, itens, prazo, observacao')
    .eq('vehicle_id', vehicleId)
    .eq('driver_id', uid)
    .eq('status', 'aberto')
    .order('prazo');
  if (error) throw comoErroApp(error);
  return data ?? [];
}

/** 'aprovado' | 'pendente' | 'negado' — se o motorista pode registrar serviço neste carro. */
export async function permissaoRegistro(vehicleId: string): Promise<string> {
  const { data, error } = await supabase.rpc('permissao_registro', { p_vehicle_id: vehicleId });
  if (error) throw comoErroApp(error);
  return data as string;
}
