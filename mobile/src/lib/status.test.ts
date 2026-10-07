import { corStatus, prioridadeStatus, rotuloStatus, type StatusItem } from './status';

const esperado: [StatusItem, string, string][] = [
  ['em_dia', 'Em dia', '#2E7D32'],
  ['proximo', 'Próximo', '#F9A825'],
  ['urgente', 'Urgente', '#EF6C00'],
  ['vencido', 'Vencido', '#C62828'],
  ['sem_historico', 'Sem histórico', '#9E9E9E'],
];

describe('status', () => {
  it.each(esperado)('%s tem rótulo e cor', (status, rotulo, cor) => {
    expect(rotuloStatus(status)).toBe(rotulo);
    expect(corStatus(status)).toBe(cor);
  });
});

describe('prioridadeStatus', () => {
  it('ordena do mais grave ao mais tranquilo', () => {
    const ordem: StatusItem[] = ['em_dia', 'proximo', 'sem_historico', 'urgente', 'vencido'];
    const ordenado = [...ordem].sort((a, b) => prioridadeStatus(a) - prioridadeStatus(b));
    expect(ordenado).toEqual(['vencido', 'urgente', 'sem_historico', 'proximo', 'em_dia']);
  });
});
