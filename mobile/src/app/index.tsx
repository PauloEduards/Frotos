import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { sair } from '@/api/auth';
import { Botao } from '@/componentes/Botao';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { cores, espaco } from '@/lib/tema';
import { useSessao } from '@/sessao/useSessao';

export default function Inicio() {
  const { carregando, sessao, perfil, recarregarPerfil } = useSessao();

  if (carregando) return <Carregando />;
  if (!sessao) return <Redirect href="/(auth)/entrar" />;
  if (!perfil) {
    return (
      <View style={estilos.container}>
        <MensagemErro texto="Não foi possível carregar seu perfil." />
        <Botao titulo="Tentar de novo" onPress={() => void recarregarPerfil()} />
        <Botao titulo="Sair" variante="secundario" onPress={() => void sair().catch(() => {})} />
      </View>
    );
  }
  if (perfil.papel === 'proprietario') return <Redirect href="/(dono)/(abas)" />;
  return <Redirect href="/(motorista)" />;
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: espaco.xl,
    gap: espaco.md,
    backgroundColor: cores.fundo,
  },
});
