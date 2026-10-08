import { randomUUID } from 'expo-crypto';

import { supabase } from './cliente';
import { comoErroApp } from './erros';

export type Bucket = 'fotos' | 'carros';
export type CategoriaFoto = 'inspecao' | 'painel' | 'nota' | 'ocorrencia';

/** Caminho novo no storage: '<frota>/<carro>/[categoria/]<uuid>.jpg'. */
export function novoCaminho(fleetId: string, vehicleId: string, categoria?: CategoriaFoto): string {
  const pasta = categoria ? `${fleetId}/${vehicleId}/${categoria}` : `${fleetId}/${vehicleId}`;
  return `${pasta}/${randomUUID()}.jpg`;
}

/** Envia um arquivo local para o storage. Se o objeto já existe (nova tentativa), considera enviado. */
export async function enviarFoto(bucket: Bucket, path: string, uri: string): Promise<void> {
  const arquivo = await fetch(uri);
  const conteudo = await arquivo.arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, conteudo, { contentType: 'image/jpeg', upsert: false });
  if (!error) return;
  const status = String((error as { statusCode?: string | number }).statusCode ?? '');
  if (status === '409' || /already exists/i.test(error.message)) return;
  throw comoErroApp(error);
}
