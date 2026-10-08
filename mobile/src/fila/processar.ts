import { mensagemErro } from '@/lib/erros';
import type { Bucket } from '@/lib/upload';

import { atualizar, descartar, listar, versaoDaFila, type ItemFila } from './fila';

export type DepsFila = {
  enviarFoto: (bucket: Bucket, path: string, uri: string) => Promise<void>;
  chamarRpc: (rpc: string, args: Record<string, unknown>) => Promise<void>;
};

/**
 * Falha temporária (vale tentar de novo sozinho): sem conexão, tempo esgotado, servidor fora (5xx),
 * muitas requisições (429). Qualquer outra falha precisa do usuário (corrigir ou descartar).
 */
function falhaTemporaria(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const o = (typeof e === 'object' && e !== null ? e : {}) as { message?: unknown; status?: unknown; statusCode?: unknown };
  const mensagem = typeof o.message === 'string' ? o.message : '';
  if (/Network request failed|Failed to fetch|network|timeout|timed out/i.test(mensagem)) return true;
  const status = Number(o.status ?? o.statusCode);
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

let emAndamento: Promise<void> | null = null;

/**
 * Envia, em ordem, as fotos e depois as ações de cada item.
 * - Falha temporária (rede, 5xx, 429): conta a tentativa e para tudo; a próxima rodada continua de onde parou.
 * - Qualquer outra falha (negócio P0001, permissão, dado inválido): o item espera o usuário
 *   corrigir/descartar e a fila segue para o próximo.
 */
export function processarFila(deps: DepsFila): Promise<void> {
  if (!emAndamento) {
    emAndamento = (async () => {
      // Se a fila mudou durante a rodada (item novo), roda de novo.
      let versao: number;
      let continuar = true;
      do {
        versao = versaoDaFila();
        continuar = await rodar(deps);
      } while (continuar && versaoDaFila() !== versao && (await temPendente()));
    })().finally(() => {
      emAndamento = null;
    });
  }
  return emAndamento;
}

async function temPendente(): Promise<boolean> {
  return (await listar()).some((i) => !i.erro?.negocio);
}

/** Uma rodada pela fila. Devolve false quando parou por falha temporária (sem conexão). */
async function rodar(deps: DepsFila): Promise<boolean> {
  for (const original of await listar()) {
    if (original.erro?.negocio) continue;
    const item: ItemFila = { ...original, fotos: [...original.fotos], acoes: [...original.acoes] };
    try {
      for (let i = 0; i < item.fotos.length; i++) {
        const f = item.fotos[i];
        if (f.enviada) continue;
        await deps.enviarFoto(f.bucket, f.path, f.uri);
        item.fotos[i] = { ...f, enviada: true };
        await atualizar(item.id, { fotos: item.fotos });
      }
      while (item.acoes.length > 0) {
        const [acao, ...resto] = item.acoes;
        await deps.chamarRpc(acao.rpc, acao.args);
        item.acoes = resto;
        await atualizar(item.id, { acoes: resto });
      }
      await descartar(item.id);
    } catch (e) {
      if (!falhaTemporaria(e)) {
        await atualizar(item.id, { erro: { mensagem: mensagemErro(e), negocio: true } });
        continue;
      }
      await atualizar(item.id, {
        tentativas: item.tentativas + 1,
        erro: { mensagem: mensagemErro(e), negocio: false },
      });
      return false;
    }
  }
  return true;
}

/** Libera um item parado por erro de negócio para tentar de novo (com os mesmos dados ou corrigidos). */
export async function liberarItem(id: string, acoes?: ItemFila['acoes']): Promise<void> {
  await atualizar(id, { erro: null, ...(acoes ? { acoes } : {}) });
}

/** Troca o km (p_km) das ações de um item parado (ex.: KM_MENOR) e libera para enviar de novo. */
export async function corrigirKm(id: string, km: number): Promise<void> {
  const item = (await listar()).find((i) => i.id === id);
  if (!item) return;
  const acoes = item.acoes.map((a) => ('p_km' in a.args ? { ...a, args: { ...a.args, p_km: km } } : a));
  await liberarItem(id, acoes);
}
