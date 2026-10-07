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
