import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { cores } from '@/lib/tema';

export function Carregando() {
  return (
    <View style={estilos.container} accessibilityLabel="Carregando">
      <ActivityIndicator size="large" color={cores.primaria} />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
});
