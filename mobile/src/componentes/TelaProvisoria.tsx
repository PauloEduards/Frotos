import { StyleSheet, Text, View } from 'react-native';

import { cores, espaco } from '@/lib/tema';

// Tela simples com o título; as próximas tasks substituem cada uma pela tela real.
export function TelaProvisoria({ titulo }: { titulo: string }) {
  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>{titulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.xl,
    backgroundColor: cores.fundo,
  },
  titulo: { fontSize: 20, fontWeight: '600', color: cores.texto },
});
