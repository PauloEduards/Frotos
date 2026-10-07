import { render } from '@testing-library/react-native';

import Inicio from '@/app/index';
import { useSessao } from '@/sessao/useSessao';

const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
}));
jest.mock('@/sessao/useSessao', () => ({ useSessao: jest.fn() }));
jest.mock('@/api/auth', () => ({ sair: jest.fn() }));

const useSessaoMock = useSessao as jest.Mock;

const base = { carregando: false, recarregarPerfil: jest.fn() };

beforeEach(() => mockRedirect.mockClear());

describe('redirecionamento da raiz', () => {
  it('sem sessão vai para entrar', async () => {
    useSessaoMock.mockReturnValue({ ...base, sessao: null, perfil: null });
    await render(<Inicio />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/(auth)/entrar' });
  });

  it('motorista vai para (motorista)', async () => {
    useSessaoMock.mockReturnValue({
      ...base,
      sessao: { user: { id: 'u1' } },
      perfil: { id: 'u1', nome: 'Ana', papel: 'motorista' },
    });
    await render(<Inicio />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/(motorista)' });
  });

  it('proprietário vai para (dono)/(abas)', async () => {
    useSessaoMock.mockReturnValue({
      ...base,
      sessao: { user: { id: 'u2' } },
      perfil: { id: 'u2', nome: 'Dono', papel: 'proprietario' },
    });
    await render(<Inicio />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/(dono)/(abas)' });
  });
});
