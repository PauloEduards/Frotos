import { calcularSalto } from '@/api/pendencias';

jest.mock('@/lib/cliente', () => ({ supabase: {} }));

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
