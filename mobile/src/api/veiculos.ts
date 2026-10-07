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
