import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buscarCarros, candidatar, type CarroVitrine } from '@/api/motorista';
import { Botao } from '@/componentes/Botao';
import { Campo } from '@/componentes/Campo';
import { CardCarro } from '@/componentes/CardCarro';
import { Carregando } from '@/componentes/Carregando';
import { ListaVazia } from '@/componentes/ListaVazia';
import { MensagemErro } from '@/componentes/MensagemErro';
import { Seletor } from '@/componentes/Seletor';
import { mensagemErro } from '@/lib/erros';
import { UFS } from '@/lib/formatos';
import { cores, espaco } from '@/lib/tema';
import { useUrlsAssinadas } from '@/lib/useUrlsAssinadas';
import { useSessao } from '@/sessao/useSessao';

export default function Buscar() {
  const { perfil } = useSessao();
  const [uf, setUf] = useState(perfil?.uf ?? 'SP');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [filtro, setFiltro] = useState({ uf: perfil?.uf ?? 'SP', cidade: perfil?.cidade ?? '' });

  const carros = useQuery({
    queryKey: ['busca', filtro.uf, filtro.cidade],
    queryFn: () => buscarCarros(filtro.uf, filtro.cidade),
    enabled: !!filtro.cidade.trim(),
  });
  const caminhos = (carros.data ?? []).map((c) => c.foto_path).filter((p): p is string => !!p);
  const fotos = useUrlsAssinadas(caminhos, caminhos.length > 0, 'carros');

  return (
    <KeyboardAvoidingView style={estilos.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.filtros}>
          <Seletor rotulo="Estado" opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} valor={uf} onChange={setUf} quebrarLinha />
          <Campo rotulo="Cidade" valor={cidade} onChange={setCidade} />
          <Botao titulo="Buscar" onPress={() => setFiltro({ uf, cidade: cidade.trim() })} />
        </View>

        {carros.isError ? (
          <>
            <MensagemErro texto={mensagemErro(carros.error)} />
            <Botao titulo="Tentar de novo" variante="secundario" onPress={() => void carros.refetch()} />
          </>
        ) : null}
        {carros.isFetching && !carros.data ? <Carregando /> : null}
        {carros.data && carros.data.length === 0 ? (
          <ListaVazia texto="Nenhum carro disponível na sua região no momento." />
        ) : null}
        {(carros.data ?? []).map((c) => (
          <CartaoVitrine key={c.vehicle_id} carro={c} fotoUrl={c.foto_path ? fotos.urls[c.foto_path] ?? null : null} />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CartaoVitrine({ carro, fotoUrl }: { carro: CarroVitrine; fotoUrl: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const enviar = useMutation({
    mutationFn: () => candidatar(carro.vehicle_id, mensagem),
    onError: (e) => setErro(mensagemErro(e)),
  });

  return (
    <View style={estilos.cartao}>
      <CardCarro
        carro={{ marca: carro.marca, modelo: carro.modelo, ano_modelo: carro.ano_modelo, cor: carro.cor, fotoUrl }}
        rodape={
          <Text style={estilos.apoio}>
            {`${carro.frota_nome} · ${carro.cidade ?? ''}/${carro.uf ?? ''}`}
          </Text>
        }
      />
      {enviar.isSuccess ? (
        <Text style={estilos.sucesso}>Candidatura enviada! Acompanhe em Minhas candidaturas.</Text>
      ) : aberto ? (
        <View style={estilos.form}>
          <Campo
            rotulo="Mensagem para o dono (opcional)"
            valor={mensagem}
            onChange={setMensagem}
            maxLength={300}
            multiline
          />
          {erro ? <MensagemErro texto={erro} /> : null}
          <Botao
            titulo="Enviar candidatura"
            onPress={() => {
              setErro(null);
              enviar.mutate();
            }}
            carregando={enviar.isPending}
          />
        </View>
      ) : (
        <Botao titulo="Quero este carro" onPress={() => setAberto(true)} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, gap: espaco.lg },
  filtros: { gap: espaco.sm },
  cartao: { gap: espaco.sm },
  form: { gap: espaco.sm },
  apoio: { fontSize: 14, color: cores.textoSecundario },
  sucesso: { fontSize: 15, color: '#2E7D32', fontWeight: '600' },
});
