import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { SessaoProvider } from '@/sessao/SessaoProvider';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <SessaoProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SessaoProvider>
    </QueryClientProvider>
  );
}
