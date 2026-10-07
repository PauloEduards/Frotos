import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { cadastrar } from '@/api/auth';
import Cadastro from '@/app/(auth)/cadastro';

jest.mock('@/api/auth', () => ({ cadastrar: jest.fn() }));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: string }) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

const cadastrarMock = cadastrar as jest.Mock;

beforeEach(() => jest.clearAllMocks());

async function preencher(senha = 'senha123') {
  await fireEvent.changeText(screen.getByLabelText('Nome'), 'Bruno Lima');
  await fireEvent.changeText(screen.getByLabelText('Telefone'), '11999990000');
  await fireEvent.changeText(screen.getByLabelText('E-mail'), 'bruno@frotos.dev');
  await fireEvent.changeText(screen.getByLabelText('Senha'), senha);
}

describe('tela Cadastro', () => {
  it('sem escolher papel: mostra erro e não cadastra', async () => {
    await render(<Cadastro />);
    await preencher();
    await fireEvent.press(screen.getByText('Criar conta'));
    expect(screen.getByText('Escolha se você é proprietário ou motorista.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('senha curta: mostra erro e não cadastra', async () => {
    await render(<Cadastro />);
    await preencher('12345');
    await fireEvent.press(screen.getByText('Sou motorista'));
    await fireEvent.press(screen.getByText('Criar conta'));
    expect(screen.getByText('A senha precisa ter pelo menos 6 caracteres.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('completo: chama cadastrar com os dados', async () => {
    cadastrarMock.mockResolvedValue(undefined);
    await render(<Cadastro />);
    await preencher();
    await fireEvent.press(screen.getByText('Sou motorista'));
    await fireEvent.press(screen.getByText('Criar conta'));
    await waitFor(() =>
      expect(cadastrarMock).toHaveBeenCalledWith({
        nome: 'Bruno Lima',
        telefone: '11999990000',
        email: 'bruno@frotos.dev',
        senha: 'senha123',
        papel: 'motorista',
      }),
    );
  });
});
