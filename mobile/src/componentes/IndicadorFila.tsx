import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { ItemFila, TipoItemFila } from '@/fila/fila';
import { cores, espaco } from '@/lib/tema';

import { Botao } from './Botao';

const NOME: Record<TipoItemFila, string> = {
  retirada: 'Retirada',
  devolucao: 'Devolução',
  km: 'Atualização de km',
  ocorrencia: 'Ocorrência',
  servico: 'Serviço',
  foto_carro: 'Foto do carro',
};

type Props = {
  itens: ItemFila[];
  pendentes: number;
  onTentarDeNovo: (id: string) => void;
  onDescartar: (id: string) => void;
};

/** "N envios pendentes" e, para cada item parado por erro de negócio, a mensagem com as ações. */
export function IndicadorFila({ itens, pendentes, onTentarDeNovo, onDescartar }: Props) {
  const parados = itens.filter((i) => i.erro?.negocio);
  if (pendentes === 0 && parados.length === 0) return null;

  return (
    <View style={estilos.caixa}>
      {pendentes > 0 ? (
        <View style={estilos.linha}>
          <Ionicons name="cloud-upload" size={20} color={cores.primaria} />
          <Text style={estilos.texto}>
            {pendentes === 1 ? '1 envio pendente' : `${pendentes} envios pendentes`}
          </Text>
        </View>
      ) : null}
      {parados.map((i) => (
        <View key={i.id} style={estilos.parado}>
          <Text style={estilos.titulo}>{`Não enviado: ${NOME[i.tipo]}`}</Text>
          <Text style={estilos.erro}>{i.erro?.mensagem}</Text>
          <View style={estilos.botoes}>
            <Botao titulo="Tentar de novo" variante="secundario" onPress={() => onTentarDeNovo(i.id)} />
            <Botao titulo="Descartar" variante="perigo" onPress={() => onDescartar(i.id)} />
          </View>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    gap: espaco.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.md,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  texto: { fontSize: 15, color: cores.texto, fontWeight: '600' },
  parado: { gap: espaco.xs },
  titulo: { fontSize: 15, fontWeight: '700', color: '#C62828' },
  erro: { fontSize: 14, color: cores.texto },
  botoes: { gap: espaco.sm },
});
