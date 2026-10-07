import { urlsAssinadas } from '@/api/fotos';
import { supabase } from '@/lib/cliente';

jest.mock('@/lib/cliente', () => ({ supabase: { storage: { from: jest.fn() } } }));

const from = supabase.storage.from as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('urlsAssinadas', () => {
  it('não chama o storage para lista vazia', async () => {
    await expect(urlsAssinadas([])).resolves.toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it('assina por 1 hora no bucket fotos e indexa pelo caminho', async () => {
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [
        { path: 'a.jpg', signedUrl: 'https://x/a', error: null },
        { path: 'b.jpg', signedUrl: null, error: 'Object not found' },
      ],
      error: null,
    });
    from.mockReturnValue({ createSignedUrls });
    await expect(urlsAssinadas(['a.jpg', 'b.jpg'])).resolves.toEqual({ 'a.jpg': 'https://x/a' });
    expect(from).toHaveBeenCalledWith('fotos');
    expect(createSignedUrls).toHaveBeenCalledWith(['a.jpg', 'b.jpg'], 3600);
  });

  it('erro do storage vira ErroApp', async () => {
    from.mockReturnValue({
      createSignedUrls: jest.fn().mockResolvedValue({ data: null, error: { message: 'Network request failed' } }),
    });
    await expect(urlsAssinadas(['a.jpg'])).rejects.toMatchObject({
      message: 'Sem conexão com a internet. Tente de novo.',
    });
  });
});
