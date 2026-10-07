import type { LinhaProjecao, LinhaRealizado } from '@/api/gastos';

export type Barra = { rotulo: string; total: number };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIA_MS = 24 * 3600 * 1000;

function utc(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

export function porPeriodo(linhas: LinhaProjecao[], dias: 30 | 60 | 90, hoje: string): Barra[] {
  const comData = linhas.filter((l): l is LinhaProjecao & { data: string } => l.data !== null);
  const inicio = utc(hoje);

  if (dias === 30) {
    const barras: Barra[] = [];
    for (let b = 0; b < 5; b++) {
      const d = new Date(inicio + b * 7 * DIA_MS);
      barras.push({ rotulo: `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)}`, total: 0 });
    }
    for (const l of comData) {
      const diff = Math.floor((utc(l.data) - inicio) / DIA_MS);
      const idx = Math.floor(diff / 7);
      if (diff >= 0 && idx < 5) barras[idx].total += l.valor;
    }
    return barras;
  }

  const ini = new Date(inicio);
  const fim = new Date(inicio + dias * DIA_MS);
  const mesIni = ini.getUTCFullYear() * 12 + ini.getUTCMonth();
  const mesFim = fim.getUTCFullYear() * 12 + fim.getUTCMonth();
  const barras: Barra[] = [];
  for (let m = mesIni; m <= mesFim; m++) barras.push({ rotulo: MESES[m % 12], total: 0 });
  for (const l of comData) {
    const [a, m] = l.data.split('-').map(Number);
    const idx = a * 12 + (m - 1) - mesIni;
    if (idx >= 0 && idx < barras.length) barras[idx].total += l.valor;
  }
  return barras;
}

export function porCarro(linhas: LinhaProjecao[]): { vehicle_id: string; placa: string; total: number }[] {
  const mapa = new Map<string, { vehicle_id: string; placa: string; total: number }>();
  for (const l of linhas) {
    if (l.data === null) continue;
    const atual = mapa.get(l.vehicle_id) ?? { vehicle_id: l.vehicle_id, placa: l.placa, total: 0 };
    atual.total += l.valor;
    mapa.set(l.vehicle_id, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function porItem(linhas: LinhaProjecao[]): { item_nome: string; total: number; quantidade: number }[] {
  const mapa = new Map<string, { item_nome: string; total: number; quantidade: number }>();
  for (const l of linhas) {
    if (l.data === null) continue;
    const atual = mapa.get(l.item_nome) ?? { item_nome: l.item_nome, total: 0, quantidade: 0 };
    atual.total += l.valor;
    atual.quantidade += 1;
    mapa.set(l.item_nome, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function revisoesRecomendadas(linhas: LinhaProjecao[]): LinhaProjecao[] {
  return linhas.filter((l) => l.data === null);
}

export function totalPrevisto(linhas: LinhaProjecao[]): number {
  return linhas.reduce((s, l) => (l.data === null ? s : s + l.valor), 0);
}

export function totalRealizado(r: LinhaRealizado[]): number {
  return r.reduce((s, l) => s + l.valor_total, 0);
}
