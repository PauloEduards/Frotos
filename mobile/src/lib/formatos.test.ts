import {
  formatarData,
  formatarDiaMes,
  formatarKm,
  formatarReais,
  normalizarPlaca,
} from './formatos';

describe('formatarKm', () => {
  it('formata com separador de milhar', () => {
    expect(formatarKm(45200)).toBe('45.200 km');
    expect(formatarKm(0)).toBe('0 km');
  });
  it('retorna traço para nulo', () => {
    expect(formatarKm(null)).toBe('—');
  });
});

describe('formatarReais', () => {
  it('formata em reais', () => {
    expect(formatarReais(1234.5)).toBe('R$ 1.234,50');
    expect(formatarReais(0)).toBe('R$ 0,00');
    expect(formatarReais(1000000)).toBe('R$ 1.000.000,00');
  });
  it('retorna traço para nulo', () => {
    expect(formatarReais(null)).toBe('—');
  });
});

describe('formatarData', () => {
  it('formata dd/mm/aaaa', () => {
    expect(formatarData('2026-10-30')).toBe('30/10/2026');
  });
  it('aceita timestamp ISO completo', () => {
    expect(formatarData('2026-10-30T12:00:00+00:00')).toBe('30/10/2026');
  });
  it('retorna traço para nulo', () => {
    expect(formatarData(null)).toBe('—');
  });
});

describe('formatarDiaMes', () => {
  it('formata dd/mm', () => {
    expect(formatarDiaMes('2026-10-30')).toBe('30/10');
  });
});

describe('normalizarPlaca', () => {
  it('remove hífen e espaços e põe em maiúsculas', () => {
    expect(normalizarPlaca(' abc-1d23 ')).toBe('ABC1D23');
  });
});
