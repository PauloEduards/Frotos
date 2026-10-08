import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { carrosParaMim, meuCarro } from '@/api/meuCarro';
import { Botao } from '@/componentes/Botao';
import { CardCarro } from '@/componentes/CardCarro';
import { Carregando } from '@/componentes/Carregando';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { useUrlsAssinadas } from '@/lib/useUrlsAssinadas';

/** Carros da frota liberados para o motorista (revezamento). */
export default function Carros() {
  const router = useRouter();
  const carros = useQuery({ queryKey: ['meu-carro', 'carros'], queryFn: carrosParaMim });
  const estado = useQuery({ queryKey: ['meu-carro'], queryFn: meuCarro });
  useRefreshOnFocus(() => {
    void carros.refetch();
    void estado.refetch();
  });
  const caminhos = (carros.data ?? []).map((c) => c.foto_path).filter((p): p is string => !!p);
  const fotos = useUrlsAssinadas(caminhos, caminhos.length > 0, 'carros');

  if (carros.isPending || estado.isPending) return <Carregando />;
  const comCarro = !!estado.data?.vinculo;

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void carros.refetch()} />}
    >
      {carros.isError ? <MensagemErro texto={mensagemErro(carros.error)} /> : null}
      {comCarro ? <Text style={estilos.aviso}>Você já está com um carro. Devolva-o para pegar outro.</Text> : null}
      {carros.data && carros.data.length === 0 ? <ListaVazia texto="Nenhum carro liberado para você no momento." /> : null}
      {(carros.data ?? []).map((c) => (
        <View key={c.vehicle_id} style={estilos.item}>
          <CardCarro
            carro={{ ...c, fotoUrl: c.foto_path ? fotos.urls[c.foto_path] ?? null : null }}
            selo={<Text style={c.em_uso ? estilos.emUso : estilos.livre}>{c.em_uso ? 'Em uso' : 'Livre'}</Text>}
          />
          {!comCarro && !c.em_uso ? (
            <Botao
              titulo="Pegar este carro"
              onPress={() =>
                router.push(`/(motorista)/fluxos/fotos-carro?momento=retirada&carro=${c.vehicle_id}&frota=${c.fleet_id}`)
              }
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  item: { gap: espaco.sm },
  aviso: { fontSize: 15, color: cores.texto, fontWeight: '600' },
  livre: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  emUso: { fontSize: 14, fontWeight: '700', color: cores.textoSecundario },
});
