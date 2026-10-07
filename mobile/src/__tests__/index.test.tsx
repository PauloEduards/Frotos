import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { sair } from '@/api/auth';
import Inicio from '@/app/index';
import { useSessao } from '@/sessao/useSessao';

const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
}));
jest.mock('@/sessao/useSessao', () => ({ useSessao: jest.fn() }));
jest.mock('@/api/auth', () => ({ sair: jest.fn() }));

const useSessaoMock = useSessao as jest.Mock;
const sairMock = sair as jest.Mock;

const recarregarPerfil = jest.fn();
const base = { carregando: false, recarregarPerfil };

beforeEach(() => {
  jest.clearAllMocks();
});

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

  it('carregando: mostra Carregando e não redireciona', async () => {
    useSessaoMock.mockReturnValue({ ...base, carregando: true, sessao: null, perfil: null });
    await render(<Inicio />);
    expect(screen.getByLabelText('Carregando')).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe('perfil não carregado', () => {
  beforeEach(() => {
    useSessaoMock.mockReturnValue({ ...base, sessao: { user: { id: 'u1' } }, perfil: null });
  });

  it('mostra o erro e as ações, sem redirecionar', async () => {
    await render(<Inicio />);
    expect(screen.getByText('Não foi possível carregar seu perfil.')).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
    expect(screen.getByText('Sair')).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('Tentar de novo mostra estado ocupado e a tela de erro continua depois', async () => {
    let resolver!: () => void;
    recarregarPerfil.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    await render(<Inicio />);
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(recarregarPerfil).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Tentar de novo')).toBeNull();
    resolver();
    expect(await screen.findByText('Tentar de novo')).toBeTruthy();
    expect(screen.getByText('Não foi possível carregar seu perfil.')).toBeTruthy();
  });

  it('Sair com falha mostra a mensagem de erro', async () => {
    sairMock.mockRejectedValue({ message: 'Network request failed' });
    await render(<Inicio />);
    await fireEvent.press(screen.getByText('Sair'));
    await waitFor(() =>
      expect(screen.getByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy(),
    );
  });
});
