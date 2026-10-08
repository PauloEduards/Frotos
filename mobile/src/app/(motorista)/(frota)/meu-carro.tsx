import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { meuCarro, pedidosDoMotorista, permissaoRegistro, type CarroFrota } from '@/api/meuCarro';
import { previsaoItens } from '@/api/veiculos';
import { BadgeStatus } from '@/componentes/BadgeStatus';
import { Botao } from '@/componentes/Botao';
import { CardCarro } from '@/componentes/CardCarro';
import { Carregando } from '@/componentes/Carregando';
import { IndicadorFila } from '@/componentes/IndicadorFila';
import { MensagemErro } from '@/componentes/MensagemErro';
import { useFila } from '@/fila/useFila';
import { mensagemErro } from '@/lib/erros';
import { formatarData, formatarKm } from '@/lib/formatos';
import { descreverPrevisao } from '@/lib/previsao';
import { cores, espaco } from '@/lib/tema';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { useUrlsAssinadas } from '@/lib/useUrlsAssinadas';

export default function MeuCarro() {
  const router = useRouter();
  const fila = useFila();
  const estado = useQuery({ queryKey: ['meu-carro'], queryFn: meuCarro });
  const [atualizando, setAtualizando] = useState(false);
  useRefreshOnFocus(() => void estado.refetch());

  const carro = estado.data?.carro ?? estado.data?.reservado ?? null;
  const foto = useUrlsAssinadas(carro?.foto_path ? [carro.foto_path] : [], !!carro?.foto_path, 'carros');

  async function atualizar() {
    setAtualizando(true);
    try {
      await Promise.all([estado.refetch(), fila.enviarAgora()]);
    } finally {
      setAtualizando(false);
    }
  }

  if (estado.isPending) return <Carregando />;
  if (estado.isError) {
    return (
      <View style={[estilos.fundo, estilos.conteudo]}>
        <MensagemErro texto={mensagemErro(estado.error)} />
        <Botao titulo="Tentar de novo" onPress={() => void estado.refetch()} />
      </View>
    );
  }

  const { vinculo, reservado } = estado.data;
  const fotoUrl = carro?.foto_path ? foto.urls[carro.foto_path] ?? null : null;
  const rota = (fluxo: string, c: CarroFrota, extra = '') =>
    `/(motorista)/fluxos/${fluxo}?carro=${c.vehicle_id}&frota=${c.fleet_id}${extra}` as Href;

  const itemFila = vinculo
    ? fila.itens.find((i) => i.acoes.some((a) => a.args.p_assignment_id === vinculo.id))
    : undefined;

  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} />}
    >
      <IndicadorFila
        itens={fila.itens}
        pendentes={fila.pendentes}
        onTentarDeNovo={(id) => void fila.tentarDeNovo(id)}
        onDescartar={(id) => void fila.descartar(id)}
      />

      {!vinculo && !reservado ? (
        <View style={estilos.vazio}>
          <Ionicons name="car-outline" size={56} color={cores.textoSecundario} />
          <Text style={estilos.titulo}>Escolha um carro na aba Carros</Text>
        </View>
      ) : null}

      {!vinculo && reservado ? (
        <>
          <CardCarro tamanhoPlaca="grande" carro={{ ...reservado, fotoUrl }} />
          <Text style={estilos.apoio}>Este carro está reservado para você.</Text>
          <Botao
            titulo="Retirar este carro"
            onPress={() =>
              router.push(`/(motorista)/fluxos/fotos-carro?momento=retirada&carro=${reservado.vehicle_id}&frota=${reservado.fleet_id}`)
            }
          />
        </>
      ) : null}

      {vinculo && carro && vinculo.status === 'aguardando_fotos' ? (
        <>
          <CardCarro tamanhoPlaca="grande" carro={{ ...carro, fotoUrl }} />
          {itemFila ? (
            <Text style={estilos.enviando}>
              {`Enviando… ${itemFila.fotos.filter((f) => f.enviada).length}/${itemFila.fotos.length}`}
            </Text>
          ) : (
            <Botao
              titulo="Continuar retirada"
              onPress={() =>
                router.push(
                  `/(motorista)/fluxos/fotos-carro?momento=retirada&carro=${carro.vehicle_id}&frota=${carro.fleet_id}&vinculo=${vinculo.id}`,
                )
              }
            />
          )}
        </>
      ) : null}

      {vinculo && carro && vinculo.status === 'ativo' ? (
        <ComOCarro carro={carro} vinculoId={vinculo.id} fotoUrl={fotoUrl} rota={rota} />
      ) : null}
    </ScrollView>
  );
}

function ComOCarro({
  carro,
  vinculoId,
  fotoUrl,
  rota,
}: {
  carro: CarroFrota;
  vinculoId: string;
  fotoUrl: string | null;
  rota: (fluxo: string, c: CarroFrota, extra?: string) => Href;
}) {
  const router = useRouter();
  const previsao = useQuery({ queryKey: ['meu-carro', 'previsao', carro.vehicle_id], queryFn: () => previsaoItens(carro.vehicle_id) });
  const pedidos = useQuery({ queryKey: ['meu-carro', 'pedidos', carro.vehicle_id], queryFn: () => pedidosDoMotorista(carro.vehicle_id) });
  const permissao = useQuery({ queryKey: ['meu-carro', 'permissao', carro.vehicle_id], queryFn: () => permissaoRegistro(carro.vehicle_id) });

  const proximos = (previsao.data ?? []).filter((i) => i.status !== 'em_dia').slice(0, 5);
  const pedido = pedidos.data?.[0];
  const podeRegistrar = !!pedido || (permissao.data !== undefined && permissao.data !== 'negado');

  return (
    <>
      <CardCarro tamanhoPlaca="grande" carro={{ ...carro, fotoUrl }} rodape={<Text style={estilos.apoio}>{`Km atual: ${formatarKm(carro.km_atual)}`}</Text>} />

      <View style={estilos.botoes}>
        <BotaoGrande icone="speedometer" titulo="Atualizar km" onPress={() => router.push(rota('atualizar-km', carro))} />
        <BotaoGrande icone="warning" titulo="Relatar ocorrência" onPress={() => router.push(rota('ocorrencia', carro))} />
        {podeRegistrar ? (
          <BotaoGrande
            icone="construct"
            titulo="Registrar serviço"
            onPress={() => router.push(rota('servico', carro, pedido ? `&pedido=${pedido.id}` : ''))}
          />
        ) : null}
        <BotaoGrande
          icone="key"
          titulo="Devolver carro"
          onPress={() =>
            router.push(`/(motorista)/fluxos/fotos-carro?momento=devolucao&carro=${carro.vehicle_id}&frota=${carro.fleet_id}&vinculo=${vinculoId}`)
          }
        />
      </View>

      {pedido ? (
        <View style={estilos.cartao}>
          <Text style={estilos.titulo}>{`Pedido de manutenção até ${formatarData(pedido.prazo)}`}</Text>
          {pedido.observacao ? <Text style={estilos.apoio}>{pedido.observacao}</Text> : null}
        </View>
      ) : null}

      <View style={estilos.cartao}>
        <Text style={estilos.titulo}>Próximas manutenções</Text>
        {previsao.isError ? <MensagemErro texto={mensagemErro(previsao.error)} /> : null}
        {previsao.data && proximos.length === 0 ? <Text style={estilos.apoio}>Tudo em dia.</Text> : null}
        {proximos.map((i) => (
          <View key={i.vehicle_item_id} style={estilos.item}>
            <View style={estilos.itemTopo}>
              <Text style={estilos.itemNome}>{i.nome}</Text>
              <BadgeStatus status={i.status} />
            </View>
            <Text style={estilos.apoio}>{descreverPrevisao(i)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function BotaoGrande({ icone, titulo, onPress }: { icone: keyof typeof Ionicons.glyphMap; titulo: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [estilos.grande, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icone} size={32} color={cores.primaria} />
      <Text style={estilos.grandeTexto}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  vazio: { alignItems: 'center', gap: espaco.md, paddingVertical: espaco.xl },
  titulo: { fontSize: 18, fontWeight: '700', color: cores.texto },
  apoio: { fontSize: 15, color: cores.textoSecundario },
  enviando: { fontSize: 18, fontWeight: '700', color: cores.primaria, textAlign: 'center' },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  grande: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.md,
  },
  grandeTexto: { fontSize: 15, fontWeight: '600', color: cores.texto, textAlign: 'center' },
  cartao: { gap: espaco.sm, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: cores.borda, padding: espaco.md },
  item: { gap: espaco.xs, paddingVertical: espaco.xs },
  itemTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.sm },
  itemNome: { fontSize: 16, fontWeight: '600', color: cores.texto, flex: 1 },
});
