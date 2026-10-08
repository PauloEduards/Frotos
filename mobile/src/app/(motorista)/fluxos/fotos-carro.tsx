import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { iniciarRetirada } from '@/api/meuCarro';
import { SequenciaFotos, type FotoDaSequencia } from '@/componentes/SequenciaFotos';
import { adicionar } from '@/fila/fila';
import { useFila } from '@/fila/useFila';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';
import { novoCaminho } from '@/lib/upload';

type Params = { momento: 'retirada' | 'devolucao'; carro: string; frota: string; vinculo?: string };

function erroDeRede(e: unknown): boolean {
  return e instanceof TypeError || /Network request failed|Failed to fetch/i.test(String((e as Error)?.message ?? ''));
}

/** Retirada ou devolução guiada. As fotos vão pela fila offline; a retirada precisa de internet só para começar. */
export default function FotosCarro() {
  const { momento, carro, frota, vinculo } = useLocalSearchParams<Params>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { enviarAgora } = useFila();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoConcluir(fotos: FotoDaSequencia[], km: number) {
    setErro(null);
    setEnviando(true);
    try {
      let vinculoId = vinculo;
      if (!vinculoId) {
        try {
          vinculoId = await iniciarRetirada(carro, km);
        } catch (e) {
          setErro(erroDeRede(e) ? 'Conecte-se à internet para iniciar a retirada.' : mensagemErro(e));
          return;
        }
      }

      const comCaminho = fotos.map((f) => ({
        ...f,
        path: novoCaminho(frota, carro, f.posicao === 'painel' ? 'painel' : 'inspecao'),
      }));
      const acaoFinal =
        momento === 'retirada'
          ? { rpc: 'concluir_retirada', args: { p_assignment_id: vinculoId } }
          : { rpc: 'devolver_carro', args: { p_assignment_id: vinculoId, p_km: km } };

      await adicionar({
        tipo: momento,
        criadoEm: new Date().toISOString(),
        fotos: comCaminho.map((f) => ({
          uri: f.uri,
          bucket: 'fotos',
          path: f.path,
          enviada: false,
          capturadoEm: f.capturadoEm,
          posicao: f.posicao,
        })),
        acoes: [
          {
            rpc: 'registrar_fotos_inspecao',
            args: {
              p_assignment_id: vinculoId,
              p_momento: momento,
              p_fotos: comCaminho.map((f) => ({ posicao: f.posicao, path: f.path, capturado_em: f.capturadoEm })),
            },
          },
          acaoFinal,
        ],
      });
      void enviarAgora().finally(() => void queryClient.invalidateQueries({ queryKey: ['meu-carro'] }));
      await queryClient.invalidateQueries({ queryKey: ['meu-carro'] });
      router.replace('/(motorista)/(frota)/meu-carro');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={estilos.fundo} contentContainerStyle={estilos.conteudo}>
      <SequenciaFotos momento={momento} onConcluir={(f, km) => void aoConcluir(f, km)} enviando={enviando} erro={erro} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg },
});
