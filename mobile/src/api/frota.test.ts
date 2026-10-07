import { atualizarFrota, criarFrota, gerarNovoCodigo, minhaFrota } from '@/api/frota';
import { supabase } from '@/lib/cliente';
import { ErroApp } from '@/lib/erros';

jest.mock('@/lib/cliente', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn(), auth: { getSession: jest.fn() } },
}));

const rpc = supabase.rpc as unknown as jest.Mock;
const from = supabase.from as unknown as jest.Mock;
const getSession = supabase.auth.getSession as unknown as jest.Mock;

const frota = {
  id: 'f1',
  nome: 'Frota Piloto',
  codigo_convite: 'FRT-TEST',
  modo_manutencao: 'proprietario_leva',
  limite_salto_km_dia: 350,
  limiar_amarelo_km: 1000,
  limiar_amarelo_dias: 7,
  limiar_laranja_km: 300,
};

beforeEach(() => jest.clearAllMocks());

describe('criarFrota', () => {
  it('chama a RPC criar_frota e devolve a frota', async () => {
    rpc.mockResolvedValue({ data: frota, error: null });
    await expect(criarFrota('Frota Piloto')).resolves.toEqual(frota);
    expect(rpc).toHaveBeenCalledWith('criar_frota', { p_nome: 'Frota Piloto' });
  });

  it('erro de negócio P0001 vira ErroApp com o DETAIL', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'FROTA_JA_EXISTE',
        details: 'Você já tem uma frota cadastrada.',
      },
    });
    const erro = await criarFrota('Outra').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApp);
    expect((erro as ErroApp).message).toBe('Você já tem uma frota cadastrada.');
    expect((erro as ErroApp).codigo).toBe('FROTA_JA_EXISTE');
  });
});

describe('gerarNovoCodigo', () => {
  it('chama a RPC gerar_novo_codigo e devolve o código', async () => {
    rpc.mockResolvedValue({ data: 'FRT-NOVO', error: null });
    await expect(gerarNovoCodigo('f1')).resolves.toBe('FRT-NOVO');
    expect(rpc).toHaveBeenCalledWith('gerar_novo_codigo', { p_fleet_id: 'f1' });
  });

  it('propaga o erro de negócio como ErroApp', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'SEM_ACESSO',
        details: 'Você não tem acesso a esta informação.',
      },
    });
    await expect(gerarNovoCodigo('f1')).rejects.toThrow('Você não tem acesso a esta informação.');
  });
});

describe('minhaFrota', () => {
  function montarSelect(resultado: { data: unknown; error: unknown }) {
    const maybeSingle = jest.fn().mockResolvedValue(resultado);
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    return { select, eq, maybeSingle };
  }

  it('seleciona a frota do usuário logado', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const { select, eq } = montarSelect({ data: frota, error: null });
    await expect(minhaFrota()).resolves.toEqual(frota);
    expect(from).toHaveBeenCalledWith('fleets');
    expect(select).toHaveBeenCalledWith(expect.stringContaining('codigo_convite'));
    expect(select).not.toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('owner_id', 'u1');
  });

  it('sem frota devolve null', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    montarSelect({ data: null, error: null });
    await expect(minhaFrota()).resolves.toBeNull();
  });

  it('sem sessão devolve null sem consultar', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(minhaFrota()).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

describe('atualizarFrota', () => {
  it('atualiza os campos da frota pelo id', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    from.mockReturnValue({ update });
    await atualizarFrota('f1', { limite_salto_km_dia: 400 });
    expect(from).toHaveBeenCalledWith('fleets');
    expect(update).toHaveBeenCalledWith({ limite_salto_km_dia: 400 });
    expect(eq).toHaveBeenCalledWith('id', 'f1');
  });

  it('erro vira ErroApp', async () => {
    const eq = jest.fn().mockResolvedValue({ error: { code: '42501', message: 'x' } });
    from.mockReturnValue({ update: jest.fn().mockReturnValue({ eq }) });
    await expect(atualizarFrota('f1', { nome: 'X' })).rejects.toThrow(
      'Você não tem permissão para isso.',
    );
  });
});
