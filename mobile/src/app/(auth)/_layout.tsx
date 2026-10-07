import { Redirect, Stack } from 'expo-router';

import { useSessao } from '@/sessao/useSessao';

export default function AuthLayout() {
  const { carregando, sessao } = useSessao();

  // Com sessão ativa (ex.: logo após entrar), a raiz decide o destino pelo papel.
  if (!carregando && sessao) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
