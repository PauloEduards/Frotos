const GENERICA = 'Algo deu errado. Tente de novo.';

export class ErroApp extends Error {
  codigo?: string;

  constructor(mensagem: string, codigo?: string) {
    super(mensagem);
    this.name = 'ErroApp';
    this.codigo = codigo;
  }
}

type ErroBruto = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

function comoObjeto(e: unknown): ErroBruto | null {
  return typeof e === 'object' && e !== null ? (e as ErroBruto) : null;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function mensagemErro(e: unknown): string {
  if (e instanceof ErroApp) return e.message || GENERICA;

  const o = comoObjeto(e);
  if (!o) return GENERICA;

  const code = texto(o.code);
  const message = texto(o.message);
  const details = texto(o.details);

  if (code === 'P0001') return details || GENERICA;
  if (code === '42501') return 'Você não tem permissão para isso.';
  if (code === '23505') return 'Já existe um carro com esta placa na frota.';

  if (message.includes('Network request failed') || message.includes('Failed to fetch')) {
    return 'Sem conexão com a internet. Tente de novo.';
  }
  if (message.includes('JWT expired')) return 'Sua sessão expirou. Entre de novo.';
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  // O Auth não repassa o DETAIL do trigger de cadastro; o caso real é CPF repetido.
  if (message.includes('Database error saving new user')) {
    return 'Não foi possível criar a conta. Confira o CPF: ele pode já estar cadastrado.';
  }

  return GENERICA;
}

export function comoErroApp(e: unknown): ErroApp {
  if (e instanceof ErroApp) return e;
  const o = comoObjeto(e);
  const codigo = o && o.code === 'P0001' ? texto(o.message) : texto(o?.code);
  return new ErroApp(mensagemErro(e), codigo || undefined);
}
