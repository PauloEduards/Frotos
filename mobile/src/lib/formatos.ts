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

const BRASILIA_MS = -3 * 60 * 60 * 1000;

/** Dia de hoje no horário de Brasília, como 'aaaa-mm-dd'. */
export function hojeBrt(): string {
  return new Date(Date.now() + BRASILIA_MS).toISOString().slice(0, 10);
}

/** Data (dd/mm/aaaa) de um instante, no horário de Brasília (UTC-3, sem horário de verão). */
export function formatarDataBrt(instante: string | null): string {
  if (!instante) return '—';
  const t = new Date(instante).getTime();
  if (Number.isNaN(t)) return '—';
  return formatarData(new Date(t + BRASILIA_MS).toISOString());
}

export function formatarDiaMes(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}`;
}

export function normalizarPlaca(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** Máscara de digitação: só dígitos, no máximo 8, com as barras de dd/mm/aaaa. */
export function mascararData(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

const ANO_MINIMO_DATA = 1900;

/** 'dd/mm/aaaa' → 'aaaa-mm-dd'; null se não for uma data real do calendário. */
export function dataBrParaIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (ano < ANO_MINIMO_DATA || mes < 1 || mes > 12 || dia < 1) return null;
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (dia > diasNoMes) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Lê um valor em reais digitado: '180', '180,50', '180.50' ou '1.234,56'.
 * Com vírgula, os pontos são milhares; sem vírgula, o ponto é decimal.
 * Retorna null se não for um valor válido (até 2 casas decimais).
 */
export function lerReais(texto: string): number | null {
  let t = texto.trim();
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

/** Data e hora ('dd/mm/aaaa hh:mm') de um instante, no horário de Brasília. */
export function formatarDataHoraBrt(instante: string | null): string {
  if (!instante) return '—';
  const t = new Date(instante).getTime();
  if (Number.isNaN(t)) return '—';
  const brt = new Date(t + BRASILIA_MS).toISOString();
  return `${formatarData(brt)} ${brt.slice(11, 16)}`;
}

/** Maior valor em reais aceito pelo banco (numeric(10,2)): R$ 99.999.999,99. */
export const VALOR_MAXIMO = 99999999.99;

export function valorMuitoAlto(n: number): boolean {
  return n > VALOR_MAXIMO;
}

/** As 27 unidades da federação, em ordem alfabética. */
export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

/** '52998224725' → '529.982.247-25'. */
export function formatarCpf(cpf: string | null): string {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
