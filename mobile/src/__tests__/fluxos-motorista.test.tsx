import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { carrosParaMim, meuCarro } from '@/api/meuCarro';
import { listarItens } from '@/api/veiculos';
import Carros from '@/app/(motorista)/(frota)/carros';
import AtualizarKm from '@/app/(motorista)/fluxos/atualizar-km';
import Ocorrencia from '@/app/(motorista)/fluxos/ocorrencia';
import Servico from '@/app/(motorista)/fluxos/servico';
import { adicionar } from '@/fila/fila';
import { capturarFoto } from '@/lib/camera';
import { renderComCliente } from '@/testes/renderComCliente';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste,
}));
jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/meuCarro', () => ({ carrosParaMim: jest.fn(), meuCarro: jest.fn() }));
jest.mock('@/api/veiculos', () => ({ listarItens: jest.fn() }));
jest.mock('@/api/fotos', () => ({ urlsAssinadas: jest.fn().mockResolvedValue({}) }));
jest.mock('@/fila/fila', () => ({ adicionar: jest.fn() }));
const mockEnviar = jest.fn();
jest.mock('@/fila/useFila', () => ({ useFila: () => ({ enviarAgora: mockEnviar }) }));
jest.mock('@/lib/camera', () => ({ capturarFoto: jest.fn() }));
let mockSeq = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid${++mockSeq}` }));

const adicionarMock = adicionar as jest.Mock;
const cameraMock = capturarFoto as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0;
  adicionarMock.mockResolvedValue('q1');
  mockEnviar.mockResolvedValue(undefined);
  cameraMock.mockResolvedValue({ uri: 'file://foto.jpg', capturadoEm: '2026-10-08T12:00:00.000Z' });
});

describe('aba Carros', () => {
  const carro = (extra: object) => ({
    vehicle_id: 'v1', fleet_id: 'f1', placa: 'ABC1D23', marca: 'Fiat', modelo: 'Argo',
    ano_modelo: 2023, cor: 'Vermelho', foto_path: null, km_atual: 18000, em_uso: false, ...extra,
  });

  it('lista os carros com placa; em uso fica desabilitado; livre abre a retirada', async () => {
    (meuCarro as jest.Mock).mockResolvedValue({ vinculo: null, carro: null, reservado: null });
    (carrosParaMim as jest.Mock).mockResolvedValue([carro({}), carro({ vehicle_id: 'v2', placa: 'XYZ9K88', em_uso: true })]);
    await renderComCliente(<Carros />);
    expect(await screen.findByLabelText('Placa XYZ9K88')).toBeTruthy();
    expect(screen.getByText('Em uso')).toBeTruthy();
    await fireEvent.press(screen.getByText('Pegar este carro'));
    expect(mockPush).toHaveBeenCalledWith('/(motorista)/fluxos/fotos-carro?momento=retirada&carro=v1&frota=f1');
  });

  it('já com um carro: avisa e não oferece pegar outro', async () => {
    (meuCarro as jest.Mock).mockResolvedValue({ vinculo: { id: 'a1', status: 'ativo', vehicle_id: 'v9' }, carro: null, reservado: null });
    (carrosParaMim as jest.Mock).mockResolvedValue([carro({})]);
    await renderComCliente(<Carros />);
    expect(await screen.findByText('Você já está com um carro. Devolva-o para pegar outro.')).toBeTruthy();
    expect(screen.queryByText('Pegar este carro')).toBeNull();
  });
});

describe('atualizar km', () => {
  it('foto do painel + km vão para a fila', async () => {
    mockParams = { carro: 'v1', frota: 'f1' };
    await renderComCliente(<AtualizarKm />);
    await fireEvent.press(screen.getByLabelText('Tirar foto do painel'));
    await screen.findByText('Refazer foto');
    await fireEvent.changeText(screen.getByLabelText('Km do painel'), '45900');
    await fireEvent.press(screen.getByText('Enviar'));
    await waitFor(() => expect(adicionarMock).toHaveBeenCalled());
    const item = adicionarMock.mock.calls[0][0];
    expect(item.tipo).toBe('km');
    expect(item.fotos[0].path).toBe('f1/v1/painel/uuid1.jpg');
    expect(item.acoes).toEqual([{
      rpc: 'registrar_km',
      args: { p_vehicle_id: 'v1', p_km: 45900, p_origem: 'atualizacao', p_foto_painel_path: 'f1/v1/painel/uuid1.jpg', p_capturado_em: '2026-10-08T12:00:00.000Z' },
    }]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('sem foto ou sem km não envia', async () => {
    mockParams = { carro: 'v1', frota: 'f1' };
    await renderComCliente(<AtualizarKm />);
    await fireEvent.press(screen.getByText('Enviar'));
    expect(screen.getByText('Tire a foto do painel.')).toBeTruthy();
    expect(adicionarMock).not.toHaveBeenCalled();
  });
});

describe('relatar ocorrência', () => {
  it('tipo, descrição e fotos numa chamada só', async () => {
    mockParams = { carro: 'v1', frota: 'f1' };
    await renderComCliente(<Ocorrencia />);
    await fireEvent.press(screen.getByText('Acidente grave'));
    await fireEvent.changeText(screen.getByLabelText('O que aconteceu?'), 'Batida traseira no semáforo');
    await fireEvent.press(screen.getByLabelText('Adicionar foto'));
    await screen.findByLabelText('Foto 1');
    await fireEvent.press(screen.getByText('Enviar'));
    await waitFor(() => expect(adicionarMock).toHaveBeenCalled());
    const item = adicionarMock.mock.calls[0][0];
    expect(item.tipo).toBe('ocorrencia');
    expect(item.acoes[0].rpc).toBe('relatar_ocorrencia');
    expect(item.acoes[0].args).toMatchObject({
      p_vehicle_id: 'v1',
      p_tipo: 'acidente_grave',
      p_descricao: 'Batida traseira no semáforo',
      p_fotos: [{ path: 'f1/v1/ocorrencia/uuid2.jpg', capturado_em: '2026-10-08T12:00:00.000Z' }],
    });
    expect(item.acoes[0].args.p_id).toBe('uuid1');
  });

  it('sem descrição não envia', async () => {
    mockParams = { carro: 'v1', frota: 'f1' };
    await renderComCliente(<Ocorrencia />);
    await fireEvent.press(screen.getByText('Enviar'));
    expect(screen.getByText('Descreva o que aconteceu.')).toBeTruthy();
  });
});

describe('registrar serviço', () => {
  it('itens, km, valor e foto da nota; com pedido manda p_request_id', async () => {
    mockParams = { carro: 'v1', frota: 'f1', pedido: 'p1' };
    (listarItens as jest.Mock).mockResolvedValue([
      { id: 'i1', nome: 'Óleo do motor', intervalo_km: 10000, intervalo_meses: 6, km_inicial: null, data_inicial: null, custo_estimado: 180, catalog_id: 'c', ativo: true },
    ]);
    await renderComCliente(<Servico />);
    await fireEvent.press(await screen.findByText('Óleo do motor'));
    await fireEvent.changeText(screen.getByLabelText('Km do painel'), '46000');
    await fireEvent.changeText(screen.getByLabelText('Valor total (R$)'), '210,50');
    await fireEvent.press(screen.getByLabelText('Tirar foto da nota'));
    await screen.findByText('Refazer foto');
    await fireEvent.press(screen.getByText('Registrar'));
    await waitFor(() => expect(adicionarMock).toHaveBeenCalled());
    const item = adicionarMock.mock.calls[0][0];
    expect(item.tipo).toBe('servico');
    expect(item.acoes[0].rpc).toBe('registrar_servico');
    expect(item.acoes[0].args).toMatchObject({
      p_vehicle_id: 'v1',
      p_itens: [{ vehicle_item_id: 'i1' }],
      p_km: 46000,
      p_valor_total: 210.5,
      p_request_id: 'p1',
      p_nota_foto_path: 'f1/v1/nota/uuid1.jpg',
    });
  });

  it('sem foto da nota não registra', async () => {
    mockParams = { carro: 'v1', frota: 'f1' };
    (listarItens as jest.Mock).mockResolvedValue([]);
    await renderComCliente(<Servico />);
    await fireEvent.press(await screen.findByText('Registrar'));
    expect(screen.getByText('Tire a foto da nota ou do serviço feito.')).toBeTruthy();
    expect(adicionarMock).not.toHaveBeenCalled();
  });
});
