import { render, screen } from '@testing-library/react-native';

import { CardCarro } from '@/componentes/CardCarro';
import { Placa } from '@/componentes/Placa';

it('Placa mostra a faixa BRASIL e a placa', async () => {
  await render(<Placa texto="ABC1D23" />);
  expect(screen.getByText('BRASIL')).toBeTruthy();
  expect(screen.getByText('ABC1D23')).toBeTruthy();
});

it('CardCarro com placa e foto', async () => {
  await render(
    <CardCarro carro={{ placa: 'ABC1D23', marca: 'Chevrolet', modelo: 'Onix', ano_modelo: 2022, cor: 'Prata', fotoUrl: 'https://x/f.jpg' }} />,
  );
  expect(screen.getByText('ABC1D23')).toBeTruthy();
  expect(screen.getByText('Chevrolet Onix')).toBeTruthy();
  expect(screen.getByText('2022 · Prata')).toBeTruthy();
  expect(screen.getByTestId('foto-carro')).toBeTruthy();
  expect(screen.queryByTestId('sem-foto')).toBeNull();
});

it('CardCarro sem placa (busca pública) e sem foto mostra o ícone', async () => {
  await render(<CardCarro carro={{ marca: 'Fiat', modelo: 'Argo', fotoUrl: null }} />);
  expect(screen.queryByText('BRASIL')).toBeNull();
  expect(screen.getByTestId('sem-foto')).toBeTruthy();
});

it('CardCarro mostra selo e rodapé', async () => {
  const { Text } = require('react-native');
  await render(
    <CardCarro
      carro={{ placa: 'ABC1D23', marca: 'Fiat', modelo: 'Mobi' }}
      selo={<Text>Livre</Text>}
      rodape={<Text>Frota Piloto</Text>}
    />,
  );
  expect(screen.getByText('Livre')).toBeTruthy();
  expect(screen.getByText('Frota Piloto')).toBeTruthy();
});
