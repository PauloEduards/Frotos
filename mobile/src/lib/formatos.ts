function milhares(inteiro: string): string {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatarKm(n: number | null): string {
  if (n === null) return '—';
  const arredondado = Math.round(n);
  const sinal = arredondado < 0 ? '-' : '';
  return `${sinal}${milhares(String(Math.abs(arredondado)))} km`;
}

export function formatarReais(n: number | null): string {
  if (n === null) return '—';
  const centavos = Math.round(Math.abs(n) * 100);
  const inteiro = String(Math.floor(centavos / 100));
  const resto = String(centavos % 100).padStart(2, '0');
  const sinal = n < 0 && centavos > 0 ? '-' : '';
  return `${sinal}R$ ${milhares(inteiro)},${resto}`;
}

/** Aceita 'aaaa-mm-dd' ou timestamp ISO; usa só a parte da data, sem converter fuso. */
export function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDiaMes(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}`;
}

export function normalizarPlaca(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
