import { screen } from '@testing-library/react-native';

import { minhaSituacao } from '@/api/motorista';
import MotoristaLayout from '@/app/(motorista)/_layout';
import InicioMotorista from '@/app/(motorista)/index';
import { renderComCliente } from '@/testes/renderComCliente';
import { useSessao } from '@/sessao/useSessao';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  const Stack = ({ children }: { children?: unknown }) => <Text>pilha</Text>;
  Stack.Screen = () => null;
  return {
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return null;
    },
    Stack,
  };
});
jest.mock('@/sessao/useSessao', () => ({ useSessao: jest.fn() }));
jest.mock('@/api/motorista', () => ({ minhaSituacao: jest.fn() }));

const sessaoMock = useSessao as jest.Mock;
const situacaoMock = minhaSituacao as jest.Mock;

const perfilMotorista = { id: 'u1', nome: 'Ana', telefone: null, papel: 'motorista', criado_em: '2026-10-01' };

beforeEach(() => {
  jest.clearAllMocks();
  sessaoMock.mockReturnValue({ carregando: false, sessao: { user: { id: 'u1' } }, perfil: perfilMotorista });
});

describe('layout do motorista', () => {
  it('sem perfil de motorista volta para a raiz', async () => {
    sessaoMock.mockReturnValue({ carregando: false, sessao: { user: { id: 'u1' } }, perfil: null });
    await renderComCliente(<MotoristaLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('sem sessão vai para entrar', async () => {
    sessaoMock.mockReturnValue({ carregando: false, sessao: null, perfil: null });
    await renderComCliente(<MotoristaLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/(auth)/entrar');
  });
});

describe('início do motorista', () => {
  it('sem frota vai para Buscar carros', async () => {
    situacaoMock.mockResolvedValue({ frotaAtiva: null });
    await renderComCliente(<InicioMotorista />);
    await screen.findByLabelText('Carregando', {}, { timeout: 50 }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRedirect).toHaveBeenCalledWith('/(motorista)/(busca)/buscar');
  });

  it('com frota vai para Meu carro', async () => {
    situacaoMock.mockResolvedValue({ frotaAtiva: { fleet_id: 'f1', nome: 'Frota Piloto' } });
    await renderComCliente(<InicioMotorista />);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRedirect).toHaveBeenCalledWith('/(motorista)/(frota)/meu-carro');
  });

  it('erro mostra a mensagem e Tentar de novo', async () => {
    situacaoMock.mockRejectedValue(new TypeError('Network request failed'));
    await renderComCliente(<InicioMotorista />);
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});
