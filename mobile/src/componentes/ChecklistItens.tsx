import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, espaco } from '@/lib/tema';

type Props = {
  itens: { id: string; nome: string }[];
  marcados: Set<string>;
  onAlternar: (id: string) => void;
};

/** Lista de itens do carro com caixa de marcação. */
export function ChecklistItens({ itens, marcados, onAlternar }: Props) {
  return (
    <View style={estilos.lista}>
      {itens.map((i) => (
        <LinhaMarcavel key={i.id} rotulo={i.nome} marcado={marcados.has(i.id)} onPress={() => onAlternar(i.id)} />
      ))}
    </View>
  );
}

export function LinhaMarcavel({
  rotulo,
  marcado,
  onPress,
}: {
  rotulo: string;
  marcado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: marcado }}
      onPress={onPress}
      style={estilos.linha}
    >
      <View style={[estilos.caixa, marcado && estilos.caixaMarcada]}>
        {marcado ? <Text style={estilos.visto}>✓</Text> : null}
      </View>
      <Text style={estilos.rotulo}>{rotulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.sm },
  linha: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingHorizontal: espaco.md,
  },
  caixa: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaMarcada: { backgroundColor: cores.primaria },
  visto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  rotulo: { flex: 1, fontSize: 16, color: cores.texto },
});
