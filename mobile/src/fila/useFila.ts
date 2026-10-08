import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/cliente';
import { enviarFoto } from '@/lib/upload';

import { aoMudarFila, descartar as descartarItem, listar, type ItemFila } from './fila';
import { corrigirKm, liberarItem, processarFila, type DepsFila } from './processar';

const depsPadrao: DepsFila = {
  enviarFoto,
  chamarRpc: async (rpc, args) => {
    // Lança o erro cru do PostgREST: o código P0001 distingue erro de negócio de falha de rede.
    const { error } = await supabase.rpc(rpc as never, args as never);
    if (error) throw error;
  },
};

/** Estado da fila offline e ações; envia ao abrir, ao voltar para o app e com nova tentativa progressiva. */
export function useFila(deps: DepsFila = depsPadrao) {
  const [itens, setItens] = useState<ItemFila[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recarregar = useCallback(async () => setItens(await listar()), []);

  const enviarAgora = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await processarFila(deps);
    const restantes = await listar();
    setItens(restantes);
    const comFalhaDeRede = restantes.find((i) => i.erro && !i.erro.negocio);
    if (comFalhaDeRede) {
      const segundos = Math.min(2 ** comFalhaDeRede.tentativas, 60);
      timer.current = setTimeout(() => void enviarAgora(), segundos * 1000);
    }
  }, [deps]);

  useEffect(() => {
    void enviarAgora();
    const parar = aoMudarFila(() => void recarregar());
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void enviarAgora();
    });
    return () => {
      parar();
      app.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enviarAgora, recarregar]);

  return {
    itens,
    pendentes: itens.filter((i) => !i.erro?.negocio).length,
    enviarAgora,
    tentarDeNovo: async (id: string) => {
      await liberarItem(id);
      await enviarAgora();
    },
    corrigirKm: async (id: string, km: number) => {
      await corrigirKm(id, km);
      await enviarAgora();
    },
    descartar: async (id: string) => {
      await descartarItem(id);
      await recarregar();
    },
  };
}
