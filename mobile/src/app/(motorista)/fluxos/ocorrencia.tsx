import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { adicionar } from '@/fila/fila';
import { useFila } from '@/fila/useFila';
import { capturarFoto, type FotoCapturada } from '@/lib/camera';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';
import { novoCaminho } from '@/lib/upload';

type Tipo = 'mecanico' | 'acidente_leve' | 'acidente_grave' | 'outro';
const TIPOS: { valor: Tipo; rotulo: string }[] = [
  { valor: 'mecanico', rotulo: 'Barulho/mecânico' },
  { valor: 'acidente_leve', rotulo: 'Acidente leve' },
  { valor: 'acidente_grave', rotulo: 'Acidente grave' },
  { valor: 'outro', rotulo: 'Outro' },
];
const MAX_FOTOS = 5;

export default function Ocorrencia() {
  const { carro, frota } = useLocalSearchParams<{ carro: string; frota: string }>();
  const router = useRouter();
  const { enviarAgora } = useFila();
  const [tipo, setTipo] = useState<Tipo>('mecanico');
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<FotoCapturada[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDescricao, setErroDescricao] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function adicionarFoto() {
    setErro(null);
    try {
      const f = await capturarFoto();
      if (f) setFotos((atual) => [...atual, f].slice(0, MAX_FOTOS));
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  async function enviar() {
    if (!descricao.trim()) {
      setErroDescricao('Descreva o que aconteceu.');
      return;
    }
    setErroDescricao(undefined);
    setEnviando(true);
    try {
      const id = randomUUID();
      const comCaminho = fotos.map((f) => ({ ...f, path: novoCaminho(frota, carro, 'ocorrencia') }));
      await adicionar({
        tipo: 'ocorrencia',
        criadoEm: new Date().toISOString(),
        fotos: comCaminho.map((f) => ({ uri: f.uri, bucket: 'fotos', path: f.path, enviada: false, capturadoEm: f.capturadoEm })),
        acoes: [
          {
            rpc: 'relatar_ocorrencia',
            args: {
              p_vehicle_id: carro,
              p_tipo: tipo,
              p_descricao: descricao.trim(),
              p_id: id,
              p_fotos: comCaminho.map((f) => ({ path: f.path, capturado_em: f.capturadoEm })),
            },
          },
        ],
      });
      void enviarAgora();
      router.back();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Seletor rotulo="O que houve?" opcoes={TIPOS} valor={tipo} onChange={setTipo} quebrarLinha />
        <Campo rotulo="O que aconteceu?" valor={descricao} onChange={setDescricao} erro={erroDescricao} multiline />
        <View style={estilos.fotos}>
          {fotos.map((f, i) => (
            <Image key={f.uri + i} source={{ uri: f.uri }} style={estilos.foto} accessibilityLabel={`Foto ${i + 1}`} />
          ))}
          {fotos.length < MAX_FOTOS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Adicionar foto"
              onPress={() => void adicionarFoto()}
              style={[estilos.foto, estilos.adicionar]}
            >
              <Ionicons name="camera" size={28} color={cores.primaria} />
            </Pressable>
          ) : null}
        </View>
        {erro ? <MensagemErro texto={erro} /> : null}
        <Botao titulo="Enviar" onPress={() => void enviar()} carregando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  foto: { width: 96, height: 96, borderRadius: 8 },
  adicionar: { borderWidth: 2, borderStyle: 'dashed', borderColor: cores.primaria, alignItems: 'center', justifyContent: 'center' },
});
