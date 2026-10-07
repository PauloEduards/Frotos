import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { entrar } from '@/api/auth';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEntrar() {
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.fundo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>Frotos</Text>
        <Text style={estilos.subtitulo}>Controle de manutenção da sua frota</Text>

        <View style={estilos.form}>
          <Campo rotulo="E-mail" tipo="email" valor={email} onChange={setEmail} />
          <Campo rotulo="Senha" tipo="senha" valor={senha} onChange={setSenha} />
          {erro ? <MensagemErro texto={erro} /> : null}
          <Botao titulo="Entrar" onPress={() => void aoEntrar()} carregando={enviando} />
        </View>

        <Link href="/(auth)/cadastro" style={estilos.link}>
          Criar conta
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.lg },
  titulo: { fontSize: 36, fontWeight: '700', color: cores.primaria, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: cores.textoSecundario, textAlign: 'center' },
  form: { gap: espaco.md, marginTop: espaco.lg },
  link: { color: cores.primaria, fontSize: 16, textAlign: 'center', padding: espaco.md },
});
