import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { sair } from '@/api/auth';
import { Botao } from '@/componentes/Botao';
import { Carregando } from '@/componentes/Carregando';
import { cores, espaco } from '@/lib/tema';
import { useSessao } from '@/sessao/useSessao';

export default function InicioMotorista() {
  const { carregando, sessao, perfil } = useSessao();

  if (carregando) return <Carregando />;
  if (!sessao) return <Redirect href="/(auth)/entrar" />;
  if (perfil?.papel === 'proprietario') return <Redirect href="/" />;

  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>Olá, {perfil?.nome}!</Text>
      <Text style={estilos.texto}>O app do motorista chega em breve.</Text>
      <Botao titulo="Sair" variante="secundario" onPress={() => void sair().catch(() => {})} />
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
