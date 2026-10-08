import type { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';

import { contarNaoLidos } from '@/api/avisos';
import { minhaFrota } from '@/api/frota';
import { contarPendencias } from '@/api/pendencias';
import AbasDono from '@/app/(dono)/(abas)/_layout';
import { renderComCliente } from '@/testes/renderComCliente';

const mockOpcoes: Record<string, { tabBarBadge?: number }> = {};

jest.mock('expo-router', () => {
  const Tabs = ({ children }: { children: React.ReactNode }) => children;
  Tabs.Screen = ({ name, options }: { name: string; options: { tabBarBadge?: number } }) => {
    mockOpcoes[name] = options;
    return null;
  };
  return { Tabs, Link: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('@/api/avisos', () => ({ contarNaoLidos: jest.fn() }));
jest.mock('@/api/frota', () => ({ minhaFrota: jest.fn() }));
jest.mock('@/api/pendencias', () => ({ contarPendencias: jest.fn() }));
jest.mock('@/api/candidaturas', () => ({ contarPedidosMotoristas: jest.fn().mockResolvedValue(0) }));

const frotaMock = minhaFrota as jest.Mock;
const contarMock = contarPendencias as jest.Mock;

const naoLidosMock = contarNaoLidos as jest.Mock;

let client: QueryClient;

async function renderizar() {
  ({ client } = await renderComCliente(<AbasDono />));
}


beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockOpcoes)) delete mockOpcoes[k];
  frotaMock.mockResolvedValue({ id: 'f1' });
  naoLidosMock.mockResolvedValue(0);
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

describe('Abas do dono - selo de Avisos', () => {
  it('mostra os avisos não lidos no selo da aba', async () => {
    contarMock.mockResolvedValue(0);
    naoLidosMock.mockResolvedValue(3);
    await renderizar();
    await waitFor(() => expect(mockOpcoes.avisos.tabBarBadge).toBe(3));
  });

  it('esconde o selo quando não há avisos não lidos', async () => {
    contarMock.mockResolvedValue(0);
    await renderizar();
    await waitFor(() => expect(naoLidosMock).toHaveBeenCalled());
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(mockOpcoes.avisos.tabBarBadge).toBeUndefined();
  });
});

describe('selo da aba Motoristas', () => {
  it('soma candidaturas e pedidos de entrada', async () => {
    const contarPedidos = jest.requireMock('@/api/candidaturas').contarPedidosMotoristas as jest.Mock;
    contarPedidos.mockResolvedValue(4);
    await renderizar();
    await waitFor(() => expect(mockOpcoes.motoristas.tabBarBadge).toBe(4));
    expect(contarPedidos).toHaveBeenCalledWith('f1');
  });

  it('some quando é zero', async () => {
    const contarPedidos = jest.requireMock('@/api/candidaturas').contarPedidosMotoristas as jest.Mock;
    contarPedidos.mockResolvedValue(0);
    await renderizar();
    await waitFor(() => expect(contarPedidos).toHaveBeenCalled());
    expect(mockOpcoes.motoristas.tabBarBadge).toBeUndefined();
  });
});
