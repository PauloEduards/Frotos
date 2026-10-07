import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { minhaFrota } from '@/api/frota';
import { gastosRealizados, projecaoGastos, type LinhaProjecao, type LinhaRealizado } from '@/api/gastos';
import Gastos from '@/app/(dono)/(abas)/gastos';
import { voltarAoFoco } from '@/testes/foco';
import { renderComCliente } from '@/testes/renderComCliente';

jest.mock('expo-router', () => ({ useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste }));
jest.mock('@/api/frota', () => ({ minhaFrota: jest.fn() }));
jest.mock('@/api/gastos', () => ({ projecaoGastos: jest.fn(), gastosRealizados: jest.fn() }));

const m = {
  frota: minhaFrota as jest.Mock,
  projecao: projecaoGastos as jest.Mock,
  realizado: gastosRealizados as jest.Mock,
};

function linha(p: Partial<LinhaProjecao>): LinhaProjecao {
  return {
    vehicle_id: 'v1',
    placa: 'ABC1D23',
    vehicle_item_id: 'i1',
    item_nome: 'Óleo do motor',
    data: '2026-10-08',
    valor: 180,
    ...p,
  };
}

const projecao: LinhaProjecao[] = [
  linha({}),
  linha({ data: '2026-10-20' }),
  linha({ vehicle_id: 'v2', placa: 'XYZ9K88', vehicle_item_id: 'i2', item_nome: 'Pneus', valor: 250 }),
  linha({ vehicle_id: 'v2', placa: 'XYZ9K88', vehicle_item_id: 'i3', item_nome: 'Correia dentada', data: null, valor: 400 }),
];

const realizado: LinhaRealizado[] = [
  { record_id: 'r1', vehicle_id: 'v1', placa: 'ABC1D23', data: '2026-09-20', valor_total: 150, itens: ['Óleo do motor'] },
  { record_id: 'r2', vehicle_id: 'v2', placa: 'XYZ9K88', data: '2026-09-25', valor_total: 210, itens: ['Pneus'] },
];

function renderizar() {
  return renderComCliente(<Gastos />);
}

beforeEach(() => {
  jest.resetAllMocks();
  m.frota.mockResolvedValue({ id: 'f1', nome: 'Frota' });
  m.projecao.mockResolvedValue(projecao);
  m.realizado.mockResolvedValue(realizado);
});

describe('Gastos', () => {
  it('mostra previsto, realizado, gráfico e listas', async () => {
    await renderizar();
    expect(await screen.findByText('Previsto: R$ 610,00')).toBeTruthy();
    expect(screen.getByText('Gasto nos últimos 30 dias: R$ 360,00')).toBeTruthy();
    expect(screen.getAllByTestId('barra')).toHaveLength(5);
    expect(screen.getByText('Por carro')).toBeTruthy();
    expect(screen.getByText('Por item')).toBeTruthy();
    expect(screen.getByText('Óleo do motor · 2x · R$ 360,00')).toBeTruthy();
    expect(screen.getByText('Revisão recomendada')).toBeTruthy();
    expect(screen.getByText('XYZ9K88 · Correia dentada')).toBeTruthy();
    expect(screen.queryByText('Quanto mais longe, menos precisa é a previsão.')).toBeNull();
    expect(m.projecao).toHaveBeenCalledWith('f1', 30);
    expect(m.realizado).toHaveBeenCalledWith('f1', 30);
  });

  it('trocar o período refaz as consultas e avisa da imprecisão', async () => {
    await renderizar();
    await screen.findByText('Previsto: R$ 610,00');
    await fireEvent.press(screen.getByText('90 dias'));
    await waitFor(() => expect(m.projecao).toHaveBeenCalledWith('f1', 90));
    expect(m.realizado).toHaveBeenCalledWith('f1', 90);
    expect(await screen.findByText('Quanto mais longe, menos precisa é a previsão.')).toBeTruthy();
    expect(await screen.findByText('Gasto nos últimos 90 dias: R$ 360,00')).toBeTruthy();
  });

  it('sem dados mostra a lista vazia', async () => {
    m.projecao.mockResolvedValue([]);
    m.realizado.mockResolvedValue([]);
    await renderizar();
    expect(await screen.findByText('Sem gastos previstos para este período.')).toBeTruthy();
    expect(screen.queryByText('Revisão recomendada')).toBeNull();
  });

  it('voltar para a aba recarrega previsão e gastos', async () => {
    await renderizar();
    await screen.findByText('Previsto: R$ 610,00');
    m.projecao.mockResolvedValue([linha({ valor: 100, data: '2026-10-10' })]);
    m.realizado.mockResolvedValue([]);
    await voltarAoFoco();
    expect(await screen.findByText('Previsto: R$ 100,00')).toBeTruthy();
    expect(screen.getByText('Gasto nos últimos 30 dias: R$ 0,00')).toBeTruthy();
  });

  it('puxar para atualizar refaz previsão e gastos', async () => {
    await renderizar();
    await screen.findByText('Previsto: R$ 610,00');
    m.projecao.mockResolvedValue([]);
    const tela = screen.getByTestId('gastos');
    await act(async () => {
      await tela.props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByText('Previsto: R$ 0,00')).toBeTruthy();
    expect(m.projecao).toHaveBeenCalledTimes(2);
    expect(m.realizado).toHaveBeenCalledTimes(2);
  });

  it('sem frota orienta a criar a frota', async () => {
    m.frota.mockResolvedValue(null);
    await renderizar();
    expect(await screen.findByText('Crie sua frota na aba Frota para começar.')).toBeTruthy();
    expect(screen.queryByText('Sem gastos previstos para este período.')).toBeNull();
    expect(screen.queryByText(/^Previsto:/)).toBeNull();
  });

  it('mostra o erro com opção de tentar de novo', async () => {
    m.projecao.mockRejectedValue(new Error('falhou'));
    await renderizar();
    expect(await screen.findByText('Tentar de novo')).toBeTruthy();
  });
});
