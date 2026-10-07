import type { LinhaProjecao, LinhaRealizado } from '@/api/gastos';

import {
  porCarro,
  porItem,
  porPeriodo,
  revisoesRecomendadas,
  totalPrevisto,
  totalRealizado,
} from './agregar';

const HOJE = '2026-10-07';

function linha(p: Partial<LinhaProjecao>): LinhaProjecao {
  return {
    vehicle_id: 'v1',
    placa: 'AAA1A11',
    vehicle_item_id: 'i1',
    item_nome: 'Óleo do motor',
    data: '2026-10-08',
    valor: 180,
    ...p,
  };
}

describe('porPeriodo', () => {
  it('30 dias: 5 blocos de 7 dias', () => {
    const r = porPeriodo([linha({ data: '2026-10-08' }), linha({ data: '2026-10-20', valor: 250 })], 30, HOJE);
    expect(r).toEqual([
      { rotulo: '07/10', total: 180 },
      { rotulo: '14/10', total: 250 },
      { rotulo: '21/10', total: 0 },
      { rotulo: '28/10', total: 0 },
      { rotulo: '04/11', total: 0 },
    ]);
  });

  it('90 dias: meses de calendário, incluindo barras zeradas', () => {
    const r = porPeriodo(
      [
        linha({ data: '2026-10-16' }),
        linha({ data: '2026-12-05' }),
        linha({ data: '2026-11-02', valor: 600 }),
      ],
      90,
      HOJE,
    );
    expect(r).toEqual([
      { rotulo: 'out', total: 180 },
      { rotulo: 'nov', total: 600 },
      { rotulo: 'dez', total: 180 },
      { rotulo: 'jan', total: 0 },
    ]);
  });

  it('ignora data null', () => {
    const r = porPeriodo([linha({ data: null })], 30, HOJE);
    expect(r.every((b) => b.total === 0)).toBe(true);
  });
});

describe('agregações', () => {
  const linhas = [
    linha({ valor: 180 }),
    linha({ data: '2026-11-20', valor: 180 }),
    linha({ vehicle_id: 'v2', placa: 'BBB2B22', item_nome: 'Pneus', vehicle_item_id: 'i2', valor: 500 }),
    linha({ vehicle_id: 'v2', placa: 'BBB2B22', item_nome: 'Correia', vehicle_item_id: 'i3', data: null, valor: 300 }),
  ];

  it('porCarro soma e ordena decrescente, sem data null', () => {
    expect(porCarro(linhas)).toEqual([
      { vehicle_id: 'v2', placa: 'BBB2B22', total: 500 },
      { vehicle_id: 'v1', placa: 'AAA1A11', total: 360 },
    ]);
  });

  it('porItem conta repetições', () => {
    expect(porItem(linhas)).toEqual([
      { item_nome: 'Pneus', total: 500, quantidade: 1 },
      { item_nome: 'Óleo do motor', total: 360, quantidade: 2 },
    ]);
  });

  it('data null só aparece nas revisões e fora do total previsto', () => {
    expect(revisoesRecomendadas(linhas).map((l) => l.item_nome)).toEqual(['Correia']);
    expect(totalPrevisto(linhas)).toBe(860);
  });

  it('totalRealizado soma', () => {
    const r = [{ valor_total: 150 }, { valor_total: 210 }] as LinhaRealizado[];
    expect(totalRealizado(r)).toBe(360);
  });
});
