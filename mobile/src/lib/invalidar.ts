import type { QueryClient } from '@tanstack/react-query';

// Tudo que uma escrita na frota pode mudar: status e previsões dos carros, plano de itens,
// pendências (e o selo da aba), gastos previstos e realizados, motoristas e avisos (selo da aba).
const CHAVES = [['veiculos'], ['itens'], ['pendencias'], ['gastos'], ['membros'], ['avisos'], ['sugestao-custo']];

/** Marca como desatualizados todos os dados derivados da frota; as telas abertas recarregam. */
export function invalidarDadosDaFrota(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(CHAVES.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
