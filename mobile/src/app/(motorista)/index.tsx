import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { minhaSituacao } from '@/api/motorista';
import { Botao } from '@/componentes/Botao';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';

/** Decide o grupo de abas: sem frota → Buscar carros; na frota → Meu carro. */
export default function InicioMotorista() {
  const situacao = useQuery({ queryKey: ['situacao'], queryFn: minhaSituacao });

  if (situacao.isError) {
    return (
      <View style={estilos.container}>
        <MensagemErro texto={mensagemErro(situacao.error)} />
        <Botao titulo="Tentar de novo" onPress={() => void situacao.refetch()} />
      </View>
    );
  }
  if (!situacao.data) return <Carregando />;
  if (situacao.data.frotaAtiva) return <Redirect href="/(motorista)/(frota)/meu-carro" />;
  return <Redirect href="/(motorista)/(busca)/buscar" />;
}

const estilos = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.lg, backgroundColor: cores.fundo },
});
