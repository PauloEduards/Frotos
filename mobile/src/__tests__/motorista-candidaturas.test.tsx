import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { cancelarCandidatura, entrarComCodigo, meusPedidosDeEntrada, minhasCandidaturas } from '@/api/motorista';
import Candidaturas from '@/app/(motorista)/(busca)/candidaturas';
import { renderComCliente } from '@/testes/renderComCliente';

jest.mock('expo-router', () => ({ useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste }));
jest.mock('@/api/motorista', () => ({
  minhasCandidaturas: jest.fn(),
  meusPedidosDeEntrada: jest.fn(),
  cancelarCandidatura: jest.fn(),
  entrarComCodigo: jest.fn(),
}));
jest.mock('@/api/fotos', () => ({ urlsAssinadas: jest.fn().mockResolvedValue({}) }));

const carro = {
  vehicle_id: 'v1', marca: 'Fiat', modelo: 'Argo', ano_modelo: 2023, cor: 'Vermelho',
  foto_path: null, frota_nome: 'Frota Piloto', cidade: 'São Paulo', uf: 'SP',
};

beforeEach(() => {
  jest.clearAllMocks();
  (minhasCandidaturas as jest.Mock).mockResolvedValue([
    { id: 'c1', status: 'pendente', criada_em: '2026-10-08T12:00:00.000Z', carro },
    { id: 'c2', status: 'recusada', criada_em: '2026-10-01T12:00:00.000Z', carro: { ...carro, modelo: 'Mobi' } },
  ]);
  (meusPedidosDeEntrada as jest.Mock).mockResolvedValue([{ id: 'm1', status: 'pendente', frota_nome: 'Frota Sul' }]);
  (cancelarCandidatura as jest.Mock).mockResolvedValue(undefined);
  (entrarComCodigo as jest.Mock).mockResolvedValue(undefined);
});

it('lista candidaturas com status e o pedido de entrada', async () => {
  await renderComCliente(<Candidaturas />);
  expect(await screen.findByText('Fiat Argo')).toBeTruthy();
  expect(screen.getByText('Aguardando')).toBeTruthy();
  expect(screen.getByText('Recusada')).toBeTruthy();
  expect(screen.getByText('Pedido de entrada na frota Frota Sul — Aguardando')).toBeTruthy();
  expect(screen.queryByText('BRASIL')).toBeNull();
});

it('Cancelar candidatura só nas pendentes', async () => {
  await renderComCliente(<Candidaturas />);
  const botoes = await screen.findAllByText('Cancelar candidatura');
  expect(botoes).toHaveLength(1);
  await fireEvent.press(botoes[0]);
  await waitFor(() => expect(cancelarCandidatura).toHaveBeenCalledWith('c1'));
});

it('entrar com código da frota', async () => {
  await renderComCliente(<Candidaturas />);
  await fireEvent.changeText(await screen.findByLabelText('Código da frota'), 'frt-test');
  await fireEvent.press(screen.getByText('Entrar com código'));
  await waitFor(() => expect(entrarComCodigo).toHaveBeenCalledWith('frt-test'));
  expect(await screen.findByText('Pedido enviado. Aguarde a aprovação do dono.')).toBeTruthy();
});

it('sem nada mostra o estado vazio', async () => {
  (minhasCandidaturas as jest.Mock).mockResolvedValue([]);
  (meusPedidosDeEntrada as jest.Mock).mockResolvedValue([]);
  await renderComCliente(<Candidaturas />);
  expect(await screen.findByText('Você ainda não se candidatou a nenhum carro.')).toBeTruthy();
});
