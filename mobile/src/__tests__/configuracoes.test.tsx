import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { sair } from '@/api/auth';
import { atualizarFrota, minhaFrota, type Frota } from '@/api/frota';
import Configuracoes from '@/app/(dono)/configuracoes';
import { renderComCliente } from '@/testes/renderComCliente';

jest.mock('@/api/frota', () => ({ minhaFrota: jest.fn(), atualizarFrota: jest.fn() }));
jest.mock('@/api/auth', () => ({ sair: jest.fn() }));

const minhaFrotaMock = minhaFrota as jest.Mock;
const atualizarFrotaMock = atualizarFrota as jest.Mock;

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
  ({ client } = await renderComCliente(<Configuracoes />));
}


beforeEach(() => {
  jest.clearAllMocks();
  minhaFrotaMock.mockResolvedValue(frota);
  atualizarFrotaMock.mockResolvedValue(undefined);
});

describe('configurações da frota', () => {
  it('mostra o seletor e os campos com os valores atuais', async () => {
    await renderizar();
    expect(await screen.findByText('Quem leva o carro à oficina')).toBeTruthy();
    expect(screen.getByText('O proprietário leva')).toBeTruthy();
    expect(screen.getByText('Motoristas levam')).toBeTruthy();
    expect(screen.getByLabelText('Limite de km por dia sem foto do painel').props.value).toBe('350');
    expect(screen.getByLabelText('Amarelo: faltando até (km)').props.value).toBe('1000');
    expect(screen.getByLabelText('Amarelo: faltando até (dias)').props.value).toBe('7');
    expect(screen.getByLabelText('Laranja: faltando menos de (km)').props.value).toBe('300');
  });

  it('Salvar chama atualizarFrota com os números e invalida a frota', async () => {
    await renderizar();
    const invalidar = jest.spyOn(client, 'invalidateQueries');
    await fireEvent.changeText(
      await screen.findByLabelText('Limite de km por dia sem foto do painel'),
      '400',
    );
    await fireEvent.changeText(screen.getByLabelText('Amarelo: faltando até (dias)'), '10');
    await fireEvent.press(screen.getByText('Motoristas levam'));
    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() =>
      expect(atualizarFrotaMock).toHaveBeenCalledWith('f1', {
        modo_manutencao: 'motoristas_levam',
        limite_salto_km_dia: 400,
        limiar_amarelo_km: 1000,
        limiar_amarelo_dias: 10,
        limiar_laranja_km: 300,
      }),
    );
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['frota'] }));
    // Os limiares mudam o status dos carros e itens, e com eles as pendências e os gastos.
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['veiculos'] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['gastos'] });
    expect(await screen.findByText('Configurações salvas.')).toBeTruthy();
  });

  it.each([
    ['vazio', ''],
    ['negativo', '-5'],
  ])('valor %s mostra erro e não salva', async (_nome, valor) => {
    await renderizar();
    await fireEvent.changeText(await screen.findByLabelText('Amarelo: faltando até (km)'), valor);
    await fireEvent.press(screen.getByText('Salvar'));
    expect(await screen.findByText('Informe um número válido.')).toBeTruthy();
    expect(atualizarFrotaMock).not.toHaveBeenCalled();
  });

  it('limite de km por dia zero não é aceito (precisa ser maior que zero)', async () => {
    await renderizar();
    await fireEvent.changeText(
      await screen.findByLabelText('Limite de km por dia sem foto do painel'),
      '0',
    );
    await fireEvent.press(screen.getByText('Salvar'));
    expect(await screen.findByText('Informe um número válido.')).toBeTruthy();
    expect(atualizarFrotaMock).not.toHaveBeenCalled();
  });

  it('zero é aceito nos limiares', async () => {
    await renderizar();
    await fireEvent.changeText(await screen.findByLabelText('Laranja: faltando menos de (km)'), '0');
    await fireEvent.press(screen.getByText('Salvar'));
    await waitFor(() =>
      expect(atualizarFrotaMock).toHaveBeenCalledWith(
        'f1',
        expect.objectContaining({ limiar_laranja_km: 0 }),
      ),
    );
  });

  it('Sair encerra a sessão', async () => {
    (sair as jest.Mock).mockResolvedValue(undefined);
    await renderizar();
    await fireEvent.press(await screen.findByText('Sair'));
    await waitFor(() => expect(sair).toHaveBeenCalledTimes(1));
  });

  it('falha ao sair mostra a mensagem', async () => {
    (sair as jest.Mock).mockRejectedValue({ message: 'Network request failed' });
    await renderizar();
    await fireEvent.press(await screen.findByText('Sair'));
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
  });

  it('sem frota também permite sair', async () => {
    minhaFrotaMock.mockResolvedValue(null);
    (sair as jest.Mock).mockResolvedValue(undefined);
    await renderizar();
    await fireEvent.press(await screen.findByText('Sair'));
    await waitFor(() => expect(sair).toHaveBeenCalledTimes(1));
  });

  it('falha ao salvar mostra a mensagem de erro', async () => {
    atualizarFrotaMock.mockRejectedValue({ message: 'Network request failed' });
    await renderizar();
    await fireEvent.press(await screen.findByText('Salvar'));
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    expect(screen.queryByText('Configurações salvas.')).toBeNull();
  });
});
