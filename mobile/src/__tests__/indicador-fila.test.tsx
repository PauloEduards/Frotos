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

it('item com km parado: Corrigir km manda o km novo', async () => {
  const corrigir = jest.fn();
  await render(
    <IndicadorFila
      itens={[item({
        acoes: [{ rpc: 'devolver_carro', args: { p_assignment_id: 'a1', p_km: 1 } }],
        erro: { mensagem: 'O km informado (1) é menor que o último registro (45.870).', negocio: true },
      })]}
      pendentes={0}
      onTentarDeNovo={jest.fn()}
      onDescartar={jest.fn()}
      onCorrigirKm={corrigir}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText('Km correto'), '45900');
  await fireEvent.press(screen.getByText('Enviar com este km'));
  expect(corrigir).toHaveBeenCalledWith('i1', 45900);
});

it('muitas tentativas sem conexão: oferece descartar', async () => {
  const descartar = jest.fn();
  await render(
    <IndicadorFila
      itens={[item({ tentativas: 6, erro: { mensagem: 'Sem conexão com a internet. Tente de novo.', negocio: false } })]}
      pendentes={1}
      onTentarDeNovo={jest.fn()}
      onDescartar={descartar}
    />,
  );
  expect(screen.getByText('Não está conseguindo enviar: Atualização de km')).toBeTruthy();
  await fireEvent.press(screen.getByText('Descartar'));
  expect(descartar).toHaveBeenCalledWith('i1');
});
