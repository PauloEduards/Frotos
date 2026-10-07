import { comoErroApp, ErroApp, mensagemErro } from './erros';

describe('mensagemErro', () => {
  it('mostra o DETAIL de erros de negócio (P0001)', () => {
    expect(
      mensagemErro({
        code: 'P0001',
        message: 'KM_MENOR',
        details: 'O km informado (45.200) é menor que o último registro (45.870).',
      }),
    ).toBe('O km informado (45.200) é menor que o último registro (45.870).');
  });
  it('usa mensagem genérica se P0001 vier sem detalhe', () => {
    expect(mensagemErro({ code: 'P0001', message: 'X', details: null })).toBe(
      'Algo deu errado. Tente de novo.',
    );
  });
  it('traduz permissão negada', () => {
    expect(mensagemErro({ code: '42501', message: 'permission denied' })).toBe(
      'Você não tem permissão para isso.',
    );
  });
  it('traduz placa duplicada na frota (23505)', () => {
    expect(mensagemErro({ code: '23505', message: 'duplicate key value' })).toBe(
      'Já existe um carro com esta placa na frota.',
    );
  });
  it('traduz falha de rede', () => {
    expect(mensagemErro(new TypeError('Network request failed'))).toBe(
      'Sem conexão com a internet. Tente de novo.',
    );
  });
  it('traduz erros de autenticação', () => {
    expect(
      mensagemErro({ name: 'AuthApiError', message: 'Invalid login credentials' }),
    ).toBe('E-mail ou senha incorretos.');
    expect(
      mensagemErro({ name: 'AuthApiError', message: 'User already registered' }),
    ).toBe('Este e-mail já está cadastrado.');
  });
  it('traduz sessão expirada', () => {
    expect(mensagemErro({ message: 'JWT expired' })).toBe('Sua sessão expirou. Entre de novo.');
  });
  it('usa mensagem genérica para o resto', () => {
    expect(mensagemErro('qualquer coisa')).toBe('Algo deu errado. Tente de novo.');
  });
  it('preserva a mensagem de um ErroApp', () => {
    expect(mensagemErro(new ErroApp('Texto pronto', 'COD'))).toBe('Texto pronto');
  });
});

describe('comoErroApp', () => {
  it('guarda o código do backend', () => {
    const e = comoErroApp({ code: 'P0001', message: 'KM_MENOR', details: 'x' });
    expect(e).toBeInstanceOf(ErroApp);
    expect(e.codigo).toBe('KM_MENOR');
    expect(e.message).toBe('x');
  });
  it('devolve o mesmo ErroApp se já for um', () => {
    const e = new ErroApp('a', 'B');
    expect(comoErroApp(e)).toBe(e);
  });
});
