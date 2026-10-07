import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores } from '@/lib/tema';

type Props = {
  path: string;
  /** Endereços assinados, indexados pelo caminho (ver `urlsAssinadas`). */
  urls: Record<string, string>;
  /** Descrição para leitores de tela; também identifica a foto nos testes. */
  descricao?: string;
};

export function FotoRemota({ path, urls, descricao = 'Foto' }: Props) {
  const [aberta, setAberta] = useState(false);
  const url = urls[path];

  if (!url) {
    return (
      <View
        accessibilityLabel={`${descricao} (indisponível)`}
        style={[estilos.miniatura, estilos.indisponivel]}
      >
        <Text style={estilos.textoIndisponivel}>Sem imagem</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={descricao} onPress={() => setAberta(true)}>
        <Image source={{ uri: url }} style={estilos.miniatura} />
      </Pressable>
      <Modal visible={aberta} transparent animationType="fade" onRequestClose={() => setAberta(false)}>
        <View style={estilos.fundo}>
          <Image source={{ uri: url }} style={estilos.cheia} resizeMode="contain" accessibilityLabel={descricao} />
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setAberta(false)} style={estilos.fechar}>
            <Text style={estilos.textoFechar}>Fechar</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  miniatura: { width: 96, height: 96, borderRadius: 8, backgroundColor: cores.borda },
  indisponivel: { alignItems: 'center', justifyContent: 'center' },
  textoIndisponivel: { fontSize: 12, color: cores.textoSecundario },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  cheia: { width: '100%', height: '85%' },
  fechar: { position: 'absolute', top: 48, right: 16, paddingVertical: 10, paddingHorizontal: 16 },
  textoFechar: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
