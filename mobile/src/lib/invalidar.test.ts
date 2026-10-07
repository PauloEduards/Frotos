import { QueryClient } from '@tanstack/react-query';

import { invalidarDadosDaFrota } from './invalidar';

describe('invalidarDadosDaFrota', () => {
  it('invalida carros, itens, pendências, gastos, motoristas e os selos das abas', async () => {
    const client = new QueryClient();
    const invalidar = jest.spyOn(client, 'invalidateQueries');
    await invalidarDadosDaFrota(client);
    const chaves = invalidar.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(chaves).toEqual(
      expect.arrayContaining([
        '["veiculos"]',
        '["itens"]',
        '["pendencias"]',
        '["gastos"]',
        '["membros"]',
        '["avisos"]',
      ]),
    );
    client.clear();
  });
});
