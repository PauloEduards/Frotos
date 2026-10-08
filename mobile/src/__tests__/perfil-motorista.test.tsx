import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { atualizarPerfil, sair } from '@/api/auth';
import Perfil from '@/app/(motorista)/perfil';
import { useSessao } from '@/sessao/useSessao';

jest.mock('@/api/auth', () => ({ atualizarPerfil: jest.fn(), sair: jest.fn() }));
jest.mock('@/sessao/useSessao', () => ({ useSessao: jest.fn() }));

const atualizarMock = atualizarPerfil as jest.Mock;
const recarregar = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useSessao as jest.Mock).mockReturnValue({
    carregando: false,
    sessao: { user: { id: 'u1' } },
    perfil: {
      id: 'u1',
      nome: 'Ana',
      telefone: null,
      papel: 'motorista',
      criado_em: '2026-10-01',
      uf: 'SP',
      cidade: 'São Paulo',
      cpf: '52998224725',
      tem_cnh: true,
    },
    recarregarPerfil: recarregar,
  });
  atualizarMock.mockResolvedValue(undefined);
  recarregar.mockResolvedValue(undefined);
});

it('mostra os dados atuais e o CPF formatado', async () => {
  await render(<Perfil />);
  expect(screen.getByText('Meu perfil')).toBeTruthy();
  expect(screen.getByText('CPF 529.982.247-25')).toBeTruthy();
  expect(screen.getByLabelText('Cidade').props.value).toBe('São Paulo');
  expect(screen.getByLabelText('Tenho CNH').props.value).toBe(true);
});

it('salva estado, cidade e CNH', async () => {
  await render(<Perfil />);
  await fireEvent.press(screen.getByText('RJ'));
  await fireEvent.changeText(screen.getByLabelText('Cidade'), 'Niterói');
  await fireEvent(screen.getByLabelText('Tenho CNH'), 'valueChange', false);
  await fireEvent.press(screen.getByText('Salvar'));
  await waitFor(() => expect(atualizarMock).toHaveBeenCalledWith({ uf: 'RJ', cidade: 'Niterói', tem_cnh: false }));
  expect(recarregar).toHaveBeenCalled();
  expect(await screen.findByText('Perfil salvo.')).toBeTruthy();
});

it('cidade vazia não salva', async () => {
  await render(<Perfil />);
  await fireEvent.changeText(screen.getByLabelText('Cidade'), ' ');
  await fireEvent.press(screen.getByText('Salvar'));
  expect(screen.getByText('Escolha o estado e informe a cidade.')).toBeTruthy();
  expect(atualizarMock).not.toHaveBeenCalled();
});

it('tem o botão Sair', async () => {
  (sair as jest.Mock).mockResolvedValue(undefined);
  await render(<Perfil />);
  await fireEvent.press(screen.getByText('Sair'));
  await waitFor(() => expect(sair).toHaveBeenCalled());
});
