import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  adicionarItem,
  atualizarItem,
  definirHistoricoInicial,
  listarItens,
  sugestaoCusto,
  type ItemVeiculo,
} from '@/api/veiculos';
import ItensDoCarro from '@/app/(dono)/carros/[id]/itens';
import { renderComCliente } from '@/testes/renderComCliente';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'v1' }) }));
jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/veiculos', () => ({
  listarItens: jest.fn(),
  definirHistoricoInicial: jest.fn(),
  atualizarItem: jest.fn(),
  adicionarItem: jest.fn(),
  sugestaoCusto: jest.fn(),
}));

const listarMock = listarItens as jest.Mock;
const historicoMock = definirHistoricoInicial as jest.Mock;
const atualizarMock = atualizarItem as jest.Mock;
const adicionarMock = adicionarItem as jest.Mock;
const sugestaoMock = sugestaoCusto as jest.Mock;

const oleo: ItemVeiculo = {
  id: 'i1',
  nome: 'Óleo do motor',
  intervalo_km: 10000,
  intervalo_meses: 6,
  km_inicial: null,
  data_inicial: null,
  custo_estimado: 180,
  catalog_id: 'c1',
  ativo: true,
};
const pneus: ItemVeiculo = {
  id: 'i2',
  nome: 'Pneus',
  intervalo_km: 40000,
  intervalo_meses: null,
  km_inicial: 20000,
  data_inicial: '2026-03-15',
  custo_estimado: 1200.5,
  catalog_id: 'c2',
  ativo: true,
};
const correia: ItemVeiculo = {
  id: 'i3',
  nome: 'Revisão geral',
  intervalo_km: null,
  intervalo_meses: 12,
  km_inicial: null,
  data_inicial: null,
  custo_estimado: 0,
  catalog_id: null,
  ativo: true,
};

let client: QueryClient;

async function renderizar() {
  ({ client } = await renderComCliente(<ItensDoCarro />));
  await screen.findByText('Óleo do motor');
}

async function abrirOleo() {
  await fireEvent.press(screen.getByText('Óleo do motor'));
  await screen.findByLabelText('Última troca: km');
  await esperarSugestao();
}

// A sugestão de custo chega por consulta assíncrona; deixa ela assentar dentro do act.
async function esperarSugestao() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}


beforeEach(() => {
  jest.clearAllMocks();
  listarMock.mockResolvedValue([oleo, pneus, correia]);
  historicoMock.mockResolvedValue(undefined);
  atualizarMock.mockResolvedValue(1);
  adicionarMock.mockResolvedValue(undefined);
  sugestaoMock.mockResolvedValue(null);
});

describe('lista', () => {
  it('mostra título, ajuda e os itens com intervalo, custo e situação do histórico', async () => {
    await renderizar();
    expect(listarMock).toHaveBeenCalledWith('v1');
    expect(screen.getByText('Plano de manutenção')).toBeTruthy();
    expect(
      screen.getByText(
        'Informe quando cada item foi trocado pela última vez. Se não souber, deixe em branco.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('a cada 10.000 km ou 6 meses')).toBeTruthy();
    expect(screen.getByText('Custo estimado R$ 180,00')).toBeTruthy();
    expect(screen.getByText('a cada 40.000 km')).toBeTruthy();
    expect(screen.getByText('a cada 12 meses')).toBeTruthy();
    expect(screen.getByText('Custo estimado R$ 1.200,50')).toBeTruthy();
    // Óleo e Revisão geral não têm histórico; Pneus tem.
    expect(screen.getAllByText('Sem histórico — revisar')).toHaveLength(2);
    expect(screen.getByText('Última troca: 20.000 km em 15/03/2026')).toBeTruthy();
  });

  it('não mostra itens desativados', async () => {
    listarMock.mockResolvedValue([oleo, { ...pneus, ativo: false }]);
    await renderizar();
    expect(screen.queryByText('Pneus')).toBeNull();
  });

  it('erro ao carregar mostra a mensagem e tenta de novo', async () => {
    listarMock.mockRejectedValueOnce({ code: '42501', message: 'x' });
    await renderComCliente(<ItensDoCarro />);
    expect(await screen.findByText('Você não tem permissão para isso.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Óleo do motor')).toBeTruthy();
  });
});

describe('histórico inicial', () => {
  it('tocar no item abre o editor com os campos de última troca', async () => {
    await renderizar();
    await abrirOleo();
    expect(screen.getByText('Última troca: km')).toBeTruthy();
    expect(screen.getByText('Última troca: data (dd/mm/aaaa)')).toBeTruthy();
    expect(screen.getByText('Salvar')).toBeTruthy();
  });

  it('o editor já vem preenchido com o histórico existente', async () => {
    await renderizar();
    await fireEvent.press(screen.getByText('Pneus'));
    expect((await screen.findByLabelText('Última troca: km')).props.value).toBe('20000');
    await esperarSugestao();
    expect(screen.getByLabelText('Última troca: data (dd/mm/aaaa)').props.value).toBe('15/03/2026');
  });

  it('salvar envia km e data em formato ISO', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Última troca: km'), '40000');
    await fireEvent.changeText(screen.getByLabelText('Última troca: data (dd/mm/aaaa)'), '01/08/2026');
    await fireEvent.press(screen.getByText('Salvar'));
    await waitFor(() => expect(historicoMock).toHaveBeenCalledWith('i1', 40000, '2026-08-01'));
    expect(atualizarMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Aplicar esta mudança a:')).toBeNull();
    await waitFor(() => expect(screen.queryByLabelText('Última troca: km')).toBeNull());
  });

  it('digitar só os números aplica a máscara da data', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Última troca: data (dd/mm/aaaa)'), '01082026');
    expect(screen.getByLabelText('Última troca: data (dd/mm/aaaa)').props.value).toBe('01/08/2026');
  });

  it('deixar os dois campos vazios limpa o histórico', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.press(screen.getByText('Salvar'));
    await waitFor(() => expect(historicoMock).toHaveBeenCalledWith('i1', null, null));
  });

  it('data inexistente mostra "Data inválida." e não salva', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Última troca: data (dd/mm/aaaa)'), '31/02/2026');
    await fireEvent.press(screen.getByText('Salvar'));
    expect(await screen.findByText('Data inválida.')).toBeTruthy();
    expect(historicoMock).not.toHaveBeenCalled();
  });

  it('km inválido não salva', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Última troca: km'), '12a');
    await fireEvent.press(screen.getByText('Salvar'));
    expect(await screen.findByText('Km inválido.')).toBeTruthy();
    expect(historicoMock).not.toHaveBeenCalled();
  });

  it('erro do backend aparece e o editor continua aberto', async () => {
    historicoMock.mockRejectedValue({
      code: 'P0001',
      message: 'SEM_ACESSO',
      details: 'Você não tem acesso a esta informação.',
    });
    await renderizar();
    await abrirOleo();
    await fireEvent.press(screen.getByText('Salvar'));
    expect(await screen.findByText('Você não tem acesso a esta informação.')).toBeTruthy();
    expect(screen.getByLabelText('Última troca: km')).toBeTruthy();
  });
});

describe('intervalo e custo', () => {
  async function editarEPerguntar() {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Intervalo em km'), '8000');
    await fireEvent.changeText(screen.getByLabelText('Custo estimado (R$)'), '200,50');
    await fireEvent.press(screen.getByText('Salvar'));
    await screen.findByText('Aplicar esta mudança a:');
  }

  it('o editor vem com os valores atuais', async () => {
    await renderizar();
    await abrirOleo();
    expect(screen.getByLabelText('Intervalo em km').props.value).toBe('10000');
    expect(screen.getByLabelText('Intervalo em meses').props.value).toBe('6');
    expect(screen.getByLabelText('Custo estimado (R$)').props.value).toBe('180,00');
  });

  it('pergunta o alcance, e "Todos os carros da frota" mostra quantos foram alterados', async () => {
    atualizarMock.mockResolvedValue(3);
    await editarEPerguntar();
    expect(screen.getByText('Só este carro')).toBeTruthy();
    await fireEvent.press(screen.getByText('Todos os carros da frota'));
    await waitFor(() =>
      expect(atualizarMock).toHaveBeenCalledWith(
        'i1',
        { intervalo_km: 8000, intervalo_meses: 6, custo_estimado: 200.5 },
        true,
      ),
    );
    expect(await screen.findByText('Alterado em 3 carros.')).toBeTruthy();
    expect(screen.queryByText('Aplicar esta mudança a:')).toBeNull();
  });

  it('"Só este carro" chama com aplicarEmTodos falso', async () => {
    await editarEPerguntar();
    await fireEvent.press(screen.getByText('Só este carro'));
    await waitFor(() =>
      expect(atualizarMock).toHaveBeenCalledWith(
        'i1',
        { intervalo_km: 8000, intervalo_meses: 6, custo_estimado: 200.5 },
        false,
      ),
    );
    await waitFor(() => expect(screen.queryByText('Aplicar esta mudança a:')).toBeNull());
    expect(screen.queryByText(/Alterado em/)).toBeNull();
  });

  it('o histórico é salvo antes de perguntar', async () => {
    await editarEPerguntar();
    expect(historicoMock).toHaveBeenCalledWith('i1', null, null);
  });

  it('um carro alterado usa o singular', async () => {
    atualizarMock.mockResolvedValue(1);
    await editarEPerguntar();
    await fireEvent.press(screen.getByText('Todos os carros da frota'));
    expect(await screen.findByText('Alterado em 1 carro.')).toBeTruthy();
  });

  it('cancelar a pergunta volta ao editor sem alterar o plano', async () => {
    await editarEPerguntar();
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText('Aplicar esta mudança a:')).toBeNull();
    expect(screen.getByLabelText('Intervalo em km').props.value).toBe('8000');
    expect(atualizarMock).not.toHaveBeenCalled();
  });

  it('erro ao aplicar a mudança aparece e mantém a pergunta para tentar de novo', async () => {
    atualizarMock.mockRejectedValue({
      code: 'P0001',
      message: 'INTERVALO_INVALIDO',
      details: 'Informe o intervalo em km, em meses ou ambos.',
    });
    await editarEPerguntar();
    await fireEvent.press(screen.getByText('Só este carro'));
    expect(await screen.findByText('Informe o intervalo em km, em meses ou ambos.')).toBeTruthy();
    expect(screen.getByText('Aplicar esta mudança a:')).toBeTruthy();
    atualizarMock.mockResolvedValue(1);
    await fireEvent.press(screen.getByText('Só este carro'));
    await waitFor(() => expect(atualizarMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Aplicar esta mudança a:')).toBeNull());
  });

  it('sem nenhum intervalo não salva', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Intervalo em km'), '');
    await fireEvent.changeText(screen.getByLabelText('Intervalo em meses'), '');
    await fireEvent.press(screen.getByText('Salvar'));
    expect(await screen.findByText('Informe o intervalo em km, em meses ou ambos.')).toBeTruthy();
    expect(historicoMock).not.toHaveBeenCalled();
  });

  it('intervalo e custo inválidos não salvam', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Intervalo em meses'), '1,5');
    await fireEvent.changeText(screen.getByLabelText('Custo estimado (R$)'), 'abc');
    await fireEvent.press(screen.getByText('Salvar'));
    expect(await screen.findByText('Intervalo inválido.')).toBeTruthy();
    expect(screen.getByText('Custo inválido.')).toBeTruthy();
    expect(historicoMock).not.toHaveBeenCalled();
  });

  it('só um intervalo preenchido é aceito (zero conta como vazio)', async () => {
    await renderizar();
    await abrirOleo();
    await fireEvent.changeText(screen.getByLabelText('Intervalo em km'), '0');
    await fireEvent.press(screen.getByText('Salvar'));
    await screen.findByText('Aplicar esta mudança a:');
    await fireEvent.press(screen.getByText('Só este carro'));
    await waitFor(() =>
      expect(atualizarMock).toHaveBeenCalledWith(
        'i1',
        { intervalo_km: null, intervalo_meses: 6, custo_estimado: 180 },
        false,
      ),
    );
  });
});

describe('sugestão de custo', () => {
  it('mostra a média paga e tocar preenche o custo', async () => {
    sugestaoMock.mockResolvedValue(210);
    await renderizar();
    await abrirOleo();
    expect(sugestaoMock).toHaveBeenCalledWith('i1');
    await fireEvent.press(await screen.findByText('Média paga: R$ 210,00 — usar este valor'));
    expect(screen.getByLabelText('Custo estimado (R$)').props.value).toBe('210,00');
  });

  it('sem média paga não mostra sugestão', async () => {
    await renderizar();
    await abrirOleo();
    await waitFor(() => expect(sugestaoMock).toHaveBeenCalled());
    expect(screen.queryByText(/Média paga/)).toBeNull();
  });
});

describe('adicionar item', () => {
  async function abrirNovo() {
    await renderizar();
    await fireEvent.press(screen.getByText('Adicionar item'));
    await screen.findByLabelText('Nome do item');
  }

  it('cadastra o item (0 km conta como sem intervalo em km) e recarrega a lista', async () => {
    await abrirNovo();
    await fireEvent.changeText(screen.getByLabelText('Nome do item'), ' Bateria ');
    await fireEvent.changeText(screen.getByLabelText('Intervalo em km'), '0');
    await fireEvent.changeText(screen.getByLabelText('Intervalo em meses'), '24');
    await fireEvent.changeText(screen.getByLabelText('Custo estimado (R$)'), '450');
    await fireEvent.press(screen.getByText('Salvar item'));
    await waitFor(() =>
      expect(adicionarMock).toHaveBeenCalledWith('v1', {
        nome: 'Bateria',
        intervalo_km: null,
        intervalo_meses: 24,
        custo_estimado: 450,
      }),
    );
    await waitFor(() => expect(listarMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByLabelText('Nome do item')).toBeNull());
  });

  it('sem custo informado usa zero', async () => {
    await abrirNovo();
    await fireEvent.changeText(screen.getByLabelText('Nome do item'), 'Bateria');
    await fireEvent.changeText(screen.getByLabelText('Intervalo em meses'), '24');
    await fireEvent.press(screen.getByText('Salvar item'));
    await waitFor(() =>
      expect(adicionarMock).toHaveBeenCalledWith('v1', {
        nome: 'Bateria',
        intervalo_km: null,
        intervalo_meses: 24,
        custo_estimado: 0,
      }),
    );
  });

  it('exige nome e pelo menos um intervalo', async () => {
    await abrirNovo();
    await fireEvent.press(screen.getByText('Salvar item'));
    expect(await screen.findByText('Informe o nome do item.')).toBeTruthy();
    expect(screen.getByText('Informe o intervalo em km, em meses ou ambos.')).toBeTruthy();
    expect(adicionarMock).not.toHaveBeenCalled();
  });

  it('erro do backend aparece e o formulário continua aberto', async () => {
    adicionarMock.mockRejectedValue({ code: '42501', message: 'x' });
    await abrirNovo();
    await fireEvent.changeText(screen.getByLabelText('Nome do item'), 'Bateria');
    await fireEvent.changeText(screen.getByLabelText('Intervalo em meses'), '24');
    await fireEvent.press(screen.getByText('Salvar item'));
    expect(await screen.findByText('Você não tem permissão para isso.')).toBeTruthy();
    expect(screen.getByLabelText('Nome do item').props.value).toBe('Bateria');
  });

  it('abrir um item fecha o formulário de novo item', async () => {
    await abrirNovo();
    await fireEvent.press(screen.getByText('Óleo do motor'));
    expect(await screen.findByLabelText('Última troca: km')).toBeTruthy();
    expect(screen.queryByLabelText('Nome do item')).toBeNull();
  });
});
