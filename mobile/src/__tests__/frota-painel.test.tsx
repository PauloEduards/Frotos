import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

import { criarFrota, gerarNovoCodigo, minhaFrota, type Frota } from '@/api/frota';
import PainelFrota from '@/app/(dono)/(abas)/index';

jest.mock('@/api/frota', () => ({
  minhaFrota: jest.fn(),
  criarFrota: jest.fn(),
  gerarNovoCodigo: jest.fn(),
}));

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
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <PainelFrota />
    </QueryClientProvider>,
  );
}

type BotaoAlerta = { text: string; style?: string; onPress?: () => void | Promise<void> };

let alertSpy: jest.SpyInstance;
let shareSpy: jest.SpyInstance;

afterEach(() => client?.clear());

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});

describe('painel sem frota', () => {
  beforeEach(() => minhaFrotaMock.mockResolvedValue(null));

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
