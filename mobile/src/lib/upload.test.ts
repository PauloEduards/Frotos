import { enviarFoto, novoCaminho } from './upload';

const mockUpload = jest.fn();
jest.mock('@/lib/cliente', () => ({
  supabase: { storage: { from: (bucket: string) => ({ upload: (...a: unknown[]) => mockUpload(bucket, ...a) }) } },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-2222-3333-4444-555555555555' }));

beforeEach(() => {
  mockUpload.mockReset();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)),
  });
});

it('novoCaminho monta frota/carro/categoria/uuid.jpg', () => {
  expect(novoCaminho('f1', 'v1', 'painel')).toBe('f1/v1/painel/11111111-2222-3333-4444-555555555555.jpg');
  expect(novoCaminho('f1', 'v1')).toBe('f1/v1/11111111-2222-3333-4444-555555555555.jpg');
});

it('enviarFoto sobe o arquivo como JPEG sem sobrescrever', async () => {
  mockUpload.mockResolvedValue({ error: null });
  await enviarFoto('fotos', 'f1/v1/x.jpg', 'file://x.jpg');
  expect(mockUpload).toHaveBeenCalledWith('fotos', 'f1/v1/x.jpg', expect.any(ArrayBuffer), {
    contentType: 'image/jpeg',
    upsert: false,
  });
});

it('enviarFoto: objeto que já existe conta como enviado (nova tentativa da fila)', async () => {
  mockUpload.mockResolvedValue({ error: { message: 'The resource already exists', statusCode: '409' } });
  await expect(enviarFoto('fotos', 'f1/v1/x.jpg', 'file://x.jpg')).resolves.toBeUndefined();
});

it('enviarFoto: outro erro é lançado', async () => {
  mockUpload.mockResolvedValue({ error: { message: 'new row violates row-level security policy', statusCode: '403' } });
  await expect(enviarFoto('fotos', 'f1/v1/x.jpg', 'file://x.jpg')).rejects.toBeTruthy();
});
