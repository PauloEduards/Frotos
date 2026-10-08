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
let versao = 0;
// Toda leitura-e-escrita da fila passa por esta cadeia: duas mudanças nunca se cruzam.
let cadeia: Promise<unknown> = Promise.resolve();

function emSerie<T>(fn: () => Promise<T>): Promise<T> {
  const proxima = cadeia.then(fn, fn);
  cadeia = proxima.catch(() => undefined);
  return proxima;
}

/** Conta as mudanças na fila (o processador usa para saber se precisa de outra rodada). */
export function versaoDaFila(): number {
  return versao;
}

export function aoMudarFila(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function listar(): Promise<ItemFila[]> {
  return emSerie(lerSemFila);
}

async function lerSemFila(): Promise<ItemFila[]> {
  const bruto = await AsyncStorage.getItem(CHAVE);
  return bruto ? (JSON.parse(bruto) as ItemFila[]) : [];
}

function mudar(fn: (itens: ItemFila[]) => ItemFila[]): Promise<void> {
  return emSerie(async () => {
    await AsyncStorage.setItem(CHAVE, JSON.stringify(fn(await lerSemFila())));
    versao++;
    ouvintes.forEach((o) => o());
  });
}

export async function adicionar(item: Omit<ItemFila, 'id' | 'tentativas' | 'erro'>): Promise<string> {
  const id = randomUUID();
  await mudar((itens) => [...itens, { ...item, id, tentativas: 0, erro: null }]);
  return id;
}

export function atualizar(id: string, parcial: Partial<ItemFila>): Promise<void> {
  return mudar((itens) => itens.map((i) => (i.id === id ? { ...i, ...parcial } : i)));
}

export function descartar(id: string): Promise<void> {
  return mudar((itens) => itens.filter((i) => i.id !== id));
}
