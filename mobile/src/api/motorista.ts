import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

/** Carro da busca pública: nunca tem placa. */
export type CarroVitrine = {
  vehicle_id: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  cor: string;
  foto_path: string | null;
  frota_nome: string;
  cidade: string | null;
  uf: string | null;
};

export type StatusCandidatura = 'pendente' | 'aceita' | 'recusada' | 'cancelada';

export type MinhaCandidatura = { id: string; status: StatusCandidatura; criada_em: string; carro: CarroVitrine };

/** Em qual frota o motorista está ativo (ou null: ainda procura carro). */
export async function minhaSituacao(): Promise<{ frotaAtiva: { fleet_id: string; nome: string } | null }> {
  const { data: sessao } = await supabase.auth.getSession();
  const uid = sessao.session?.user.id;
  if (!uid) return { frotaAtiva: null };
  const { data, error } = await supabase
    .from('fleet_members')
    .select('fleet_id, fleets(nome)')
    .eq('driver_id', uid)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle();
  if (error) throw comoErroApp(error);
  if (!data) return { frotaAtiva: null };
  const frota = data as unknown as { fleet_id: string; fleets: { nome: string } | null };
  return { frotaAtiva: { fleet_id: frota.fleet_id, nome: frota.fleets?.nome ?? 'Frota' } };
}

export async function buscarCarros(uf: string, cidade: string): Promise<CarroVitrine[]> {
  const { data, error } = await supabase.rpc('buscar_carros', { p_uf: uf, p_cidade: cidade });
  if (error) throw comoErroApp(error);
  return (data ?? []) as CarroVitrine[];
}

export async function candidatar(vehicleId: string, mensagem?: string): Promise<void> {
  const { error } = await supabase.rpc('candidatar', {
    p_vehicle_id: vehicleId,
    p_mensagem: mensagem?.trim() ? mensagem.trim() : undefined,
  });
  if (error) throw comoErroApp(error);
}

export async function minhasCandidaturas(): Promise<MinhaCandidatura[]> {
  const { data, error } = await supabase.rpc('minhas_candidaturas');
  if (error) throw comoErroApp(error);
  return (data ?? []).map((l) => ({
    id: l.id,
    status: l.status as StatusCandidatura,
    criada_em: l.criada_em,
    carro: {
      vehicle_id: l.vehicle_id,
      marca: l.marca,
      modelo: l.modelo,
      ano_modelo: l.ano_modelo,
      cor: l.cor,
      foto_path: l.foto_path,
      frota_nome: l.frota_nome,
      cidade: l.cidade,
      uf: l.uf,
    },
  }));
}

export async function meusPedidosDeEntrada(): Promise<{ id: string; status: string; frota_nome: string }[]> {
  const { data, error } = await supabase.rpc('meus_pedidos_entrada');
  if (error) throw comoErroApp(error);
  return data ?? [];
}

export async function cancelarCandidatura(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_candidatura', { p_id: id });
  if (error) throw comoErroApp(error);
}

export async function entrarComCodigo(codigo: string): Promise<void> {
  const { error } = await supabase.rpc('entrar_na_frota', { p_codigo: codigo });
  if (error) throw comoErroApp(error);
}
