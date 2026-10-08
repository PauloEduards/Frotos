import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import type { Bucket } from '@/lib/upload';

export type TipoItemFila = 'retirada' | 'devolucao' | 'km' | 'ocorrencia' | 'servico' | 'foto_carro';

export type FotoFila = {
  uri: string;
  bucket: Bucket;
  path: string;
  enviada: boolean;
  capturadoEm: string;
  posicao?: string;
};

export type AcaoFila = { rpc: string; args: Record<string, unknown> };

export type ItemFila = {
  id: string;
  tipo: TipoItemFila;
  criadoEm: string;
  fotos: FotoFila[];
  /** Executadas em ordem; cada uma sai da lista quando conclui (nova tentativa não repete). */
  acoes: AcaoFila[];
  tentativas: number;
  erro: { mensagem: string; negocio: boolean } | null;
};

const CHAVE = 'frotos:fila:v1';
const ouvintes = new Set<() => void>();

export function aoMudarFila(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export async function listar(): Promise<ItemFila[]> {
  const bruto = await AsyncStorage.getItem(CHAVE);
  return bruto ? (JSON.parse(bruto) as ItemFila[]) : [];
}

async function salvar(itens: ItemFila[]): Promise<void> {
  await AsyncStorage.setItem(CHAVE, JSON.stringify(itens));
  ouvintes.forEach((o) => o());
}

export async function adicionar(item: Omit<ItemFila, 'id' | 'tentativas' | 'erro'>): Promise<string> {
  const id = randomUUID();
  await salvar([...(await listar()), { ...item, id, tentativas: 0, erro: null }]);
  return id;
}

export async function atualizar(id: string, parcial: Partial<ItemFila>): Promise<void> {
  await salvar((await listar()).map((i) => (i.id === id ? { ...i, ...parcial } : i)));
}

export async function descartar(id: string): Promise<void> {
  await salvar((await listar()).filter((i) => i.id !== id));
}
