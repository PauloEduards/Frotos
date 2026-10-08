import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, espaco } from '@/lib/tema';

import { Placa } from './Placa';

export type CarroDoCard = {
  /** Sem placa na busca pública. */
  placa?: string | null;
  marca: string;
  modelo: string;
  ano_modelo?: number | null;
  cor?: string | null;
  fotoUrl?: string | null;
};

type Props = {
  carro: CarroDoCard;
  /** Selo de status, "Livre" etc. */
  selo?: ReactNode;
  /** Linha extra embaixo (frota, motorista, próxima manutenção...). */
  rodape?: ReactNode;
  onPress?: () => void;
  tamanhoPlaca?: 'pequena' | 'grande';
};

export function CardCarro({ carro, selo, rodape, onPress, tamanhoPlaca }: Props) {
  const detalhe = [carro.ano_modelo, carro.cor].filter(Boolean).join(' · ');
  const conteudo = (
    <View style={estilos.card}>
      <View style={estilos.info}>
        {carro.placa ? <Placa texto={carro.placa} tamanho={tamanhoPlaca} /> : null}
        <Text style={estilos.modelo}>{`${carro.marca} ${carro.modelo}`}</Text>
        {detalhe ? <Text style={estilos.detalhe}>{detalhe}</Text> : null}
        {selo ? <View style={estilos.selo}>{selo}</View> : null}
        {rodape ? <View>{rodape}</View> : null}
      </View>
      <View style={estilos.fotoArea}>
        {carro.fotoUrl ? (
          <Image testID="foto-carro" source={{ uri: carro.fotoUrl }} style={estilos.foto} accessibilityLabel="Foto do carro" />
        ) : (
          <View testID="sem-foto" style={[estilos.foto, estilos.semFoto]} accessibilityLabel="Carro sem foto">
            <Ionicons name="car" size={36} color={cores.textoSecundario} />
          </View>
        )}
      </View>
    </View>
  );
  if (!onPress) return conteudo;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.md,
    gap: espaco.md,
  },
  info: { flex: 1, gap: espaco.xs },
  modelo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: 14, color: cores.textoSecundario },
  selo: { flexDirection: 'row', marginTop: espaco.xs },
  fotoArea: { justifyContent: 'flex-end' },
  foto: { width: 96, height: 72, borderRadius: 8 },
  semFoto: { backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center' },
});
