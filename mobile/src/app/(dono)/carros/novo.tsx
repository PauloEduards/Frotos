import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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

import { minhaFrota } from '@/api/frota';
import { CORES, MARCAS_COMUNS, cadastrarVeiculo, type NovoVeiculo } from '@/api/veiculos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { mensagemErro } from '@/lib/erros';
import { normalizarPlaca } from '@/lib/formatos';
import { invalidarDadosDaFrota } from '@/lib/invalidar';
import { cores, espaco } from '@/lib/tema';

const MAX_INT = 2147483647;
const PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const ANO_MINIMO = 1980;
const KM_DIA_PADRAO = '300';

const OPCOES_COR = CORES.map((c) => ({ valor: c, rotulo: c }));

type Erros = Partial<
  Record<'placa' | 'marca' | 'modelo' | 'ano' | 'cor' | 'km' | 'kmDia', string>
>;

function lerInteiro(texto: string, minimo: number, maximo: number): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= minimo && n <= maximo ? n : null;
}

export default function NovoCarro() {
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
          <Text style={estilos.apoio}>Crie sua frota na aba Frota para cadastrar carros.</Text>
        </View>
      </View>
    );
  }

  return <Formulario fleetId={frota.data.id} />;
}

function Formulario({ fleetId }: { fleetId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [cor, setCor] = useState('');
  const [km, setKm] = useState('');
  const [kmDia, setKmDia] = useState(KM_DIA_PADRAO);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const cadastrar = useMutation({
    mutationFn: (v: NovoVeiculo) => cadastrarVeiculo(fleetId, v),
    onSuccess: async ({ id }) => {
      await invalidarDadosDaFrota(queryClient);
      router.replace(`/(dono)/carros/${id}/itens`);
    },
    onError: (e) => setErroGeral(mensagemErro(e)),
  });

  function aoCadastrar() {
    setErroGeral(null);

    const novosErros: Erros = {};
    const placaNormalizada = normalizarPlaca(placa);
    if (!PLACA.test(placaNormalizada)) novosErros.placa = 'Placa inválida.';

    const marcaLimpa = marca.trim();
    const modeloLimpo = modelo.trim();
    // Uma mensagem só, no primeiro campo que falta.
    if (!marcaLimpa) novosErros.marca = 'Informe a marca e o modelo.';
    else if (!modeloLimpo) novosErros.modelo = 'Informe a marca e o modelo.';

    const anoMaximo = new Date().getFullYear() + 1;
    const anoNumero = lerInteiro(ano, ANO_MINIMO, anoMaximo);
    if (anoNumero === null) novosErros.ano = 'Ano inválido.';

    if (!cor) novosErros.cor = 'Escolha a cor.';

    const kmNumero = lerInteiro(km, 0, MAX_INT);
    if (kmNumero === null) novosErros.km = 'Informe o km atual.';

    const kmDiaNumero = lerInteiro(kmDia, 1, MAX_INT);
    if (kmDiaNumero === null) novosErros.kmDia = 'Informe o km por dia.';

    setErros(novosErros);
    if (
      Object.keys(novosErros).length > 0 ||
      anoNumero === null ||
      kmNumero === null ||
      kmDiaNumero === null
    ) {
      return;
    }

    cadastrar.mutate({
      placa: placaNormalizada,
      marca: marcaLimpa,
      modelo: modeloLimpo,
      ano_modelo: anoNumero,
      cor,
      km_atual: kmNumero,
      km_dia_estimado: kmDiaNumero,
    });
  }

  return (
    <KeyboardAvoidingView
      style={estilos.fundo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Campo rotulo="Placa" valor={placa} onChange={setPlaca} erro={erros.placa} />

        <View style={estilos.grupo}>
          <Campo rotulo="Marca" valor={marca} onChange={setMarca} erro={erros.marca} />
          <View style={estilos.chips}>
            {MARCAS_COMUNS.map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: marca === m }}
                onPress={() => setMarca(m)}
                style={[estilos.chip, marca === m && estilos.chipMarcado]}
              >
                <Text style={[estilos.chipTexto, marca === m && estilos.chipTextoMarcado]}>
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Campo rotulo="Modelo" valor={modelo} onChange={setModelo} erro={erros.modelo} />
        <Campo rotulo="Ano" tipo="numero" valor={ano} onChange={setAno} erro={erros.ano} />

        <View style={estilos.grupo}>
          <Seletor rotulo="Cor" opcoes={OPCOES_COR} valor={cor} onChange={setCor} quebrarLinha />
          {erros.cor ? <Text style={estilos.erro}>{erros.cor}</Text> : null}
        </View>

        <Campo rotulo="Km atual" tipo="numero" valor={km} onChange={setKm} erro={erros.km} />

        <View style={estilos.grupo}>
          <Campo
            rotulo="Km por dia"
            tipo="numero"
            valor={kmDia}
            onChange={setKmDia}
            erro={erros.kmDia}
          />
          <Text style={estilos.apoio}>
            Quanto o carro roda por dia, em média. O app ajusta sozinho com as leituras dos
            motoristas.
          </Text>
        </View>

        {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
        <Botao titulo="Cadastrar carro" onPress={aoCadastrar} carregando={cadastrar.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  grupo: { gap: espaco.sm },
  apoio: { fontSize: 13, color: cores.textoSecundario },
  erro: { fontSize: 13, color: '#C62828' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: espaco.md,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  chipMarcado: { borderColor: cores.primaria, backgroundColor: '#E3F2FD' },
  chipTexto: { fontSize: 14, color: cores.texto },
  chipTextoMarcado: { color: cores.primaria, fontWeight: '600' },
});
