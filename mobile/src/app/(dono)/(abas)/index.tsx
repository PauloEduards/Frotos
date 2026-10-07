import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { criarFrota, gerarNovoCodigo, minhaFrota, type Frota } from '@/api/frota';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';

const CHAVE = ['frota'];

export default function PainelFrota() {
  const frota = useQuery({ queryKey: CHAVE, queryFn: minhaFrota });

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
    <ScrollView style={estilos.fundo} contentContainerStyle={estilos.conteudo}>
      {frota.data ? (
        <>
          <CartaoCodigo frota={frota.data} />
          <AdicionarCarro />
        </>
      ) : (
        <CriarFrota />
      )}
    </ScrollView>
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
});
