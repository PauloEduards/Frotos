import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { urlsAssinadas } from '@/api/fotos';
import { cancelarPedido, pedidosAbertos, type PedidoAberto } from '@/api/manutencao';
import {
  atualizarVeiculo,
  buscarVeiculo,
  corrigirKm,
  leiturasKm,
  previsaoItens,
  servicos,
  statusCarro,
  vinculos,
  type LeituraKm,
  type OrigemKm,
  type PrevisaoItem,
  type Servico,
  type StatusServico,
  type Vinculo,
} from '@/api/veiculos';
import { BadgeStatus } from '@/componentes/BadgeStatus';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { FotoRemota } from '@/componentes/FotoRemota';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { formatarData, formatarDataBrt, formatarKm, formatarReais } from '@/lib/formatos';
import { prioridadeStatus } from '@/lib/status';
import { cores, espaco } from '@/lib/tema';

const ROTULO_ORIGEM: Record<OrigemKm, string> = {
  retirada: 'Retirada',
  devolucao: 'Devolução',
  atualizacao: 'Atualização',
  manutencao: 'Manutenção',
  correcao_dono: 'Correção',
};

const ROTULO_SERVICO: Record<StatusServico, string> = {
  aprovado: 'Aprovado',
  pendente: 'Pendente',
  recusado: 'Recusado',
  contestado: 'Contestado',
};

const COR_SERVICO: Record<StatusServico, string> = {
  aprovado: '#2E7D32',
  pendente: '#EF6C00',
  recusado: '#C62828',
  contestado: '#C62828',
};

const ROTULO_POSICAO: Record<string, string> = {
  frente: 'frente',
  traseira: 'traseira',
  lateral_esq: 'lateral esquerda',
  lateral_dir: 'lateral direita',
  extra: 'extra',
};

const ORDEM_POSICAO = ['frente', 'traseira', 'lateral_esq', 'lateral_dir', 'extra'];

const MEIA_HORA = 30 * 60 * 1000;

export default function DetalheCarro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [atualizando, setAtualizando] = useState(false);

  const veiculo = useQuery({ queryKey: ['veiculos', 'detalhe', id], queryFn: () => buscarVeiculo(id) });
  const status = useQuery({ queryKey: ['veiculos', 'status', id], queryFn: () => statusCarro(id) });
  const previsao = useQuery({ queryKey: ['veiculos', 'previsao', id], queryFn: () => previsaoItens(id) });
  const leituras = useQuery({ queryKey: ['veiculos', 'leituras', id], queryFn: () => leiturasKm(id) });
  const servicosQ = useQuery({ queryKey: ['veiculos', 'servicos', id], queryFn: () => servicos(id) });
  const vinculosQ = useQuery({ queryKey: ['veiculos', 'vinculos', id], queryFn: () => vinculos(id) });
  const pedidosQ = useQuery({ queryKey: ['veiculos', 'pedidos', id], queryFn: () => pedidosAbertos(id) });

  const queryClient = useQueryClient();
  const [maisAberto, setMaisAberto] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [kmCorreto, setKmCorreto] = useState('');
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function aposAcao() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['veiculos'] }),
      queryClient.invalidateQueries({ queryKey: ['pendencias'] }),
    ]);
  }

  const cancelar = useMutation({
    mutationFn: (pedidoId: string) => cancelarPedido(pedidoId),
    onSuccess: aposAcao,
    onError: (e) => setErroAcao(mensagemErro(e)),
  });
  const corrigir = useMutation({
    mutationFn: (km: number) => corrigirKm(id, km),
    onSuccess: async () => {
      setCorrigindo(false);
      setKmCorreto('');
      await aposAcao();
    },
    onError: (e) => setErroAcao(mensagemErro(e)),
  });
  const alterar = useMutation({
    mutationFn: (campos: Parameters<typeof atualizarVeiculo>[1]) => atualizarVeiculo(id, campos),
    onSuccess: async (_, campos) => {
      await aposAcao();
      if (campos.ativo === false) router.back();
    },
    onError: (e) => setErroAcao(mensagemErro(e)),
  });

  function pedirCancelamento(pedidoId: string) {
    setErroAcao(null);
    Alert.alert('Cancelar pedido?', 'O motorista deixa de receber este pedido.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => cancelar.mutate(pedidoId) },
    ]);
  }

  function pedirDesativacao() {
    setErroAcao(null);
    Alert.alert('Desativar carro?', 'O carro sai do painel e das previsões.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Desativar carro', style: 'destructive', onPress: () => alterar.mutate({ ativo: false }) },
    ]);
  }

  function salvarKm() {
    setErroAcao(null);
    if (!/^\d+$/.test(kmCorreto.trim())) {
      setErroAcao('Informe o km do painel.');
      return;
    }
    corrigir.mutate(Number(kmCorreto.trim()));
  }

  // Uma única chamada assina as fotos do painel e das inspeções, depois que as duas listas chegam.
  const caminhos = [
    ...(leituras.data ?? []).flatMap((l) => (l.foto_painel_path ? [l.foto_painel_path] : [])),
    ...(vinculosQ.data ?? []).flatMap((v) => v.fotos.map((f) => f.path)),
  ].sort();
  const fotos = useQuery({
    queryKey: ['veiculos', 'fotos', id, caminhos.join('|')],
    queryFn: () => urlsAssinadas(caminhos),
    enabled: caminhos.length > 0 && !leituras.isPending && !vinculosQ.isPending,
    staleTime: MEIA_HORA,
    placeholderData: (anterior) => anterior,
  });
  const urls = fotos.data ?? {};

  async function atualizar() {
    setAtualizando(true);
    try {
      await Promise.all([
        veiculo.refetch(),
        status.refetch(),
        previsao.refetch(),
        leituras.refetch(),
        servicosQ.refetch(),
        vinculosQ.refetch(),
        pedidosQ.refetch(),
      ]);
    } finally {
      setAtualizando(false);
    }
  }

  if (veiculo.isPending) return <Carregando />;

  if (veiculo.isError) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <MensagemErro texto={mensagemErro(veiculo.error)} />
          <Botao titulo="Tentar de novo" onPress={() => void veiculo.refetch()} />
        </View>
      </View>
    );
  }

  const v = veiculo.data;
  const resumo = status.data;
  const media = resumo ? `${formatarKm(Math.round(resumo.media))}/dia` : null;

  return (
    <ScrollView
      testID="detalhe-carro"
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} />}
    >
      <View style={estilos.cabecalho}>
        <View style={estilos.linhaCabecalho}>
          <Text style={estilos.placa}>{v.placa}</Text>
          {resumo ? <BadgeStatus status={resumo.status} /> : null}
        </View>
        <Text style={estilos.modelo}>{`${v.marca} ${v.modelo} · ${v.cor}`}</Text>
        <Text style={estilos.destaque}>{`Km atual: ${formatarKm(v.km_atual)}`}</Text>
        {resumo && media ? (
          <Text style={estilos.apoio}>
            {resumo.estimada ? `Média estimada: ${media}` : `Média: ${media}`}
          </Text>
        ) : null}
        {status.isError ? <MensagemErro texto={mensagemErro(status.error)} /> : null}
      </View>

      <Botao titulo="Plano de manutenção" variante="secundario" onPress={() => router.push(`/carros/${id}/itens`)} />
      <Botao titulo="Registrar serviço" onPress={() => router.push(`/carros/${id}/servico`)} />
      <Botao titulo="Pedido de manutenção" variante="secundario" onPress={() => router.push(`/carros/${id}/pedido`)} />

      <Secao
        titulo="Pedidos abertos"
        consulta={pedidosQ}
        vazio="Nenhum pedido aberto."
        renderizar={(lista) =>
          lista.map((p) => (
            <LinhaPedido
              key={p.id}
              pedido={p}
              nomes={nomesDosItens(previsao.data)}
              onCancelar={() => pedirCancelamento(p.id)}
            />
          ))
        }
      />

      <Secao
        titulo="Manutenção"
        consulta={previsao}
        vazio="Nenhum item no plano de manutenção."
        renderizar={(itens) =>
          [...itens]
            .sort((a, b) => prioridadeStatus(a.status) - prioridadeStatus(b.status))
            .map((i) => <LinhaPrevisao key={i.vehicle_item_id} item={i} />)
        }
      />

      <Secao
        titulo="Leituras de km"
        consulta={leituras}
        vazio="Nenhuma leitura de km registrada."
        renderizar={(lista) => lista.map((l) => <LinhaLeitura key={l.id} leitura={l} urls={urls} />)}
      />

      <Secao
        titulo="Serviços"
        consulta={servicosQ}
        vazio="Nenhum serviço registrado."
        renderizar={(lista) => lista.map((s) => <LinhaServico key={s.id} servico={s} />)}
      />

      <Secao
        titulo="Retiradas e devoluções"
        consulta={vinculosQ}
        vazio="Nenhuma retirada ou devolução registrada."
        renderizar={(lista) => lista.map((a) => <BlocoVinculo key={a.id} vinculo={a} urls={urls} />)}
      />

      <Botao
        titulo="Mais"
        variante="secundario"
        onPress={() => {
          setMaisAberto(!maisAberto);
          setErroAcao(null);
        }}
      />
      {maisAberto ? (
        <View style={estilos.menuMais}>
          <Botao titulo="Corrigir km" variante="secundario" onPress={() => setCorrigindo(!corrigindo)} />
          {corrigindo ? (
            <View style={estilos.secao}>
              <Text style={estilos.apoio}>Use só para corrigir um km digitado errado.</Text>
              <Campo rotulo="Km correto" valor={kmCorreto} onChange={setKmCorreto} tipo="numero" />
              <Botao titulo="Salvar km" onPress={salvarKm} carregando={corrigir.isPending} />
            </View>
          ) : null}
          <View style={estilos.linhaInterruptor}>
            <Text style={estilos.nomeItem}>Sempre exigir minha aprovação</Text>
            <Switch
              accessibilityLabel="Sempre exigir minha aprovação"
              value={
                alterar.isPending && alterar.variables?.exige_aprovacao_sempre !== undefined
                  ? alterar.variables.exige_aprovacao_sempre
                  : v.exige_aprovacao_sempre === true
              }
              onValueChange={(valor) => {
                setErroAcao(null);
                alterar.mutate({ exige_aprovacao_sempre: valor });
              }}
            />
          </View>
          <Botao titulo="Desativar carro" variante="perigo" onPress={pedirDesativacao} />
        </View>
      ) : null}
      {erroAcao ? <MensagemErro texto={erroAcao} /> : null}
    </ScrollView>
  );
}

function nomesDosItens(previsao: PrevisaoItem[] | undefined): Record<string, string> {
  return Object.fromEntries((previsao ?? []).map((i) => [i.vehicle_item_id, i.nome]));
}

function LinhaPedido({
  pedido,
  nomes,
  onCancelar,
}: {
  pedido: PedidoAberto;
  nomes: Record<string, string>;
  onCancelar: () => void;
}) {
  return (
    <View style={estilos.linha}>
      <Text style={estilos.nomeItem}>{`Prazo: ${formatarData(pedido.prazo)}`}</Text>
      <Text style={estilos.apoio}>{pedido.itens.map((i) => nomes[i] ?? 'Item').join(', ')}</Text>
      {pedido.observacao ? <Text style={estilos.apoio}>{pedido.observacao}</Text> : null}
      <Botao titulo="Cancelar" variante="secundario" onPress={onCancelar} />
    </View>
  );
}

function Secao<T>({
  titulo,
  consulta,
  vazio,
  renderizar,
}: {
  titulo: string;
  consulta: UseQueryResult<T[]>;
  vazio: string;
  renderizar: (dados: T[]) => ReactNode;
}) {
  let corpo: ReactNode;
  if (consulta.data !== undefined) {
    corpo = consulta.data.length === 0 ? <ListaVazia texto={vazio} /> : renderizar(consulta.data);
  } else if (consulta.isError) {
    corpo = null;
  } else {
    corpo = <ActivityIndicator color={cores.primaria} accessibilityLabel={`Carregando ${titulo}`} />;
  }

  return (
    <View style={estilos.secao}>
      <Text accessibilityRole="header" style={estilos.tituloSecao}>
        {titulo}
      </Text>
      {consulta.isError ? (
        <View style={estilos.erroSecao}>
          <MensagemErro texto={mensagemErro(consulta.error)} />
          <Botao titulo="Tentar de novo" variante="secundario" onPress={() => void consulta.refetch()} />
        </View>
      ) : null}
      {corpo}
    </View>
  );
}

function descreverPrevisao(i: PrevisaoItem): string {
  if (i.status === 'sem_historico') return 'Sem histórico — revisar';
  if (i.km_restante !== null && i.km_restante <= 0) {
    return i.km_restante === 0 ? 'Vencido agora' : `Vencido há ${formatarKm(-i.km_restante)}`;
  }
  if (i.km_restante !== null) {
    const faltam = `Faltam ${formatarKm(i.km_restante)}`;
    return i.data_prevista ? `${faltam} · previsto para ${formatarData(i.data_prevista)}` : faltam;
  }
  if (i.data_prevista) {
    return i.status === 'vencido'
      ? `Vencido desde ${formatarData(i.data_prevista)}`
      : `Previsto para ${formatarData(i.data_prevista)}`;
  }
  return 'Sem previsão';
}

function LinhaPrevisao({ item }: { item: PrevisaoItem }) {
  return (
    <View style={estilos.linha}>
      <View style={estilos.linhaTopo}>
        <Text style={estilos.nomeItem}>{item.nome}</Text>
        <BadgeStatus status={item.status} />
      </View>
      <Text style={estilos.apoio}>{descreverPrevisao(item)}</Text>
    </View>
  );
}

function LinhaLeitura({ leitura, urls }: { leitura: LeituraKm; urls: Record<string, string> }) {
  const texto = `${formatarKm(leitura.km)} · ${formatarDataBrt(leitura.capturado_em)} · ${ROTULO_ORIGEM[leitura.origem]}`;
  return (
    <View style={estilos.linha}>
      <View style={estilos.linhaTopo}>
        <Text style={estilos.nomeItem}>{texto}</Text>
        {leitura.salto_suspeito ? (
          <View style={estilos.seloConferir}>
            <Text style={estilos.textoSelo}>Conferir</Text>
          </View>
        ) : null}
      </View>
      {leitura.foto_painel_path ? (
        <FotoRemota path={leitura.foto_painel_path} urls={urls} descricao="Foto do painel" />
      ) : null}
    </View>
  );
}

function LinhaServico({ servico }: { servico: Servico }) {
  return (
    <View style={estilos.linha}>
      <View style={estilos.linhaTopo}>
        <Text style={estilos.nomeItem}>{`${formatarData(servico.data)} · ${formatarReais(servico.valor_total)}`}</Text>
        <Text style={[estilos.statusServico, { color: COR_SERVICO[servico.status] }]}>
          {ROTULO_SERVICO[servico.status]}
        </Text>
      </View>
      <Text style={estilos.apoio}>{servico.itens.map((i) => i.nome).join(', ')}</Text>
      {servico.motivo ? <Text style={estilos.apoio}>{`Motivo: ${servico.motivo}`}</Text> : null}
    </View>
  );
}

function BlocoVinculo({ vinculo, urls }: { vinculo: Vinculo; urls: Record<string, string> }) {
  const situacao =
    vinculo.status === 'ativo' ? 'Em uso' : vinculo.status === 'aguardando_fotos' ? 'Aguardando fotos da retirada' : null;
  return (
    <View style={estilos.linha}>
      <View style={estilos.linhaTopo}>
        <Text style={estilos.nomeItem}>{vinculo.motorista_nome ?? 'Motorista'}</Text>
        {situacao ? <Text style={estilos.situacao}>{situacao}</Text> : null}
      </View>
      <Text style={estilos.apoio}>
        {`Retirada: ${formatarDataBrt(vinculo.inicio_em)} · ${formatarKm(vinculo.km_inicio)}`}
      </Text>
      <FotosDoMomento vinculo={vinculo} momento="retirada" urls={urls} />
      {vinculo.fim_em ? (
        <>
          <Text style={estilos.apoio}>
            {`Devolução: ${formatarDataBrt(vinculo.fim_em)} · ${formatarKm(vinculo.km_fim)}`}
          </Text>
          <FotosDoMomento vinculo={vinculo} momento="devolucao" urls={urls} />
        </>
      ) : null}
    </View>
  );
}

function FotosDoMomento({
  vinculo,
  momento,
  urls,
}: {
  vinculo: Vinculo;
  momento: 'retirada' | 'devolucao';
  urls: Record<string, string>;
}) {
  const fotos = vinculo.fotos
    .filter((f) => f.momento === momento)
    .sort((a, b) => ORDEM_POSICAO.indexOf(a.posicao) - ORDEM_POSICAO.indexOf(b.posicao));
  if (fotos.length === 0) return null;
  const nome = momento === 'retirada' ? 'retirada' : 'devolução';
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fotos}>
      {fotos.map((f) => (
        <FotoRemota key={f.id} path={f.path} urls={urls} descricao={`Foto da ${nome}: ${ROTULO_POSICAO[f.posicao]}`} />
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  cabecalho: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.lg,
    gap: espaco.sm,
  },
  linhaCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.md },
  placa: { fontSize: 28, fontWeight: '700', color: cores.texto },
  modelo: { fontSize: 16, color: cores.textoSecundario },
  destaque: { fontSize: 18, fontWeight: '600', color: cores.texto },
  apoio: { fontSize: 15, color: cores.textoSecundario },
  secao: { gap: espaco.sm, marginTop: espaco.sm },
  tituloSecao: { fontSize: 20, fontWeight: '700', color: cores.texto },
  erroSecao: { gap: espaco.sm },
  linha: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.md,
    gap: espaco.sm,
  },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.md },
  nomeItem: { flex: 1, fontSize: 16, fontWeight: '600', color: cores.texto },
  seloConferir: { backgroundColor: '#EF6C00', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  textoSelo: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  statusServico: { fontSize: 14, fontWeight: '700' },
  situacao: { fontSize: 13, fontWeight: '600', color: cores.primaria },
  fotos: { gap: espaco.sm },
  menuMais: { gap: espaco.md },
  linhaInterruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.md,
  },
});
