import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

const clientes = new Set<QueryClient>();

/** Cliente de teste: sem novas tentativas e sem timers de coleta (gcTime infinito), limpo após cada teste. */
export function criarClienteDeTeste(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  clientes.add(client);
  return client;
}

/** Renderiza a tela dentro de um QueryClientProvider de teste e devolve também o cliente. */
export async function renderComCliente(ui: ReactElement, client: QueryClient = criarClienteDeTeste()) {
  const resultado = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...resultado, client };
}

afterEach(() => {
  for (const c of clientes) c.clear();
  clientes.clear();
});
