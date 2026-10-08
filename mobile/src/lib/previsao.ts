import type { PrevisaoItem } from '@/api/veiculos';

import { formatarData, formatarKm } from './formatos';

/** Texto curto da previsão de um item: 'Faltam 800 km · previsto para 30/10/2026', 'Vencido há 200 km'... */
export function descreverPrevisao(i: PrevisaoItem): string {
  if (i.status === 'sem_historico') return 'Sem histórico — revisar';
  if (i.km_restante !== null && i.km_restante <= 0) {
    return i.km_restante === 0 ? 'Vencido agora' : `Vencido há ${formatarKm(-i.km_restante)}`;
  }
  if (i.km_restante !== null) {
    const faltam = `Faltam ${formatarKm(i.km_restante)}`;
    return i.data_prevista ? `${faltam} · previsto para ${formatarData(i.data_prevista)}` : faltam;
  }
  if (i.data_prevista) {
    return i.status === 'vencido'
      ? `Vencido desde ${formatarData(i.data_prevista)}`
      : `Previsto para ${formatarData(i.data_prevista)}`;
  }
  return 'Sem previsão';
}
