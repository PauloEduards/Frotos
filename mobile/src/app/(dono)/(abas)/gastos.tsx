import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { minhaFrota } from '@/api/frota';
import { gastosRealizados, projecaoGastos } from '@/api/gastos';
import { Botao } from '@/componentes/Botao';
import { Carregando } from '@/componentes/Carregando';
import { GraficoBarras } from '@/componentes/GraficoBarras';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { SemFrota } from '@/componentes/SemFrota';
import {
  porCarro,
  porItem,
  porPeriodo,
  revisoesRecomendadas,
  totalPrevisto,
  totalRealizado,
} from '@/features/gastos/agregar';
import { mensagemErro } from '@/lib/erros';
import { formatarReais, hojeBrt } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';

type Periodo = '30' | '60' | '90';

const OPCOES: { valor: Periodo; rotulo: string }[] = [
  { valor: '30', rotulo: '30 dias' },
  { valor: '60', rotulo: '60 dias' },
  { valor: '90', rotulo: '90 dias' },
];

export default function Gastos() {
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const dias = Number(periodo) as 30 | 60 | 90;

  const frota = useQuery({ queryKey: ['frota'], queryFn: minhaFrota });
  const fleetId = frota.data?.id;
  const habilitado = fleetId !== undefined;
  const projecao = useQuery({
    queryKey: ['gastos', 'projecao', fleetId, dias],
    queryFn: () => projecaoGastos(fleetId as string, dias),
    enabled: habilitado,
  });
  const realizado = useQuery({
    queryKey: ['gastos', 'realizado', fleetId, dias],
    queryFn: () => gastosRealizados(fleetId as string, dias),
    enabled: habilitado,
  });

  const [atualizando, setAtualizando] = useState(false);

  function recarregar() {
    return Promise.all([frota.refetch(), ...(habilitado ? [projecao.refetch(), realizado.refetch()] : [])]);
  }

  async function atualizar() {
    setAtualizando(true);
    try {
      await recarregar();
    } finally {
      setAtualizando(false);
    }
  }

  useRefreshOnFocus(recarregar);

  const erro = frota.isError ? frota.error : projecao.isError ? projecao.error : realizado.isError ? realizado.error : null;
  const carregando = frota.isPending || (habilitado && (projecao.isPending || realizado.isPending));

  function tentarDeNovo() {
    if (frota.isError) void frota.refetch();
    if (projecao.isError) void projecao.refetch();
    if (realizado.isError) void realizado.refetch();
  }

  let corpo;
  if (carregando && !erro) {
    corpo = <Carregando />;
  } else if (frota.data === null) {
    corpo = <SemFrota />;
  } else if (erro) {
    corpo = (
      <View style={estilos.bloco}>
        <MensagemErro texto={mensagemErro(erro)} />
        <Botao titulo="Tentar de novo" onPress={tentarDeNovo} />
      </View>
    );
  } else {
    corpo = (
      <Resultado
        dias={dias}
        linhas={projecao.data ?? []}
        gasto={totalRealizado(realizado.data ?? [])}
      />
    );
  }

  return (
    <ScrollView
      testID="gastos"
      style={estilos.fundo}
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        habilitado ? <RefreshControl refreshing={atualizando} onRefresh={() => void atualizar()} /> : undefined
      }
    >
      <Seletor opcoes={OPCOES} valor={periodo} onChange={setPeriodo} rotulo="Período" />
      {corpo}
    </ScrollView>
  );
}

function Resultado({
  dias,
  linhas,
  gasto,
}: {
  dias: 30 | 60 | 90;
  linhas: Parameters<typeof porCarro>[0];
  gasto: number;
}) {
  const barras = porPeriodo(linhas, dias, hojeBrt());
  const carros = porCarro(linhas);
  const itens = porItem(linhas);
  const revisoes = revisoesRecomendadas(linhas);
  const semPrevisao = carros.length === 0;

  return (
    <>
      <View style={estilos.cartao}>
        <Text style={estilos.valor}>{`Previsto: ${formatarReais(totalPrevisto(linhas))}`}</Text>
        <Text style={estilos.detalhe}>{`Gasto nos últimos ${dias} dias: ${formatarReais(gasto)}`}</Text>
        {dias > 30 ? <Text style={estilos.aviso}>Quanto mais longe, menos precisa é a previsão.</Text> : null}
      </View>

      {semPrevisao ? (
        <ListaVazia texto="Sem gastos previstos para este período." />
      ) : (
        <>
          <View style={estilos.cartao}>
            <GraficoBarras barras={barras} formatarValor={formatarReais} />
          </View>

          <View style={estilos.bloco}>
            <Text style={estilos.secao}>Por carro</Text>
            {carros.map((c) => (
              <View key={c.vehicle_id} style={estilos.linha}>
                <Text style={estilos.texto}>{c.placa}</Text>
                <Text style={estilos.texto}>{formatarReais(c.total)}</Text>
              </View>
            ))}
          </View>

          <View style={estilos.bloco}>
            <Text style={estilos.secao}>Por item</Text>
            {itens.map((i) => (
              <Text key={i.item_nome} style={estilos.texto}>
                {`${i.item_nome} · ${i.quantidade}x · ${formatarReais(i.total)}`}
              </Text>
            ))}
          </View>
        </>
      )}

      {revisoes.length > 0 ? (
        <View style={estilos.bloco}>
          <Text style={estilos.secao}>Revisão recomendada</Text>
          {revisoes.map((r) => (
            <Text key={`${r.vehicle_id}-${r.vehicle_item_id}`} style={estilos.texto}>
              {`${r.placa} · ${r.item_nome}`}
            </Text>
          ))}
        </View>
      ) : null}
    </>
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
  valor: { fontSize: 22, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: 15, color: cores.textoSecundario },
  aviso: { fontSize: 14, color: cores.textoSecundario },
  linha: { flexDirection: 'row', justifyContent: 'space-between' },
  texto: { fontSize: 16, color: cores.texto },
});
