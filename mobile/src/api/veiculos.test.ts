import { cadastrarVeiculo } from '@/api/veiculos';
import { supabase } from '@/lib/cliente';
import { ErroApp } from '@/lib/erros';

jest.mock('@/lib/cliente', () => ({ supabase: { from: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;

const novo = {
  placa: 'ABC1D23',
  marca: 'Chevrolet',
  modelo: 'Onix 1.0',
  ano_modelo: 2022,
  cor: 'Prata',
  km_atual: 45200,
  km_dia_estimado: 300,
};

function mockInsert(resultado: unknown) {
  const single = jest.fn().mockResolvedValue(resultado);
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  from.mockReturnValue({ insert });
  return { insert, select, single };
}

beforeEach(() => jest.clearAllMocks());

describe('cadastrarVeiculo', () => {
  it('insere em vehicles com fleet_id e fipe_codigo nulo e devolve o id', async () => {
    const { insert, select } = mockInsert({ data: { id: 'v1' }, error: null });
    await expect(cadastrarVeiculo('f1', novo)).resolves.toEqual({ id: 'v1' });
    expect(from).toHaveBeenCalledWith('vehicles');
    expect(insert).toHaveBeenCalledWith({ ...novo, fleet_id: 'f1', fipe_codigo: null });
    expect(select).toHaveBeenCalledWith('id');
  });

  it('placa duplicada (23505) vira ErroApp com a mensagem em português', async () => {
    mockInsert({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const erro = await cadastrarVeiculo('f1', novo).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApp);
    expect((erro as ErroApp).message).toBe('Já existe um carro com esta placa na frota.');
    expect((erro as ErroApp).codigo).toBe('23505');
  });
});
