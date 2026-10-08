import { mensagemErro } from '@/lib/erros';
import type { Bucket } from '@/lib/upload';

import { atualizar, descartar, listar, type ItemFila } from './fila';

export type DepsFila = {
  enviarFoto: (bucket: Bucket, path: string, uri: string) => Promise<void>;
  chamarRpc: (rpc: string, args: Record<string, unknown>) => Promise<void>;
};

function erroDeNegocio(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P0001';
}

let emAndamento: Promise<void> | null = null;

/**
 * Envia, em ordem, as fotos e depois as ações de cada item.
 * - Erro de negócio (P0001): marca o item, que espera o usuário corrigir/descartar; segue para o próximo.
 * - Outro erro (rede): conta a tentativa e para tudo; a próxima rodada continua de onde parou.
 */
export function processarFila(deps: DepsFila): Promise<void> {
  if (!emAndamento) {
    emAndamento = rodar(deps).finally(() => {
      emAndamento = null;
    });
  }
  return emAndamento;
}

async function rodar(deps: DepsFila): Promise<void> {
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
      if (erroDeNegocio(e)) {
        await atualizar(item.id, { erro: { mensagem: mensagemErro(e), negocio: true } });
        continue;
      }
      await atualizar(item.id, {
        tentativas: item.tentativas + 1,
        erro: { mensagem: mensagemErro(e), negocio: false },
      });
      return;
    }
  }
}

/** Libera um item parado por erro de negócio para tentar de novo (com os mesmos dados ou corrigidos). */
export async function liberarItem(id: string, acoes?: ItemFila['acoes']): Promise<void> {
  await atualizar(id, { erro: null, ...(acoes ? { acoes } : {}) });
}
