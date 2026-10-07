import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

export type NovoVeiculo = {
  placa: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  cor: string;
  km_atual: number;
  km_dia_estimado: number;
};

export const CORES = ['Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Outra'];

export const MARCAS_COMUNS = [
  'Chevrolet',
  'Fiat',
  'Volkswagen',
  'Hyundai',
  'Renault',
  'Toyota',
  'Honda',
  'Nissan',
  'Jeep',
  'Peugeot',
  'Citroën',
  'Ford',
];

export async function cadastrarVeiculo(fleetId: string, v: NovoVeiculo): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...v, fleet_id: fleetId, fipe_codigo: null })
    .select('id')
    .single();
  if (error) throw comoErroApp(error);
  return data;
}

export type ItemVeiculo = {
  id: string;
  nome: string;
  intervalo_km: number | null;
  intervalo_meses: number | null;
  km_inicial: number | null;
  data_inicial: string | null;
  custo_estimado: number;
  catalog_id: string | null;
  ativo: boolean;
};

export type PlanoItem = {
  intervalo_km: number | null;
  intervalo_meses: number | null;
  custo_estimado: number;
};

const COLUNAS_ITEM =
  'id, nome, intervalo_km, intervalo_meses, km_inicial, data_inicial, custo_estimado, catalog_id, ativo, maintenance_catalog(ordem)';

/** Itens do catálogo na ordem do catálogo; itens próprios por último, em ordem alfabética. */
export async function listarItens(vehicleId: string): Promise<ItemVeiculo[]> {
  const { data, error } = await supabase
    .from('vehicle_items')
    .select(COLUNAS_ITEM)
    .eq('vehicle_id', vehicleId);
  if (error) throw comoErroApp(error);

  return data
    .map(({ maintenance_catalog, ...item }) => ({
      item: item as ItemVeiculo,
      ordem: maintenance_catalog?.ordem ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      if (a.ordem !== b.ordem) return a.ordem < b.ordem ? -1 : 1;
      return a.item.nome.localeCompare(b.item.nome, 'pt-BR');
    })
    .map(({ item }) => item);
}

// Os tipos gerados tratam os parâmetros das RPCs como não nulos, mas o banco aceita null
// (histórico em branco, intervalo só em km ou só em meses).
export async function definirHistoricoInicial(
  itemId: string,
  km: number | null,
  data: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('definir_historico_inicial', {
    p_item_id: itemId,
    p_km_inicial: km as number,
    p_data_inicial: data as string,
  });
  if (error) throw comoErroApp(error);
}

/** Devolve em quantos carros a mudança foi aplicada. */
export async function atualizarItem(
  itemId: string,
  d: PlanoItem,
  aplicarEmTodos: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc('atualizar_item', {
    p_item_id: itemId,
    p_intervalo_km: d.intervalo_km as number,
    p_intervalo_meses: d.intervalo_meses as number,
    p_custo_estimado: d.custo_estimado,
    p_aplicar_em_todos: aplicarEmTodos,
  });
  if (error) throw comoErroApp(error);
  return data;
}

export async function adicionarItem(vehicleId: string, d: PlanoItem & { nome: string }): Promise<void> {
  const { error } = await supabase.from('vehicle_items').insert({
    vehicle_id: vehicleId,
    nome: d.nome,
    intervalo_km: d.intervalo_km,
    intervalo_meses: d.intervalo_meses,
    custo_estimado: d.custo_estimado,
  });
  if (error) throw comoErroApp(error);
}

/** Média dos valores já pagos neste item; null se ainda não há serviços aprovados. */
export async function sugestaoCusto(itemId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('custo_medio_item', { p_item_id: itemId });
  if (error) throw comoErroApp(error);
  return data ?? null;
}
