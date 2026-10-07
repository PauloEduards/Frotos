import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { criarPedido } from '@/api/manutencao';
import { buscarVeiculo, listarItens, previsaoItens, resumoFrota } from '@/api/veiculos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { ChecklistItens } from '@/componentes/ChecklistItens';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { dataBrParaIso, hojeBrt, mascararData } from '@/lib/formatos';
import { invalidarDadosDaFrota } from '@/lib/invalidar';
import { cores, espaco } from '@/lib/tema';

const STATUS_PRE_MARCADOS = ['proximo', 'urgente', 'vencido'];

export default function PedidoManutencao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const veiculoQ = useQuery({ queryKey: ['veiculos', 'detalhe', id], queryFn: () => buscarVeiculo(id) });
  const fleetId = veiculoQ.data?.fleet_id;
  const resumoQ = useQuery({
    queryKey: ['veiculos', 'resumo', fleetId],
    queryFn: () => resumoFrota(fleetId as string),
    enabled: !!fleetId,
  });
  const itensQ = useQuery({ queryKey: ['itens', id], queryFn: () => listarItens(id) });
  const previsaoQ = useQuery({ queryKey: ['veiculos', 'previsao', id], queryFn: () => previsaoItens(id) });

  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const [prazo, setPrazo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState<{ itens?: string; prazo?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const enviarPedido = useMutation({
    mutationFn: (d: { itens: string[]; prazo: string; observacao?: string }) =>
      criarPedido(id, d.itens, d.prazo, d.observacao),
    onSuccess: async () => {
      await invalidarDadosDaFrota(queryClient);
      router.back();
    },
    onError: (e) => setErroGeral(mensagemErro(e)),
  });

  const consultas = [veiculoQ, resumoQ, itensQ, previsaoQ];
  const falha = consultas.find((c) => c.isError);
  if (falha) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <MensagemErro texto={mensagemErro(falha.error)} />
          <Botao
            titulo="Tentar de novo"
            onPress={() => consultas.filter((c) => c.isError).forEach((c) => void c.refetch())}
          />
        </View>
      </View>
    );
  }
  if (consultas.some((c) => c.isPending)) return <Carregando />;

  const resumo = (resumoQ.data ?? []).find((r) => r.vehicle_id === id);
  const motorista = resumo?.motorista_nome ?? null;
  const itens = (itensQ.data ?? []).filter((i) => i.ativo);
  const selecionados =
    marcados ??
    new Set(
      (previsaoQ.data ?? [])
        .filter((p) => STATUS_PRE_MARCADOS.includes(p.status))
        .map((p) => p.vehicle_item_id),
    );

  function alternar(itemId: string) {
    const novo = new Set(selecionados);
    if (novo.has(itemId)) novo.delete(itemId);
    else novo.add(itemId);
    setMarcados(novo);
  }

  function enviar() {
    setErroGeral(null);
    const escolhidos = itens.filter((i) => selecionados.has(i.id)).map((i) => i.id);
    const e: { itens?: string; prazo?: string } = {};
    if (escolhidos.length === 0) e.itens = 'Marque pelo menos um item.';
    const prazoIso = prazo.trim() ? dataBrParaIso(prazo) : null;
    if (!prazo.trim()) e.prazo = 'Informe o prazo.';
    else if (!prazoIso) e.prazo = 'Informe uma data válida.';
    else if (prazoIso < hojeBrt()) e.prazo = 'O prazo precisa ser hoje ou depois.';
    setErros(e);
    if (e.itens || e.prazo || !prazoIso) return;
    enviarPedido.mutate({ itens: escolhidos, prazo: prazoIso, observacao: observacao.trim() || undefined });
  }

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      {motorista ? (
        <Text style={estilos.apoio}>{`Motorista: ${motorista}`}</Text>
      ) : (
        <Text style={estilos.aviso}>
          Este carro está sem motorista. O pedido vai para quem estiver com ele.
        </Text>
      )}

      <Text accessibilityRole="header" style={estilos.titulo}>
        O que precisa ser feito?
      </Text>
      <ChecklistItens itens={itens} marcados={selecionados} onAlternar={alternar} />
      {erros.itens ? <MensagemErro texto={erros.itens} /> : null}

      <Campo
        rotulo="Prazo"
        valor={prazo}
        onChange={(t) => setPrazo(mascararData(t))}
        tipo="numero"
        erro={erros.prazo}
      />
      <Campo rotulo="Observação (opcional)" valor={observacao} onChange={setObservacao} />

      {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
      <Botao
        titulo="Enviar pedido"
        onPress={enviar}
        desabilitado={!motorista}
        carregando={enviarPedido.isPending}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  titulo: { fontSize: 20, fontWeight: '700', color: cores.texto },
  apoio: { fontSize: 15, color: cores.textoSecundario },
  aviso: { fontSize: 15, fontWeight: '600', color: '#EF6C00' },
});
