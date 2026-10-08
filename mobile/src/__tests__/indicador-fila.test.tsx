import { fireEvent, render, screen } from '@testing-library/react-native';

import { IndicadorFila } from '@/componentes/IndicadorFila';
import type { ItemFila } from '@/fila/fila';

function item(extra: Partial<ItemFila>): ItemFila {
  return { id: 'i1', tipo: 'km', criadoEm: 'x', fotos: [], acoes: [], tentativas: 0, erro: null, ...extra };
}

it('nada pendente: não mostra nada', async () => {
  await render(<IndicadorFila itens={[]} pendentes={0} onTentarDeNovo={jest.fn()} onDescartar={jest.fn()} />);
  expect(screen.toJSON()).toBeNull();
});

it('mostra a contagem de envios pendentes', async () => {
  await render(
    <IndicadorFila itens={[item({}), item({ id: 'i2' })]} pendentes={2} onTentarDeNovo={jest.fn()} onDescartar={jest.fn()} />,
  );
  expect(screen.getByText('2 envios pendentes')).toBeTruthy();
});

it('item com erro de negócio mostra a mensagem, Tentar de novo e Descartar', async () => {
  const tentar = jest.fn();
  const descartar = jest.fn();
  await render(
    <IndicadorFila
      itens={[item({ erro: { mensagem: 'O km informado (1) é menor que o último registro (45.870).', negocio: true } })]}
      pendentes={0}
      onTentarDeNovo={tentar}
      onDescartar={descartar}
    />,
  );
  expect(screen.getByText('Não enviado: Atualização de km')).toBeTruthy();
  expect(screen.getByText('O km informado (1) é menor que o último registro (45.870).')).toBeTruthy();
  await fireEvent.press(screen.getByText('Tentar de novo'));
  await fireEvent.press(screen.getByText('Descartar'));
  expect(tentar).toHaveBeenCalledWith('i1');
  expect(descartar).toHaveBeenCalledWith('i1');
});
