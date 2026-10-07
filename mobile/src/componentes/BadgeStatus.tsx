import { StyleSheet, Text, View } from 'react-native';

import { corStatus, rotuloStatus, type StatusItem } from '@/lib/status';

// Fundo na cor do status com texto branco; o amarelo (#F9A825) pede texto escuro para ter contraste.
const TEXTO_ESCURO: StatusItem[] = ['proximo'];

export function BadgeStatus({ status }: { status: StatusItem }) {
  const cor = TEXTO_ESCURO.includes(status) ? '#212121' : '#FFFFFF';
  return (
    <View style={[estilos.badge, { backgroundColor: corStatus(status) }]}>
      <Text style={[estilos.texto, { color: cor }]}>{rotuloStatus(status)}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  texto: { fontSize: 13, fontWeight: '700' },
});
