import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { carroDoItem, listarAvisos, marcarLido, marcarTodosLidos, type Aviso } from '@/api/avisos';
import { Botao } from '@/componentes/Botao';
import { Carregando } from '@/componentes/Carregando';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { formatarDataHoraBrt } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';

const VERMELHO = '#C62828';

export default function Avisos() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const avisos = useQuery({ queryKey: ['avisos', 'lista'], queryFn: () => listarAvisos() });
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Um toque de cada vez: enquanto um aviso abre, novos toques são ignorados.
  const abrindo = useRef(false);

  useRefreshOnFocus(() => avisos.refetch());

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['avisos'] });

  const todos = useMutation({
    mutationFn: marcarTodosLidos,
    onSuccess: invalidar,
    onError: (e) => setErro(mensagemErro(e)),
  });

  async function atualizar() {
    setAtualizando(true);
    try {
      await avisos.refetch();
    } finally {
      setAtualizando(false);
    }
  }

  async function abrir(aviso: Aviso) {
    if (abrindo.current) return;
    abrindo.current = true;
    try {
      await abrirAviso(aviso);
    } finally {
      abrindo.current = false;
    }
  }

  async function abrirAviso(aviso: Aviso) {
    setErro(null);
    try {
      if (!aviso.lida) {
        await marcarLido(aviso.id);
        await invalidar();
      }
    } catch (e) {
      setErro(mensagemErro(e));
      return;
    }
    const ref = aviso.ref_id;
    switch (aviso.ref_tabela) {
      case 'vehicles':
        if (ref) router.push(`/(dono)/carros/${ref}`);
        break;
      case 'vehicle_items': {
        if (!ref) break;
        const carro = await carroDoItem(ref).catch(() => null);
        if (carro) router.push(`/(dono)/carros/${carro}`);
        break;
      }
      case 'maintenance_records':
      case 'incidents':
        router.navigate('/(dono)/(abas)/pendencias');
        break;
      case 'fleet_members':
        router.navigate('/(dono)/(abas)/motoristas');
        break;
    }
  }

  if (avisos.isPending) return <Carregando />;

  const lista = avisos.data;
  if (!lista) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <MensagemErro texto={mensagemErro(avisos.error)} />
          <Botao titulo="Tentar de novo" onPress={() => void avisos.refetch()} />
        </View>
      </View>
    );
  }

  const haNaoLidos = lista.some((a) => !a.lida);

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} />}
    >
      {erro ? <MensagemErro texto={erro} /> : null}
      {haNaoLidos ? (
        <Botao
          titulo="Marcar todos como lidos"
          variante="secundario"
          carregando={todos.isPending}
          onPress={() => {
            setErro(null);
            todos.mutate();
          }}
        />
      ) : null}
      {lista.length === 0 ? <ListaVazia texto="Nenhum aviso por enquanto." /> : null}
      {lista.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          onPress={() => void abrir(a)}
          style={[estilos.cartao, a.prioridade === 'alta' && estilos.cartaoAlta]}
        >
          <Text style={[estilos.titulo, !a.lida && estilos.negrito]}>{a.titulo}</Text>
          <Text style={estilos.corpo}>{a.corpo}</Text>
          <Text style={estilos.data}>{formatarDataHoraBrt(a.criada_em)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.md },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.lg,
    gap: espaco.xs,
  },
  cartaoAlta: { borderLeftWidth: 6, borderLeftColor: VERMELHO },
  titulo: { fontSize: 16, color: cores.texto },
  negrito: { fontWeight: '700' },
  corpo: { fontSize: 15, color: cores.texto },
  data: { fontSize: 13, color: cores.textoSecundario },
});
