import { StyleSheet, Text } from 'react-native';

import { espaco } from '@/lib/tema';

export function MensagemErro({ texto }: { texto: string }) {
  return (
    <Text accessibilityRole="alert" style={estilos.texto}>
      {texto}
    </Text>
  );
}

const estilos = StyleSheet.create({
  texto: { color: '#C62828', fontSize: 14, paddingVertical: espaco.xs },
});
