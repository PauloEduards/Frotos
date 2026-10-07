import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { sair } from '@/api/auth';
import InicioMotorista from '@/app/(motorista)/index';
import { useSessao } from '@/sessao/useSessao';

const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
}));
jest.mock('@/sessao/useSessao', () => ({ useSessao: jest.fn() }));
jest.mock('@/api/auth', () => ({ sair: jest.fn() }));

const useSessaoMock = useSessao as jest.Mock;
const sairMock = sair as jest.Mock;

const base = { carregando: false, recarregarPerfil: jest.fn() };

beforeEach(() => jest.clearAllMocks());

describe('início do motorista', () => {
  it('mostra saudação e aviso', async () => {
    useSessaoMock.mockReturnValue({
      ...base,
      sessao: { user: { id: 'u1' } },
      perfil: { id: 'u1', nome: 'Ana', papel: 'motorista' },
    });
    await render(<InicioMotorista />);
    expect(screen.getByText('Olá, Ana!')).toBeTruthy();
    expect(screen.getByText('O app do motorista chega em breve.')).toBeTruthy();
  });

  it('perfil null: não mostra "Olá, !" e volta para a raiz', async () => {
    useSessaoMock.mockReturnValue({ ...base, sessao: { user: { id: 'u1' } }, perfil: null });
    await render(<InicioMotorista />);
    expect(screen.queryByText(/Olá/)).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/' });
  });

  it('Sair com falha mostra a mensagem de erro', async () => {
    useSessaoMock.mockReturnValue({
      ...base,
      sessao: { user: { id: 'u1' } },
      perfil: { id: 'u1', nome: 'Ana', papel: 'motorista' },
    });
    sairMock.mockRejectedValue({ message: 'Network request failed' });
    await render(<InicioMotorista />);
    await fireEvent.press(screen.getByText('Sair'));
    await waitFor(() =>
      expect(screen.getByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy(),
    );
  });
});
