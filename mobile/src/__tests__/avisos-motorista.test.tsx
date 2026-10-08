import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { listarAvisos, marcarLido } from '@/api/avisos';
import AvisosMotorista from '@/app/(motorista)/(frota)/avisos';
import { renderComCliente } from '@/testes/renderComCliente';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste,
}));
jest.mock('@/api/avisos', () => ({ listarAvisos: jest.fn(), marcarLido: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (marcarLido as jest.Mock).mockResolvedValue(undefined);
});

it('lista os avisos e ao tocar marca como lido e abre Meu carro', async () => {
  (listarAvisos as jest.Mock).mockResolvedValue([
    { id: 'n1', tipo: 'pedido_novo', titulo: 'Pedido de manutenção', corpo: 'Leve o carro à oficina até 20/10.', prioridade: 'normal', ref_tabela: 'maintenance_requests', ref_id: 'p1', lida: false, criada_em: '2026-10-08T11:00:00.000Z' },
  ]);
  await renderComCliente(<AvisosMotorista />);
  await fireEvent.press(await screen.findByText('Pedido de manutenção'));
  await waitFor(() => expect(marcarLido).toHaveBeenCalledWith('n1'));
  expect(mockPush).toHaveBeenCalledWith('/(motorista)/(frota)/meu-carro');
});

it('sem avisos mostra o estado vazio', async () => {
  (listarAvisos as jest.Mock).mockResolvedValue([]);
  await renderComCliente(<AvisosMotorista />);
  expect(await screen.findByText('Nenhum aviso por enquanto.')).toBeTruthy();
});
