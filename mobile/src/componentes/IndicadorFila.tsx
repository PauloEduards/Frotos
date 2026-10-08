import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ItemFila, TipoItemFila } from '@/fila/fila';
import { cores, espaco } from '@/lib/tema';

import { Botao } from './Botao';
import { Campo } from './Campo';

const NOME: Record<TipoItemFila, string> = {
  retirada: 'Retirada',
  devolucao: 'Devolução',
  km: 'Atualização de km',
  ocorrencia: 'Ocorrência',
  servico: 'Serviço',
  foto_carro: 'Foto do carro',
};

/** A partir de quantas tentativas sem conexão o usuário pode desistir de um envio. */
export const TENTATIVAS_PARA_DESCARTAR = 5;

type Props = {
  itens: ItemFila[];
  pendentes: number;
  onTentarDeNovo: (id: string) => void;
  onDescartar: (id: string) => void;
  onCorrigirKm?: (id: string, km: number) => void;
};

/** "N envios pendentes" e, para cada item parado, a mensagem com as ações (corrigir km, tentar, descartar). */
export function IndicadorFila({ itens, pendentes, onTentarDeNovo, onDescartar, onCorrigirKm }: Props) {
  const parados = itens.filter((i) => i.erro?.negocio);
  const travados = itens.filter((i) => !i.erro?.negocio && i.tentativas >= TENTATIVAS_PARA_DESCARTAR);
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
        <ItemParado key={i.id} item={i} onTentarDeNovo={onTentarDeNovo} onDescartar={onDescartar} onCorrigirKm={onCorrigirKm} />
      ))}
      {travados.map((i) => (
        <View key={i.id} style={estilos.parado}>
          <Text style={estilos.titulo}>{`Não está conseguindo enviar: ${NOME[i.tipo]}`}</Text>
          <Text style={estilos.erro}>{i.erro?.mensagem}</Text>
          <Botao titulo="Descartar" variante="perigo" onPress={() => onDescartar(i.id)} />
        </View>
      ))}
    </View>
  );
}

function ItemParado({
  item: i,
  onTentarDeNovo,
  onDescartar,
  onCorrigirKm,
}: { item: ItemFila } & Pick<Props, 'onTentarDeNovo' | 'onDescartar' | 'onCorrigirKm'>) {
  const [km, setKm] = useState('');
  const temKm = !!onCorrigirKm && i.acoes.some((a) => 'p_km' in a.args);
  const numero = /^\d+$/.test(km.trim()) ? Number(km.trim()) : null;
  return (
    <View style={estilos.parado}>
      <Text style={estilos.titulo}>{`Não enviado: ${NOME[i.tipo]}`}</Text>
      <Text style={estilos.erro}>{i.erro?.mensagem}</Text>
      {temKm ? (
        <>
          <Campo rotulo="Km correto" tipo="numero" valor={km} onChange={setKm} />
          <Botao
            titulo="Enviar com este km"
            onPress={() => {
              if (numero !== null) onCorrigirKm?.(i.id, numero);
            }}
          />
        </>
      ) : null}
      <View style={estilos.botoes}>
        <Botao titulo="Tentar de novo" variante="secundario" onPress={() => onTentarDeNovo(i.id)} />
        <Botao titulo="Descartar" variante="perigo" onPress={() => onDescartar(i.id)} />
      </View>
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
