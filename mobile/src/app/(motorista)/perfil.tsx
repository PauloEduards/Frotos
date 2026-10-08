import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { atualizarPerfil } from '@/api/auth';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { mensagemErro } from '@/lib/erros';
import { formatarCpf, UFS } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';
import { useSair } from '@/sessao/useSair';
import { useSessao } from '@/sessao/useSessao';

export default function Perfil() {
  const { perfil, recarregarPerfil } = useSessao();
  const { aoSair, erroSair, saindo } = useSair();
  const [uf, setUf] = useState(perfil?.uf ?? '');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [temCnh, setTemCnh] = useState(perfil?.tem_cnh ?? false);
  const [erroCidade, setErroCidade] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  async function aoSalvar() {
    setErro(null);
    setSalvo(false);
    if (!uf || !cidade.trim()) {
      setErroCidade('Escolha o estado e informe a cidade.');
      return;
    }
    setErroCidade(null);
    setSalvando(true);
    try {
      await atualizarPerfil({ uf, cidade: cidade.trim(), tem_cnh: temCnh });
      await recarregarPerfil();
      setSalvo(true);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>Meu perfil</Text>
        {perfil ? <Text style={estilos.nome}>{perfil.nome}</Text> : null}
        {perfil?.cpf ? <Text style={estilos.apoio}>{`CPF ${formatarCpf(perfil.cpf)}`}</Text> : null}

        <View style={estilos.grupo}>
          <Seletor
            rotulo="Estado"
            opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))}
            valor={uf}
            onChange={(u) => {
              setSalvo(false);
              setUf(u);
            }}
            quebrarLinha
          />
          <Campo
            rotulo="Cidade"
            valor={cidade}
            onChange={(t) => {
              setSalvo(false);
              setCidade(t);
            }}
            erro={erroCidade ?? undefined}
          />
          <View style={estilos.linha}>
            <Text style={estilos.texto}>Tenho CNH</Text>
            <Switch
              accessibilityLabel="Tenho CNH"
              value={temCnh}
              onValueChange={(v) => {
                setSalvo(false);
                setTemCnh(v);
              }}
            />
          </View>
        </View>

        {erro ? <MensagemErro texto={erro} /> : null}
        {salvo ? <Text style={estilos.sucesso}>Perfil salvo.</Text> : null}
        <Botao titulo="Salvar" onPress={() => void aoSalvar()} carregando={salvando} />

        <View style={estilos.sair}>
          {erroSair ? <MensagemErro texto={erroSair} /> : null}
          <Botao titulo="Sair" variante="secundario" onPress={() => void aoSair()} carregando={saindo} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  titulo: { fontSize: 24, fontWeight: '700', color: cores.texto },
  nome: { fontSize: 18, fontWeight: '600', color: cores.texto },
  apoio: { fontSize: 15, color: cores.textoSecundario },
  grupo: { gap: espaco.sm },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  texto: { fontSize: 16, color: cores.texto },
  sucesso: { fontSize: 14, color: '#2E7D32' },
  sair: { gap: espaco.sm, marginTop: espaco.lg },
});
