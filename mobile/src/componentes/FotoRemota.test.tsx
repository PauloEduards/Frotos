import { fireEvent, render, screen } from '@testing-library/react-native';

import { FotoRemota } from './FotoRemota';

const PATH = 'f1/v1/painel.jpg';

describe('FotoRemota', () => {
  it('se a imagem não carregar, mostra "Sem imagem" e pede um endereço novo uma vez', async () => {
    const onErro = jest.fn();
    await render(<FotoRemota path={PATH} urls={{ [PATH]: 'https://x/velho.jpg' }} descricao="Foto do painel" onErro={onErro} />);
    await fireEvent(screen.getByTestId(`miniatura:${PATH}`), 'error');
    expect(screen.getByText('Sem imagem')).toBeTruthy();
    expect(screen.getByLabelText('Foto do painel (indisponível)')).toBeTruthy();
    expect(onErro).toHaveBeenCalledTimes(1);
  });

  it('com o endereço novo volta a mostrar a foto; se falhar de novo, não pede outra vez', async () => {
    const onErro = jest.fn();
    const { rerender } = await render(
      <FotoRemota path={PATH} urls={{ [PATH]: 'https://x/velho.jpg' }} onErro={onErro} />,
    );
    await fireEvent(screen.getByTestId(`miniatura:${PATH}`), 'error');
    await rerender(<FotoRemota path={PATH} urls={{ [PATH]: 'https://x/novo.jpg' }} onErro={onErro} />);
    const imagem = screen.getByTestId(`miniatura:${PATH}`);
    expect(imagem.props.source).toEqual({ uri: 'https://x/novo.jpg' });
    await fireEvent(imagem, 'error');
    expect(screen.getByText('Sem imagem')).toBeTruthy();
    expect(onErro).toHaveBeenCalledTimes(1);
  });
});
