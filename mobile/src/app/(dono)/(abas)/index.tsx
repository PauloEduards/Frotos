import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { criarFrota, gerarNovoCodigo, minhaFrota, type Frota } from '@/api/frota';
import { resumoFrota, type ResumoCarro } from '@/api/veiculos';
import { BadgeStatus } from '@/componentes/BadgeStatus';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { formatarData } from '@/lib/formatos';
import { corStatus, prioridadeStatus } from '@/lib/status';
import { cores, espaco } from '@/lib/tema';

const CHAVE = ['frota'];

export default function PainelFrota() {
  const frota = useQuery({ queryKey: CHAVE, queryFn: minhaFrota });
  const fleetId = frota.data?.id;
  const carros = useQuery({
    queryKey: ['veiculos', 'resumo', fleetId],
    queryFn: () => resumoFrota(fleetId as string),
    enabled: fleetId !== undefined,
  });
  const [atualizando, setAtualizando] = useState(false);

  async function atualizar() {
    setAtualizando(true);
    try {
      await carros.refetch();
    } finally {
      setAtualizando(false);
    }
  }

  if (frota.isPending) return <Carregando />;

  if (frota.isError) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <MensagemErro texto={mensagemErro(frota.error)} />
          <Botao titulo="Tentar de novo" onPress={() => void frota.refetch()} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      testID="painel-frota"
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        frota.data ? <RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} /> : undefined
      }
    >
      {frota.data ? (
        <>
          <CartaoCodigo frota={frota.data} />
          <AdicionarCarro />
          <ListaCarros consulta={carros} />
        </>
      ) : (
        <CriarFrota />
      )}
    </ScrollView>
  );
}

function ListaCarros({ consulta }: { consulta: UseQueryResult<ResumoCarro[]> }) {
  // Se a atualização falhar, a lista anterior continua visível abaixo do erro.
  const erro = consulta.isError ? (
    <View style={estilos.bloco}>
      <MensagemErro texto={mensagemErro(consulta.error)} />
      <Botao titulo="Tentar de novo" onPress={() => void consulta.refetch()} />
    </View>
  ) : null;

  if (consulta.data === undefined) return erro ?? <Carregando />;
  if (consulta.data.length === 0) {
    return (
      <>
        {erro}
        <ListaVazia texto={'Nenhum carro cadastrado. Toque em "Adicionar carro".'} />
      </>
    );
  }
  // sort é estável: dentro do mesmo status mantém a ordem por placa que vem do banco.
  const ordenados = [...consulta.data].sort((a, b) => prioridadeStatus(a.status) - prioridadeStatus(b.status));
  return (
    <View style={estilos.bloco}>
      {erro}
      {ordenados.map((c) => (
        <CartaoCarro key={c.vehicle_id} carro={c} />
      ))}
    </View>
  );
}

function CartaoCarro({ carro }: { carro: ResumoCarro }) {
  const router = useRouter();
  const proxima =
    carro.proximo_item && carro.proxima_data
      ? `Próxima: ${carro.proximo_item} em ${formatarData(carro.proxima_data)}`
      : 'Sem previsão de manutenção';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/carros/${carro.vehicle_id}`)}
      style={({ pressed }) => [
        estilos.cartao,
        { borderLeftWidth: 6, borderLeftColor: corStatus(carro.status) },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={estilos.linhaCarro}>
        <Text style={estilos.placa}>{`${carro.placa} · ${carro.marca} ${carro.modelo}`}</Text>
        <BadgeStatus status={carro.status} />
      </View>
      <Text style={estilos.detalhe}>{proxima}</Text>
      {carro.estimada ? <Text style={estilos.estimada}>previsão estimada</Text> : null}
      <Text style={estilos.detalhe}>{carro.motorista_nome ? `Motorista: ${carro.motorista_nome}` : 'Livre'}</Text>
    </Pressable>
  );
}

function CriarFrota() {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);

  const criar = useMutation({
    mutationFn: (nomeFrota: string) => criarFrota(nomeFrota),
    onSuccess: (nova) => queryClient.setQueryData<Frota | null>(CHAVE, nova),
    onError: (e) => setErro(mensagemErro(e)),
  });

  function aoCriar() {
    setErro(null);
    const limpo = nome.trim();
    if (!limpo) {
      setErroNome('Informe o nome da frota.');
      return;
    }
    setErroNome(undefined);
    criar.mutate(limpo);
  }

  return (
    <>
      <Text style={estilos.titulo}>Crie sua frota</Text>
      <Text style={estilos.apoio}>
        Depois de criar, você recebe um código para os motoristas entrarem.
      </Text>
      <Campo rotulo="Nome da frota" valor={nome} onChange={setNome} erro={erroNome} />
      {erro ? <MensagemErro texto={erro} /> : null}
      <Botao titulo="Criar frota" onPress={aoCriar} carregando={criar.isPending} />
    </>
  );
}

function AdicionarCarro() {
  const router = useRouter();
  return <Botao titulo="Adicionar carro" onPress={() => router.push('/(dono)/carros/novo')} />;
}

function CartaoCodigo({ frota }: { frota: Frota }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const gerar = useMutation({
    mutationFn: () => gerarNovoCodigo(frota.id),
    onSuccess: (codigo) => {
      const atualizada: Frota = { ...frota, codigo_convite: codigo };
      queryClient.setQueryData<Frota | null>(CHAVE, atualizada);
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  async function compartilhar() {
    setErro(null);
    try {
      await Share.share({
        message: `Entre na minha frota no app Frotos com o código ${frota.codigo_convite}.`,
      });
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  function pedirNovoCodigo() {
    setErro(null);
    Alert.alert(
      'Gerar novo código?',
      'Os motoristas que ainda não entraram vão precisar do código novo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Gerar novo código', style: 'destructive', onPress: () => gerar.mutate() },
      ],
    );
  }

  return (
    <View style={estilos.cartao}>
      <Text style={estilos.nomeFrota}>{frota.nome}</Text>
      <Text style={estilos.codigo} selectable>
        {`Código da frota: ${frota.codigo_convite}`}
      </Text>
      {erro ? <MensagemErro texto={erro} /> : null}
      <Botao titulo="Compartilhar" onPress={() => void compartilhar()} />
      <Botao
        titulo="Gerar novo código"
        variante="secundario"
        onPress={pedirNovoCodigo}
        carregando={gerar.isPending}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  titulo: { fontSize: 24, fontWeight: '700', color: cores.texto },
  apoio: { fontSize: 15, color: cores.textoSecundario },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.lg,
    gap: espaco.md,
  },
  nomeFrota: { fontSize: 14, color: cores.textoSecundario },
  codigo: { fontSize: 20, fontWeight: '700', color: cores.texto },
  bloco: { gap: espaco.md },
  linhaCarro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.md },
  placa: { flex: 1, fontSize: 17, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: 15, color: cores.textoSecundario },
  estimada: { fontSize: 13, fontStyle: 'italic', color: cores.textoSecundario },
});
