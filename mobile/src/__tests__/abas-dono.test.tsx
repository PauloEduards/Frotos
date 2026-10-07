import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';

import { minhaFrota } from '@/api/frota';
import { contarPendencias } from '@/api/pendencias';
import AbasDono from '@/app/(dono)/(abas)/_layout';

const mockOpcoes: Record<string, { tabBarBadge?: number }> = {};

jest.mock('expo-router', () => {
  const Tabs = ({ children }: { children: React.ReactNode }) => children;
  Tabs.Screen = ({ name, options }: { name: string; options: { tabBarBadge?: number } }) => {
    mockOpcoes[name] = options;
    return null;
  };
  return { Tabs, Link: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('@/api/frota', () => ({ minhaFrota: jest.fn() }));
jest.mock('@/api/pendencias', () => ({ contarPendencias: jest.fn() }));

const frotaMock = minhaFrota as jest.Mock;
const contarMock = contarPendencias as jest.Mock;

let client: QueryClient;

async function renderizar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <AbasDono />
    </QueryClientProvider>,
  );
}

afterEach(() => client?.clear());

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockOpcoes)) delete mockOpcoes[k];
  frotaMock.mockResolvedValue({ id: 'f1' });
});

describe('Abas do dono - selo de Pendências', () => {
  it('mostra o total de pendências no selo da aba', async () => {
    contarMock.mockResolvedValue(5);
    await renderizar();
    await waitFor(() => expect(mockOpcoes.pendencias.tabBarBadge).toBe(5));
    expect(contarMock).toHaveBeenCalledWith('f1');
    expect(mockOpcoes.index.tabBarBadge).toBeUndefined();
  });

  it('esconde o selo quando não há pendências', async () => {
    contarMock.mockResolvedValue(0);
    await renderizar();
    await waitFor(() => expect(contarMock).toHaveBeenCalled());
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(mockOpcoes.pendencias.tabBarBadge).toBeUndefined();
  });
});
