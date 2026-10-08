import type { StatusItem } from '@/lib/status';
import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';
import { enviarFoto, novoCaminho } from '@/lib/upload';

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

/** Envia a foto do carro (bucket 'carros') e grava o caminho no carro. */
export async function definirFotoCarro(fleetId: string, vehicleId: string, uri: string): Promise<void> {
  const path = novoCaminho(fleetId, vehicleId);
  await enviarFoto('carros', path, uri);
  const { error } = await supabase.from('vehicles').update({ foto_path: path }).eq('id', vehicleId);
  if (error) throw comoErroApp(error);
}

export type ModoVisibilidade = 'todos' | 'alguns' | 'um';

export async function definirVisibilidade(
  vehicleId: string,
  modo: ModoVisibilidade,
  motoristas: string[],
): Promise<void> {
  const { error } = await supabase.rpc('definir_visibilidade', {
    p_vehicle_id: vehicleId,
    p_modo: modo,
    p_motoristas: modo === 'todos' ? [] : motoristas,
  });
  if (error) throw comoErroApp(error);
}

export async function definirAnuncio(vehicleId: string, anunciado: boolean): Promise<void> {
  const { error } = await supabase.from('vehicles').update({ anunciado }).eq('id', vehicleId);
  if (error) throw comoErroApp(error);
}

/** Motoristas marcados na visibilidade "alguns"/"um" do carro. */
export async function motoristasDaVisibilidade(vehicleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('vehicle_visibility')
    .select('driver_id')
    .eq('vehicle_id', vehicleId);
  if (error) throw comoErroApp(error);
  return (data ?? []).map((l) => l.driver_id);
}

/** Caminho da foto de cada carro da frota (para os cards do painel e das pendências). */
export async function fotosDosCarros(fleetId: string): Promise<Record<string, string | null>> {
  const { data, error } = await supabase.from('vehicles').select('id, foto_path').eq('fleet_id', fleetId);
  if (error) throw comoErroApp(error);
  return Object.fromEntries((data ?? []).map((v) => [v.id, v.foto_path]));
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

export type ResumoCarro = {
  vehicle_id: string;
  placa: string;
  marca: string;
  modelo: string;
  status: StatusItem;
  proxima_data: string | null;
  proximo_item: string | null;
  estimada: boolean;
  motorista_nome: string | null;
};

// Os tipos gerados tratam as colunas retornadas pelas RPCs como não nulas, mas o banco devolve null
// (carro sem previsão, sem motorista, item sem km ou sem data).
export async function resumoFrota(fleetId: string): Promise<ResumoCarro[]> {
  const { data, error } = await supabase.rpc('resumo_frota', { p_fleet_id: fleetId });
  if (error) throw comoErroApp(error);
  return data as ResumoCarro[];
}

export type PrevisaoItem = {
  vehicle_item_id: string;
  nome: string;
  proximo_km: number | null;
  km_restante: number | null;
  data_prevista: string | null;
  status: StatusItem;
  custo_estimado: number;
};

export async function previsaoItens(vehicleId: string): Promise<PrevisaoItem[]> {
  const { data, error } = await supabase.rpc('previsao_itens', { p_vehicle_id: vehicleId });
  if (error) throw comoErroApp(error);
  return data as PrevisaoItem[];
}

export type StatusDoCarro = {
  status: StatusItem;
  proxima_data: string | null;
  proximo_item: string | null;
  media: number;
  estimada: boolean;
};

export async function statusCarro(vehicleId: string): Promise<StatusDoCarro> {
  const { data, error } = await supabase.rpc('status_carro', { p_vehicle_id: vehicleId });
  if (error) throw comoErroApp(error);
  const linha = (data as StatusDoCarro[] | null)?.[0];
  if (!linha) throw comoErroApp({ message: 'Carro não encontrado.' });
  return linha;
}

export type Veiculo = {
  id: string;
  fleet_id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_modelo: number;
  cor: string;
  km_atual: number;
  km_dia_estimado: number;
  exige_aprovacao_sempre: boolean;
  foto_path: string | null;
  visibilidade: ModoVisibilidade;
  anunciado: boolean;
};

export async function buscarVeiculo(id: string): Promise<Veiculo> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(
      'id, fleet_id, placa, marca, modelo, ano_modelo, cor, km_atual, km_dia_estimado, exige_aprovacao_sempre, foto_path, visibilidade, anunciado',
    )
    .eq('id', id)
    .single();
  if (error) throw comoErroApp(error);
  return data;
}

export type OrigemKm = 'retirada' | 'devolucao' | 'atualizacao' | 'manutencao' | 'correcao_dono';

export type LeituraKm = {
  id: string;
  km: number;
  origem: OrigemKm;
  capturado_em: string;
  foto_painel_path: string | null;
  salto_suspeito: boolean;
};

export async function leiturasKm(vehicleId: string, limite = 20): Promise<LeituraKm[]> {
  const { data, error } = await supabase
    .from('odometer_readings')
    .select('id, km, origem, capturado_em, foto_painel_path, salto_suspeito')
    .eq('vehicle_id', vehicleId)
    .order('capturado_em', { ascending: false })
    .limit(limite);
  if (error) throw comoErroApp(error);
  return data;
}

export type StatusServico = 'pendente' | 'aprovado' | 'recusado' | 'contestado';

export type Servico = {
  id: string;
  data: string;
  km: number;
  oficina: string | null;
  valor_total: number;
  status: StatusServico;
  motivo: string | null;
  itens: { nome: string; valor: number | null }[];
};

export async function servicos(vehicleId: string): Promise<Servico[]> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select(
      'id, data, km, oficina, valor_total, status, motivo, maintenance_record_items(valor, nome_outro, vehicle_items(nome))',
    )
    .eq('vehicle_id', vehicleId)
    .order('data', { ascending: false });
  if (error) throw comoErroApp(error);
  return data.map(({ maintenance_record_items, ...s }) => ({
    ...s,
    itens: maintenance_record_items.map((i) => ({
      nome: i.vehicle_items?.nome ?? i.nome_outro ?? 'Outro serviço',
      valor: i.valor,
    })),
  }));
}

export type FotoInspecao = {
  id: string;
  momento: 'retirada' | 'devolucao';
  posicao: 'frente' | 'traseira' | 'lateral_esq' | 'lateral_dir' | 'painel' | 'extra';
  path: string;
};

export type Vinculo = {
  id: string;
  status: 'aguardando_fotos' | 'ativo' | 'encerrado';
  inicio_em: string;
  fim_em: string | null;
  km_inicio: number;
  km_fim: number | null;
  motorista_nome: string | null;
  fotos: FotoInspecao[];
};

export async function vinculos(vehicleId: string): Promise<Vinculo[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, status, inicio_em, fim_em, km_inicio, km_fim, profiles(nome), inspection_photos(id, momento, posicao, path)',
    )
    .eq('vehicle_id', vehicleId)
    .order('inicio_em', { ascending: false });
  if (error) throw comoErroApp(error);
  return data.map(({ profiles, inspection_photos, ...v }) => ({
    ...v,
    motorista_nome: profiles?.nome ?? null,
    fotos: inspection_photos,
  }));
}

/** Correção do dono para um km digitado errado (leitura com origem `correcao_dono`). */
export async function corrigirKm(vehicleId: string, km: number): Promise<void> {
  const { error } = await supabase.rpc('registrar_km', {
    p_vehicle_id: vehicleId,
    p_km: km,
    p_origem: 'correcao_dono',
  });
  if (error) throw comoErroApp(error);
}

export async function atualizarVeiculo(
  id: string,
  campos: { exige_aprovacao_sempre?: boolean; ativo?: boolean; km_dia_estimado?: number },
): Promise<void> {
  const { error } = await supabase.from('vehicles').update(campos).eq('id', id);
  if (error) throw comoErroApp(error);
}
