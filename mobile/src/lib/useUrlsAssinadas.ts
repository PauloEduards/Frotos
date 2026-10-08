import { useQuery } from '@tanstack/react-query';

import { urlsAssinadas } from '@/api/fotos';

const MEIA_HORA = 30 * 60 * 1000;

/**
 * Endereços assinados (válidos por 1 hora) das fotos, numa única chamada.
 * `renovar` pede endereços novos, por exemplo quando uma foto não carrega (endereço vencido).
 * Se a assinatura falhar, `urls` fica vazio e as telas mostram "Sem imagem".
 */
export function useUrlsAssinadas(
  caminhos: string[],
  habilitado = true,
  bucket: 'fotos' | 'carros' = 'fotos',
) {
  const ordenados = [...new Set(caminhos)].sort();
  const fotos = useQuery({
    queryKey: ['fotos', bucket, ordenados.join('|')],
    queryFn: () => urlsAssinadas(ordenados, bucket),
    enabled: habilitado && ordenados.length > 0,
    staleTime: MEIA_HORA,
    placeholderData: (anterior) => anterior,
  });

  function renovar(): Promise<unknown> {
    if (!habilitado || ordenados.length === 0) return Promise.resolve();
    // Vários pedidos ao mesmo tempo (várias fotos vencidas) viram uma chamada só.
    return fotos.refetch({ cancelRefetch: false });
  }

  return { urls: fotos.data ?? {}, renovar };
}
