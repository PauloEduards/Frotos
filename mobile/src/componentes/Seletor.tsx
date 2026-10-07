import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, espaco } from '@/lib/tema';

type Props<T extends string> = {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (valor: T) => void;
  rotulo?: string;
};

export function Seletor<T extends string>({ opcoes, valor, onChange, rotulo }: Props<T>) {
  return (
    <View style={estilos.container}>
      {rotulo ? <Text style={estilos.rotulo}>{rotulo}</Text> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={estilos.linha}>
        {opcoes.map((o) => {
          const marcada = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: marcada }}
              onPress={() => onChange(o.valor)}
              style={[estilos.opcao, marcada && estilos.opcaoMarcada]}
            >
              <Text style={[estilos.texto, marcada && estilos.textoMarcado]}>{o.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: espaco.xs },
  rotulo: { fontSize: 14, color: cores.textoSecundario },
  linha: { flexDirection: 'row', gap: espaco.sm },
  opcao: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: espaco.sm,
  },
  opcaoMarcada: { borderColor: cores.primaria, backgroundColor: '#E3F2FD' },
  texto: { fontSize: 15, color: cores.texto, textAlign: 'center' },
  textoMarcado: { color: cores.primaria, fontWeight: '600' },
});
