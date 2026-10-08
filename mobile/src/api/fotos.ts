import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

const UMA_HORA = 3600;

/** Endereços temporários (1 hora) das fotos privadas, indexados pelo caminho no storage. */
export async function urlsAssinadas(
  paths: string[],
  bucket: 'fotos' | 'carros' = 'fotos',
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, UMA_HORA);
  if (error) throw comoErroApp(error);
  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}
