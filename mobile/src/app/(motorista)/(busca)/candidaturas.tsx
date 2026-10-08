import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  cancelarCandidatura,
  entrarComCodigo,
  meusPedidosDeEntrada,
  minhasCandidaturas,
  type MinhaCandidatura,
  type StatusCandidatura,
} from '@/api/motorista';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { CardCarro } from '@/componentes/CardCarro';
import { Carregando } from '@/componentes/Carregando';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { useUrlsAssinadas } from '@/lib/useUrlsAssinadas';

const ROTULO: Record<StatusCandidatura, string> = {
  pendente: 'Aguardando',
  aceita: 'Aceita',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
};
const COR: Record<StatusCandidatura, string> = {
  pendente: '#F9A825',
  aceita: '#2E7D32',
  recusada: '#C62828',
  cancelada: '#9E9E9E',
};

export default function Candidaturas() {
  const queryClient = useQueryClient();
  const candidaturas = useQuery({ queryKey: ['candidaturas'], queryFn: minhasCandidaturas });
  const pedidos = useQuery({ queryKey: ['candidaturas', 'entrada'], queryFn: meusPedidosDeEntrada });
  useRefreshOnFocus(() => {
    void candidaturas.refetch();
    void pedidos.refetch();
    void queryClient.invalidateQueries({ queryKey: ['situacao'] });
  });

  const caminhos = (candidaturas.data ?? []).map((c) => c.carro.foto_path).filter((p): p is string => !!p);
  const fotos = useUrlsAssinadas(caminhos, caminhos.length > 0, 'carros');

  if (candidaturas.isPending || pedidos.isPending) return <Carregando />;
  const erro = candidaturas.error ?? pedidos.error;
  const lista = candidaturas.data ?? [];
  const entradas = pedidos.data ?? [];

  return (
    <KeyboardAvoidingView style={estilos.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <EntrarComCodigo />
        {erro ? <MensagemErro texto={mensagemErro(erro)} /> : null}
        {entradas.map((p) => (
          <Text key={p.id} style={estilos.entrada}>{`Pedido de entrada na frota ${p.frota_nome} — Aguardando`}</Text>
        ))}
        {lista.length === 0 && entradas.length === 0 ? (
          <ListaVazia texto="Você ainda não se candidatou a nenhum carro." />
        ) : null}
        {lista.map((c) => (
          <LinhaCandidatura
            key={c.id}
            candidatura={c}
            fotoUrl={c.carro.foto_path ? fotos.urls[c.carro.foto_path] ?? null : null}
          />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LinhaCandidatura({ candidatura: c, fotoUrl }: { candidatura: MinhaCandidatura; fotoUrl: string | null }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const cancelar = useMutation({
    mutationFn: () => cancelarCandidatura(c.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidaturas'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <View style={estilos.cartao}>
      <CardCarro
        carro={{ marca: c.carro.marca, modelo: c.carro.modelo, ano_modelo: c.carro.ano_modelo, cor: c.carro.cor, fotoUrl }}
        selo={
          <View style={[estilos.selo, { backgroundColor: COR[c.status] }]}>
            <Text style={estilos.seloTexto}>{ROTULO[c.status]}</Text>
          </View>
        }
        rodape={<Text style={estilos.apoio}>{c.carro.frota_nome}</Text>}
      />
      {erro ? <MensagemErro texto={erro} /> : null}
      {c.status === 'pendente' ? (
        <Botao
          titulo="Cancelar candidatura"
          variante="secundario"
          onPress={() => cancelar.mutate()}
          carregando={cancelar.isPending}
        />
      ) : null}
    </View>
  );
}

function EntrarComCodigo() {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const entrar = useMutation({
    mutationFn: () => entrarComCodigo(codigo.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidaturas'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <View style={estilos.cartao}>
      <Text style={estilos.titulo}>Tem o código de uma frota?</Text>
      <Campo rotulo="Código da frota" valor={codigo} onChange={setCodigo} />
      {erro ? <MensagemErro texto={erro} /> : null}
      {entrar.isSuccess ? <Text style={estilos.sucesso}>Pedido enviado. Aguarde a aprovação do dono.</Text> : null}
      <Botao
        titulo="Entrar com código"
        variante="secundario"
        onPress={() => {
          setErro(null);
          if (codigo.trim()) entrar.mutate();
        }}
        carregando={entrar.isPending}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  cartao: { gap: espaco.sm },
  titulo: { fontSize: 17, fontWeight: '700', color: cores.texto },
  apoio: { fontSize: 14, color: cores.textoSecundario },
  entrada: { fontSize: 15, color: cores.texto, fontWeight: '600' },
  selo: { borderRadius: 12, paddingHorizontal: espaco.sm, paddingVertical: 2 },
  seloTexto: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  sucesso: { fontSize: 15, color: '#2E7D32', fontWeight: '600' },
});
