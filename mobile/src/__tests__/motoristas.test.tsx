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
import { candidaturasPendentes, responderCandidatura } from '@/api/candidaturas';
import Motoristas from '@/app/(dono)/(abas)/motoristas';
import { voltarAoFoco } from '@/testes/foco';
import { renderComCliente } from '@/testes/renderComCliente';
import { ErroApp } from '@/lib/erros';

jest.mock('expo-router', () => ({ useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste }));
jest.mock('@/api/frota', () => ({
  minhaFrota: jest.fn(),
  listarMembros: jest.fn(),
  responderEntrada: jest.fn(),
  definirNivel: jest.fn(),
  removerMotorista: jest.fn(),
}));
jest.mock('@/api/candidaturas', () => ({
  candidaturasPendentes: jest.fn().mockResolvedValue([]),
  responderCandidatura: jest.fn(),
}));
jest.mock('@/api/fotos', () => ({ urlsAssinadas: jest.fn().mockResolvedValue({}) }));

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
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['gastos'] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['membros'] });
  });

  it('aprovar a entrada atualiza motoristas e os dados da frota', async () => {
    mocks.listarMembros.mockResolvedValue([membro({ status: 'pendente', id: 'p1' })]);
    await renderizar();
    const invalidar = jest.spyOn(client, 'invalidateQueries');
    await fireEvent.press(await screen.findByText('Aprovar'));
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['membros'] }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['veiculos'] });
  });

  it('voltar para a aba recarrega os motoristas', async () => {
    await renderizar();
    await screen.findByText(VAZIO);
    mocks.listarMembros.mockResolvedValue([membro({ status: 'pendente', id: 'p1', nome: 'Bruno Lima' })]);
    await voltarAoFoco();
    expect(await screen.findByText('Bruno Lima')).toBeTruthy();
  });

  it('sem frota orienta a criar a frota', async () => {
    mocks.minhaFrota.mockResolvedValue(null);
    await renderizar();
    expect(await screen.findByText('Crie sua frota na aba Frota para começar.')).toBeTruthy();
    expect(screen.queryByText(VAZIO)).toBeNull();
  });

  it('erro ao carregar mostra mensagem e tentar de novo', async () => {
    mocks.listarMembros.mockRejectedValue(new ErroApp('Falha ao listar.', 'X'));
    await renderizar();
    expect(await screen.findByText('Falha ao listar.')).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});

const candidatura = {
  id: 'c1',
  driver_id: 'd9',
  nome: 'Diego Lima',
  telefone: '11988887777',
  cidade: 'São Paulo',
  uf: 'SP',
  cpf: '52998224725',
  tem_cnh: true,
  mensagem: 'Trabalho de manhã',
  criada_em: '2026-10-08T12:00:00.000Z',
  carro: { vehicle_id: 'v1', placa: 'CDE3F45', marca: 'Fiat', modelo: 'Argo', foto_path: null },
};

describe('pedidos de motoristas (candidaturas)', () => {
  it('aparecem no topo com os dados do candidato e o carro desejado', async () => {
    (candidaturasPendentes as jest.Mock).mockResolvedValue([candidatura]);
    mocks.listarMembros.mockResolvedValue([membro({ status: 'pendente', id: 'm5', nome: 'Pedro' })]);
    await renderizar();
    expect(await screen.findByText('Pedidos de motoristas')).toBeTruthy();
    expect(screen.getByText('Diego Lima')).toBeTruthy();
    expect(screen.getByText('11988887777')).toBeTruthy();
    expect(screen.getByText('São Paulo/SP')).toBeTruthy();
    expect(screen.getByText('CPF 529.982.247-25')).toBeTruthy();
    expect(screen.getByText('Tem CNH: sim')).toBeTruthy();
    expect(screen.getByText('"Trabalho de manhã"')).toBeTruthy();
    expect(screen.getByLabelText('Placa CDE3F45')).toBeTruthy();
    const titulos = screen.getAllByText(/^(Pedidos de motoristas|Pedidos para entrar)$/).map((n) => n.props.children);
    expect(titulos).toEqual(['Pedidos de motoristas', 'Pedidos para entrar']);
  });

  it('Aceitar responde e atualiza', async () => {
    (candidaturasPendentes as jest.Mock).mockResolvedValue([candidatura]);
    (responderCandidatura as jest.Mock).mockResolvedValue(undefined);
    await renderizar();
    await fireEvent.press(await screen.findByText('Aceitar'));
    await waitFor(() => expect(responderCandidatura).toHaveBeenCalledWith('c1', true));
  });

  it('Recusar pede confirmação', async () => {
    (candidaturasPendentes as jest.Mock).mockResolvedValue([candidatura]);
    (responderCandidatura as jest.Mock).mockResolvedValue(undefined);
    const alerta = jest.spyOn(Alert, 'alert');
    await renderizar();
    await fireEvent.press(await screen.findByText('Recusar candidato'));
    const botoes = alerta.mock.calls[0][2] as BotaoAlerta[];
    expect(responderCandidatura).not.toHaveBeenCalled();
    botoes.find((b) => b.text === 'Recusar')?.onPress?.();
    await waitFor(() => expect(responderCandidatura).toHaveBeenCalledWith('c1', false));
  });
});
