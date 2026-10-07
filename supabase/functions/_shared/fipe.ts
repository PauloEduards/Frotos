// Consulta FIPE com cache. Módulo puro (sem APIs do Deno): as dependências são injetadas.

export type ConsultaFipe =
  | { tipo: 'marcas' }
  | { tipo: 'modelos'; marca: string }
  | { tipo: 'anos'; marca: string; modelo: string };

export type OpcaoFipe = { codigo: string; nome: string };

export type DepsFipe = {
  lerCache(chave: string): Promise<{ dados: OpcaoFipe[]; atualizadoEm: Date } | null>;
  salvarCache(chave: string, dados: OpcaoFipe[]): Promise<void>;
  buscar(url: string): Promise<unknown>;
};

const BASE = 'https://parallelum.com.br/fipe/api/v1/carros';
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;
const CODIGO = /^[A-Za-z0-9_-]+$/;

function codigoValido(v: string | null): v is string {
  return v !== null && CODIGO.test(v);
}

export function lerConsulta(p: URLSearchParams): ConsultaFipe | null {
  const tipo = p.get('tipo');
  const marca = p.get('marca');
  const modelo = p.get('modelo');
  if (tipo === 'marcas') return { tipo: 'marcas' };
  if (tipo === 'modelos') {
    return codigoValido(marca) ? { tipo: 'modelos', marca } : null;
  }
  if (tipo === 'anos') {
    return codigoValido(marca) && codigoValido(modelo) ? { tipo: 'anos', marca, modelo } : null;
  }
  return null;
}

export function urlFipe(c: ConsultaFipe): string {
  switch (c.tipo) {
    case 'marcas':
      return `${BASE}/marcas`;
    case 'modelos':
      return `${BASE}/marcas/${c.marca}/modelos`;
    case 'anos':
      return `${BASE}/marcas/${c.marca}/modelos/${c.modelo}/anos`;
  }
}

export function chaveCache(c: ConsultaFipe): string {
  switch (c.tipo) {
    case 'marcas':
      return 'marcas';
    case 'modelos':
      return `modelos:${c.marca}`;
    case 'anos':
      return `anos:${c.marca}:${c.modelo}`;
  }
}

export function cacheValido(atualizadoEm: Date, agora: Date): boolean {
  return agora.getTime() - atualizadoEm.getTime() < VALIDADE_MS;
}

// A API devolve codigo numérico em marcas/modelos e string em anos; normaliza tudo para string.
function normalizar(c: ConsultaFipe, resposta: unknown): OpcaoFipe[] {
  const lista =
    c.tipo === 'modelos' && resposta && typeof resposta === 'object'
      ? (resposta as { modelos?: unknown }).modelos
      : resposta;
  if (!Array.isArray(lista)) throw new Error('Formato inesperado da FIPE');
  return lista.map((item) => {
    const { codigo, nome } = (item ?? {}) as { codigo?: unknown; nome?: unknown };
    if ((typeof codigo !== 'string' && typeof codigo !== 'number') || typeof nome !== 'string') {
      throw new Error('Item inesperado da FIPE');
    }
    return { codigo: String(codigo), nome };
  });
}

export async function buscarComCache(
  c: ConsultaFipe,
  deps: DepsFipe,
  agora: Date,
): Promise<{ status: 200 | 503; corpo: OpcaoFipe[] | { erro: 'FIPE_INDISPONIVEL' } }> {
  const chave = chaveCache(c);
  let cache: { dados: OpcaoFipe[]; atualizadoEm: Date } | null = null;
  try {
    cache = await deps.lerCache(chave);
  } catch {
    cache = null;
  }
  if (cache && cacheValido(cache.atualizadoEm, agora)) {
    return { status: 200, corpo: cache.dados };
  }
  try {
    const dados = normalizar(c, await deps.buscar(urlFipe(c)));
    // Lista vazia não é uma resposta útil: trata como falha para não gravar cache "fresco" vazio.
    if (dados.length === 0) throw new Error('Lista vazia da FIPE');
    try {
      await deps.salvarCache(chave, dados);
    } catch {
      // falha ao gravar o cache não deve derrubar a resposta
    }
    return { status: 200, corpo: dados };
  } catch {
    if (cache) return { status: 200, corpo: cache.dados };
    return { status: 503, corpo: { erro: 'FIPE_INDISPONIVEL' } };
  }
}
