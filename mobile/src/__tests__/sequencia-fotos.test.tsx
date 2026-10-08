import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SequenciaFotos } from '@/componentes/SequenciaFotos';
import { capturarFoto } from '@/lib/camera';

jest.mock('@/lib/camera', () => ({ capturarFoto: jest.fn() }));
const cameraMock = capturarFoto as jest.Mock;

let n = 0;
beforeEach(() => {
  jest.clearAllMocks();
  n = 0;
  cameraMock.mockImplementation(async () => ({ uri: `file://f${++n}.jpg`, capturadoEm: `2026-10-08T12:00:0${n}.000Z` }));
});

async function tirarEAvancar() {
  await fireEvent.press(screen.getByLabelText(/^Tirar foto/));
  await screen.findByText('Refazer foto');
  await fireEvent.press(screen.getByText('Próxima'));
}

it('segue a ordem frente → traseira → laterais → painel e não avança sem foto', async () => {
  await render(<SequenciaFotos momento="retirada" onConcluir={jest.fn()} />);
  expect(screen.getByText('Foto 1 de 5 · Frente')).toBeTruthy();
  expect(screen.queryByText('Próxima')).toBeNull();
  await tirarEAvancar();
  expect(screen.getByText('Foto 2 de 5 · Traseira')).toBeTruthy();
  await tirarEAvancar();
  expect(screen.getByText('Foto 3 de 5 · Lateral esquerda')).toBeTruthy();
  await tirarEAvancar();
  expect(screen.getByText('Foto 4 de 5 · Lateral direita')).toBeTruthy();
  await tirarEAvancar();
  expect(screen.getByText('Foto 5 de 5 · Painel')).toBeTruthy();
});

it('Refazer troca a foto do passo', async () => {
  const concluir = jest.fn();
  await render(<SequenciaFotos momento="retirada" onConcluir={concluir} />);
  await fireEvent.press(screen.getByLabelText(/^Tirar foto/));
  await screen.findByText('Refazer foto');
  await fireEvent.press(screen.getByText('Refazer foto'));
  await waitFor(() => expect(cameraMock).toHaveBeenCalledTimes(2));
  await fireEvent.press(screen.getByText('Próxima'));
  for (let i = 0; i < 3; i++) await tirarEAvancar();
  await fireEvent.press(screen.getByLabelText(/^Tirar foto/));
  await screen.findByText('Refazer foto');
  await fireEvent.changeText(screen.getByLabelText('Km do painel'), '45300');
  await fireEvent.press(screen.getByText('Concluir'));
  const [fotos] = concluir.mock.calls[0];
  expect(fotos[0].uri).toBe('file://f2.jpg');
});

it('depois do painel pede o km e entrega as 5 fotos na ordem', async () => {
  const concluir = jest.fn();
  await render(<SequenciaFotos momento="devolucao" onConcluir={concluir} />);
  for (let i = 0; i < 4; i++) await tirarEAvancar();
  await fireEvent.press(screen.getByLabelText(/^Tirar foto/));
  await screen.findByText('Refazer foto');
  await fireEvent.press(screen.getByText('Concluir'));
  expect(screen.getByText('Informe o km.')).toBeTruthy();
  expect(concluir).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Km do painel'), '45300');
  await fireEvent.press(screen.getByText('Concluir'));
  const [fotos, km] = concluir.mock.calls[0];
  expect(km).toBe(45300);
  expect(fotos.map((f: { posicao: string }) => f.posicao)).toEqual([
    'frente', 'traseira', 'lateral_esq', 'lateral_dir', 'painel',
  ]);
  expect(fotos[4].uri).toBe('file://f5.jpg');
});
