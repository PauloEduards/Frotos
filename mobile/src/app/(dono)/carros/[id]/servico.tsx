import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { pedidosAbertos, registrarServico, type ItemServico } from '@/api/manutencao';
import { listarItens, previsaoItens } from '@/api/veiculos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { ChecklistItens, LinhaMarcavel } from '@/componentes/ChecklistItens';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { dataBrParaIso, formatarData, hojeBrt, lerReais, mascararData } from '@/lib/formatos';
import { invalidarDadosDaFrota } from '@/lib/invalidar';
import { cores, espaco } from '@/lib/tema';

const STATUS_PRE_MARCADOS = ['proximo', 'urgente', 'vencido'];

type Erros = Partial<Record<'itens' | 'outro' | 'km' | 'data' | 'valor', string>>;

export default function RegistrarServico() {
  const { id, pedido } = useLocalSearchParams<{ id: string; pedido?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const itensQ = useQuery({ queryKey: ['itens', id], queryFn: () => listarItens(id) });
  const previsaoQ = useQuery({ queryKey: ['veiculos', 'previsao', id], queryFn: () => previsaoItens(id) });
  const pedidosQ = useQuery({
    queryKey: ['veiculos', 'pedidos', id],
    queryFn: () => pedidosAbertos(id),
    enabled: !!pedido,
  });

  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const [outro, setOutro] = useState(false);
  const [nomeOutro, setNomeOutro] = useState('');
  const [km, setKm] = useState('');
  const [data, setData] = useState(() => formatarData(hojeBrt()));
  const [valor, setValor] = useState('');
  const [oficina, setOficina] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: (d: Parameters<typeof registrarServico>[0]) => registrarServico(d),
    onSuccess: async () => {
      await invalidarDadosDaFrota(queryClient);
      router.back();
    },
    onError: (e) => setErroGeral(mensagemErro(e)),
  });

  const consultas = pedido ? [itensQ, previsaoQ, pedidosQ] : [itensQ, previsaoQ];
  if (consultas.some((c) => c.isPending && !c.isError)) return <Carregando />;
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

  const itens = (itensQ.data ?? []).filter((i) => i.ativo);
  const doPedido = pedido ? pedidosQ.data?.find((p) => p.id === pedido) : undefined;
  const pedidoIndisponivel = !!pedido && !doPedido;
  const padrao = new Set(
    doPedido
      ? doPedido.itens
      : (previsaoQ.data ?? [])
          .filter((p) => STATUS_PRE_MARCADOS.includes(p.status))
          .map((p) => p.vehicle_item_id),
  );
  const selecionados = marcados ?? padrao;

  function alternar(itemId: string) {
    const novo = new Set(selecionados);
    if (novo.has(itemId)) novo.delete(itemId);
    else novo.add(itemId);
    setMarcados(novo);
  }

  function enviar() {
    if (pedidoIndisponivel) return;
    setErroGeral(null);
    const e: Erros = {};
    const nome = nomeOutro.trim();
    const escolhidos = itens.filter((i) => selecionados.has(i.id));
    if (escolhidos.length === 0 && !outro) e.itens = 'Marque pelo menos um serviço.';
    if (outro && !nome) e.outro = 'Informe o nome do outro serviço.';

    const kmNum = /^\d+$/.test(km.trim()) ? Number(km.trim()) : null;
    if (kmNum === null) e.km = 'Informe o km do painel.';
    const dataIso = dataBrParaIso(data);
    if (!dataIso) e.data = 'Informe uma data válida.';
    const valorNum = lerReais(valor);
    if (valorNum === null) e.valor = 'Informe o valor total.';

    setErros(e);
    if (Object.keys(e).length > 0 || kmNum === null || !dataIso || valorNum === null) return;

    const lista: ItemServico[] = escolhidos.map((i) => ({ vehicle_item_id: i.id }));
    if (outro) lista.push({ nome_outro: nome });
    salvar.mutate({
      vehicleId: id,
      itens: lista,
      km: kmNum,
      data: dataIso,
      valorTotal: valorNum,
      oficina: oficina.trim() || undefined,
      requestId: pedido || undefined,
    });
  }

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={estilos.titulo}>
        O que foi feito?
      </Text>
      <ChecklistItens itens={itens} marcados={selecionados} onAlternar={alternar} />
      <LinhaMarcavel rotulo="Outro serviço" marcado={outro} onPress={() => setOutro(!outro)} />
      {outro ? (
        <Campo rotulo="Nome do serviço" valor={nomeOutro} onChange={setNomeOutro} erro={erros.outro} />
      ) : null}
      {erros.itens ? <MensagemErro texto={erros.itens} /> : null}

      <Campo rotulo="Km do painel" valor={km} onChange={setKm} tipo="numero" erro={erros.km} />
      <Campo
        rotulo="Data"
        valor={data}
        onChange={(t) => setData(mascararData(t))}
        tipo="numero"
        erro={erros.data}
      />
      <Campo rotulo="Valor total" valor={valor} onChange={setValor} tipo="numero" erro={erros.valor} />
      <Campo rotulo="Oficina (opcional)" valor={oficina} onChange={setOficina} />

      {pedidoIndisponivel ? <MensagemErro texto="Este pedido não está mais aberto." /> : null}
      {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
      <Botao
        titulo="Registrar"
        onPress={enviar}
        desabilitado={pedidoIndisponivel}
        carregando={salvar.isPending}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  titulo: { fontSize: 20, fontWeight: '700', color: cores.texto },
});
