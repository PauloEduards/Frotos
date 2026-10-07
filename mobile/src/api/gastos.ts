import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

export type LinhaProjecao = {
  vehicle_id: string;
  placa: string;
  vehicle_item_id: string;
  item_nome: string;
  data: string | null;
  valor: number;
};

export type LinhaRealizado = {
  record_id: string;
  vehicle_id: string;
  placa: string;
  data: string;
  valor_total: number;
  itens: string[];
};

// numeric pode chegar como string pelo PostgREST, por isso Number().
export async function projecaoGastos(fleetId: string, dias: 30 | 60 | 90): Promise<LinhaProjecao[]> {
  const { data, error } = await supabase.rpc('projecao_gastos', { p_fleet_id: fleetId, p_dias: dias });
  if (error) throw comoErroApp(error);
  return (data ?? []).map((l) => ({
    vehicle_id: l.vehicle_id,
    placa: l.placa,
    vehicle_item_id: l.vehicle_item_id,
    item_nome: l.item_nome,
    data: l.data ?? null,
    valor: Number(l.valor ?? 0),
  }));
}

export async function gastosRealizados(fleetId: string, dias: 30 | 60 | 90): Promise<LinhaRealizado[]> {
  const { data, error } = await supabase.rpc('gastos_realizados', { p_fleet_id: fleetId, p_dias: dias });
  if (error) throw comoErroApp(error);
  return (data ?? []).map((l) => ({
    record_id: l.record_id,
    vehicle_id: l.vehicle_id,
    placa: l.placa,
    data: l.data,
    valor_total: Number(l.valor_total ?? 0),
    itens: l.itens ?? [],
  }));
}
