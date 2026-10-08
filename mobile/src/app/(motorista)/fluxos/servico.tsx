import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { listarItens } from '@/api/veiculos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { CampoFoto } from '@/componentes/CampoFoto';
import { ChecklistItens } from '@/componentes/ChecklistItens';
import { MensagemErro } from '@/componentes/MensagemErro';
import { adicionar } from '@/fila/fila';
import { useFila } from '@/fila/useFila';
import type { FotoCapturada } from '@/lib/camera';
import { hojeBrt, lerReais, valorMuitoAlto } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';
import { novoCaminho } from '@/lib/upload';

type Erros = Partial<Record<'itens' | 'km' | 'valor' | 'nota', string>>;

/** Serviço feito pelo motorista (com pedido do dono ou permissão). A foto da nota é obrigatória. */
export default function Servico() {
  const { carro, frota, pedido } = useLocalSearchParams<{ carro: string; frota: string; pedido?: string }>();
  const router = useRouter();
  const { enviarAgora } = useFila();
  const itens = useQuery({ queryKey: ['itens', carro], queryFn: () => listarItens(carro) });
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [km, setKm] = useState('');
  const [valor, setValor] = useState('');
  const [oficina, setOficina] = useState('');
  const [nota, setNota] = useState<FotoCapturada | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function registrar() {
    const novos: Erros = {};
    if (marcados.size === 0) novos.itens = 'Marque pelo menos um serviço.';
    const kmNumero = /^\d+$/.test(km.trim()) ? Number(km.trim()) : null;
    if (kmNumero === null) novos.km = 'Informe o km.';
    const valorNumero = lerReais(valor);
    if (valorNumero === null) novos.valor = 'Informe o valor.';
    else if (valorMuitoAlto(valorNumero)) novos.valor = 'Valor muito alto.';
    if (!nota) novos.nota = 'Tire a foto da nota ou do serviço feito.';
    setErros(novos);
    if (Object.keys(novos).length > 0 || !nota || kmNumero === null || valorNumero === null) return;

    setEnviando(true);
    try {
      const path = novoCaminho(frota, carro, 'nota');
      await adicionar({
        tipo: 'servico',
        criadoEm: new Date().toISOString(),
        fotos: [{ uri: nota.uri, bucket: 'fotos', path, enviada: false, capturadoEm: nota.capturadoEm }],
        acoes: [
          {
            rpc: 'registrar_servico',
            args: {
              p_vehicle_id: carro,
              p_itens: [...marcados].map((id) => ({ vehicle_item_id: id })),
              p_km: kmNumero,
              p_data: hojeBrt(),
              p_valor_total: valorNumero,
              p_request_id: pedido ?? null,
              p_oficina: oficina.trim() || null,
              p_nota_foto_path: path,
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
        <Text style={estilos.titulo}>O que foi feito?</Text>
        <ChecklistItens itens={itens.data ?? []} marcados={marcados} onAlternar={alternar} />
        {erros.itens ? <MensagemErro texto={erros.itens} /> : null}
        <Campo rotulo="Km do painel" tipo="numero" valor={km} onChange={setKm} erro={erros.km} />
        <Campo rotulo="Valor total (R$)" tipo="numero" valor={valor} onChange={setValor} erro={erros.valor} />
        <Campo rotulo="Oficina (opcional)" valor={oficina} onChange={setOficina} />
        <CampoFoto titulo="Tirar foto da nota" icone="receipt" uri={nota?.uri} onFoto={setNota} erro={erros.nota} />
        <Botao titulo="Registrar" onPress={() => void registrar()} carregando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  titulo: { fontSize: 18, fontWeight: '700', color: cores.texto },
});
