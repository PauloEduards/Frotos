import { StyleSheet, Text, View } from 'react-native';

import type { Barra } from '@/features/gastos/agregar';
import { cores, espaco } from '@/lib/tema';

const ALTURA_MAXIMA = 140;

type Props = { barras: Barra[]; formatarValor: (n: number) => string };

export function GraficoBarras({ barras, formatarValor }: Props) {
  const maior = Math.max(0, ...barras.map((b) => b.total));
  return (
    <View style={estilos.grafico}>
      {barras.map((b, i) => {
        const altura = maior > 0 ? Math.max(b.total > 0 ? 4 : 0, (b.total / maior) * ALTURA_MAXIMA) : 0;
        return (
          <View key={`${b.rotulo}-${i}`} style={estilos.coluna} testID="barra">
            <Text style={estilos.valor} numberOfLines={1}>
              {formatarValor(b.total)}
            </Text>
            <View style={estilos.area}>
              <View style={[estilos.barra, { height: altura }]} />
            </View>
            <Text style={estilos.rotulo}>{b.rotulo}</Text>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  grafico: { flexDirection: 'row', gap: espaco.sm, alignItems: 'flex-end' },
  coluna: { flex: 1, alignItems: 'center', gap: espaco.xs },
  valor: { fontSize: 11, color: cores.textoSecundario },
  area: { height: ALTURA_MAXIMA, justifyContent: 'flex-end', alignSelf: 'stretch', alignItems: 'center' },
  barra: { width: '70%', backgroundColor: cores.primaria, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  rotulo: { fontSize: 12, color: cores.texto },
});
