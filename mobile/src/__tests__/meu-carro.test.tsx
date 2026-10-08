import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { meuCarro, pedidosDoMotorista, permissaoRegistro } from '@/api/meuCarro';
import { previsaoItens } from '@/api/veiculos';
import MeuCarro from '@/app/(motorista)/(frota)/meu-carro';
import { useFila } from '@/fila/useFila';
import { renderComCliente } from '@/testes/renderComCliente';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste,
}));
jest.mock('@/api/meuCarro', () => ({
  meuCarro: jest.fn(),
  pedidosDoMotorista: jest.fn(),
  permissaoRegistro: jest.fn(),
}));
jest.mock('@/api/veiculos', () => ({ previsaoItens: jest.fn() }));
jest.mock('@/api/fotos', () => ({ urlsAssinadas: jest.fn().mockResolvedValue({}) }));
jest.mock('@/fila/useFila', () => ({ useFila: jest.fn() }));

const carro = {
  vehicle_id: 'v1', fleet_id: 'f1', placa: 'ABC1D23', marca: 'Chevrolet', modelo: 'Onix',
  ano_modelo: 2022, cor: 'Prata', foto_path: null, km_atual: 45200, em_uso: false,
};

const filaVazia = { itens: [], pendentes: 0, enviarAgora: jest.fn(), tentarDeNovo: jest.fn(), descartar: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useFila as jest.Mock).mockReturnValue(filaVazia);
  (pedidosDoMotorista as jest.Mock).mockResolvedValue([]);
  (permissaoRegistro as jest.Mock).mockResolvedValue('negado');
  (previsaoItens as jest.Mock).mockResolvedValue([
    { vehicle_item_id: 'i1', nome: 'Óleo do motor', proximo_km: 46000, km_restante: 800, data_prevista: '2026-10-30', status: 'proximo', custo_estimado: 180 },
  ]);
});

it('carro reservado: mostra o carro e Retirar este carro', async () => {
  (meuCarro as jest.Mock).mockResolvedValue({ vinculo: null, carro: null, reservado: carro });
  await renderComCliente(<MeuCarro />);
  expect(await screen.findByLabelText('Placa ABC1D23')).toBeTruthy();
  await fireEvent.press(screen.getByText('Retirar este carro'));
  expect(mockPush).toHaveBeenCalledWith('/(motorista)/fluxos/fotos-carro?momento=retirada&carro=v1&frota=f1');
});

it('sem carro: orienta a escolher na aba Carros', async () => {
  (meuCarro as jest.Mock).mockResolvedValue({ vinculo: null, carro: null, reservado: null });
  await renderComCliente(<MeuCarro />);
  expect(await screen.findByText('Escolha um carro na aba Carros')).toBeTruthy();
});

it('com o carro: campos de foto somem e aparecem manutenções e ações', async () => {
  (meuCarro as jest.Mock).mockResolvedValue({
    vinculo: { id: 'a1', status: 'ativo', vehicle_id: 'v1' }, carro, reservado: null,
  });
  await renderComCliente(<MeuCarro />);
  expect(await screen.findByText('Óleo do motor')).toBeTruthy();
  expect(screen.getByText('Faltam 800 km · previsto para 30/10/2026')).toBeTruthy();
  expect(screen.queryByText('Retirar este carro')).toBeNull();
  expect(screen.getByText('Atualizar km')).toBeTruthy();
  expect(screen.getByText('Relatar ocorrência')).toBeTruthy();
  expect(screen.getByText('Devolver carro')).toBeTruthy();
  expect(screen.queryByText('Registrar serviço')).toBeNull();
  await fireEvent.press(screen.getByText('Devolver carro'));
  expect(mockPush).toHaveBeenCalledWith('/(motorista)/fluxos/fotos-carro?momento=devolucao&carro=v1&frota=f1&vinculo=a1');
});

it('pedido do dono mostra o pedido e libera Registrar serviço', async () => {
  (meuCarro as jest.Mock).mockResolvedValue({
    vinculo: { id: 'a1', status: 'ativo', vehicle_id: 'v1' }, carro, reservado: null,
  });
  (pedidosDoMotorista as jest.Mock).mockResolvedValue([{ id: 'p1', itens: ['i1'], prazo: '2026-10-20', observacao: null }]);
  await renderComCliente(<MeuCarro />);
  expect(await screen.findByText('Pedido de manutenção até 20/10/2026')).toBeTruthy();
  await fireEvent.press(screen.getByText('Registrar serviço'));
  expect(mockPush).toHaveBeenCalledWith('/(motorista)/fluxos/servico?carro=v1&frota=f1&pedido=p1');
});

it('retirada enviando: mostra o progresso da fila', async () => {
  (meuCarro as jest.Mock).mockResolvedValue({
    vinculo: { id: 'a1', status: 'aguardando_fotos', vehicle_id: 'v1' }, carro, reservado: null,
  });
  (useFila as jest.Mock).mockReturnValue({
    ...filaVazia,
    pendentes: 1,
    itens: [{
      id: 'q1', tipo: 'retirada', criadoEm: 'x', tentativas: 0, erro: null,
      acoes: [{ rpc: 'registrar_fotos_inspecao', args: { p_assignment_id: 'a1' } }],
      fotos: [true, true, false, false, false].map((enviada, i) => ({ uri: 'u', bucket: 'fotos', path: `${i}`, enviada, capturadoEm: 'x' })),
    }],
  });
  await renderComCliente(<MeuCarro />);
  expect(await screen.findByText('Enviando… 2/5')).toBeTruthy();
});

it('retirada aguardando fotos sem nada na fila: oferece continuar', async () => {
  (meuCarro as jest.Mock).mockResolvedValue({
    vinculo: { id: 'a1', status: 'aguardando_fotos', vehicle_id: 'v1' }, carro, reservado: null,
  });
  await renderComCliente(<MeuCarro />);
  await fireEvent.press(await screen.findByText('Continuar retirada'));
  expect(mockPush).toHaveBeenCalledWith('/(motorista)/fluxos/fotos-carro?momento=retirada&carro=v1&frota=f1&vinculo=a1');
});

it('Atualizar km e Relatar ocorrência abrem os fluxos', async () => {
  (meuCarro as jest.Mock).mockResolvedValue({
    vinculo: { id: 'a1', status: 'ativo', vehicle_id: 'v1' }, carro, reservado: null,
  });
  await renderComCliente(<MeuCarro />);
  await fireEvent.press(await screen.findByText('Atualizar km'));
  await fireEvent.press(screen.getByText('Relatar ocorrência'));
  await waitFor(() =>
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      '/(motorista)/fluxos/atualizar-km?carro=v1&frota=f1',
      '/(motorista)/fluxos/ocorrencia?carro=v1&frota=f1',
    ]),
  );
});
