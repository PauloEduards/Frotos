import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

export type Aviso = {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  prioridade: 'normal' | 'alta';
  ref_tabela: string | null;
  ref_id: string | null;
  lida: boolean;
  criada_em: string;
};

const COLUNAS = 'id, tipo, titulo, corpo, prioridade, ref_tabela, ref_id, lida, criada_em';

export async function listarAvisos(limite = 50): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUNAS)
    .order('criada_em', { ascending: false })
    .limit(limite);
  if (error) throw comoErroApp(error);
  return (data ?? []) as Aviso[];
}

export async function marcarLido(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', id);
  if (error) throw comoErroApp(error);
}

export async function marcarTodosLidos(): Promise<void> {
  const { error } = await supabase.from('notifications').update({ lida: true }).eq('lida', false);
  if (error) throw comoErroApp(error);
}

export async function contarNaoLidos(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('lida', false);
  if (error) throw comoErroApp(error);
  return count ?? 0;
}

/** Carro a que um item pertence; null se não encontrado. */
export async function carroDoItem(itemId: string): Promise<string | null> {
  const { data, error } = await supabase.from('vehicle_items').select('vehicle_id').eq('id', itemId).maybeSingle();
  if (error) throw comoErroApp(error);
  return data?.vehicle_id ?? null;
}
