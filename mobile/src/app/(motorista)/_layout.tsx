import { Redirect, Stack } from 'expo-router';

import { Carregando } from '@/componentes/Carregando';
import { useSessao } from '@/sessao/useSessao';

export default function MotoristaLayout() {
  const { carregando, sessao, perfil } = useSessao();

  if (carregando) return <Carregando />;
  if (!sessao) return <Redirect href="/(auth)/entrar" />;
  // Perfil ausente ou de outro papel: a raiz decide o destino.
  if (perfil?.papel !== 'motorista') return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="perfil" options={{ headerShown: true, title: 'Meu perfil', headerBackTitle: 'Voltar' }} />
    </Stack>
  );
}
