import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

export type ItemServico =
  | { vehicle_item_id: string; valor?: number }
  | { nome_outro: string; valor?: number };

export async function registrarServico(d: {
  vehicleId: string;
  itens: ItemServico[];
  km: number;
  data: string;
  valorTotal: number;
  oficina?: string;
  requestId?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('registrar_servico', {
    p_vehicle_id: d.vehicleId,
    p_itens: d.itens,
    p_km: d.km,
    p_data: d.data,
    p_valor_total: d.valorTotal,
    p_request_id: d.requestId,
    p_oficina: d.oficina || undefined,
  });
  if (error) throw comoErroApp(error);
}

export async function criarPedido(
  vehicleId: string,
  itens: string[],
  prazo: string,
  observacao?: string,
): Promise<void> {
  const { error } = await supabase.rpc('criar_pedido', {
    p_vehicle_id: vehicleId,
    p_itens: itens,
    p_prazo: prazo,
    p_observacao: observacao || undefined,
  });
  if (error) throw comoErroApp(error);
}

export async function cancelarPedido(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_pedido', { p_request_id: requestId });
  if (error) throw comoErroApp(error);
}

export type PedidoAberto = {
  id: string;
  itens: string[];
  prazo: string;
  observacao: string | null;
  driver_id: string;
};

export async function pedidosAbertos(vehicleId: string): Promise<PedidoAberto[]> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('id, itens, prazo, observacao, driver_id')
    .eq('vehicle_id', vehicleId)
    .eq('status', 'aberto')
    .order('prazo', { ascending: true });
  if (error) throw comoErroApp(error);
  return data;
}
