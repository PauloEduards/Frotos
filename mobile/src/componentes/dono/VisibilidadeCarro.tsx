import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { listarMembros } from '@/api/frota';
import {
  definirAnuncio,
  definirVisibilidade,
  motoristasDaVisibilidade,
  type ModoVisibilidade,
} from '@/api/veiculos';
import { Botao } from '@/componentes/Botao';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { mensagemErro } from '@/lib/erros';
import { invalidarDadosDaFrota } from '@/lib/invalidar';
import { cores, espaco } from '@/lib/tema';

const MODOS: { valor: ModoVisibilidade; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos da frota' },
  { valor: 'alguns', rotulo: 'Só alguns' },
  { valor: 'um', rotulo: 'Só um motorista' },
];

type Props = {
  vehicleId: string;
  fleetId: string;
  visibilidade: ModoVisibilidade;
  anunciado: boolean;
  frotaTemCidade: boolean;
};

/** Quem pode pegar o carro (todos / alguns / um) e o anúncio na busca de motoristas. */
export function VisibilidadeCarro({ vehicleId, fleetId, visibilidade, anunciado, frotaTemCidade }: Props) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<ModoVisibilidade>(visibilidade);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const membros = useQuery({ queryKey: ['membros', fleetId], queryFn: () => listarMembros(fleetId) });
  const atuais = useQuery({
    queryKey: ['veiculos', 'visibilidade', vehicleId],
    queryFn: () => motoristasDaVisibilidade(vehicleId),
  });

  useEffect(() => {
    if (atuais.data) setMarcados(atuais.data);
  }, [atuais.data]);
  useEffect(() => setModo(visibilidade), [visibilidade]);

  const salvar = useMutation({
    mutationFn: () => definirVisibilidade(vehicleId, modo, modo === 'todos' ? [] : marcados),
    onSuccess: async () => {
      setSalvo(true);
      await invalidarDadosDaFrota(queryClient);
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const anunciar = useMutation({
    mutationFn: (valor: boolean) => definirAnuncio(vehicleId, valor),
    onSuccess: () => invalidarDadosDaFrota(queryClient),
    onError: (e) => setErro(mensagemErro(e)),
  });

  const ativos = (membros.data ?? []).filter((m) => m.status === 'ativo');

  function alternar(driverId: string) {
    setSalvo(false);
    setErro(null);
    if (modo === 'um') {
      setMarcados([driverId]);
      return;
    }
    setMarcados((atual) =>
      atual.includes(driverId) ? atual.filter((d) => d !== driverId) : [...atual, driverId],
    );
  }

  const valorAnuncio = anunciar.isPending && anunciar.variables !== undefined ? anunciar.variables : anunciado;

  return (
    <View style={estilos.secao}>
      <Seletor
        rotulo="Quem pode pegar este carro"
        opcoes={MODOS}
        valor={modo}
        onChange={(m) => {
          setSalvo(false);
          setErro(null);
          setModo(m);
          if (m === 'um') setMarcados((atual) => atual.slice(0, 1));
        }}
        quebrarLinha
      />

      {modo !== 'todos' ? (
        <View style={estilos.lista}>
          {ativos.map((m) => {
            const marcado = marcados.includes(m.driver_id);
            return (
              <Pressable
                key={m.driver_id}
                accessibilityRole={modo === 'um' ? 'radio' : 'checkbox'}
                accessibilityState={{ checked: marcado }}
                onPress={() => alternar(m.driver_id)}
                style={estilos.linha}
              >
                <Ionicons
                  name={marcado ? (modo === 'um' ? 'radio-button-on' : 'checkbox') : modo === 'um' ? 'radio-button-off' : 'square-outline'}
                  size={24}
                  color={marcado ? cores.primaria : cores.textoSecundario}
                />
                <Text style={estilos.nome}>{m.nome}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Botao
        titulo="Salvar quem pode pegar"
        variante="secundario"
        onPress={() => {
          setErro(null);
          salvar.mutate();
        }}
        carregando={salvar.isPending}
      />
      {salvo ? <Text style={estilos.sucesso}>Salvo.</Text> : null}

      <View style={estilos.linhaInterruptor}>
        <Text style={estilos.nome}>Anunciar na busca de motoristas</Text>
        <Switch
          accessibilityLabel="Anunciar na busca de motoristas"
          disabled={!frotaTemCidade}
          value={valorAnuncio}
          onValueChange={(v) => {
            setErro(null);
            anunciar.mutate(v);
          }}
        />
      </View>
      {!frotaTemCidade ? <Text style={estilos.apoio}>Informe a cidade da frota em Configurações</Text> : null}
      {frotaTemCidade && valorAnuncio && visibilidade !== 'todos' ? (
        <Text style={estilos.apoio}>
          O anúncio só vale quando o carro estiver disponível para todos da frota.
        </Text>
      ) : null}
      {erro ? <MensagemErro texto={erro} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: {
    gap: espaco.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espaco.md,
  },
  lista: { gap: espaco.xs },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, minHeight: 44 },
  nome: { fontSize: 16, color: cores.texto, flex: 1 },
  linhaInterruptor: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, minHeight: 48 },
  apoio: { fontSize: 13, color: cores.textoSecundario },
  sucesso: { fontSize: 14, color: '#2E7D32' },
});
