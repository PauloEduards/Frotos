import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FotoCapturada } from '@/lib/camera';
import { cores, espaco } from '@/lib/tema';

import { Botao } from './Botao';
import { Campo } from './Campo';
import { CampoFoto } from './CampoFoto';
import { MensagemErro } from './MensagemErro';

export type PosicaoFoto = 'frente' | 'traseira' | 'lateral_esq' | 'lateral_dir' | 'painel';
export type FotoDaSequencia = FotoCapturada & { posicao: PosicaoFoto };

const PASSOS: { posicao: PosicaoFoto; rotulo: string; dica: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { posicao: 'frente', rotulo: 'Frente', dica: 'Afaste-se e pegue o carro inteiro, de frente.', icone: 'car' },
  { posicao: 'traseira', rotulo: 'Traseira', dica: 'O carro inteiro, de trás, com a placa.', icone: 'car-sport' },
  { posicao: 'lateral_esq', rotulo: 'Lateral esquerda', dica: 'O lado do motorista, de ponta a ponta.', icone: 'arrow-back' },
  { posicao: 'lateral_dir', rotulo: 'Lateral direita', dica: 'O lado do passageiro, de ponta a ponta.', icone: 'arrow-forward' },
  { posicao: 'painel', rotulo: 'Painel', dica: 'Com o carro ligado, mostrando o km.', icone: 'speedometer' },
];

type Props = {
  momento: 'retirada' | 'devolucao';
  onConcluir: (fotos: FotoDaSequencia[], km: number) => void;
  enviando?: boolean;
  erro?: string | null;
};

/** Retirada/devolução guiada: 5 fotos em ordem (sem galeria) e, depois do painel, o km. */
export function SequenciaFotos({ momento, onConcluir, enviando = false, erro }: Props) {
  const [passo, setPasso] = useState(0);
  const [fotos, setFotos] = useState<Partial<Record<PosicaoFoto, FotoCapturada>>>({});
  const [km, setKm] = useState('');
  const [erroKm, setErroKm] = useState<string | undefined>();

  const atual = PASSOS[passo];
  const foto = fotos[atual.posicao];
  const ultimo = passo === PASSOS.length - 1;

  function concluir() {
    const numero = /^\d+$/.test(km.trim()) ? Number(km.trim()) : null;
    if (numero === null) {
      setErroKm('Informe o km.');
      return;
    }
    setErroKm(undefined);
    const lista = PASSOS.map((p) => ({ ...(fotos[p.posicao] as FotoCapturada), posicao: p.posicao }));
    onConcluir(lista, numero);
  }

  return (
    <View style={estilos.container}>
      <Text style={estilos.momento}>{momento === 'retirada' ? 'Retirada do carro' : 'Devolução do carro'}</Text>
      <Text style={estilos.passo}>{`Foto ${passo + 1} de ${PASSOS.length} · ${atual.rotulo}`}</Text>
      <Text style={estilos.dica}>{atual.dica}</Text>
      <CampoFoto
        key={atual.posicao}
        titulo={`Tirar foto: ${atual.rotulo}`}
        icone={atual.icone}
        uri={foto?.uri}
        onFoto={(f) => setFotos((anteriores) => ({ ...anteriores, [atual.posicao]: f }))}
      />

      {ultimo && foto ? (
        <Campo rotulo="Km do painel" tipo="numero" valor={km} onChange={setKm} erro={erroKm} />
      ) : null}
      {erro ? <MensagemErro texto={erro} /> : null}

      <View style={estilos.botoes}>
        {passo > 0 ? <Botao titulo="Voltar" variante="secundario" onPress={() => setPasso(passo - 1)} /> : null}
        {foto && !ultimo ? <Botao titulo="Próxima" onPress={() => setPasso(passo + 1)} /> : null}
        {foto && ultimo ? <Botao titulo="Concluir" onPress={concluir} carregando={enviando} /> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: espaco.md },
  momento: { fontSize: 22, fontWeight: '700', color: cores.texto },
  passo: { fontSize: 18, fontWeight: '600', color: cores.primaria },
  dica: { fontSize: 15, color: cores.textoSecundario },
  botoes: { gap: espaco.sm },
});
