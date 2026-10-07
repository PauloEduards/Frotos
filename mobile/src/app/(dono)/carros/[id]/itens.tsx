import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
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

import {
  adicionarItem,
  atualizarItem,
  definirHistoricoInicial,
  listarItens,
  sugestaoCusto,
  type ItemVeiculo,
  type PlanoItem,
} from '@/api/veiculos';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { Carregando } from '@/componentes/Carregando';
import { MensagemErro } from '@/componentes/MensagemErro';
import { mensagemErro } from '@/lib/erros';
import {
  dataBrParaIso,
  formatarData,
  formatarKm,
  formatarReais,
  lerReais,
  mascararData,
} from '@/lib/formatos';
import { corStatus } from '@/lib/status';
import { cores, espaco } from '@/lib/tema';

const MAX_INT = 2147483647;
const NOVO = 'novo';
const ERRO_INTERVALO = 'Informe o intervalo em km, em meses ou ambos.';

/** Texto de um campo numérico → inteiro; '' → null; null também para inválido (ver `valido`). */
function lerInteiro(texto: string): { valido: boolean; valor: number | null } {
  const t = texto.trim();
  if (t === '') return { valido: true, valor: null };
  if (!/^\d+$/.test(t)) return { valido: false, valor: null };
  const n = Number(t);
  return n > MAX_INT ? { valido: false, valor: null } : { valido: true, valor: n };
}

function paraCampoReais(n: number): string {
  return formatarReais(n).replace('R$ ', '');
}

function descreverIntervalo(kmIntervalo: number | null, meses: number | null): string {
  const partes: string[] = [];
  if (kmIntervalo !== null) partes.push(formatarKm(kmIntervalo));
  if (meses !== null) partes.push(meses === 1 ? '1 mês' : `${meses} meses`);
  return `a cada ${partes.join(' ou ')}`;
}

function descreverHistorico(item: ItemVeiculo): string {
  if (item.km_inicial === null && item.data_inicial === null) return 'Sem histórico — revisar';
  const partes: string[] = [];
  if (item.km_inicial !== null) partes.push(formatarKm(item.km_inicial));
  if (item.data_inicial !== null) partes.push(`em ${formatarData(item.data_inicial)}`);
  return `Última troca: ${partes.join(' ')}`;
}

type CamposPlano = { km: string; meses: string; custo: string };
type ErrosPlano = Partial<Record<'km' | 'meses' | 'custo' | 'intervalo', string>>;

/** Valida intervalos e custo; 0 ou vazio em um intervalo significa "sem esse intervalo". */
function lerPlano(c: CamposPlano): { plano: PlanoItem | null; erros: ErrosPlano } {
  const erros: ErrosPlano = {};
  const km = lerInteiro(c.km);
  const meses = lerInteiro(c.meses);
  if (!km.valido) erros.km = 'Intervalo inválido.';
  if (!meses.valido) erros.meses = 'Intervalo inválido.';

  const intervaloKm = km.valor === 0 ? null : km.valor;
  const intervaloMeses = meses.valor === 0 ? null : meses.valor;
  if (km.valido && meses.valido && intervaloKm === null && intervaloMeses === null) {
    erros.intervalo = ERRO_INTERVALO;
  }

  let custo = 0;
  if (c.custo.trim() !== '') {
    const lido = lerReais(c.custo);
    if (lido === null) erros.custo = 'Custo inválido.';
    else custo = lido;
  }

  if (Object.keys(erros).length > 0) return { plano: null, erros };
  return {
    plano: { intervalo_km: intervaloKm, intervalo_meses: intervaloMeses, custo_estimado: custo },
    erros,
  };
}

function CamposDoPlano({
  campos,
  onChange,
  erros,
}: {
  campos: CamposPlano;
  onChange: (c: CamposPlano) => void;
  erros: ErrosPlano;
}) {
  return (
    <>
      <Campo
        rotulo="Intervalo em km"
        tipo="numero"
        valor={campos.km}
        onChange={(km) => onChange({ ...campos, km })}
        erro={erros.km}
      />
      <Campo
        rotulo="Intervalo em meses"
        tipo="numero"
        valor={campos.meses}
        onChange={(meses) => onChange({ ...campos, meses })}
        erro={erros.meses}
      />
      {erros.intervalo ? <Text style={estilos.erro}>{erros.intervalo}</Text> : null}
    </>
  );
}

export default function ItensDoCarro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itens = useQuery({ queryKey: ['itens', id], queryFn: () => listarItens(id) });
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (itens.isPending) return <Carregando />;

  if (itens.isError) {
    return (
      <View style={estilos.fundo}>
        <View style={estilos.conteudo}>
          <MensagemErro texto={mensagemErro(itens.error)} />
          <Botao titulo="Tentar de novo" onPress={() => void itens.refetch()} />
        </View>
      </View>
    );
  }

  function alternar(chave: string) {
    setAviso(null);
    setAberto((atual) => (atual === chave ? null : chave));
  }

  return (
    <KeyboardAvoidingView
      style={estilos.fundo}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={estilos.titulo}>
          Plano de manutenção
        </Text>
        <Text style={estilos.apoio}>
          Informe quando cada item foi trocado pela última vez. Se não souber, deixe em branco.
        </Text>

        {aviso ? <Text style={estilos.aviso}>{aviso}</Text> : null}

        {itens.data
          .filter((item) => item.ativo)
          .map((item) => (
            <View key={item.id} style={estilos.cartao}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: aberto === item.id }}
                onPress={() => alternar(item.id)}
                style={estilos.resumo}
              >
                <Text style={estilos.nome}>{item.nome}</Text>
                <Text style={estilos.detalhe}>
                  {descreverIntervalo(item.intervalo_km, item.intervalo_meses)}
                </Text>
                <Text style={estilos.detalhe}>
                  {`Custo estimado ${formatarReais(item.custo_estimado)}`}
                </Text>
                <Text
                  style={
                    item.km_inicial === null && item.data_inicial === null
                      ? estilos.semHistorico
                      : estilos.detalhe
                  }
                >
                  {descreverHistorico(item)}
                </Text>
              </Pressable>
              {aberto === item.id ? (
                <EditorItem
                  key={item.id}
                  item={item}
                  onFechar={() => setAberto(null)}
                  onAviso={setAviso}
                />
              ) : null}
            </View>
          ))}

        {aberto === NOVO ? (
          <NovoItem vehicleId={id} onFechar={() => setAberto(null)} />
        ) : (
          <Botao titulo="Adicionar item" variante="secundario" onPress={() => alternar(NOVO)} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditorItem({
  item,
  onFechar,
  onAviso,
}: {
  item: ItemVeiculo;
  onFechar: () => void;
  onAviso: (texto: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [kmInicial, setKmInicial] = useState(item.km_inicial === null ? '' : String(item.km_inicial));
  const [dataInicial, setDataInicial] = useState(item.data_inicial ? formatarData(item.data_inicial) : '');
  const [plano, setPlano] = useState<CamposPlano>({
    km: item.intervalo_km === null ? '' : String(item.intervalo_km),
    meses: item.intervalo_meses === null ? '' : String(item.intervalo_meses),
    custo: paraCampoReais(item.custo_estimado),
  });
  const [erros, setErros] = useState<ErrosPlano & { kmInicial?: string; dataInicial?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [pendente, setPendente] = useState<PlanoItem | null>(null);

  const sugestao = useQuery({
    queryKey: ['sugestao-custo', item.id],
    queryFn: () => sugestaoCusto(item.id),
  });

  function recarregar() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['itens'] }),
      queryClient.invalidateQueries({ queryKey: ['veiculos'] }),
    ]);
  }

  const salvarHistorico = useMutation({
    mutationFn: (v: { km: number | null; data: string | null; plano: PlanoItem }) =>
      definirHistoricoInicial(item.id, v.km, v.data),
    onSuccess: async (_, v) => {
      const mudouPlano =
        v.plano.intervalo_km !== item.intervalo_km ||
        v.plano.intervalo_meses !== item.intervalo_meses ||
        v.plano.custo_estimado !== item.custo_estimado;
      if (mudouPlano) setPendente(v.plano);
      else onFechar();
      await recarregar();
    },
    onError: (e) => setErroGeral(mensagemErro(e)),
  });

  const aplicar = useMutation({
    mutationFn: (v: { plano: PlanoItem; emTodos: boolean }) =>
      atualizarItem(item.id, v.plano, v.emTodos),
    onSuccess: async (qtd, v) => {
      onAviso(v.emTodos ? `Alterado em ${qtd} ${qtd === 1 ? 'carro' : 'carros'}.` : null);
      onFechar();
      await recarregar();
    },
    onError: (e) => setErroGeral(mensagemErro(e)),
  });

  function aoSalvar() {
    setErroGeral(null);
    const novosErros: typeof erros = {};

    const km = lerInteiro(kmInicial);
    if (!km.valido) novosErros.kmInicial = 'Km inválido.';

    let data: string | null = null;
    if (dataInicial.trim() !== '') {
      data = dataBrParaIso(dataInicial);
      if (data === null) novosErros.dataInicial = 'Data inválida.';
    }

    const lido = lerPlano(plano);
    setErros({ ...novosErros, ...lido.erros });
    if (Object.keys(novosErros).length > 0 || !lido.plano) return;

    salvarHistorico.mutate({ km: km.valor, data, plano: lido.plano });
  }

  if (pendente) {
    return (
      <View style={estilos.editor}>
        <Text style={estilos.pergunta}>Aplicar esta mudança a:</Text>
        {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
        <Botao
          titulo="Só este carro"
          carregando={aplicar.isPending}
          onPress={() => {
            setErroGeral(null);
            aplicar.mutate({ plano: pendente, emTodos: false });
          }}
        />
        <Botao
          titulo="Todos os carros da frota"
          carregando={aplicar.isPending}
          onPress={() => {
            setErroGeral(null);
            aplicar.mutate({ plano: pendente, emTodos: true });
          }}
        />
        <Botao
          titulo="Cancelar"
          variante="secundario"
          onPress={() => {
            setErroGeral(null);
            setPendente(null);
          }}
        />
      </View>
    );
  }

  return (
    <View style={estilos.editor}>
      <Campo
        rotulo="Última troca: km"
        tipo="numero"
        valor={kmInicial}
        onChange={setKmInicial}
        erro={erros.kmInicial}
      />
      <Campo
        rotulo="Última troca: data (dd/mm/aaaa)"
        tipo="numero"
        valor={dataInicial}
        onChange={(t) => setDataInicial(mascararData(t))}
        erro={erros.dataInicial}
      />
      <CamposDoPlano campos={plano} onChange={setPlano} erros={erros} />
      <Campo
        rotulo="Custo estimado (R$)"
        valor={plano.custo}
        onChange={(custo) => setPlano({ ...plano, custo })}
        erro={erros.custo}
      />
      {sugestao.data != null ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPlano({ ...plano, custo: paraCampoReais(sugestao.data as number) })}
        >
          <Text style={estilos.sugestao}>
            {`Média paga: ${formatarReais(sugestao.data)} — usar este valor`}
          </Text>
        </Pressable>
      ) : null}
      {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
      <Botao titulo="Salvar" onPress={aoSalvar} carregando={salvarHistorico.isPending} />
    </View>
  );
}

function NovoItem({ vehicleId, onFechar }: { vehicleId: string; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [plano, setPlano] = useState<CamposPlano>({ km: '', meses: '', custo: '' });
  const [erros, setErros] = useState<ErrosPlano & { nome?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const adicionar = useMutation({
    mutationFn: (v: PlanoItem & { nome: string }) => adicionarItem(vehicleId, v),
    onSuccess: async () => {
      onFechar();
      await queryClient.invalidateQueries({ queryKey: ['itens', vehicleId] });
    },
    onError: (e) => setErroGeral(mensagemErro(e)),
  });

  function aoSalvar() {
    setErroGeral(null);
    const nomeLimpo = nome.trim();
    const lido = lerPlano(plano);
    const novosErros: typeof erros = { ...lido.erros };
    if (!nomeLimpo) novosErros.nome = 'Informe o nome do item.';
    setErros(novosErros);
    if (!lido.plano || !nomeLimpo) return;
    adicionar.mutate({ nome: nomeLimpo, ...lido.plano });
  }

  return (
    <View style={estilos.cartao}>
      <View style={estilos.editor}>
        <Campo rotulo="Nome do item" valor={nome} onChange={setNome} erro={erros.nome} />
        <CamposDoPlano campos={plano} onChange={setPlano} erros={erros} />
        <Campo
          rotulo="Custo estimado (R$)"
          valor={plano.custo}
          onChange={(custo) => setPlano({ ...plano, custo })}
          erro={erros.custo}
        />
        {erroGeral ? <MensagemErro texto={erroGeral} /> : null}
        <Botao titulo="Salvar item" onPress={aoSalvar} carregando={adicionar.isPending} />
        <Botao titulo="Cancelar" variante="secundario" onPress={onFechar} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.xl, gap: espaco.lg },
  titulo: { fontSize: 22, fontWeight: '700', color: cores.texto },
  apoio: { fontSize: 14, color: cores.textoSecundario },
  aviso: { fontSize: 14, fontWeight: '600', color: '#2E7D32' },
  erro: { fontSize: 13, color: '#C62828' },
  cartao: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  resumo: { padding: espaco.lg, gap: espaco.xs, minHeight: 48 },
  nome: { fontSize: 16, fontWeight: '600', color: cores.texto },
  detalhe: { fontSize: 14, color: cores.textoSecundario },
  semHistorico: { fontSize: 14, fontWeight: '600', color: corStatus('sem_historico') },
  editor: {
    padding: espaco.lg,
    gap: espaco.md,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  pergunta: { fontSize: 16, fontWeight: '600', color: cores.texto },
  sugestao: { fontSize: 14, color: cores.primaria, fontWeight: '600', paddingVertical: espaco.xs },
});
