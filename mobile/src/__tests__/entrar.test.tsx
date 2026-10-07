import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { entrar } from '@/api/auth';
import Entrar from '@/app/(auth)/entrar';

jest.mock('@/api/auth', () => ({ entrar: jest.fn() }));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: string }) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

const entrarMock = entrar as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('tela Entrar', () => {
  it('mostra título, subtítulo e link de cadastro', async () => {
    await render(<Entrar />);
    expect(screen.getByText('Frotos')).toBeTruthy();
    expect(screen.getByText('Controle de manutenção da sua frota')).toBeTruthy();
    expect(screen.getByText('Criar conta')).toBeTruthy();
  });

  it('chama entrar com e-mail e senha', async () => {
    entrarMock.mockResolvedValue(undefined);
    await render(<Entrar />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@frotos.dev');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha123');
    await fireEvent.press(screen.getByText('Entrar'));
    await waitFor(() => expect(entrarMock).toHaveBeenCalledWith('ana@frotos.dev', 'senha123'));
  });

  it('credenciais inválidas: mostra mensagem e mantém os campos', async () => {
    entrarMock.mockRejectedValue({ name: 'AuthApiError', message: 'Invalid login credentials' });
    await render(<Entrar />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@frotos.dev');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'errada');
    await fireEvent.press(screen.getByText('Entrar'));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeTruthy();
    expect(screen.getByLabelText('E-mail').props.value).toBe('ana@frotos.dev');
    expect(screen.getByLabelText('Senha').props.value).toBe('errada');
  });
});
