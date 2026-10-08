import { Platform, StyleSheet, Text, View } from 'react-native';

type Props = { texto: string; tamanho?: 'pequena' | 'grande' };

/** Placa no padrão Mercosul: fundo branco, faixa azul "BRASIL" e caracteres grandes. */
export function Placa({ texto, tamanho = 'pequena' }: Props) {
  const grande = tamanho === 'grande';
  return (
    <View accessibilityLabel={`Placa ${texto}`} style={[estilos.placa, grande && estilos.placaGrande]}>
      <View style={estilos.faixa}>
        <Text style={[estilos.brasil, grande && estilos.brasilGrande]}>BRASIL</Text>
      </View>
      <Text style={[estilos.texto, grande && estilos.textoGrande]}>{texto}</Text>
    </View>
  );
}

const fonteMono = Platform.select({ ios: 'Menlo', default: 'monospace' });

const estilos = StyleSheet.create({
  placa: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#212121',
    borderWidth: 2,
    borderRadius: 6,
    overflow: 'hidden',
    minWidth: 104,
  },
  placaGrande: { minWidth: 168, borderWidth: 3 },
  faixa: { backgroundColor: '#1565C0', alignItems: 'center', paddingVertical: 1 },
  brasil: { color: '#FFFFFF', fontSize: 8, fontWeight: '700', letterSpacing: 2 },
  brasilGrande: { fontSize: 11 },
  texto: {
    color: '#212121',
    fontFamily: fonteMono,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  textoGrande: { fontSize: 28, letterSpacing: 4 },
});
