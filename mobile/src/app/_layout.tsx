import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ligarFocoAoApp } from '@/lib/focoDoApp';
import { SessaoProvider } from '@/sessao/SessaoProvider';
import { usePush } from '@/sessao/usePush';

function Navegacao() {
  usePush();
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  // Na web o React Query já acompanha o foco da janela.
  useEffect(() => (Platform.OS === 'web' ? undefined : ligarFocoAoApp()), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessaoProvider>
        <Navegacao />
      </SessaoProvider>
    </QueryClientProvider>
  );
}
