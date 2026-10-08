import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listarAvisos, marcarLido, type Aviso } from '@/api/avisos';
import { Carregando } from '@/componentes/Carregando';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { formatarDataHoraBrt } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';

export default function AvisosMotorista() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const avisos = useQuery({ queryKey: ['avisos', 'lista'], queryFn: () => listarAvisos() });
  useRefreshOnFocus(() => void avisos.refetch());

  async function abrir(a: Aviso) {
    try {
      if (!a.lida) await marcarLido(a.id);
    } catch {
      // Marcar como lido falhou: segue para a tela mesmo assim.
    }
    void queryClient.invalidateQueries({ queryKey: ['avisos'] });
    void queryClient.invalidateQueries({ queryKey: ['meu-carro'] });
    router.push('/(motorista)/(frota)/meu-carro');
  }

  if (avisos.isPending) return <Carregando />;

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void avisos.refetch()} />}
    >
      {avisos.isError ? <MensagemErro texto={mensagemErro(avisos.error)} /> : null}
      {avisos.data && avisos.data.length === 0 ? <ListaVazia texto="Nenhum aviso por enquanto." /> : null}
      {(avisos.data ?? []).map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          onPress={() => void abrir(a)}
          style={[estilos.aviso, a.prioridade === 'alta' && estilos.alta]}
        >
          <Text style={[estilos.titulo, !a.lida && estilos.naoLido]}>{a.titulo}</Text>
          <Text style={estilos.corpo}>{a.corpo}</Text>
          <View>
            <Text style={estilos.data}>{formatarDataHoraBrt(a.criada_em)}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.md },
  aviso: { gap: espaco.xs, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: cores.borda, padding: espaco.md },
  alta: { borderLeftWidth: 6, borderLeftColor: '#C62828' },
  titulo: { fontSize: 16, color: cores.texto },
  naoLido: { fontWeight: '700' },
  corpo: { fontSize: 15, color: cores.textoSecundario },
  data: { fontSize: 13, color: cores.textoSecundario },
});
