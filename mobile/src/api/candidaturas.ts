import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

export type CandidaturaDono = {
  id: string;
  driver_id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  cpf: string | null;
  tem_cnh: boolean;
  mensagem: string | null;
  criada_em: string;
  carro: { vehicle_id: string; placa: string; marca: string; modelo: string; foto_path: string | null };
};

type Linha = {
  id: string;
  driver_id: string;
  vehicle_id: string;
  mensagem: string | null;
  criada_em: string;
  profiles: { nome: string; telefone: string | null; cidade: string | null; uf: string | null; cpf: string | null; tem_cnh: boolean } | null;
  vehicles: { placa: string; marca: string; modelo: string; foto_path: string | null } | null;
};

/** Candidaturas pendentes para os carros da frota (aba Motoristas do dono). */
export async function candidaturasPendentes(fleetId: string): Promise<CandidaturaDono[]> {
  const { data, error } = await supabase
    .from('candidaturas')
    .select(
      'id, driver_id, vehicle_id, mensagem, criada_em, profiles(nome, telefone, cidade, uf, cpf, tem_cnh), vehicles(placa, marca, modelo, foto_path)',
    )
    .eq('fleet_id', fleetId)
    .eq('status', 'pendente')
    .order('criada_em');
  if (error) throw comoErroApp(error);
  return ((data ?? []) as unknown as Linha[]).map((l) => ({
    id: l.id,
    driver_id: l.driver_id,
    nome: l.profiles?.nome ?? 'Motorista',
    telefone: l.profiles?.telefone ?? null,
    cidade: l.profiles?.cidade ?? null,
    uf: l.profiles?.uf ?? null,
    cpf: l.profiles?.cpf ?? null,
    tem_cnh: l.profiles?.tem_cnh ?? false,
    mensagem: l.mensagem,
    criada_em: l.criada_em,
    carro: {
      vehicle_id: l.vehicle_id,
      placa: l.vehicles?.placa ?? '',
      marca: l.vehicles?.marca ?? '',
      modelo: l.vehicles?.modelo ?? '',
      foto_path: l.vehicles?.foto_path ?? null,
    },
  }));
}

export async function responderCandidatura(id: string, aceitar: boolean): Promise<void> {
  const { error } = await supabase.rpc('responder_candidatura', { p_id: id, p_aceitar: aceitar });
  if (error) throw comoErroApp(error);
}

/** Selo da aba Motoristas: candidaturas pendentes + pedidos de entrada por código. */
export async function contarPedidosMotoristas(fleetId: string): Promise<number> {
  const [cand, entradas] = await Promise.all([
    supabase.from('candidaturas').select('id', { count: 'exact', head: true }).eq('fleet_id', fleetId).eq('status', 'pendente'),
    supabase.from('fleet_members').select('id', { count: 'exact', head: true }).eq('fleet_id', fleetId).eq('status', 'pendente'),
  ]);
  if (cand.error) throw comoErroApp(cand.error);
  if (entradas.error) throw comoErroApp(entradas.error);
  return (cand.count ?? 0) + (entradas.count ?? 0);
}
