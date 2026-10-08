import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { buscarCarros, candidatar } from '@/api/motorista';
import Buscar from '@/app/(motorista)/(busca)/buscar';
import { renderComCliente } from '@/testes/renderComCliente';
import { useSessao } from '@/sessao/useSessao';

jest.mock('@/sessao/useSessao', () => ({ useSessao: jest.fn() }));
jest.mock('@/api/motorista', () => ({ buscarCarros: jest.fn(), candidatar: jest.fn() }));
jest.mock('@/api/fotos', () => ({ urlsAssinadas: jest.fn().mockResolvedValue({}) }));

const buscarMock = buscarCarros as jest.Mock;
const candidatarMock = candidatar as jest.Mock;

const argo = {
  vehicle_id: 'v1',
  marca: 'Fiat',
  modelo: 'Argo',
  ano_modelo: 2023,
  cor: 'Vermelho',
  foto_path: 'f1/v1/argo.jpg',
  frota_nome: 'Frota Piloto',
  cidade: 'São Paulo',
  uf: 'SP',
};

beforeEach(() => {
  jest.clearAllMocks();
  (useSessao as jest.Mock).mockReturnValue({
    perfil: { id: 'u1', nome: 'Diego', papel: 'motorista', uf: 'SP', cidade: 'São Paulo', tem_cnh: true },
  });
  buscarMock.mockResolvedValue([argo]);
  candidatarMock.mockResolvedValue(undefined);
});

it('já busca na cidade do perfil e mostra os carros sem placa', async () => {
  await renderComCliente(<Buscar />);
  expect(screen.getByLabelText('Cidade').props.value).toBe('São Paulo');
  await waitFor(() => expect(buscarMock).toHaveBeenCalledWith('SP', 'São Paulo'));
  expect(await screen.findByText('Fiat Argo')).toBeTruthy();
  expect(screen.getByText('Frota Piloto · São Paulo/SP')).toBeTruthy();
  expect(screen.queryByText('BRASIL')).toBeNull();
});

it('Buscar com outra cidade', async () => {
  await renderComCliente(<Buscar />);
  await screen.findByText('Fiat Argo');
  await fireEvent.press(screen.getByText('RJ'));
  await fireEvent.changeText(screen.getByLabelText('Cidade'), 'Niterói');
  await fireEvent.press(screen.getByText('Buscar'));
  await waitFor(() => expect(buscarMock).toHaveBeenCalledWith('RJ', 'Niterói'));
});

it('sem carros mostra a mensagem da região', async () => {
  buscarMock.mockResolvedValue([]);
  await renderComCliente(<Buscar />);
  expect(await screen.findByText('Nenhum carro disponível na sua região no momento.')).toBeTruthy();
});

it('Quero este carro: mensagem opcional e candidatura', async () => {
  await renderComCliente(<Buscar />);
  await fireEvent.press(await screen.findByText('Quero este carro'));
  await fireEvent.changeText(screen.getByLabelText('Mensagem para o dono (opcional)'), 'Trabalho à noite');
  await fireEvent.press(screen.getByText('Enviar candidatura'));
  await waitFor(() => expect(candidatarMock).toHaveBeenCalledWith('v1', 'Trabalho à noite'));
  expect(await screen.findByText('Candidatura enviada! Acompanhe em Minhas candidaturas.')).toBeTruthy();
});

it('erro de negócio (sem CNH) aparece', async () => {
  candidatarMock.mockRejectedValue({ code: 'P0001', message: 'SEM_CNH', details: 'Você precisa ter CNH para se candidatar.' });
  await renderComCliente(<Buscar />);
  await fireEvent.press(await screen.findByText('Quero este carro'));
  await fireEvent.press(screen.getByText('Enviar candidatura'));
  expect(await screen.findByText('Você precisa ter CNH para se candidatar.')).toBeTruthy();
});

it('mensagem limitada a 300 caracteres', async () => {
  await renderComCliente(<Buscar />);
  await fireEvent.press(await screen.findByText('Quero este carro'));
  expect(screen.getByLabelText('Mensagem para o dono (opcional)').props.maxLength).toBe(300);
});
