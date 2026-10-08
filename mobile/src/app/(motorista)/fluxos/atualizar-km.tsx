import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { CampoFoto } from '@/componentes/CampoFoto';
import { adicionar } from '@/fila/fila';
import { useFila } from '@/fila/useFila';
import type { FotoCapturada } from '@/lib/camera';
import { formatarKm } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';
import { novoCaminho } from '@/lib/upload';

export default function AtualizarKm() {
  const { carro, frota, km: kmAtual } = useLocalSearchParams<{ carro: string; frota: string; km?: string }>();
  const router = useRouter();
  const { enviarAgora } = useFila();
  const [foto, setFoto] = useState<FotoCapturada | null>(null);
  const [km, setKm] = useState('');
  const [erroFoto, setErroFoto] = useState<string | undefined>();
  const [erroKm, setErroKm] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const numero = /^\d+$/.test(km.trim()) ? Number(km.trim()) : null;
    setErroFoto(foto ? undefined : 'Tire a foto do painel.');
    const minimo = kmAtual ? Number(kmAtual) : undefined;
    const menor = numero !== null && minimo !== undefined && numero < minimo;
    setErroKm(
      numero === null
        ? 'Informe o km.'
        : menor
          ? `O km não pode ser menor que o atual do carro (${formatarKm(minimo as number)}).`
          : undefined,
    );
    if (!foto || numero === null || menor) return;
    setEnviando(true);
    try {
      const path = novoCaminho(frota, carro, 'painel');
      await adicionar({
        tipo: 'km',
        criadoEm: new Date().toISOString(),
        fotos: [{ uri: foto.uri, bucket: 'fotos', path, enviada: false, capturadoEm: foto.capturadoEm, posicao: 'painel' }],
        acoes: [
          {
            rpc: 'registrar_km',
            args: {
              p_vehicle_id: carro,
              p_km: numero,
              p_origem: 'atualizacao',
              p_foto_painel_path: path,
              p_capturado_em: foto.capturadoEm,
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
        <Text style={estilos.dica}>Com o carro ligado, fotografe o painel mostrando o km.</Text>
        <CampoFoto titulo="Tirar foto do painel" icone="speedometer" uri={foto?.uri} onFoto={setFoto} erro={erroFoto} />
        <Campo rotulo="Km do painel" tipo="numero" valor={km} onChange={setKm} erro={erroKm} />
        <Botao titulo="Enviar" onPress={() => void enviar()} carregando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  dica: { fontSize: 15, color: cores.textoSecundario },
});
