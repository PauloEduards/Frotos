import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  definirNivel,
  listarMembros,
  minhaFrota,
  removerMotorista,
  responderEntrada,
  type Membro,
} from '@/api/frota';
import Motoristas from '@/app/(dono)/(abas)/motoristas';
import { renderComCliente } from '@/testes/renderComCliente';
import { ErroApp } from '@/lib/erros';

jest.mock('@/api/frota', () => ({
  minhaFrota: jest.fn(),
  listarMembros: jest.fn(),
  responderEntrada: jest.fn(),
  definirNivel: jest.fn(),
  removerMotorista: jest.fn(),
}));

const mocks = {
  minhaFrota: minhaFrota as jest.Mock,
  listarMembros: listarMembros as jest.Mock,
  responderEntrada: responderEntrada as jest.Mock,
  definirNivel: definirNivel as jest.Mock,
  removerMotorista: removerMotorista as jest.Mock,
};

type BotaoAlerta = { text: string; style?: string; onPress?: () => void };

function membro(extra: Partial<Membro>): Membro {
  return {
    id: 'm1',
    driver_id: 'd1',
    status: 'ativo',
    nivel_manutencao: 'com_aprovacao',
    nome: 'Ana Souza',
    telefone: '11999990000',
    carro_placa: null,
    ...extra,
  };
}

let client: QueryClient;
let alertSpy: jest.SpyInstance;

async function renderizar() {
  ({ client } = await renderComCliente(<Motoristas />));
}


beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mocks.minhaFrota.mockResolvedValue({ id: 'f1' });
  mocks.listarMembros.mockResolvedValue([]);
  mocks.responderEntrada.mockResolvedValue(undefined);
  mocks.definirNivel.mockResolvedValue(undefined);
  mocks.removerMotorista.mockResolvedValue(undefined);
});

const VAZIO = 'Nenhum motorista ainda. Compartilhe o código da frota.';

describe('motoristas', () => {
  it('sem motoristas mostra a lista vazia', async () => {
    await renderizar();
    expect(await screen.findByText(VAZIO)).toBeTruthy();
  });

  it('removidos não aparecem', async () => {
    mocks.listarMembros.mockResolvedValue([membro({ status: 'removido', nome: 'Fulano' })]);
    await renderizar();
    expect(await screen.findByText(VAZIO)).toBeTruthy();
    expect(screen.queryByText('Fulano')).toBeNull();
  });

  it('pedido pendente: Aprovar e Recusar chamam responderEntrada', async () => {
    mocks.listarMembros.mockResolvedValue([membro({ status: 'pendente', id: 'p1', nome: 'Bruno Lima' })]);
    await renderizar();
    expect(await screen.findByText('Pedidos para entrar')).toBeTruthy();
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.getByText('11999990000')).toBeTruthy();
    await fireEvent.press(screen.getByText('Aprovar'));
    await waitFor(() => expect(mocks.responderEntrada).toHaveBeenCalledWith('p1', true));
    await fireEvent.press(screen.getByText('Recusar'));
    await waitFor(() => expect(mocks.responderEntrada).toHaveBeenCalledWith('p1', false));
  });

  it('erro ao responder aparece junto do pedido', async () => {
    mocks.listarMembros.mockResolvedValue([membro({ status: 'pendente', id: 'p1' })]);
    mocks.responderEntrada.mockRejectedValue(new ErroApp('Pedido já respondido.', 'X'));
    await renderizar();
    await fireEvent.press(await screen.findByText('Aprovar'));
    expect(await screen.findByText('Pedido já respondido.')).toBeTruthy();
  });

  it('motorista ativo mostra o carro ou "Sem carro"', async () => {
    mocks.listarMembros.mockResolvedValue([
      membro({ id: 'a', nome: 'Ana', carro_placa: 'ABC1D23' }),
      membro({ id: 'b', nome: 'Beto', carro_placa: null }),
    ]);
    await renderizar();
    expect(await screen.findByText('Com o carro ABC1D23')).toBeTruthy();
    expect(screen.getByText('Sem carro')).toBeTruthy();
  });

  it('trocar o nível chama definirNivel', async () => {
    mocks.listarMembros.mockResolvedValue([membro({ id: 'a' })]);
    await renderizar();
    expect(await screen.findByText('Não registra')).toBeTruthy();
    expect(screen.getByText('Registra com aprovação')).toBeTruthy();
    await fireEvent.press(screen.getByText('Não registra'));
    await waitFor(() => expect(mocks.definirNivel).toHaveBeenCalledWith('a', 'sem_permissao'));
    await fireEvent.press(screen.getByText('Confiável'));
    await waitFor(() => expect(mocks.definirNivel).toHaveBeenCalledWith('a', 'confiavel'));
  });

  it('texto de ajuda só aparece no nível Confiável', async () => {
    mocks.listarMembros.mockResolvedValue([
      membro({ id: 'a', nivel_manutencao: 'confiavel' }),
      membro({ id: 'b', nome: 'Beto', nivel_manutencao: 'com_aprovacao' }),
    ]);
    await renderizar();
    expect(
      await screen.findAllByText('Os serviços entram direto na previsão. Você pode contestar depois.'),
    ).toHaveLength(1);
  });

  it('remover pede confirmação, remove e invalida membros e veículos', async () => {
    mocks.listarMembros.mockResolvedValue([membro({ id: 'a' })]);
    await renderizar();
    await fireEvent.press(await screen.findByText('Remover da frota'));
    expect(mocks.removerMotorista).not.toHaveBeenCalled();
    expect(alertSpy.mock.calls[0][1]).toBe('Se ele estiver com um carro, o carro fica livre.');
    const invalidar = jest.spyOn(client, 'invalidateQueries');
    const botoes = alertSpy.mock.calls[0][2] as BotaoAlerta[];
    botoes.find((b) => b.text === 'Remover da frota')?.onPress?.();
    await waitFor(() => expect(mocks.removerMotorista).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['veiculos'] }));
  });

  it('erro ao carregar mostra mensagem e tentar de novo', async () => {
    mocks.listarMembros.mockRejectedValue(new ErroApp('Falha ao listar.', 'X'));
    await renderizar();
    expect(await screen.findByText('Falha ao listar.')).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});
