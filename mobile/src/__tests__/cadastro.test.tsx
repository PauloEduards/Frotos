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

  it('proprietário: cadastra sem CPF e sem CNH', async () => {
    cadastrarMock.mockResolvedValue(undefined);
    await render(<Cadastro />);
    await preencher();
    await fireEvent.press(screen.getByText('Sou proprietário'));
    expect(screen.queryByLabelText('CPF')).toBeNull();
    expect(screen.queryByText('Tenho CNH')).toBeNull();
    await fireEvent.press(screen.getByText('Criar conta'));
    await waitFor(() =>
      expect(cadastrarMock).toHaveBeenCalledWith({
        nome: 'Bruno Lima',
        telefone: '11999990000',
        email: 'bruno@frotos.dev',
        senha: 'senha123',
        papel: 'proprietario',
      }),
    );
  });

  it('motorista: pede estado, cidade, CPF (com máscara) e CNH', async () => {
    cadastrarMock.mockResolvedValue(undefined);
    await render(<Cadastro />);
    await preencher();
    await fireEvent.press(screen.getByText('Sou motorista'));
    await fireEvent.press(screen.getByText('SP'));
    await fireEvent.changeText(screen.getByLabelText('Cidade'), 'São Paulo');
    await fireEvent.changeText(screen.getByLabelText('CPF'), '52998224725');
    expect(screen.getByLabelText('CPF').props.value).toBe('529.982.247-25');
    await fireEvent(screen.getByLabelText('Tenho CNH'), 'valueChange', true);
    await fireEvent.press(screen.getByText('Criar conta'));
    await waitFor(() =>
      expect(cadastrarMock).toHaveBeenCalledWith({
        nome: 'Bruno Lima',
        telefone: '11999990000',
        email: 'bruno@frotos.dev',
        senha: 'senha123',
        papel: 'motorista',
        uf: 'SP',
        cidade: 'São Paulo',
        cpf: '52998224725',
        tem_cnh: true,
      }),
    );
  });

  it('motorista com CPF inválido não cadastra', async () => {
    await render(<Cadastro />);
    await preencher();
    await fireEvent.press(screen.getByText('Sou motorista'));
    await fireEvent.press(screen.getByText('SP'));
    await fireEvent.changeText(screen.getByLabelText('Cidade'), 'São Paulo');
    await fireEvent.changeText(screen.getByLabelText('CPF'), '111.111.111-11');
    await fireEvent.press(screen.getByText('Criar conta'));
    expect(screen.getByText('CPF inválido.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('motorista sem cidade não cadastra', async () => {
    await render(<Cadastro />);
    await preencher();
    await fireEvent.press(screen.getByText('Sou motorista'));
    await fireEvent.changeText(screen.getByLabelText('CPF'), '52998224725');
    await fireEvent.press(screen.getByText('Criar conta'));
    expect(screen.getByText('Escolha o estado e informe a cidade.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('erro do servidor ao salvar (CPF repetido) mostra a mensagem e mantém os dados', async () => {
    cadastrarMock.mockRejectedValue({ name: 'AuthApiError', message: 'Database error saving new user' });
    await render(<Cadastro />);
    await preencher();
    await fireEvent.press(screen.getByText('Sou motorista'));
    await fireEvent.press(screen.getByText('SP'));
    await fireEvent.changeText(screen.getByLabelText('Cidade'), 'São Paulo');
    await fireEvent.changeText(screen.getByLabelText('CPF'), '52998224725');
    await fireEvent.press(screen.getByText('Criar conta'));
    expect(
      await screen.findByText('Não foi possível criar a conta. Confira o CPF: ele pode já estar cadastrado.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('CPF').props.value).toBe('529.982.247-25');
  });
});
