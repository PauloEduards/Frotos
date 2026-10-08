import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync } from 'expo-image-manipulator';

import { capturarFoto } from './camera';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const permissao = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const camera = ImagePicker.launchCameraAsync as jest.Mock;
const manipular = manipulateAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('sem permissão: lança a mensagem para liberar a câmera', async () => {
  permissao.mockResolvedValue({ granted: false });
  await expect(capturarFoto()).rejects.toThrow(
    'Libere o acesso à câmera nas configurações do celular para continuar.',
  );
  expect(camera).not.toHaveBeenCalled();
});

it('cancelado: retorna null', async () => {
  permissao.mockResolvedValue({ granted: true });
  camera.mockResolvedValue({ canceled: true, assets: null });
  await expect(capturarFoto()).resolves.toBeNull();
});

it('foto grande: reduz o lado maior para 1600 e comprime em JPEG 0,7', async () => {
  permissao.mockResolvedValue({ granted: true });
  camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://orig.jpg', width: 4000, height: 3000 }] });
  manipular.mockResolvedValue({ uri: 'file://menor.jpg' });

  const foto = await capturarFoto();

  expect(manipular).toHaveBeenCalledWith('file://orig.jpg', [{ resize: { width: 1600 } }], {
    compress: 0.7,
    format: 'jpeg',
  });
  expect(foto?.uri).toBe('file://menor.jpg');
  expect(typeof foto?.capturadoEm).toBe('string');
});

it('foto em pé: reduz pela altura', async () => {
  permissao.mockResolvedValue({ granted: true });
  camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://o.jpg', width: 3000, height: 4000 }] });
  manipular.mockResolvedValue({ uri: 'file://m.jpg' });
  await capturarFoto();
  expect(manipular).toHaveBeenCalledWith('file://o.jpg', [{ resize: { height: 1600 } }], expect.anything());
});

it('foto pequena: só comprime', async () => {
  permissao.mockResolvedValue({ granted: true });
  camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://p.jpg', width: 1200, height: 900 }] });
  manipular.mockResolvedValue({ uri: 'file://c.jpg' });
  await capturarFoto();
  expect(manipular).toHaveBeenCalledWith('file://p.jpg', [], expect.anything());
});
