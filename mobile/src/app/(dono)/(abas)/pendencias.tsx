import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { urlsAssinadas } from '@/api/fotos';
import { minhaFrota } from '@/api/frota';
import {
  leiturasParaConferir,
  ocorrenciasAbertas,
  resolverOcorrencia,
  revisarServico,
  servicosParaRevisar,
  servicosRecentesDeMotoristas,
  type LeituraConferir,
  type OcorrenciaAberta,
  type ServicoRevisao,
  type TipoOcorrencia,
} from '@/api/pendencias';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { FotoRemota } from '@/componentes/FotoRemota';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { formatarData, formatarDataBrt, formatarKm, formatarReais } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';

const ROTULO_TIPO: Record<TipoOcorrencia, string> = {
  mecanico: 'Barulho/mecânico',
  acidente_leve: 'Acidente leve',
  acidente_grave: 'Acidente grave',
  outro: 'Outro',
};

const VERMELHO = '#C62828';
const LARANJA = '#EF6C00';

type Dados = {
  servicos: ServicoRevisao[];
  recentes: ServicoRevisao[];
  leituras: LeituraConferir[];
  ocorrencias: OcorrenciaAberta[];
  urls: Record<string, string>;
};

async function carregar(fleetId: string): Promise<Dados> {
  const [servicos, recentes, leituras, ocorrencias] = await Promise.all([
    servicosParaRevisar(fleetId),
    servicosRecentesDeMotoristas(fleetId),
    leiturasParaConferir(fleetId),
    ocorrenciasAbertas(fleetId),
  ]);
  const caminhos = new Set<string>();
  for (const s of [...servicos, ...recentes]) if (s.nota_foto_path) caminhos.add(s.nota_foto_path);
  for (const l of leituras) caminhos.add(l.foto_painel_path);
  for (const o of ocorrencias) for (const f of o.fotos) caminhos.add(f);
  // As fotos complementam: se a assinatura falhar, os cartões continuam acionáveis ("Sem imagem").
  const urls = await urlsAssinadas([...caminhos]).catch((): Record<string, string> => ({}));
  return { servicos, recentes, leituras, ocorrencias, urls };
}

export default function Pendencias() {
  const frota = useQuery({ queryKey: ['frota'], queryFn: minhaFrota });
  const fleetId = frota.data?.id;
  const pendencias = useQuery({
    queryKey: ['pendencias', 'tela', fleetId],
    queryFn: () => carregar(fleetId as string),
    enabled: fleetId !== undefined,
  });
  const [atualizando, setAtualizando] = useState(false);

  async function atualizar() {
    setAtualizando(true);
    try {
      await pendencias.refetch();
    } finally {
      setAtualizando(false);
    }
  }

  if (frota.isPending || (fleetId !== undefined && pendencias.isPending)) return <Carregando />;

  const erro = frota.isError ? frota.error : pendencias.isError ? pendencias.error : null;
  const dados = pendencias.data;
  if (!dados) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          {erro ? (
            <>
              <MensagemErro texto={mensagemErro(erro)} />
              <Botao
                titulo="Tentar de novo"
                onPress={() => void (frota.isError ? frota.refetch() : pendencias.refetch())}
              />
            </>
          ) : (
            <ListaVazia texto="Nenhuma pendência. Tudo em dia!" />
          )}
        </View>
      </View>
    );
  }

  const vazio =
    dados.servicos.length === 0 &&
    dados.recentes.length === 0 &&
    dados.leituras.length === 0 &&
    dados.ocorrencias.length === 0;

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} />}
    >
      {erro ? (
        <View style={estilos.bloco}>
          <MensagemErro texto={mensagemErro(erro)} />
          <Botao titulo="Tentar de novo" onPress={() => void pendencias.refetch()} />
        </View>
      ) : null}
      {vazio ? <ListaVazia texto="Nenhuma pendência. Tudo em dia!" /> : null}

      {dados.servicos.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Serviços para aprovar</Text>
          {dados.servicos.map((s) => (
            <CartaoServico key={s.id} servico={s} urls={dados.urls} modo="revisar" />
          ))}
        </View>
      ) : null}

      {dados.ocorrencias.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Ocorrências</Text>
          {dados.ocorrencias.map((o) => (
            <CartaoOcorrencia key={o.id} ocorrencia={o} urls={dados.urls} />
          ))}
        </View>
      ) : null}

      {dados.leituras.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Leituras de km para conferir</Text>
          {dados.leituras.map((l) => (
            <CartaoLeitura key={l.id} leitura={l} urls={dados.urls} />
          ))}
        </View>
      ) : null}

      {dados.recentes.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Registrados por motoristas confiáveis</Text>
          {dados.recentes.map((s) => (
            <CartaoServico key={s.id} servico={s} urls={dados.urls} modo="contestar" />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function useInvalidarPendencias() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['pendencias'] }),
      queryClient.invalidateQueries({ queryKey: ['veiculos'] }),
      queryClient.invalidateQueries({ queryKey: ['itens'] }),
    ]);
}

type Decisao = 'aprovar' | 'recusar' | 'contestar';

function CartaoServico({
  servico,
  urls,
  modo,
}: {
  servico: ServicoRevisao;
  urls: Record<string, string>;
  modo: 'revisar' | 'contestar';
}) {
  const invalidar = useInvalidarPendencias();
  const [erro, setErro] = useState<string | null>(null);
  const [motivando, setMotivando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const revisar = useMutation({
    mutationFn: (v: { decisao: Decisao; motivo?: string }) => revisarServico(servico.id, v.decisao, v.motivo),
    onSuccess: invalidar,
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar(decisao: Decisao) {
    setErro(null);
    const texto = motivo.trim();
    revisar.mutate({ decisao, motivo: decisao === 'aprovar' || !texto ? undefined : texto });
  }

  function cancelar() {
    setMotivando(false);
    setMotivo('');
    setErro(null);
  }

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.titulo}>{`${servico.placa} · ${servico.autor} · ${formatarData(servico.data)}`}</Text>
      {servico.itens.map((i, idx) => (
        <Text key={idx} style={estilos.detalhe}>
          {i.valor !== null ? `${i.nome} · ${formatarReais(i.valor)}` : i.nome}
        </Text>
      ))}
      <Text style={estilos.valor}>{formatarReais(servico.valor_total)}</Text>
      <Text style={estilos.detalhe}>
        {servico.oficina ? `${servico.oficina} · ` : ''}
        {formatarKm(servico.km)}
      </Text>
      {servico.nota_foto_path ? (
        <FotoRemota path={servico.nota_foto_path} urls={urls} descricao={`Nota do serviço ${servico.placa}`} />
      ) : (
        <Text style={estilos.detalhe}>Sem foto da nota</Text>
      )}
      {erro ? <MensagemErro texto={erro} /> : null}
      {motivando ? (
        <View style={estilos.bloco}>
          {modo === 'contestar' ? <Text style={estilos.aviso}>O serviço sai da previsão.</Text> : null}
          <Campo rotulo="Motivo (opcional)" valor={motivo} onChange={setMotivo} />
          <Botao
            titulo={modo === 'revisar' ? 'Confirmar recusa' : 'Confirmar contestação'}
            variante="perigo"
            carregando={revisar.isPending}
            onPress={() => enviar(modo === 'revisar' ? 'recusar' : 'contestar')}
          />
          <Botao titulo="Cancelar" variante="secundario" desabilitado={revisar.isPending} onPress={cancelar} />
        </View>
      ) : modo === 'revisar' ? (
        <View style={estilos.bloco}>
          <Botao titulo="Aprovar" carregando={revisar.isPending} onPress={() => enviar('aprovar')} />
          <Botao
            titulo="Recusar"
            variante="secundario"
            desabilitado={revisar.isPending}
            onPress={() => setMotivando(true)}
          />
        </View>
      ) : (
        <Botao titulo="Contestar" variante="secundario" onPress={() => setMotivando(true)} />
      )}
    </View>
  );
}

function CartaoLeitura({ leitura, urls }: { leitura: LeituraConferir; urls: Record<string, string> }) {
  const s = leitura.salto;
  const resumo = s
    ? `${s.km >= 0 ? '+' : '-'}${formatarKm(Math.abs(s.km))} em ${s.dias} ${s.dias === 1 ? 'dia' : 'dias'}`
    : 'Salto de km suspeito';
  return (
    <View style={[estilos.cartao, estilos.cartaoAlerta]}>
      <Text style={estilos.titulo}>
        {`${leitura.placa} · ${leitura.autor} · ${formatarDataBrt(leitura.capturado_em)}`}
      </Text>
      <Text style={estilos.alerta}>{resumo}</Text>
      <Text style={estilos.detalhe}>{`Painel marcando ${formatarKm(leitura.km)}`}</Text>
      <FotoRemota path={leitura.foto_painel_path} urls={urls} descricao={`Foto do painel ${leitura.placa}`} />
    </View>
  );
}

function CartaoOcorrencia({
  ocorrencia,
  urls,
}: {
  ocorrencia: OcorrenciaAberta;
  urls: Record<string, string>;
}) {
  const invalidar = useInvalidarPendencias();
  const [erro, setErro] = useState<string | null>(null);
  const resolver = useMutation({
    mutationFn: () => resolverOcorrencia(ocorrencia.id),
    onSuccess: invalidar,
    onError: (e) => setErro(mensagemErro(e)),
  });
  const grave = ocorrencia.tipo === 'acidente_grave';

  return (
    <View style={[estilos.cartao, grave && estilos.cartaoGrave]}>
      <Text style={[estilos.tipo, grave && { color: VERMELHO }]}>{ROTULO_TIPO[ocorrencia.tipo]}</Text>
      <Text style={estilos.titulo}>
        {`${ocorrencia.placa} · ${ocorrencia.motorista} · ${formatarDataBrt(ocorrencia.criada_em)}`}
      </Text>
      <Text style={estilos.descricao}>{ocorrencia.descricao}</Text>
      {ocorrencia.fotos.length > 0 ? (
        <View style={estilos.fotos}>
          {ocorrencia.fotos.map((f, i) => (
            <FotoRemota key={f} path={f} urls={urls} descricao={`Foto ${i + 1} da ocorrência ${ocorrencia.placa}`} />
          ))}
        </View>
      ) : null}
      {erro ? <MensagemErro texto={erro} /> : null}
      <Botao
        titulo="Marcar como resolvida"
        carregando={resolver.isPending}
        onPress={() => {
          setErro(null);
          resolver.mutate();
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.xl },
  bloco: { gap: espaco.md },
  secao: { fontSize: 20, fontWeight: '700', color: cores.texto },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.lg,
    gap: espaco.sm,
  },
  cartaoAlerta: { borderColor: LARANJA, borderWidth: 2 },
  cartaoGrave: { borderColor: VERMELHO, borderWidth: 2 },
  titulo: { fontSize: 16, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: 15, color: cores.textoSecundario },
  valor: { fontSize: 20, fontWeight: '700', color: cores.texto },
  aviso: { fontSize: 15, color: cores.texto },
  alerta: { fontSize: 18, fontWeight: '700', color: LARANJA },
  tipo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  descricao: { fontSize: 16, color: cores.texto },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
});
