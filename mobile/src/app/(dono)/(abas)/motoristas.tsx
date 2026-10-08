import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  definirNivel,
  listarMembros,
  minhaFrota,
  removerMotorista,
  responderEntrada,
  type Membro,
} from '@/api/frota';
import { candidaturasPendentes, responderCandidatura, type CandidaturaDono } from '@/api/candidaturas';
import { Botao } from '@/componentes/Botao';
import { CardCarro } from '@/componentes/CardCarro';
import { Carregando } from '@/componentes/Carregando';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { SemFrota } from '@/componentes/SemFrota';
import { mensagemErro } from '@/lib/erros';
import { formatarCpf } from '@/lib/formatos';
import { useUrlsAssinadas } from '@/lib/useUrlsAssinadas';
import { invalidarDadosDaFrota } from '@/lib/invalidar';
import { cores, espaco } from '@/lib/tema';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';

const NIVEIS: { valor: Membro['nivel_manutencao']; rotulo: string }[] = [
  { valor: 'sem_permissao', rotulo: 'Não registra' },
  { valor: 'com_aprovacao', rotulo: 'Registra com aprovação' },
  { valor: 'confiavel', rotulo: 'Confiável' },
];

const AJUDA_CONFIAVEL = 'Os serviços entram direto na previsão. Você pode contestar depois.';

export default function Motoristas() {
  const frota = useQuery({ queryKey: ['frota'], queryFn: minhaFrota });
  const fleetId = frota.data?.id;
  const membros = useQuery({
    queryKey: ['membros', fleetId],
    queryFn: () => listarMembros(fleetId as string),
    enabled: fleetId !== undefined,
  });
  const candidaturas = useQuery({
    queryKey: ['membros', 'candidaturas', fleetId],
    queryFn: () => candidaturasPendentes(fleetId as string),
    enabled: fleetId !== undefined,
  });
  const [atualizando, setAtualizando] = useState(false);

  useRefreshOnFocus(() => {
    void frota.refetch();
    if (fleetId !== undefined) {
      void membros.refetch();
      void candidaturas.refetch();
    }
  });

  async function atualizar() {
    setAtualizando(true);
    try {
      await Promise.all([membros.refetch(), candidaturas.refetch()]);
    } finally {
      setAtualizando(false);
    }
  }

  if (frota.isPending || (fleetId !== undefined && membros.isPending)) return <Carregando />;

  if (frota.data === null) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <SemFrota />
        </View>
      </View>
    );
  }

  const erro = frota.isError ? frota.error : membros.isError ? membros.error : null;
  const lista = membros.data?.filter((m) => m.status !== 'removido');
  if (erro && lista === undefined) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <MensagemErro texto={mensagemErro(erro)} />
          <Botao
            titulo="Tentar de novo"
            onPress={() => void (frota.isError ? frota.refetch() : membros.refetch())}
          />
        </View>
      </View>
    );
  }

  const pendentes = (lista ?? []).filter((m) => m.status === 'pendente');
  const ativos = (lista ?? []).filter((m) => m.status === 'ativo');
  const candidatos = candidaturas.data ?? [];

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        fleetId ? <RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} /> : undefined
      }
    >
      {erro ? (
        <View style={estilos.bloco}>
          <MensagemErro texto={mensagemErro(erro)} />
          <Botao titulo="Tentar de novo" onPress={() => void membros.refetch()} />
        </View>
      ) : null}
      {candidatos.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Pedidos de motoristas</Text>
          {candidatos.map((c) => (
            <CartaoCandidatura key={c.id} candidatura={c} />
          ))}
        </View>
      ) : null}
      {pendentes.length === 0 && ativos.length === 0 && candidatos.length === 0 ? (
        <ListaVazia texto="Nenhum motorista ainda. Compartilhe o código da frota." />
      ) : null}
      {pendentes.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Pedidos para entrar</Text>
          {pendentes.map((m) => (
            <CartaoPedido key={m.id} membro={m} fleetId={fleetId} />
          ))}
        </View>
      ) : null}
      {ativos.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Motoristas</Text>
          {ativos.map((m) => (
            <CartaoMotorista key={m.id} membro={m} fleetId={fleetId} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function CartaoCandidatura({ candidatura: c }: { candidatura: CandidaturaDono }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const foto = useUrlsAssinadas(c.carro.foto_path ? [c.carro.foto_path] : [], !!c.carro.foto_path, 'carros');
  const responder = useMutation({
    mutationFn: (aceitar: boolean) => responderCandidatura(c.id, aceitar),
    onSuccess: () => invalidarDadosDaFrota(queryClient),
    onError: (e) => setErro(mensagemErro(e)),
  });

  function recusar() {
    Alert.alert('Recusar candidato?', `${c.nome} será avisado.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Recusar', style: 'destructive', onPress: () => responder.mutate(false) },
    ]);
  }

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.nome}>{c.nome}</Text>
      {c.telefone ? <Text style={estilos.detalhe}>{c.telefone}</Text> : null}
      {c.cidade && c.uf ? <Text style={estilos.detalhe}>{`${c.cidade}/${c.uf}`}</Text> : null}
      <Text style={estilos.detalhe}>{`CPF ${formatarCpf(c.cpf)}`}</Text>
      <Text style={estilos.detalhe}>{`Tem CNH: ${c.tem_cnh ? 'sim' : 'não'}`}</Text>
      {c.mensagem ? <Text style={estilos.detalhe}>{`"${c.mensagem}"`}</Text> : null}
      <Text style={estilos.detalhe}>Quer o carro:</Text>
      <CardCarro
        carro={{
          placa: c.carro.placa,
          marca: c.carro.marca,
          modelo: c.carro.modelo,
          fotoUrl: c.carro.foto_path ? foto.urls[c.carro.foto_path] ?? null : null,
        }}
      />
      {erro ? <MensagemErro texto={erro} /> : null}
      <Botao titulo="Aceitar" onPress={() => responder.mutate(true)} carregando={responder.isPending} />
      <Botao titulo="Recusar candidato" variante="secundario" onPress={recusar} />
    </View>
  );
}

function CartaoPedido({ membro, fleetId }: { membro: Membro; fleetId: string | undefined }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const responder = useMutation({
    mutationFn: (aprovar: boolean) => responderEntrada(membro.id, aprovar),
    onSuccess: () => invalidarDadosDaFrota(queryClient),
    onError: (e) => setErro(mensagemErro(e)),
  });

  function aoResponder(aprovar: boolean) {
    setErro(null);
    responder.mutate(aprovar);
  }

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.nome}>{membro.nome}</Text>
      {membro.telefone ? <Text style={estilos.detalhe}>{membro.telefone}</Text> : null}
      {erro ? <MensagemErro texto={erro} /> : null}
      <Botao titulo="Aprovar" onPress={() => aoResponder(true)} desabilitado={responder.isPending} />
      <Botao
        titulo="Recusar"
        variante="secundario"
        onPress={() => aoResponder(false)}
        desabilitado={responder.isPending}
      />
    </View>
  );
}

function CartaoMotorista({ membro, fleetId }: { membro: Membro; fleetId: string | undefined }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const nivel = useMutation({
    mutationFn: (novo: Membro['nivel_manutencao']) => definirNivel(membro.id, novo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membros', fleetId] }),
    onError: (e) => setErro(mensagemErro(e)),
  });

  const remover = useMutation({
    mutationFn: () => removerMotorista(membro.id),
    onSuccess: () => invalidarDadosDaFrota(queryClient),
    onError: (e) => setErro(mensagemErro(e)),
  });

  function pedirRemocao() {
    setErro(null);
    Alert.alert('Remover da frota?', 'Se ele estiver com um carro, o carro fica livre.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover da frota', style: 'destructive', onPress: () => remover.mutate() },
    ]);
  }

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.nome}>{membro.nome}</Text>
      {membro.telefone ? <Text style={estilos.detalhe}>{membro.telefone}</Text> : null}
      <Text style={estilos.detalhe}>
        {membro.carro_placa ? `Com o carro ${membro.carro_placa}` : 'Sem carro'}
      </Text>
      <Seletor
        rotulo="Registro de manutenção"
        opcoes={NIVEIS}
        valor={membro.nivel_manutencao}
        onChange={(v) => {
          setErro(null);
          nivel.mutate(v);
        }}
        quebrarLinha
      />
      {membro.nivel_manutencao === 'confiavel' ? <Text style={estilos.detalhe}>{AJUDA_CONFIAVEL}</Text> : null}
      {erro ? <MensagemErro texto={erro} /> : null}
      <Botao
        titulo="Remover da frota"
        variante="perigo"
        onPress={pedirRemocao}
        carregando={remover.isPending}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  bloco: { gap: espaco.md },
  secao: { fontSize: 20, fontWeight: '700', color: cores.texto },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.lg,
    gap: espaco.md,
  },
  nome: { fontSize: 17, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: 15, color: cores.textoSecundario },
});
