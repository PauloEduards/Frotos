import {
  dataBrParaIso,
  formatarData,
  formatarDataBrt,
  formatarDataHoraBrt,
  formatarDiaMes,
  formatarKm,
  formatarReais,
  lerReais,
  VALOR_MAXIMO,
  valorMuitoAlto,
  mascararData,
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

describe('mascararData', () => {
  it('insere as barras enquanto digita e ignora o que não é dígito', () => {
    expect(mascararData('0')).toBe('0');
    expect(mascararData('010')).toBe('01/0');
    expect(mascararData('01082026')).toBe('01/08/2026');
    expect(mascararData('01/08/2026')).toBe('01/08/2026');
    expect(mascararData('01/08/20269999')).toBe('01/08/2026');
    expect(mascararData('ab')).toBe('');
  });
});

describe('dataBrParaIso', () => {
  it('converte dd/mm/aaaa em aaaa-mm-dd', () => {
    expect(dataBrParaIso('01/08/2026')).toBe('2026-08-01');
    expect(dataBrParaIso(' 29/02/2024 ')).toBe('2024-02-29');
  });
  it.each(['31/02/2026', '29/02/2025', '00/01/2026', '32/01/2026', '10/13/2026', '1/8/2026', '01/08/26', '', 'abc', '01-08-2026', '01/08/1800'])(
    'rejeita %p',
    (texto) => {
      expect(dataBrParaIso(texto)).toBeNull();
    },
  );
});

describe('valorMuitoAlto', () => {
  it('aceita até 99.999.999,99 e recusa acima disso', () => {
    expect(VALOR_MAXIMO).toBe(99999999.99);
    expect(valorMuitoAlto(lerReais('99.999.999,99') as number)).toBe(false);
    expect(valorMuitoAlto(lerReais('100.000.000,00') as number)).toBe(true);
    expect(valorMuitoAlto(0)).toBe(false);
  });
});

describe('lerReais', () => {
  it('aceita vírgula ou ponto como separador decimal', () => {
    expect(lerReais('180')).toBe(180);
    expect(lerReais('180,5')).toBe(180.5);
    expect(lerReais('180.50')).toBe(180.5);
    expect(lerReais('1.234,56')).toBe(1234.56);
    expect(lerReais('0')).toBe(0);
  });
  it.each(['', 'abc', '-5', '1,234', '10,5,5', 'R$ 10'])('rejeita %p', (texto) => {
    expect(lerReais(texto)).toBeNull();
  });
});

describe('formatarDataBrt', () => {
  it('converte o instante para o horário de Brasília', () => {
    expect(formatarDataBrt('2026-10-07T15:00:00+00:00')).toBe('07/10/2026');
    // 01:00 UTC ainda é o dia anterior em Brasília (UTC-3)
    expect(formatarDataBrt('2026-10-08T01:00:00+00:00')).toBe('07/10/2026');
    expect(formatarDataBrt('2026-01-01T02:59:59Z')).toBe('31/12/2025');
  });
  it('retorna traço para nulo ou inválido', () => {
    expect(formatarDataBrt(null)).toBe('—');
    expect(formatarDataBrt('lixo')).toBe('—');
  });
});

describe('formatarDataHoraBrt', () => {
  it('converte para Brasília', () => {
    expect(formatarDataHoraBrt('2026-10-07T11:00:00Z')).toBe('07/10/2026 08:00');
    expect(formatarDataHoraBrt('2026-10-07T02:30:00Z')).toBe('06/10/2026 23:30');
    expect(formatarDataHoraBrt(null)).toBe('—');
  });
});
