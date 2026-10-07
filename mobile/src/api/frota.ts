import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

export type Frota = {
  id: string;
  nome: string;
  codigo_convite: string;
  modo_manutencao: 'proprietario_leva' | 'motoristas_levam';
  limite_salto_km_dia: number;
  limiar_amarelo_km: number;
  limiar_amarelo_dias: number;
  limiar_laranja_km: number;
};

const COLUNAS =
  'id, nome, codigo_convite, modo_manutencao, limite_salto_km_dia, limiar_amarelo_km, limiar_amarelo_dias, limiar_laranja_km';

export async function minhaFrota(): Promise<Frota | null> {
  const { data: sessao } = await supabase.auth.getSession();
  const uid = sessao.session?.user.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('fleets')
    .select(COLUNAS)
    .eq('owner_id', uid)
    .maybeSingle();
  if (error) throw comoErroApp(error);
  return data;
}

export async function criarFrota(nome: string): Promise<Frota> {
  const { data, error } = await supabase.rpc('criar_frota', { p_nome: nome });
  if (error) throw comoErroApp(error);
  return data;
}

export async function gerarNovoCodigo(fleetId: string): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_novo_codigo', { p_fleet_id: fleetId });
  if (error) throw comoErroApp(error);
  return data;
}

export async function atualizarFrota(
  fleetId: string,
  campos: Partial<Omit<Frota, 'id' | 'codigo_convite'>>,
): Promise<void> {
  const { error } = await supabase.from('fleets').update(campos).eq('id', fleetId);
  if (error) throw comoErroApp(error);
}

export type Membro = {
  id: string;
  driver_id: string;
  status: 'pendente' | 'ativo' | 'removido';
  nivel_manutencao: 'sem_permissao' | 'com_aprovacao' | 'confiavel';
  nome: string;
  telefone: string | null;
  carro_placa: string | null;
};

type LinhaMembro = Omit<Membro, 'nome' | 'telefone' | 'carro_placa'> & {
  profiles: { nome: string; telefone: string | null } | null;
};

type LinhaVinculo = { driver_id: string; vehicles: { placa: string } | null };

export async function listarMembros(fleetId: string): Promise<Membro[]> {
  const { data, error } = await supabase
    .from('fleet_members')
    .select('id, driver_id, status, nivel_manutencao, profiles(nome, telefone)')
    .eq('fleet_id', fleetId)
    .order('criado_em');
  if (error) throw comoErroApp(error);
  const linhas = (data ?? []) as unknown as LinhaMembro[];

  const ids = linhas.map((l) => l.driver_id);
  const placas = new Map<string, string>();
  if (ids.length > 0) {
    const { data: vinculos, error: erroVinculos } = await supabase
      .from('assignments')
      .select('driver_id, vehicles(placa)')
      .in('driver_id', ids)
      .in('status', ['aguardando_fotos', 'ativo']);
    if (erroVinculos) throw comoErroApp(erroVinculos);
    for (const v of (vinculos ?? []) as unknown as LinhaVinculo[]) {
      if (v.vehicles) placas.set(v.driver_id, v.vehicles.placa);
    }
  }

  return linhas.map((l) => ({
    id: l.id,
    driver_id: l.driver_id,
    status: l.status,
    nivel_manutencao: l.nivel_manutencao,
    nome: l.profiles?.nome ?? 'Motorista',
    telefone: l.profiles?.telefone ?? null,
    carro_placa: placas.get(l.driver_id) ?? null,
  }));
}

export async function responderEntrada(memberId: string, aprovar: boolean): Promise<void> {
  const { error } = await supabase.rpc('responder_entrada', { p_member_id: memberId, p_aprovar: aprovar });
  if (error) throw comoErroApp(error);
}

export async function definirNivel(memberId: string, nivel: Membro['nivel_manutencao']): Promise<void> {
  const { error } = await supabase.from('fleet_members').update({ nivel_manutencao: nivel }).eq('id', memberId);
  if (error) throw comoErroApp(error);
}

export async function removerMotorista(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remover_motorista', { p_member_id: memberId });
  if (error) throw comoErroApp(error);
}
