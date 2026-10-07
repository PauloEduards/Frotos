import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { atualizarFrota, minhaFrota, type Frota } from '@/api/frota';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { mensagemErro } from '@/lib/erros';
import { invalidarDadosDaFrota } from '@/lib/invalidar';
import { cores, espaco } from '@/lib/tema';

type Modo = Frota['modo_manutencao'];
type NumeroCampo =
  | 'limite_salto_km_dia'
  | 'limiar_amarelo_km'
  | 'limiar_amarelo_dias'
  | 'limiar_laranja_km';

const MODOS: { valor: Modo; rotulo: string }[] = [
  { valor: 'proprietario_leva', rotulo: 'O proprietário leva' },
  { valor: 'motoristas_levam', rotulo: 'Motoristas levam' },
];

// `minimo`: o limite por dia precisa ser maior que zero; os limiares aceitam zero.
const CAMPOS: { chave: NumeroCampo; rotulo: string; minimo: number }[] = [
  { chave: 'limite_salto_km_dia', rotulo: 'Limite de km por dia sem foto do painel', minimo: 1 },
  { chave: 'limiar_amarelo_km', rotulo: 'Amarelo: faltando até (km)', minimo: 0 },
  { chave: 'limiar_amarelo_dias', rotulo: 'Amarelo: faltando até (dias)', minimo: 0 },
  { chave: 'limiar_laranja_km', rotulo: 'Laranja: faltando menos de (km)', minimo: 0 },
];

const MAX_INT = 2147483647;
const NUMERO_INVALIDO = 'Informe um número válido.';

function lerInteiro(texto: string, minimo: number): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= minimo && n <= MAX_INT ? n : null;
}

export default function Configuracoes() {
  const frota = useQuery({ queryKey: ['frota'], queryFn: minhaFrota });

  if (frota.isPending) return <Carregando />;

  if (frota.isError) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <MensagemErro texto={mensagemErro(frota.error)} />
          <Botao titulo="Tentar de novo" onPress={() => void frota.refetch()} />
        </View>
      </View>
    );
  }

  if (!frota.data) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <Text style={estilos.apoio}>Crie sua frota na aba Frota para ajustar as configurações.</Text>
        </View>
      </View>
    );
  }

  return <Formulario frota={frota.data} />;
}

function Formulario({ frota }: { frota: Frota }) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<Modo>(frota.modo_manutencao);
  const [valores, setValores] = useState<Record<NumeroCampo, string>>({
    limite_salto_km_dia: String(frota.limite_salto_km_dia),
    limiar_amarelo_km: String(frota.limiar_amarelo_km),
    limiar_amarelo_dias: String(frota.limiar_amarelo_dias),
    limiar_laranja_km: String(frota.limiar_laranja_km),
  });
  const [erros, setErros] = useState<Partial<Record<NumeroCampo, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const salvar = useMutation({
    mutationFn: (campos: Parameters<typeof atualizarFrota>[1]) => atualizarFrota(frota.id, campos),
    onSuccess: async () => {
      setSalvo(true);
      // Os limiares mudam o status dos carros e itens, e com eles pendências e gastos.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['frota'] }),
        invalidarDadosDaFrota(queryClient),
      ]);
    },
    onError: (e) => setErroGeral(mensagemErro(e)),
  });

  function aoSalvar() {
    setErroGeral(null);
    setSalvo(false);

    const novosErros: Partial<Record<NumeroCampo, string>> = {};
    const numeros = {} as Record<NumeroCampo, number>;
    for (const c of CAMPOS) {
      const n = lerInteiro(valores[c.chave], c.minimo);
      if (n === null) novosErros[c.chave] = NUMERO_INVALIDO;
      else numeros[c.chave] = n;
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    salvar.mutate({ modo_manutencao: modo, ...numeros });
  }

  function alterar(chave: NumeroCampo, texto: string) {
    setSalvo(false);
    setValores((v) => ({ ...v, [chave]: texto }));
  }

  return (
    <KeyboardAvoidingView
      style={estilos.fundo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Seletor
          rotulo="Quem leva o carro à oficina"
          opcoes={MODOS}
          valor={modo}
          onChange={(m) => {
            setSalvo(false);
            setModo(m);
          }}
        />
        {CAMPOS.map((c) => (
          <Campo
            key={c.chave}
            rotulo={c.rotulo}
            tipo="numero"
            valor={valores[c.chave]}
            onChange={(t) => alterar(c.chave, t)}
            erro={erros[c.chave]}
          />
        ))}
        {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
        {salvo ? <Text style={estilos.sucesso}>Configurações salvas.</Text> : null}
        <Botao titulo="Salvar" onPress={aoSalvar} carregando={salvar.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  apoio: { fontSize: 15, color: cores.textoSecundario },
  sucesso: { fontSize: 14, color: '#2E7D32' },
});
