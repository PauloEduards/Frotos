import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { cores, espaco } from '@/lib/tema';

type Props = {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  variante?: 'primario' | 'secundario' | 'perigo';
};

const PERIGO = '#C62828';

export function Botao({ titulo, onPress, carregando = false, variante = 'primario' }: Props) {
  const corFundo =
    variante === 'primario' ? cores.primaria : variante === 'perigo' ? PERIGO : 'transparent';
  const corTexto = variante === 'secundario' ? cores.primaria : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: carregando, busy: carregando }}
      disabled={carregando}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: corFundo },
        variante === 'secundario' && { borderWidth: 1, borderColor: cores.primaria },
        (pressed || carregando) && { opacity: 0.7 },
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <Text style={[estilos.texto, { color: corTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: espaco.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: 16, fontWeight: '600' },
});
