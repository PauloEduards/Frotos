import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { capturarFoto, type FotoCapturada } from '@/lib/camera';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';

import { MensagemErro } from './MensagemErro';

type Props = {
  /** Texto do botão quando ainda não há foto. */
  titulo: string;
  uri?: string | null;
  onFoto: (foto: FotoCapturada) => void;
  erro?: string;
  /** Ícone ou ilustração do ângulo esperado. */
  icone?: keyof typeof Ionicons.glyphMap;
};

/** Área grande para tirar (ou refazer) uma foto pela câmera, com a prévia. */
export function CampoFoto({ titulo, uri, onFoto, erro, icone = 'camera' }: Props) {
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  async function tirar() {
    if (abrindo) return;
    setErroCamera(null);
    setAbrindo(true);
    try {
      const foto = await capturarFoto();
      if (foto) onFoto(foto);
    } catch (e) {
      setErroCamera(mensagemErro(e));
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <View style={estilos.grupo}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Refazer foto' : titulo}
        onPress={tirar}
        style={[estilos.area, erro ? estilos.areaErro : null]}
      >
        {uri ? (
          <Image source={{ uri }} style={estilos.previa} accessibilityLabel="Prévia da foto" />
        ) : (
          <View style={estilos.vazia}>
            <Ionicons name={icone} size={40} color={cores.primaria} />
            <Text style={estilos.titulo}>{titulo}</Text>
          </View>
        )}
      </Pressable>
      {uri ? (
        <Pressable accessibilityRole="button" onPress={tirar} style={estilos.refazer}>
          <Ionicons name="refresh" size={16} color={cores.primaria} />
          <Text style={estilos.refazerTexto}>Refazer foto</Text>
        </Pressable>
      ) : null}
      {erro ? <MensagemErro texto={erro} /> : null}
      {erroCamera ? <MensagemErro texto={erroCamera} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco.sm },
  area: {
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: cores.primaria,
    backgroundColor: '#E3F2FD',
    overflow: 'hidden',
  },
  areaErro: { borderColor: '#C62828' },
  vazia: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espaco.sm },
  titulo: { fontSize: 16, fontWeight: '600', color: cores.primaria },
  previa: { width: '100%', height: '100%' },
  refazer: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs, alignSelf: 'flex-start', minHeight: 40 },
  refazerTexto: { fontSize: 15, color: cores.primaria, fontWeight: '600' },
});
