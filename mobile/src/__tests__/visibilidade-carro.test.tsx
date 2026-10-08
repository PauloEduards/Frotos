import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { listarMembros } from '@/api/frota';
import { definirAnuncio, definirVisibilidade, motoristasDaVisibilidade } from '@/api/veiculos';
import { VisibilidadeCarro } from '@/componentes/dono/VisibilidadeCarro';
import { renderComCliente } from '@/testes/renderComCliente';

jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/frota', () => ({ listarMembros: jest.fn() }));
jest.mock('@/api/veiculos', () => ({
  definirAnuncio: jest.fn(),
  definirVisibilidade: jest.fn(),
  motoristasDaVisibilidade: jest.fn(),
}));

const membrosMock = listarMembros as jest.Mock;
const visMock = definirVisibilidade as jest.Mock;
const anuncioMock = definirAnuncio as jest.Mock;
const marcadosMock = motoristasDaVisibilidade as jest.Mock;

const membros = [
  { id: 'm1', driver_id: 'd1', status: 'ativo', nivel_manutencao: 'com_aprovacao', nome: 'Ana', telefone: null, carro_placa: null },
  { id: 'm2', driver_id: 'd2', status: 'ativo', nivel_manutencao: 'com_aprovacao', nome: 'Bruno', telefone: null, carro_placa: null },
  { id: 'm3', driver_id: 'd3', status: 'pendente', nivel_manutencao: 'com_aprovacao', nome: 'Caio', telefone: null, carro_placa: null },
];

type Props = Partial<Parameters<typeof VisibilidadeCarro>[0]>;

async function renderizar(props: Props = {}) {
  return renderComCliente(
    <VisibilidadeCarro
      vehicleId="v1"
      fleetId="f1"
      visibilidade="todos"
      anunciado={false}
      frotaTemCidade
      {...props}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  membrosMock.mockResolvedValue(membros);
  marcadosMock.mockResolvedValue([]);
  visMock.mockResolvedValue(undefined);
  anuncioMock.mockResolvedValue(undefined);
});

it('mostra o seletor de quem pode pegar o carro', async () => {
  await renderizar();
  expect(screen.getByText('Quem pode pegar este carro')).toBeTruthy();
  expect(screen.getByText('Todos da frota')).toBeTruthy();
  expect(screen.getByText('Só alguns')).toBeTruthy();
  expect(screen.getByText('Só um motorista')).toBeTruthy();
});

it('Só alguns: marca motoristas ativos e salva', async () => {
  await renderizar();
  await fireEvent.press(screen.getByText('Só alguns'));
  expect(await screen.findByText('Ana')).toBeTruthy();
  expect(screen.queryByText('Caio')).toBeNull();
  await fireEvent.press(screen.getByText('Ana'));
  await fireEvent.press(screen.getByText('Bruno'));
  await fireEvent.press(screen.getByText('Salvar quem pode pegar'));
  await waitFor(() => expect(visMock).toHaveBeenCalledWith('v1', 'alguns', ['d1', 'd2']));
});

it('Só um motorista: escolher outro troca a marcação', async () => {
  await renderizar();
  await fireEvent.press(screen.getByText('Só um motorista'));
  await fireEvent.press(await screen.findByText('Ana'));
  await fireEvent.press(screen.getByText('Bruno'));
  await fireEvent.press(screen.getByText('Salvar quem pode pegar'));
  await waitFor(() => expect(visMock).toHaveBeenCalledWith('v1', 'um', ['d2']));
});

it('volta para Todos da frota', async () => {
  marcadosMock.mockResolvedValue(['d1']);
  await renderizar({ visibilidade: 'um' });
  await fireEvent.press(await screen.findByText('Todos da frota'));
  await fireEvent.press(screen.getByText('Salvar quem pode pegar'));
  await waitFor(() => expect(visMock).toHaveBeenCalledWith('v1', 'todos', []));
});

it('anunciar na busca chama definirAnuncio', async () => {
  await renderizar();
  await fireEvent(screen.getByLabelText('Anunciar na busca de motoristas'), 'valueChange', true);
  await waitFor(() => expect(anuncioMock).toHaveBeenCalledWith('v1', true));
});

it('sem cidade da frota, o anúncio fica desabilitado com a explicação', async () => {
  await renderizar({ frotaTemCidade: false });
  expect(screen.getByText('Informe a cidade da frota em Configurações')).toBeTruthy();
  expect(screen.getByLabelText('Anunciar na busca de motoristas').props.disabled).toBe(true);
});

it('reservado: avisa que o anúncio só vale com todos da frota', async () => {
  await renderizar({ visibilidade: 'um', anunciado: true });
  expect(await screen.findByText('O anúncio só vale quando o carro estiver disponível para todos da frota.')).toBeTruthy();
});

it('erro do servidor aparece na seção', async () => {
  visMock.mockRejectedValue({ code: 'P0001', message: 'VISIBILIDADE_INVALIDA', details: 'Escolha um motorista.' });
  await renderizar();
  await fireEvent.press(screen.getByText('Só alguns'));
  await screen.findByText('Ana');
  await fireEvent.press(screen.getByText('Salvar quem pode pegar'));
  expect(await screen.findByText('Escolha um motorista.')).toBeTruthy();
});
