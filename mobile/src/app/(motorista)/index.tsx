import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/componentes/Botao';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { cores, espaco } from '@/lib/tema';
import { useSair } from '@/sessao/useSair';
import { useSessao } from '@/sessao/useSessao';

export default function InicioMotorista() {
  const { carregando, sessao, perfil } = useSessao();
  const { aoSair, erroSair, saindo } = useSair();

  if (carregando) return <Carregando />;
  if (!sessao) return <Redirect href="/(auth)/entrar" />;
  // Sem perfil (falha ao carregar) ou de outro papel: a raiz decide o que mostrar.
  if (perfil?.papel !== 'motorista') return <Redirect href="/" />;

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>Olá, {perfil.nome}!</Text>
      <Text style={estilos.texto}>O app do motorista chega em breve.</Text>
      {erroSair ? <MensagemErro texto={erroSair} /> : null}
      <Botao titulo="Sair" variante="secundario" onPress={() => void aoSair()} carregando={saindo} />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: espaco.xl,
    gap: espaco.lg,
    backgroundColor: cores.fundo,
  },
  titulo: { fontSize: 24, fontWeight: '700', color: cores.texto },
  texto: { fontSize: 16, color: cores.textoSecundario },
});
