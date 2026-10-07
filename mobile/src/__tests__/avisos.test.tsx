import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { carroDoItem, listarAvisos, marcarLido, marcarTodosLidos, type Aviso } from '@/api/avisos';
import Avisos from '@/app/(dono)/(abas)/avisos';
import { renderComCliente } from '@/testes/renderComCliente';
import { ErroApp } from '@/lib/erros';

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('@/api/avisos', () => ({
  listarAvisos: jest.fn(),
  marcarLido: jest.fn(),
  marcarTodosLidos: jest.fn(),
  carroDoItem: jest.fn(),
}));

const m = {
  listar: listarAvisos as jest.Mock,
  lido: marcarLido as jest.Mock,
  todos: marcarTodosLidos as jest.Mock,
  carro: carroDoItem as jest.Mock,
};

function aviso(extra: Partial<Aviso>): Aviso {
  return {
    id: 'a1',
    tipo: 'x',
    titulo: 'Título',
    corpo: 'Corpo',
    prioridade: 'normal',
    ref_tabela: null,
    ref_id: null,
    lida: false,
    criada_em: '2026-10-07T11:00:00Z',
    ...extra,
  };
}

let client: QueryClient;

async function renderizar() {
  ({ client } = await renderComCliente(<Avisos />));
}


beforeEach(() => {
  jest.clearAllMocks();
  m.lido.mockResolvedValue(undefined);
  m.todos.mockResolvedValue(undefined);
});

describe('Avisos', () => {
  it('lista título, corpo e data em horário de Brasília', async () => {
    m.listar.mockResolvedValue([aviso({ titulo: 'Troca de óleo vencida', corpo: 'Onix passou do prazo' })]);
    await renderizar();
    expect(await screen.findByText('Troca de óleo vencida')).toBeTruthy();
    expect(screen.getByText('Onix passou do prazo')).toBeTruthy();
    expect(screen.getByText('07/10/2026 08:00')).toBeTruthy();
  });

  it('destaca não lidos em negrito e avisos de prioridade alta', async () => {
    m.listar.mockResolvedValue([
      aviso({ id: 'a1', titulo: 'Novo', lida: false }),
      aviso({ id: 'a2', titulo: 'Antigo', lida: true, prioridade: 'alta' }),
    ]);
    await renderizar();
    const novo = await screen.findByText('Novo');
    expect(novo).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('Antigo')).not.toHaveStyle({ fontWeight: '700' });
    const cartao = screen.getByText('Antigo').parent;
    expect(cartao).toHaveStyle({ borderLeftColor: '#C62828' });
  });

  it.each([
    ['vehicles', 'v1', '/(dono)/carros/v1', 'push'],
    ['maintenance_records', 'r1', '/(dono)/(abas)/pendencias', 'navigate'],
    ['incidents', 'i1', '/(dono)/(abas)/pendencias', 'navigate'],
    ['fleet_members', 'f1', '/(dono)/(abas)/motoristas', 'navigate'],
  ])('toque em aviso de %s marca como lido e navega', async (tabela, ref, destino, metodo) => {
    m.listar.mockResolvedValue([aviso({ ref_tabela: tabela, ref_id: ref })]);
    await renderizar();
    await fireEvent.press(await screen.findByText('Título'));
    await waitFor(() => expect(m.lido).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect((metodo === 'push' ? mockPush : mockNavigate)).toHaveBeenCalledWith(destino));
  });

  it('aviso de item navega para o carro do item', async () => {
    m.listar.mockResolvedValue([aviso({ ref_tabela: 'vehicle_items', ref_id: 'it1' })]);
    m.carro.mockResolvedValue('v9');
    await renderizar();
    await fireEvent.press(await screen.findByText('Título'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(dono)/carros/v9'));
    expect(m.carro).toHaveBeenCalledWith('it1');
  });

  it('se não achar o carro do item, só marca como lido', async () => {
    m.listar.mockResolvedValue([aviso({ ref_tabela: 'vehicle_items', ref_id: 'it1' })]);
    m.carro.mockRejectedValue(new Error('falha'));
    await renderizar();
    await fireEvent.press(await screen.findByText('Título'));
    await waitFor(() => expect(m.lido).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(m.carro).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('outros tipos só marcam como lido', async () => {
    m.listar.mockResolvedValue([aviso({ ref_tabela: 'outra', ref_id: 'x' })]);
    await renderizar();
    await fireEvent.press(await screen.findByText('Título'));
    await waitFor(() => expect(m.lido).toHaveBeenCalledWith('a1'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('aviso já lido navega sem marcar de novo', async () => {
    m.listar.mockResolvedValue([aviso({ lida: true, ref_tabela: 'vehicles', ref_id: 'v1' })]);
    await renderizar();
    await fireEvent.press(await screen.findByText('Título'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(dono)/carros/v1'));
    expect(m.lido).not.toHaveBeenCalled();
  });

  it('mostra o erro e não navega se marcar como lido falhar', async () => {
    m.listar.mockResolvedValue([aviso({ ref_tabela: 'vehicles', ref_id: 'v1' })]);
    m.lido.mockRejectedValue(new ErroApp('Não foi possível marcar.'));
    await renderizar();
    await fireEvent.press(await screen.findByText('Título'));
    expect(await screen.findByText('Não foi possível marcar.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('Marcar todos como lidos chama marcarTodosLidos', async () => {
    m.listar.mockResolvedValue([aviso({})]);
    await renderizar();
    await fireEvent.press(await screen.findByText('Marcar todos como lidos'));
    await waitFor(() => expect(m.todos).toHaveBeenCalled());
  });

  it('vazio mostra a mensagem', async () => {
    m.listar.mockResolvedValue([]);
    await renderizar();
    expect(await screen.findByText('Nenhum aviso por enquanto.')).toBeTruthy();
    expect(screen.queryByText('Marcar todos como lidos')).toBeNull();
  });
});
