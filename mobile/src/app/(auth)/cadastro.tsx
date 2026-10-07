import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { cadastrar } from '@/api/auth';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import { cores, espaco } from '@/lib/tema';

type Papel = 'proprietario' | 'motorista';

const OPCOES: { papel: Papel; titulo: string }[] = [
  { papel: 'proprietario', titulo: 'Sou proprietário' },
  { papel: 'motorista', titulo: 'Sou motorista' },
];

type Erros = { nome?: string; telefone?: string; email?: string; senha?: string; papel?: string };

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function validar(): Erros {
    const e: Erros = {};
    if (!nome.trim()) e.nome = 'Informe seu nome.';
    if (!telefone.trim()) e.telefone = 'Informe seu telefone.';
    if (!email.trim()) e.email = 'Informe seu e-mail.';
    if (senha.length < 6) e.senha = 'A senha precisa ter pelo menos 6 caracteres.';
    if (!papel) e.papel = 'Escolha se você é proprietário ou motorista.';
    return e;
  }

  async function aoCadastrar() {
    setErroGeral(null);
    const e = validar();
    setErros(e);
    if (Object.keys(e).length > 0 || !papel) return;

    setEnviando(true);
    try {
      await cadastrar({
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        senha,
        papel,
      });
      // A sessão criada leva o layout (auth) a redirecionar pela raiz.
    } catch (err) {
      setErroGeral(mensagemErro(err));
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
        <Text style={estilos.titulo}>Crie sua conta</Text>

        <View style={estilos.form}>
          <Campo rotulo="Nome" valor={nome} onChange={setNome} erro={erros.nome} />
          <Campo
            rotulo="Telefone"
            tipo="telefone"
            valor={telefone}
            onChange={setTelefone}
            erro={erros.telefone}
          />
          <Campo
            rotulo="E-mail"
            tipo="email"
            valor={email}
            onChange={setEmail}
            erro={erros.email}
          />
          <Campo
            rotulo="Senha"
            tipo="senha"
            valor={senha}
            onChange={setSenha}
            erro={erros.senha}
          />

          <View style={estilos.opcoes}>
            {OPCOES.map((o) => {
              const marcada = papel === o.papel;
              return (
                <Pressable
                  key={o.papel}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: marcada }}
                  onPress={() => setPapel(o.papel)}
                  style={[estilos.opcao, marcada && estilos.opcaoMarcada]}
                >
                  <Text style={[estilos.opcaoTexto, marcada && estilos.opcaoTextoMarcado]}>
                    {o.titulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {erros.papel ? <MensagemErro texto={erros.papel} /> : null}

          {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
          <Botao titulo="Criar conta" onPress={() => void aoCadastrar()} carregando={enviando} />
        </View>

        <Link href="/(auth)/entrar" style={estilos.link}>
          Já tenho conta
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: espaco.xl, gap: espaco.lg },
  titulo: { fontSize: 28, fontWeight: '700', color: cores.texto, textAlign: 'center' },
  form: { gap: espaco.md },
  opcoes: { flexDirection: 'row', gap: espaco.sm },
  opcao: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: espaco.sm,
  },
  opcaoMarcada: { borderColor: cores.primaria, backgroundColor: '#E3F2FD' },
  opcaoTexto: { fontSize: 15, color: cores.texto },
  opcaoTextoMarcado: { color: cores.primaria, fontWeight: '600' },
  link: { color: cores.primaria, fontSize: 16, textAlign: 'center', padding: espaco.md },
});
