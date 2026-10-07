import { calcularSalto, contarPendencias, servicosRecentesDeMotoristas } from '@/api/pendencias';
import { supabase } from '@/lib/cliente';

jest.mock('@/lib/cliente', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));

const from = supabase.from as unknown as jest.Mock;
const getSession = supabase.auth.getSession as unknown as jest.Mock;

/** Consulta encadeável que, ao ser aguardada, devolve `resultado`. */
function consulta(resultado: unknown) {
  const q: Record<string, unknown> = {};
  const encadeia = () => q;
  for (const m of ['select', 'eq', 'neq', 'is', 'gte', 'order']) q[m] = jest.fn(encadeia);
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resultado).then(ok, ko);
  return q;
}

beforeEach(() => jest.clearAllMocks());

describe('calcularSalto', () => {
  it('sem leitura anterior não há salto', () => {
    expect(calcularSalto({ km: 10, capturado_em: '2026-10-06T15:00:00Z' }, null)).toBeNull();
  });

  it('conta dias de calendário em Brasília, no mínimo 1', () => {
    const atual = { km: 64000, capturado_em: '2026-10-06T15:00:00Z' };
    expect(calcularSalto(atual, { km: 62000, capturado_em: '2026-10-06T12:00:00Z' })).toEqual({ km: 2000, dias: 1 });
    expect(calcularSalto(atual, { km: 62000, capturado_em: '2026-10-03T12:00:00Z' })).toEqual({ km: 2000, dias: 3 });
  });

  it('23h45 em Brasília e 00h15 do dia seguinte contam como dias diferentes', () => {
    const atual = { km: 5, capturado_em: '2026-10-06T03:15:00Z' }; // 00:15 BRT de 06/10
    const anterior = { km: 1, capturado_em: '2026-10-06T02:45:00Z' }; // 23:45 BRT de 05/10
    expect(calcularSalto(atual, anterior)).toEqual({ km: 4, dias: 1 });
  });
});

describe('contarPendencias', () => {
  it('soma serviços pendentes e ocorrências abertas da frota', async () => {
    const servicos = consulta({ count: 3, error: null });
    const ocorrencias = consulta({ count: 2, error: null });
    from.mockImplementation((t: string) => (t === 'maintenance_records' ? servicos : ocorrencias));

    await expect(contarPendencias('f1')).resolves.toBe(5);
    expect(servicos.eq).toHaveBeenCalledWith('status', 'pendente');
    expect(servicos.eq).toHaveBeenCalledWith('vehicles.fleet_id', 'f1');
    expect(ocorrencias.eq).toHaveBeenCalledWith('status', 'aberta');
    expect(ocorrencias.eq).toHaveBeenCalledWith('vehicles.fleet_id', 'f1');
  });

  it('contagem nula vale 0', async () => {
    from.mockImplementation(() => consulta({ count: null, error: null }));
    await expect(contarPendencias('f1')).resolves.toBe(0);
  });

  it('propaga o erro de qualquer das consultas', async () => {
    from.mockImplementation((t: string) =>
      t === 'incidents'
        ? consulta({ count: null, error: { code: '42501', message: 'x' } })
        : consulta({ count: 1, error: null }),
    );
    await expect(contarPendencias('f1')).rejects.toThrow('Você não tem permissão para isso.');
  });
});

describe('servicosRecentesDeMotoristas', () => {
  it('sem sessão devolve lista vazia sem consultar', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(servicosRecentesDeMotoristas('f1')).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('exclui os serviços do próprio dono', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'dono1' } } } });
    const q = consulta({ data: [], error: null });
    from.mockReturnValue(q);
    await expect(servicosRecentesDeMotoristas('f1')).resolves.toEqual([]);
    expect(q.neq).toHaveBeenCalledWith('autor_id', 'dono1');
  });
});
