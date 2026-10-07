import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

import { criarFrota, gerarNovoCodigo, minhaFrota, type Frota } from '@/api/frota';
import { resumoFrota, type ResumoCarro } from '@/api/veiculos';
import PainelFrota from '@/app/(dono)/(abas)/index';
import { voltarAoFoco } from '@/testes/foco';
import { renderComCliente } from '@/testes/renderComCliente';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste,
}));
jest.mock('@/api/veiculos', () => ({ resumoFrota: jest.fn() }));
jest.mock('@/api/frota', () => ({
  minhaFrota: jest.fn(),
  criarFrota: jest.fn(),
  gerarNovoCodigo: jest.fn(),
}));

const resumoMock = resumoFrota as jest.Mock;
const minhaFrotaMock = minhaFrota as jest.Mock;
const criarFrotaMock = criarFrota as jest.Mock;
const gerarNovoCodigoMock = gerarNovoCodigo as jest.Mock;

const frota: Frota = {
  id: 'f1',
  nome: 'Frota Piloto',
  codigo_convite: 'FRT-TEST',
  modo_manutencao: 'proprietario_leva',
  limite_salto_km_dia: 350,
  limiar_amarelo_km: 1000,
  limiar_amarelo_dias: 7,
  limiar_laranja_km: 300,
};

let client: QueryClient;

async function renderizar() {
  ({ client } = await renderComCliente(<PainelFrota />));
}

type BotaoAlerta = { text: string; style?: string; onPress?: () => void | Promise<void> };

let alertSpy: jest.SpyInstance;
let shareSpy: jest.SpyInstance;


beforeEach(() => {
  jest.clearAllMocks();
  resumoMock.mockResolvedValue([]);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});

describe('painel sem frota', () => {
  beforeEach(() => minhaFrotaMock.mockResolvedValue(null));

  it('voltar para a aba sem frota não consulta carros', async () => {
    await renderizar();
    await screen.findByText('Crie sua frota');
    await voltarAoFoco();
    await waitFor(() => expect(minhaFrotaMock).toHaveBeenCalledTimes(2));
    expect(resumoMock).not.toHaveBeenCalled();
  });

  it('mostra o formulário de criação', async () => {
    await renderizar();
    expect(await screen.findByText('Crie sua frota')).toBeTruthy();
    expect(screen.getByLabelText('Nome da frota')).toBeTruthy();
    expect(screen.getByText('Criar frota')).toBeTruthy();
  });

  it('criar chama criarFrota e depois mostra o código', async () => {
    criarFrotaMock.mockResolvedValue(frota);
    await renderizar();
    await fireEvent.changeText(await screen.findByLabelText('Nome da frota'), '  Frota Piloto ');
    await fireEvent.press(screen.getByText('Criar frota'));
    await waitFor(() => expect(criarFrotaMock).toHaveBeenCalledWith('Frota Piloto'));
    expect(await screen.findByText('Código da frota: FRT-TEST')).toBeTruthy();
    expect(screen.queryByText('Crie sua frota')).toBeNull();
  });

  it('nome vazio não chama criarFrota', async () => {
    await renderizar();
    await fireEvent.press(await screen.findByText('Criar frota'));
    expect(await screen.findByText('Informe o nome da frota.')).toBeTruthy();
    expect(criarFrotaMock).not.toHaveBeenCalled();
  });

  it('erro de negócio mostra o DETAIL', async () => {
    criarFrotaMock.mockRejectedValue({
      code: 'P0001',
      message: 'FROTA_JA_EXISTE',
      details: 'Você já tem uma frota cadastrada.',
    });
    await renderizar();
    await fireEvent.changeText(await screen.findByLabelText('Nome da frota'), 'X');
    await fireEvent.press(screen.getByText('Criar frota'));
    expect(await screen.findByText('Você já tem uma frota cadastrada.')).toBeTruthy();
  });
});

describe('painel com frota', () => {
  beforeEach(() => minhaFrotaMock.mockResolvedValue(frota));

  it('mostra o card com o código e os botões', async () => {
    await renderizar();
    expect(await screen.findByText('Código da frota: FRT-TEST')).toBeTruthy();
    expect(screen.getByText('Compartilhar')).toBeTruthy();
    expect(screen.getByText('Gerar novo código')).toBeTruthy();
  });

  it('Adicionar carro abre o cadastro de carro', async () => {
    await renderizar();
    await fireEvent.press(await screen.findByText('Adicionar carro'));
    expect(mockPush).toHaveBeenCalledWith('/(dono)/carros/novo');
  });

  it('Compartilhar abre o Share com a mensagem', async () => {
    await renderizar();
    await fireEvent.press(await screen.findByText('Compartilhar'));
    expect(shareSpy).toHaveBeenCalledWith({
      message: 'Entre na minha frota no app Frotos com o código FRT-TEST.',
    });
  });

  it('Gerar novo código pede confirmação antes de chamar a API', async () => {
    gerarNovoCodigoMock.mockResolvedValue('FRT-NOVO');
    await renderizar();
    await fireEvent.press(await screen.findByText('Gerar novo código'));

    expect(gerarNovoCodigoMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [, mensagem, botoes] = alertSpy.mock.calls[0] as [string, string, BotaoAlerta[]];
    expect(mensagem).toBe('Os motoristas que ainda não entraram vão precisar do código novo.');

    await botoes.find((b) => b.text === 'Gerar novo código')!.onPress!();
    await waitFor(() => expect(gerarNovoCodigoMock).toHaveBeenCalledWith('f1'));
    expect(await screen.findByText('Código da frota: FRT-NOVO')).toBeTruthy();
  });

  it('a confirmação tem um botão Cancelar que não gera código', async () => {
    await renderizar();
    await fireEvent.press(await screen.findByText('Gerar novo código'));
    const botoes = alertSpy.mock.calls[0][2] as BotaoAlerta[];
    const cancelar = botoes.find((b) => b.text === 'Cancelar');
    expect(cancelar?.style).toBe('cancel');
    expect(cancelar?.onPress).toBeUndefined();
    expect(gerarNovoCodigoMock).not.toHaveBeenCalled();
  });

  it('falha ao gerar mostra a mensagem de erro e mantém o código', async () => {
    gerarNovoCodigoMock.mockRejectedValue({ message: 'Network request failed' });
    await renderizar();
    await fireEvent.press(await screen.findByText('Gerar novo código'));
    const botoes = alertSpy.mock.calls[0][2] as BotaoAlerta[];
    await botoes.find((b) => b.text === 'Gerar novo código')!.onPress!();
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    expect(screen.getByText('Código da frota: FRT-TEST')).toBeTruthy();
  });
});

describe('falha ao carregar', () => {
  it('mostra o erro e permite tentar de novo', async () => {
    minhaFrotaMock.mockRejectedValueOnce({ message: 'Network request failed' });
    minhaFrotaMock.mockResolvedValue(frota);
    await renderizar();
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Código da frota: FRT-TEST')).toBeTruthy();
  });
});

function carro(extra: Partial<ResumoCarro> & { vehicle_id: string; placa: string }): ResumoCarro {
  return {
    marca: 'Chevrolet',
    modelo: 'Onix',
    status: 'em_dia',
    proxima_data: null,
    proximo_item: null,
    estimada: false,
    motorista_nome: null,
    ...extra,
  };
}

describe('lista de carros', () => {
  beforeEach(() => minhaFrotaMock.mockResolvedValue(frota));

  it('consulta o resumo da frota pelo id da frota', async () => {
    await renderizar();
    await screen.findByText('Código da frota: FRT-TEST');
    await waitFor(() => expect(resumoMock).toHaveBeenCalledWith('f1'));
  });

  it('frota sem carros mostra a lista vazia', async () => {
    await renderizar();
    expect(
      await screen.findByText('Nenhum carro cadastrado. Toque em "Adicionar carro".'),
    ).toBeTruthy();
  });

  it('mostra o card com placa, modelo, status, próxima manutenção e motorista', async () => {
    resumoMock.mockResolvedValue([
      carro({
        vehicle_id: 'v1',
        placa: 'ABC1D23',
        status: 'urgente',
        proxima_data: '2026-10-30',
        proximo_item: 'Óleo do motor',
        motorista_nome: 'Ana',
      }),
    ]);
    await renderizar();
    expect(await screen.findByText('ABC1D23 · Chevrolet Onix')).toBeTruthy();
    expect(screen.getByText('Urgente')).toBeTruthy();
    expect(screen.getByText('Próxima: Óleo do motor em 30/10/2026')).toBeTruthy();
    expect(screen.getByText('Motorista: Ana')).toBeTruthy();
    expect(screen.queryByText('previsão estimada')).toBeNull();
    expect(
      screen.queryByText('Nenhum carro cadastrado. Toque em "Adicionar carro".'),
    ).toBeNull();
  });

  it('carro sem motorista aparece como Livre e previsão estimada é sinalizada', async () => {
    resumoMock.mockResolvedValue([
      carro({
        vehicle_id: 'v1',
        placa: 'ABC1D23',
        proxima_data: '2026-10-30',
        proximo_item: 'Pneus',
        estimada: true,
      }),
    ]);
    await renderizar();
    expect(await screen.findByText('Livre')).toBeTruthy();
    expect(screen.getByText('previsão estimada')).toBeTruthy();
  });

  it('carro sem previsão não inventa data', async () => {
    resumoMock.mockResolvedValue([
      carro({ vehicle_id: 'v1', placa: 'ABC1D23', status: 'sem_historico' }),
    ]);
    await renderizar();
    expect(await screen.findByText('Sem previsão de manutenção')).toBeTruthy();
    expect(screen.getByText('Sem histórico')).toBeTruthy();
  });

  it('ordena por severidade: vencido, urgente, sem histórico, próximo, em dia', async () => {
    resumoMock.mockResolvedValue([
      carro({ vehicle_id: 'a', placa: 'AAA1A11', status: 'em_dia' }),
      carro({ vehicle_id: 'b', placa: 'BBB2B22', status: 'proximo' }),
      carro({ vehicle_id: 'c', placa: 'CCC3C33', status: 'sem_historico' }),
      carro({ vehicle_id: 'd', placa: 'DDD4D44', status: 'urgente' }),
      carro({ vehicle_id: 'e', placa: 'EEE5E55', status: 'vencido' }),
      carro({ vehicle_id: 'f', placa: 'FFF6F66', status: 'vencido' }),
    ]);
    await renderizar();
    await screen.findByText('AAA1A11 · Chevrolet Onix');
    const placas = screen
      .getAllByText(/· Chevrolet Onix$/)
      .map((n) => String(n.props.children).split(' ')[0]);
    expect(placas).toEqual(['EEE5E55', 'FFF6F66', 'DDD4D44', 'CCC3C33', 'BBB2B22', 'AAA1A11']);
  });

  it('tocar no card abre o detalhe do carro', async () => {
    resumoMock.mockResolvedValue([carro({ vehicle_id: 'v9', placa: 'ABC1D23' })]);
    await renderizar();
    await fireEvent.press(await screen.findByText('ABC1D23 · Chevrolet Onix'));
    expect(mockPush).toHaveBeenCalledWith('/carros/v9');
  });

  it('voltar para a aba recarrega a frota e os carros', async () => {
    await renderizar();
    await screen.findByText('Nenhum carro cadastrado. Toque em "Adicionar carro".');
    resumoMock.mockResolvedValue([carro({ vehicle_id: 'v1', placa: 'ABC1D23' })]);
    await voltarAoFoco();
    expect(await screen.findByText('ABC1D23 · Chevrolet Onix')).toBeTruthy();
    expect(minhaFrotaMock).toHaveBeenCalledTimes(2);
    expect(resumoMock).toHaveBeenCalledTimes(2);
  });

  it('puxar para atualizar refaz a consulta', async () => {
    await renderizar();
    await screen.findByText('Nenhum carro cadastrado. Toque em "Adicionar carro".');
    resumoMock.mockResolvedValue([carro({ vehicle_id: 'v1', placa: 'ABC1D23' })]);
    const lista = screen.getByTestId('painel-frota');
    await act(async () => {
      await lista.props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByText('ABC1D23 · Chevrolet Onix')).toBeTruthy();
    expect(resumoMock).toHaveBeenCalledTimes(2);
  });

  it('falha ao listar os carros mostra o erro e permite tentar de novo sem esconder o código', async () => {
    resumoMock.mockRejectedValueOnce({ message: 'Network request failed' });
    resumoMock.mockResolvedValue([carro({ vehicle_id: 'v1', placa: 'ABC1D23' })]);
    await renderizar();
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    expect(screen.getByText('Código da frota: FRT-TEST')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('ABC1D23 · Chevrolet Onix')).toBeTruthy();
  });
});
