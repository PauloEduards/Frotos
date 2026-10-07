import { StyleSheet, Text } from 'react-native';

import { cores, espaco } from '@/lib/tema';

export function ListaVazia({ texto }: { texto: string }) {
  return <Text style={estilos.texto}>{texto}</Text>;
}

const estilos = StyleSheet.create({
  texto: {
    fontSize: 15,
    color: cores.textoSecundario,
    textAlign: 'center',
    paddingVertical: espaco.lg,
  },
});
