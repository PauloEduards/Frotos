import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { minhaFrota, type Frota } from '@/api/frota';
import { cadastrarVeiculo } from '@/api/veiculos';
import NovoCarro from '@/app/(dono)/carros/novo';
import { renderComCliente } from '@/testes/renderComCliente';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/frota', () => ({ minhaFrota: jest.fn() }));
jest.mock('@/api/veiculos', () => ({
  ...jest.requireActual('@/api/veiculos'),
  cadastrarVeiculo: jest.fn(),
}));

const minhaFrotaMock = minhaFrota as jest.Mock;
const cadastrarMock = cadastrarVeiculo as jest.Mock;

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
  ({ client } = await renderComCliente(<NovoCarro />));
}

async function renderizarFormulario() {
  await renderizar();
  await screen.findByText('Cadastrar carro');
}

async function preencher(
  campos: Partial<{ placa: string; modelo: string; ano: string; km: string }> = {},
) {
  const v = { placa: 'abc-1d23', modelo: 'Onix 1.0', ano: '2022', km: '45200', ...campos };
  await fireEvent.changeText(screen.getByLabelText('Placa'), v.placa);
  await fireEvent.press(screen.getByText('Chevrolet'));
  await fireEvent.changeText(screen.getByLabelText('Modelo'), v.modelo);
  await fireEvent.changeText(screen.getByLabelText('Ano'), v.ano);
  await fireEvent.press(screen.getByText('Prata'));
  await fireEvent.changeText(screen.getByLabelText('Km atual'), v.km);
}


beforeEach(() => {
  jest.clearAllMocks();
  minhaFrotaMock.mockResolvedValue(frota);
});

describe('cadastro de carro', () => {
  it('mostra os campos, as marcas sugeridas e o km por dia já preenchido', async () => {
    await renderizarFormulario();
    expect(screen.getByLabelText('Placa')).toBeTruthy();
    expect(screen.getByLabelText('Marca')).toBeTruthy();
    expect(screen.getByText('Fiat')).toBeTruthy();
    expect(screen.getByText('Citroën')).toBeTruthy();
    expect(screen.getByLabelText('Modelo')).toBeTruthy();
    expect(screen.getByLabelText('Ano')).toBeTruthy();
    expect(screen.getByText('Outra')).toBeTruthy();
    expect(screen.getByLabelText('Km atual')).toBeTruthy();
    expect(screen.getByLabelText('Km por dia').props.value).toBe('300');
    expect(
      screen.getByText(
        'Quanto o carro roda por dia, em média. O app ajusta sozinho com as leituras dos motoristas.',
      ),
    ).toBeTruthy();
  });

  it('o chip preenche a marca, mas o campo aceita texto livre', async () => {
    await renderizarFormulario();
    await fireEvent.press(screen.getByText('Toyota'));
    expect(screen.getByLabelText('Marca').props.value).toBe('Toyota');
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'BYD');
    expect(screen.getByLabelText('Marca').props.value).toBe('BYD');
  });

  it('cadastra o carro e abre os itens de manutenção', async () => {
    cadastrarMock.mockResolvedValue({ id: 'v1' });
    await renderizarFormulario();
    await preencher();
    await fireEvent.press(screen.getByText('Cadastrar carro'));

    await waitFor(() =>
      expect(cadastrarMock).toHaveBeenCalledWith('f1', {
        placa: 'ABC1D23',
        marca: 'Chevrolet',
        modelo: 'Onix 1.0',
        ano_modelo: 2022,
        cor: 'Prata',
        km_atual: 45200,
        km_dia_estimado: 300,
      }),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(dono)/carros/v1/itens'));
  });

  it('carro novo atualiza também gastos e pendências', async () => {
    cadastrarMock.mockResolvedValue({ id: 'v1' });
    await renderizarFormulario();
    const invalidar = jest.spyOn(client, 'invalidateQueries');
    await preencher();
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['gastos'] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['veiculos'] });
  });

  it('placa inválida não cadastra', async () => {
    await renderizarFormulario();
    await preencher({ placa: 'ABC12' });
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Placa inválida.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('marca vazia não cadastra', async () => {
    await renderizarFormulario();
    await fireEvent.changeText(screen.getByLabelText('Placa'), 'ABC1D23');
    await fireEvent.changeText(screen.getByLabelText('Modelo'), 'Onix');
    await fireEvent.changeText(screen.getByLabelText('Ano'), '2022');
    await fireEvent.press(screen.getByText('Prata'));
    await fireEvent.changeText(screen.getByLabelText('Km atual'), '100');
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Informe a marca e o modelo.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('modelo vazio não cadastra', async () => {
    await renderizarFormulario();
    await preencher({ modelo: '   ' });
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Informe a marca e o modelo.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('km vazio não cadastra', async () => {
    await renderizarFormulario();
    await preencher({ km: '' });
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Informe o km atual.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it.each(['1979', '2200', 'abcd', ''])('ano %p é inválido', async (ano) => {
    await renderizarFormulario();
    await preencher({ ano });
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Ano inválido.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('aceita o ano seguinte ao atual', async () => {
    cadastrarMock.mockResolvedValue({ id: 'v1' });
    await renderizarFormulario();
    await preencher({ ano: String(new Date().getFullYear() + 1) });
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    await waitFor(() => expect(cadastrarMock).toHaveBeenCalledTimes(1));
  });

  it('sem cor escolhida não cadastra', async () => {
    await renderizarFormulario();
    await fireEvent.changeText(screen.getByLabelText('Placa'), 'ABC1D23');
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Fiat');
    await fireEvent.changeText(screen.getByLabelText('Modelo'), 'Argo');
    await fireEvent.changeText(screen.getByLabelText('Ano'), '2022');
    await fireEvent.changeText(screen.getByLabelText('Km atual'), '100');
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Escolha a cor.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('km por dia inválido não cadastra', async () => {
    await renderizarFormulario();
    await preencher();
    await fireEvent.changeText(screen.getByLabelText('Km por dia'), '0');
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Informe o km por dia.')).toBeTruthy();
    expect(cadastrarMock).not.toHaveBeenCalled();
  });

  it('placa duplicada mostra o erro e mantém o formulário preenchido', async () => {
    cadastrarMock.mockRejectedValue({ code: '23505', message: 'duplicate key value' });
    await renderizarFormulario();
    await preencher();
    await fireEvent.press(screen.getByText('Cadastrar carro'));
    expect(await screen.findByText('Já existe um carro com esta placa na frota.')).toBeTruthy();
    expect(screen.getByLabelText('Placa').props.value).toBe('abc-1d23');
    expect(screen.getByLabelText('Marca').props.value).toBe('Chevrolet');
    expect(screen.getByLabelText('Modelo').props.value).toBe('Onix 1.0');
    expect(screen.getByLabelText('Km atual').props.value).toBe('45200');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('sem frota', () => {
  it('orienta a criar a frota primeiro', async () => {
    minhaFrotaMock.mockResolvedValue(null);
    await renderizar();
    expect(
      await screen.findByText('Crie sua frota na aba Frota para cadastrar carros.'),
    ).toBeTruthy();
  });
});
