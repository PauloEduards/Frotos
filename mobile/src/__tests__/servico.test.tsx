import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { pedidosAbertos, registrarServico } from '@/api/manutencao';
import { listarItens, previsaoItens } from '@/api/veiculos';
import RegistrarServico from '@/app/(dono)/carros/[id]/servico';

let mockParams: Record<string, string> = { id: 'v1' };
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));
jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/veiculos', () => ({ listarItens: jest.fn(), previsaoItens: jest.fn() }));
jest.mock('@/api/manutencao', () => ({ registrarServico: jest.fn(), pedidosAbertos: jest.fn() }));

const itensMock = listarItens as jest.Mock;
const previsaoMock = previsaoItens as jest.Mock;
const pedidosMock = pedidosAbertos as jest.Mock;
const registrarMock = registrarServico as jest.Mock;

const itens = [
  { id: 'i1', nome: 'Óleo do motor', ativo: true },
  { id: 'i2', nome: 'Pneus', ativo: true },
  { id: 'i3', nome: 'Freios', ativo: true },
  { id: 'i4', nome: 'Antigo', ativo: false },
];

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
      <RegistrarServico />
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
  mockParams = { id: 'v1' };
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-07T15:00:00Z').getTime());
  itensMock.mockResolvedValue(itens);
  previsaoMock.mockResolvedValue([prev('i1', 'urgente'), prev('i2', 'em_dia'), prev('i3', 'vencido')]);
  pedidosMock.mockResolvedValue([]);
  registrarMock.mockResolvedValue(undefined);
});

async function preencher(km = '45300', valor = '350,50') {
  await fireEvent.changeText(screen.getByLabelText('Km do painel'), km);
  await fireEvent.changeText(screen.getByLabelText('Valor total'), valor);
}

describe('registrar serviço', () => {
  it('pré-marca os itens próximos, urgentes e vencidos e esconde os inativos', async () => {
    await renderizar();
    expect(marcado('Óleo do motor')).toBe(true);
    expect(marcado('Freios')).toBe(true);
    expect(marcado('Pneus')).toBe(false);
    expect(screen.queryByText('Antigo')).toBeNull();
    expect(screen.getByLabelText('Data').props.value).toBe('07/10/2026');
  });

  it('registra com os itens marcados, km, data de hoje, valor e oficina', async () => {
    await renderizar();
    await fireEvent.press(screen.getByText('Pneus'));
    await fireEvent.press(screen.getByText('Freios'));
    await preencher();
    await fireEvent.changeText(screen.getByLabelText('Oficina (opcional)'), 'Oficina do Zé');
    await fireEvent.press(screen.getByText('Registrar'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalled());
    expect(registrarMock).toHaveBeenCalledWith({
      vehicleId: 'v1',
      itens: [{ vehicle_item_id: 'i1' }, { vehicle_item_id: 'i2' }],
      km: 45300,
      data: '2026-10-07',
      valorTotal: 350.5,
      oficina: 'Oficina do Zé',
      requestId: undefined,
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const chaves = invalidar.mock.calls.map((c) => JSON.stringify(c[0].queryKey));
    expect(chaves).toEqual(expect.arrayContaining(['["veiculos"]', '["pendencias"]']));
  });

  it('"Outro serviço" pede o nome e envia nome_outro', async () => {
    await renderizar();
    await fireEvent.press(screen.getByText('Outro serviço'));
    await fireEvent.changeText(screen.getByLabelText('Nome do serviço'), 'Lavagem');
    await preencher();
    await fireEvent.press(screen.getByText('Registrar'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalled());
    expect(registrarMock.mock.calls[0][0].itens).toEqual([
      { vehicle_item_id: 'i1' },
      { vehicle_item_id: 'i3' },
      { nome_outro: 'Lavagem' },
    ]);
  });

  it('nenhum item marcado mostra o aviso e não chama a API', async () => {
    previsaoMock.mockResolvedValue([]);
    await renderizar();
    await preencher();
    await fireEvent.press(screen.getByText('Registrar'));
    expect(await screen.findByText('Marque pelo menos um serviço.')).toBeTruthy();
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it('valida km, valor e data antes de enviar', async () => {
    await renderizar();
    await fireEvent.press(screen.getByText('Registrar'));
    expect(await screen.findByText('Informe o km do painel.')).toBeTruthy();
    expect(screen.getByText('Informe o valor total.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Data'), '31/02/2026');
    await fireEvent.press(screen.getByText('Registrar'));
    expect(await screen.findByText('Informe uma data válida.')).toBeTruthy();
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it('vindo de um pedido, marca os itens do pedido e envia requestId', async () => {
    mockParams = { id: 'v1', pedido: 'p9' };
    pedidosMock.mockResolvedValue([
      { id: 'p9', itens: ['i2'], prazo: '2026-10-20', observacao: null, driver_id: 'm1' },
    ]);
    await renderizar();
    expect(marcado('Pneus')).toBe(true);
    expect(marcado('Óleo do motor')).toBe(false);
    await preencher();
    await fireEvent.press(screen.getByText('Registrar'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalled());
    expect(registrarMock.mock.calls[0][0]).toMatchObject({
      itens: [{ vehicle_item_id: 'i2' }],
      requestId: 'p9',
    });
  });

  it('pedido que não está mais aberto avisa, não envia requestId e desabilita o envio', async () => {
    mockParams = { id: 'v1', pedido: 'p9' };
    pedidosMock.mockResolvedValue([]);
    await renderizar();
    expect(screen.getByText('Este pedido não está mais aberto.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Registrar' }).props.accessibilityState.disabled).toBe(true);
    await preencher();
    await fireEvent.press(screen.getByText('Registrar'));
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it('erro de negócio mostra o DETAIL e mantém o formulário preenchido', async () => {
    registrarMock.mockRejectedValue({
      code: 'P0001',
      message: 'DATA_FUTURA',
      details: 'A data do serviço não pode ser no futuro.',
    });
    await renderizar();
    await preencher();
    await fireEvent.press(screen.getByText('Registrar'));
    expect(await screen.findByText('A data do serviço não pode ser no futuro.')).toBeTruthy();
    expect(screen.getByLabelText('Km do painel').props.value).toBe('45300');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
