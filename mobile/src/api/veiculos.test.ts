import {
  adicionarItem,
  atualizarItem,
  cadastrarVeiculo,
  definirHistoricoInicial,
  listarItens,
  sugestaoCusto,
} from '@/api/veiculos';
import { supabase } from '@/lib/cliente';
import { ErroApp } from '@/lib/erros';

jest.mock('@/lib/cliente', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const from = supabase.from as unknown as jest.Mock;
const rpc = supabase.rpc as unknown as jest.Mock;

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

function linha(id: string, nome: string, ordem: number | null) {
  return {
    id,
    nome,
    intervalo_km: 10000,
    intervalo_meses: 6,
    km_inicial: null,
    data_inicial: null,
    custo_estimado: 180,
    catalog_id: ordem === null ? null : `c-${id}`,
    ativo: true,
    maintenance_catalog: ordem === null ? null : { ordem },
  };
}

describe('listarItens', () => {
  it('ordena pela ordem do catálogo, itens próprios por último e por nome, sem expor a relação', async () => {
    const eq = jest.fn().mockResolvedValue({
      data: [
        linha('i1', 'Zebra', null),
        linha('i2', 'Filtro de ar', 3),
        linha('i3', 'Bateria', null),
        linha('i4', 'Óleo do motor', 1),
      ],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });

    const itens = await listarItens('v1');

    expect(from).toHaveBeenCalledWith('vehicle_items');
    expect(select).toHaveBeenCalledWith(expect.stringContaining('maintenance_catalog(ordem)'));
    expect(eq).toHaveBeenCalledWith('vehicle_id', 'v1');
    expect(itens.map((i) => i.nome)).toEqual(['Óleo do motor', 'Filtro de ar', 'Bateria', 'Zebra']);
    expect(itens[0]).not.toHaveProperty('maintenance_catalog');
    expect(itens[0]).toMatchObject({ id: 'i4', intervalo_km: 10000, custo_estimado: 180, ativo: true });
  });

  it('erro do banco vira ErroApp', async () => {
    const eq = jest.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'x' } });
    from.mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) });
    const erro = await listarItens('v1').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApp);
    expect((erro as ErroApp).message).toBe('Você não tem permissão para isso.');
  });
});

describe('definirHistoricoInicial', () => {
  it('chama a RPC com km e data (ou nulos)', async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await definirHistoricoInicial('i1', 40000, '2026-08-01');
    expect(rpc).toHaveBeenCalledWith('definir_historico_inicial', {
      p_item_id: 'i1',
      p_km_inicial: 40000,
      p_data_inicial: '2026-08-01',
    });
    await definirHistoricoInicial('i1', null, null);
    expect(rpc).toHaveBeenLastCalledWith('definir_historico_inicial', {
      p_item_id: 'i1',
      p_km_inicial: null,
      p_data_inicial: null,
    });
  });

  it('erro de negócio mostra o detalhe do backend', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'VALOR_INVALIDO', details: 'O km do histórico não pode ser negativo.' },
    });
    const erro = await definirHistoricoInicial('i1', -1, null).catch((e: unknown) => e);
    expect((erro as ErroApp).message).toBe('O km do histórico não pode ser negativo.');
    expect((erro as ErroApp).codigo).toBe('VALOR_INVALIDO');
  });
});

describe('atualizarItem', () => {
  it('chama a RPC e devolve quantos carros foram alterados', async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    const n = await atualizarItem(
      'i1',
      { intervalo_km: 8000, intervalo_meses: null, custo_estimado: 200 },
      true,
    );
    expect(n).toBe(3);
    expect(rpc).toHaveBeenCalledWith('atualizar_item', {
      p_item_id: 'i1',
      p_intervalo_km: 8000,
      p_intervalo_meses: null,
      p_custo_estimado: 200,
      p_aplicar_em_todos: true,
    });
  });

  it('erro vira ErroApp', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'x' } });
    await expect(
      atualizarItem('i1', { intervalo_km: 1, intervalo_meses: null, custo_estimado: 0 }, false),
    ).rejects.toBeInstanceOf(ErroApp);
  });
});

describe('adicionarItem', () => {
  it('insere em vehicle_items sem catalog_id', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });
    await adicionarItem('v1', {
      nome: 'Bateria',
      intervalo_km: null,
      intervalo_meses: 24,
      custo_estimado: 450,
    });
    expect(from).toHaveBeenCalledWith('vehicle_items');
    expect(insert).toHaveBeenCalledWith({
      vehicle_id: 'v1',
      nome: 'Bateria',
      intervalo_km: null,
      intervalo_meses: 24,
      custo_estimado: 450,
    });
  });

  it('erro vira ErroApp', async () => {
    from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: { code: '23514', message: 'check' } }) });
    await expect(
      adicionarItem('v1', { nome: 'X', intervalo_km: null, intervalo_meses: null, custo_estimado: 0 }),
    ).rejects.toBeInstanceOf(ErroApp);
  });
});

describe('sugestaoCusto', () => {
  it('devolve a média paga ou null quando não há histórico', async () => {
    rpc.mockResolvedValueOnce({ data: 210, error: null });
    await expect(sugestaoCusto('i1')).resolves.toBe(210);
    expect(rpc).toHaveBeenCalledWith('custo_medio_item', { p_item_id: 'i1' });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(sugestaoCusto('i1')).resolves.toBeNull();
  });
});
