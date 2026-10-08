import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { ErroApp } from './erros';

const LADO_MAXIMO = 1600;

export type FotoCapturada = { uri: string; capturadoEm: string };

/** Tira uma foto pela câmera (nunca pela galeria), reduz o lado maior para 1600px e comprime em JPEG 0,7. */
export async function capturarFoto(): Promise<FotoCapturada | null> {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissao.granted) {
    throw new ErroApp('Libere o acesso à câmera nas configurações do celular para continuar.');
  }

  const resultado = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (resultado.canceled || !resultado.assets?.length) return null;

  const capturadoEm = new Date().toISOString();
  const { uri, width, height } = resultado.assets[0];
  const acoes =
    Math.max(width, height) > LADO_MAXIMO
      ? [{ resize: width >= height ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO } }]
      : [];
  const reduzida = await manipulateAsync(uri, acoes, { compress: 0.7, format: SaveFormat.JPEG });
  return { uri: reduzida.uri, capturadoEm };
}
