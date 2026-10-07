import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { criarPedido } from '@/api/manutencao';
import { buscarVeiculo, listarItens, previsaoItens, resumoFrota } from '@/api/veiculos';
import PedidoManutencao from '@/app/(dono)/carros/[id]/pedido';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'v1' }),
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));
jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/veiculos', () => ({
  buscarVeiculo: jest.fn(),
  resumoFrota: jest.fn(),
  listarItens: jest.fn(),
  previsaoItens: jest.fn(),
}));
jest.mock('@/api/manutencao', () => ({ criarPedido: jest.fn() }));

const buscarMock = buscarVeiculo as jest.Mock;
const resumoMock = resumoFrota as jest.Mock;
const itensMock = listarItens as jest.Mock;
const previsaoMock = previsaoItens as jest.Mock;
const criarMock = criarPedido as jest.Mock;

function prev(id: string, status: string) {
  return {
    vehicle_item_id: id,
    nome: id,
    status,
    proximo_km: null,
    km_restante: null,
    data_prevista: null,
    custo_estimado: 0,
  };
}

let client: QueryClient;
let invalidar: jest.SpyInstance;

async function renderizar() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  invalidar = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <PedidoManutencao />
    </QueryClientProvider>,
  );
  await screen.findByText('Óleo do motor');
}

const marcado = (nome: string) =>
  screen.getByRole('checkbox', { name: nome }).props.accessibilityState?.checked ?? false;

afterEach(() => {
  client?.clear();
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-07T15:00:00Z').getTime());
  buscarMock.mockResolvedValue({ id: 'v1', fleet_id: 'f1', placa: 'ABC1D23' });
  resumoMock.mockResolvedValue([{ vehicle_id: 'v1', motorista_nome: 'Ana' }]);
  itensMock.mockResolvedValue([
    { id: 'i1', nome: 'Óleo do motor', ativo: true },
    { id: 'i2', nome: 'Pneus', ativo: true },
  ]);
  previsaoMock.mockResolvedValue([prev('i1', 'proximo'), prev('i2', 'em_dia')]);
  criarMock.mockResolvedValue(undefined);
});

describe('pedido de manutenção', () => {
  it('carro sem motorista avisa e desabilita o envio', async () => {
    resumoMock.mockResolvedValue([{ vehicle_id: 'v1', motorista_nome: null }]);
    await renderizar();
    expect(
      await screen.findByText('Este carro está sem motorista. O pedido vai para quem estiver com ele.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Enviar pedido'));
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('com motorista, pré-marca os itens e envia prazo e observação', async () => {
    await renderizar();
    expect(await screen.findByText('Motorista: Ana')).toBeTruthy();
    expect(marcado('Óleo do motor')).toBe(true);
    expect(marcado('Pneus')).toBe(false);
    await fireEvent.press(screen.getByText('Pneus'));
    await fireEvent.changeText(screen.getByLabelText('Prazo'), '15/10/2026');
    await fireEvent.changeText(screen.getByLabelText('Observação (opcional)'), 'Levar na terça');
    await fireEvent.press(screen.getByText('Enviar pedido'));
    await waitFor(() => expect(criarMock).toHaveBeenCalled());
    expect(criarMock).toHaveBeenCalledWith('v1', ['i1', 'i2'], '2026-10-15', 'Levar na terça');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const chaves = invalidar.mock.calls.map((c) => JSON.stringify(c[0].queryKey));
    expect(chaves).toEqual(expect.arrayContaining(['["veiculos"]', '["pendencias"]']));
  });

  it('prazo no passado é recusado', async () => {
    await renderizar();
    await screen.findByText('Motorista: Ana');
    await fireEvent.changeText(screen.getByLabelText('Prazo'), '06/10/2026');
    await fireEvent.press(screen.getByText('Enviar pedido'));
    expect(await screen.findByText('O prazo precisa ser hoje ou depois.')).toBeTruthy();
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('prazo vazio ou sem itens marcados é recusado', async () => {
    previsaoMock.mockResolvedValue([]);
    await renderizar();
    await screen.findByText('Motorista: Ana');
    await fireEvent.press(screen.getByText('Enviar pedido'));
    expect(await screen.findByText('Marque pelo menos um item.')).toBeTruthy();
    expect(screen.getByText('Informe o prazo.')).toBeTruthy();
    expect(criarMock).not.toHaveBeenCalled();
  });

  it('erro de negócio mostra o DETAIL', async () => {
    criarMock.mockRejectedValue({
      code: 'P0001',
      message: 'CARRO_SEM_MOTORISTA',
      details: 'Este carro está sem motorista no momento.',
    });
    await renderizar();
    await screen.findByText('Motorista: Ana');
    await fireEvent.changeText(screen.getByLabelText('Prazo'), '15/10/2026');
    await fireEvent.press(screen.getByText('Enviar pedido'));
    expect(await screen.findByText('Este carro está sem motorista no momento.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
