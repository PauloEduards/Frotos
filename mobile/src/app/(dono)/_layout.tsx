import { Redirect, Stack } from 'expo-router';

import { Carregando } from '@/componentes/Carregando';
import { useSessao } from '@/sessao/useSessao';

export default function DonoLayout() {
  const { carregando, sessao, perfil } = useSessao();

  if (carregando) return <Carregando />;
  if (!sessao) return <Redirect href="/(auth)/entrar" />;
  // Perfil ausente ou de outro papel: a raiz decide o destino.
  if (perfil?.papel !== 'proprietario') return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="configuracoes"
        options={{ headerShown: true, title: 'Configurações', headerBackTitle: 'Voltar' }}
      />
      <Stack.Screen
        name="carros/novo"
        options={{ headerShown: true, title: 'Novo carro', headerBackTitle: 'Voltar' }}
      />
      <Stack.Screen
        name="carros/[id]/index"
        options={{ headerShown: true, title: 'Carro', headerBackTitle: 'Voltar' }}
      />
      <Stack.Screen
        name="carros/[id]/servico"
        options={{ headerShown: true, title: 'Registrar serviço', headerBackTitle: 'Voltar' }}
      />
      <Stack.Screen
        name="carros/[id]/pedido"
        options={{ headerShown: true, title: 'Pedido de manutenção', headerBackTitle: 'Voltar' }}
      />
      <Stack.Screen
        name="carros/[id]/itens"
        options={{ headerShown: true, title: '', headerBackTitle: 'Voltar' }}
      />
    </Stack>
  );
}
