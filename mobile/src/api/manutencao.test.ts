import { cancelarPedido, criarPedido, pedidosAbertos, registrarServico } from '@/api/manutencao';
import { atualizarVeiculo, corrigirKm } from '@/api/veiculos';
import { supabase } from '@/lib/cliente';
import { ErroApp } from '@/lib/erros';

jest.mock('@/lib/cliente', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;
const rpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('manutencao', () => {
  it('registrarServico chama a RPC com request_id e oficina', async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await registrarServico({
      vehicleId: 'v1',
      itens: [{ vehicle_item_id: 'i1' }],
      km: 100,
      data: '2026-10-07',
      valorTotal: 10,
      oficina: 'Zé',
      requestId: 'p1',
    });
    expect(rpc).toHaveBeenCalledWith('registrar_servico', {
      p_vehicle_id: 'v1',
      p_itens: [{ vehicle_item_id: 'i1' }],
      p_km: 100,
      p_data: '2026-10-07',
      p_valor_total: 10,
      p_request_id: 'p1',
      p_oficina: 'Zé',
    });
  });

  it('registrarServico converte erro de negócio em ErroApp com o DETAIL', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'DATA_FUTURA', details: 'A data do serviço não pode ser no futuro.' },
    });
    const erro = await registrarServico({
      vehicleId: 'v1',
      itens: [],
      km: 1,
      data: 'x',
      valorTotal: 1,
    }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApp);
    expect((erro as ErroApp).message).toBe('A data do serviço não pode ser no futuro.');
  });

  it('criarPedido e cancelarPedido chamam as RPCs', async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await criarPedido('v1', ['i1'], '2026-10-20', 'obs');
    expect(rpc).toHaveBeenLastCalledWith('criar_pedido', {
      p_vehicle_id: 'v1',
      p_itens: ['i1'],
      p_prazo: '2026-10-20',
      p_observacao: 'obs',
    });
    await cancelarPedido('p1');
    expect(rpc).toHaveBeenLastCalledWith('cancelar_pedido', { p_request_id: 'p1' });
  });

  it('pedidosAbertos filtra por carro e status aberto', async () => {
    const order = jest.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null });
    const eq2 = jest.fn().mockReturnValue({ order });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const select = jest.fn().mockReturnValue({ eq: eq1 });
    from.mockReturnValue({ select });
    await expect(pedidosAbertos('v1')).resolves.toEqual([{ id: 'p1' }]);
    expect(from).toHaveBeenCalledWith('maintenance_requests');
    expect(eq1).toHaveBeenCalledWith('vehicle_id', 'v1');
    expect(eq2).toHaveBeenCalledWith('status', 'aberto');
  });

  it('corrigirKm usa a origem correcao_dono', async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await corrigirKm('v1', 45000);
    expect(rpc).toHaveBeenCalledWith('registrar_km', {
      p_vehicle_id: 'v1',
      p_km: 45000,
      p_origem: 'correcao_dono',
    });
  });

  it('atualizarVeiculo faz update por id', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ update });
    await atualizarVeiculo('v1', { ativo: false });
    expect(from).toHaveBeenCalledWith('vehicles');
    expect(update).toHaveBeenCalledWith({ ativo: false });
    expect(eq).toHaveBeenCalledWith('id', 'v1');
  });
});
