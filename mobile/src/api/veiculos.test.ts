import {
  adicionarItem,
  atualizarItem,
  cadastrarVeiculo,
  definirHistoricoInicial,
  buscarVeiculo,
  leiturasKm,
  listarItens,
  previsaoItens,
  resumoFrota,
  servicos,
  statusCarro,
  sugestaoCusto,
  vinculos,
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

describe('consultas do painel e do detalhe', () => {
  it('resumoFrota chama a RPC sem p_hoje', async () => {
    rpc.mockResolvedValue({ data: [{ vehicle_id: 'v1' }], error: null });
    await expect(resumoFrota('f1')).resolves.toEqual([{ vehicle_id: 'v1' }]);
    expect(rpc).toHaveBeenCalledWith('resumo_frota', { p_fleet_id: 'f1' });
  });

  it('resumoFrota traduz erro de negócio', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'SEM_ACESSO', details: 'Somente o proprietário vê o resumo da frota.' },
    });
    await expect(resumoFrota('f1')).rejects.toMatchObject({
      message: 'Somente o proprietário vê o resumo da frota.',
      codigo: 'SEM_ACESSO',
    });
  });

  it('previsaoItens chama a RPC sem p_hoje', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(previsaoItens('v1')).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith('previsao_itens', { p_vehicle_id: 'v1' });
  });

  it('statusCarro devolve a primeira linha da RPC', async () => {
    const linha = { status: 'em_dia', proxima_data: null, proximo_item: null, media: 300, estimada: true };
    rpc.mockResolvedValue({ data: [linha], error: null });
    await expect(statusCarro('v1')).resolves.toEqual(linha);
    expect(rpc).toHaveBeenCalledWith('status_carro', { p_vehicle_id: 'v1' });
  });

  it('statusCarro sem linhas é erro', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(statusCarro('v1')).rejects.toBeInstanceOf(ErroApp);
  });

  it('buscarVeiculo seleciona o carro pelo id', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'v1' }, error: null });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    await expect(buscarVeiculo('v1')).resolves.toEqual({ id: 'v1' });
    expect(from).toHaveBeenCalledWith('vehicles');
    expect(eq).toHaveBeenCalledWith('id', 'v1');
  });

  it('leiturasKm ordena por capturado_em desc e limita em 20 por padrão', async () => {
    const limit = jest.fn().mockResolvedValue({ data: [{ id: 'l1' }], error: null });
    const order = jest.fn().mockReturnValue({ limit });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    await expect(leiturasKm('v1')).resolves.toEqual([{ id: 'l1' }]);
    expect(from).toHaveBeenCalledWith('odometer_readings');
    expect(select.mock.calls[0][0]).toBe('id, km, origem, capturado_em, foto_painel_path, salto_suspeito');
    expect(eq).toHaveBeenCalledWith('vehicle_id', 'v1');
    expect(order).toHaveBeenCalledWith('capturado_em', { ascending: false });
    expect(limit).toHaveBeenCalledWith(20);
  });

  it('servicos junta o nome do item do plano ou o nome avulso, ordenado por data desc', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 's1',
          data: '2026-09-20',
          km: 44000,
          oficina: null,
          valor_total: 100,
          status: 'aprovado',
          motivo: null,
          maintenance_record_items: [
            { valor: 60, nome_outro: null, vehicle_items: { nome: 'Óleo do motor' } },
            { valor: 40, nome_outro: 'Lanterna', vehicle_items: null },
          ],
        },
      ],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    const r = await servicos('v1');
    expect(from).toHaveBeenCalledWith('maintenance_records');
    expect(order).toHaveBeenCalledWith('data', { ascending: false });
    expect(r[0].itens).toEqual([
      { nome: 'Óleo do motor', valor: 60 },
      { nome: 'Lanterna', valor: 40 },
    ]);
    expect(r[0]).not.toHaveProperty('maintenance_record_items');
  });

  it('vinculos traz o nome do motorista (só a coluna nome) e as fotos', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'a1',
          status: 'ativo',
          inicio_em: '2026-10-01T12:00:00+00:00',
          fim_em: null,
          km_inicio: 45000,
          km_fim: null,
          profiles: { nome: 'Ana' },
          inspection_photos: [{ id: 'p1', momento: 'retirada', posicao: 'frente', path: 'x.jpg' }],
        },
      ],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    const r = await vinculos('v1');
    expect(from).toHaveBeenCalledWith('assignments');
    expect(select.mock.calls[0][0]).toContain('profiles(nome)');
    expect(select.mock.calls[0][0]).not.toContain('*');
    expect(r[0].motorista_nome).toBe('Ana');
    expect(r[0].fotos).toHaveLength(1);
  });
});
