export type StatusItem = 'sem_historico' | 'vencido' | 'urgente' | 'proximo' | 'em_dia';

const ROTULOS: Record<StatusItem, string> = {
  em_dia: 'Em dia',
  proximo: 'Próximo',
  urgente: 'Urgente',
  vencido: 'Vencido',
  sem_historico: 'Sem histórico',
};

const CORES: Record<StatusItem, string> = {
  em_dia: '#2E7D32',
  proximo: '#F9A825',
  urgente: '#EF6C00',
  vencido: '#C62828',
  sem_historico: '#9E9E9E',
};

export function rotuloStatus(s: StatusItem): string {
  return ROTULOS[s];
}

export function corStatus(s: StatusItem): string {
  return CORES[s];
}

const PRIORIDADES: Record<StatusItem, number> = {
  vencido: 0,
  urgente: 1,
  sem_historico: 2,
  proximo: 3,
  em_dia: 4,
};

/** Menor número = mais grave; serve para listar o que precisa de atenção primeiro. */
export function prioridadeStatus(s: StatusItem): number {
  return PRIORIDADES[s];
}
