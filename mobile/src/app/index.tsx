import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/Botao';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { cores, espaco } from '@/lib/tema';
import { useSair } from '@/sessao/useSair';
import { useSessao } from '@/sessao/useSessao';

export default function Inicio() {
  const { carregando, sessao, perfil, recarregarPerfil } = useSessao();
  const { aoSair, erroSair, saindo } = useSair();
  const [tentando, setTentando] = useState(false);

  async function tentarDeNovo() {
    setTentando(true);
    try {
      await recarregarPerfil();
    } finally {
      setTentando(false);
    }
  }

  if (carregando) return <Carregando />;
  if (!sessao) return <Redirect href="/(auth)/entrar" />;
  if (!perfil) {
    return (
      <View style={estilos.container}>
        <MensagemErro texto="Não foi possível carregar seu perfil." />
        {erroSair ? <MensagemErro texto={erroSair} /> : null}
        <Botao titulo="Tentar de novo" onPress={() => void tentarDeNovo()} carregando={tentando} />
        <Botao
          titulo="Sair"
          variante="secundario"
          onPress={() => void aoSair()}
          carregando={saindo}
        />
      </View>
    );
  }
  if (perfil.papel === 'proprietario') return <Redirect href="/(dono)/(abas)" />;
  return <Redirect href="/(motorista)" />;
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: espaco.xl,
    gap: espaco.md,
    backgroundColor: cores.fundo,
  },
});
