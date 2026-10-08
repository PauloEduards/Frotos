import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { iniciarRetirada } from '@/api/meuCarro';
import FotosCarro from '@/app/(motorista)/fluxos/fotos-carro';
import { adicionar } from '@/fila/fila';
import { renderComCliente } from '@/testes/renderComCliente';

const mockReplace = jest.fn();
const mockEnviar = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/meuCarro', () => ({ iniciarRetirada: jest.fn() }));
jest.mock('@/fila/fila', () => ({ adicionar: jest.fn() }));
jest.mock('@/fila/useFila', () => ({ useFila: () => ({ enviarAgora: mockEnviar }) }));
let mockSeq = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid${++mockSeq}` }));
jest.mock('@/componentes/SequenciaFotos', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SequenciaFotos: ({ onConcluir, erro }: { onConcluir: (f: unknown[], km: number) => void; erro?: string }) => (
      <>
        <Pressable
          onPress={() =>
            onConcluir(
              ['frente', 'traseira', 'lateral_esq', 'lateral_dir', 'painel'].map((posicao, i) => ({
                posicao,
                uri: `file://${i}.jpg`,
                capturadoEm: '2026-10-08T12:00:00.000Z',
              })),
              45300,
            )
          }
        >
          <Text>concluir-sequencia</Text>
        </Pressable>
        {erro ? <Text>{erro}</Text> : null}
      </>
    ),
  };
});

const adicionarMock = adicionar as jest.Mock;
const iniciarMock = iniciarRetirada as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSeq = 0;
  adicionarMock.mockResolvedValue('q1');
  mockEnviar.mockResolvedValue(undefined);
});

it('retirada: cria o vínculo online e enfileira as 5 fotos + ações', async () => {
  mockParams = { momento: 'retirada', carro: 'v1', frota: 'f1' };
  iniciarMock.mockResolvedValue('a1');
  await renderComCliente(<FotosCarro />);
  await fireEvent.press(screen.getByText('concluir-sequencia'));
  await waitFor(() => expect(adicionarMock).toHaveBeenCalled());
  expect(iniciarMock).toHaveBeenCalledWith('v1', 45300);
  const item = adicionarMock.mock.calls[0][0];
  expect(item.tipo).toBe('retirada');
  expect(item.fotos.map((f: { path: string }) => f.path)).toEqual([
    'f1/v1/inspecao/uuid1.jpg', 'f1/v1/inspecao/uuid2.jpg', 'f1/v1/inspecao/uuid3.jpg',
    'f1/v1/inspecao/uuid4.jpg', 'f1/v1/painel/uuid5.jpg',
  ]);
  expect(item.acoes[0].rpc).toBe('registrar_fotos_inspecao');
  expect(item.acoes[0].args.p_assignment_id).toBe('a1');
  expect(item.acoes[0].args.p_momento).toBe('retirada');
  expect(item.acoes[0].args.p_fotos[4]).toEqual({ posicao: 'painel', path: 'f1/v1/painel/uuid5.jpg', capturado_em: '2026-10-08T12:00:00.000Z' });
  expect(item.acoes[1]).toEqual({ rpc: 'concluir_retirada', args: { p_assignment_id: 'a1' } });
  expect(mockEnviar).toHaveBeenCalled();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(motorista)/(frota)/meu-carro'));
});

it('retirada continuada (vínculo já existe) não cria outro', async () => {
  mockParams = { momento: 'retirada', carro: 'v1', frota: 'f1', vinculo: 'a1' };
  await renderComCliente(<FotosCarro />);
  await fireEvent.press(screen.getByText('concluir-sequencia'));
  await waitFor(() => expect(adicionarMock).toHaveBeenCalled());
  expect(iniciarMock).not.toHaveBeenCalled();
});

it('sem internet ao iniciar: avisa para conectar', async () => {
  mockParams = { momento: 'retirada', carro: 'v1', frota: 'f1' };
  iniciarMock.mockRejectedValue(new TypeError('Network request failed'));
  await renderComCliente(<FotosCarro />);
  await fireEvent.press(screen.getByText('concluir-sequencia'));
  expect(await screen.findByText('Conecte-se à internet para iniciar a retirada.')).toBeTruthy();
  expect(adicionarMock).not.toHaveBeenCalled();
});

it('km menor ao iniciar: mostra a mensagem do servidor', async () => {
  mockParams = { momento: 'retirada', carro: 'v1', frota: 'f1' };
  iniciarMock.mockRejectedValue({ code: 'P0001', message: 'KM_MENOR', details: 'O km informado (45.300) é menor que o último registro (45.870).' });
  await renderComCliente(<FotosCarro />);
  await fireEvent.press(screen.getByText('concluir-sequencia'));
  expect(await screen.findByText('O km informado (45.300) é menor que o último registro (45.870).')).toBeTruthy();
});

it('devolução: enfileira fotos e devolver_carro com o km', async () => {
  mockParams = { momento: 'devolucao', carro: 'v1', frota: 'f1', vinculo: 'a1' };
  await renderComCliente(<FotosCarro />);
  await fireEvent.press(screen.getByText('concluir-sequencia'));
  await waitFor(() => expect(adicionarMock).toHaveBeenCalled());
  const item = adicionarMock.mock.calls[0][0];
  expect(item.tipo).toBe('devolucao');
  expect(item.acoes[0].args.p_momento).toBe('devolucao');
  expect(item.acoes[1]).toEqual({ rpc: 'devolver_carro', args: { p_assignment_id: 'a1', p_km: 45300 } });
});
