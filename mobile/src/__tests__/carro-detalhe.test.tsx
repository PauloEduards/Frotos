import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { urlsAssinadas } from '@/api/fotos';
import { cancelarPedido, pedidosAbertos } from '@/api/manutencao';
import {
  atualizarVeiculo,
  buscarVeiculo,
  corrigirKm,
  leiturasKm,
  previsaoItens,
  servicos,
  statusCarro,
  vinculos,
  type LeituraKm,
  type PrevisaoItem,
  type Servico,
  type Vinculo,
} from '@/api/veiculos';
import DetalheCarro from '@/app/(dono)/carros/[id]/index';
import { voltarAoFoco } from '@/testes/foco';
import { renderComCliente } from '@/testes/renderComCliente';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'v1' }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste,
}));
jest.mock('@/lib/cliente', () => ({ supabase: {} }));
jest.mock('@/api/fotos', () => ({ urlsAssinadas: jest.fn() }));
jest.mock('@/api/manutencao', () => ({ pedidosAbertos: jest.fn(), cancelarPedido: jest.fn() }));
jest.mock('@/api/veiculos', () => ({
  atualizarVeiculo: jest.fn(),
  corrigirKm: jest.fn(),
  buscarVeiculo: jest.fn(),
  statusCarro: jest.fn(),
  previsaoItens: jest.fn(),
  leiturasKm: jest.fn(),
  servicos: jest.fn(),
  vinculos: jest.fn(),
}));

const buscarMock = buscarVeiculo as jest.Mock;
const statusMock = statusCarro as jest.Mock;
const previsaoMock = previsaoItens as jest.Mock;
const leiturasMock = leiturasKm as jest.Mock;
const servicosMock = servicos as jest.Mock;
const vinculosMock = vinculos as jest.Mock;
const urlsMock = urlsAssinadas as jest.Mock;
const pedidosMock = pedidosAbertos as jest.Mock;
const cancelarMock = cancelarPedido as jest.Mock;
const corrigirMock = corrigirKm as jest.Mock;
const atualizarMock = atualizarVeiculo as jest.Mock;

type BotaoAlerta = { text: string; style?: string; onPress?: () => void };
let alertSpy: jest.SpyInstance;

const veiculo = {
  id: 'v1',
  fleet_id: 'f1',
  placa: 'ABC1D23',
  marca: 'Chevrolet',
  modelo: 'Onix 1.0',
  ano_modelo: 2022,
  cor: 'Prata',
  km_atual: 45200,
  km_dia_estimado: 300,
  exige_aprovacao_sempre: false,
};

function item(extra: Partial<PrevisaoItem> & { nome: string }): PrevisaoItem {
  return {
    vehicle_item_id: extra.nome,
    proximo_km: null,
    km_restante: null,
    data_prevista: null,
    status: 'em_dia',
    custo_estimado: 0,
    ...extra,
  };
}

let client: QueryClient;

async function renderizar() {
  ({ client } = await renderComCliente(<DetalheCarro />));
}


beforeEach(() => {
  jest.clearAllMocks();
  buscarMock.mockResolvedValue(veiculo);
  statusMock.mockResolvedValue({
    status: 'urgente',
    proxima_data: '2026-10-30',
    proximo_item: 'Óleo do motor',
    media: 300,
    estimada: false,
  });
  previsaoMock.mockResolvedValue([]);
  leiturasMock.mockResolvedValue([]);
  servicosMock.mockResolvedValue([]);
  vinculosMock.mockResolvedValue([]);
  urlsMock.mockResolvedValue({});
  pedidosMock.mockResolvedValue([]);
  cancelarMock.mockResolvedValue(undefined);
  corrigirMock.mockResolvedValue(undefined);
  atualizarMock.mockResolvedValue(undefined);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => alertSpy.mockRestore());

describe('cabeçalho', () => {
  it('mostra placa, modelo, cor, km atual e média', async () => {
    await renderizar();
    expect(await screen.findByText('ABC1D23')).toBeTruthy();
    expect(screen.getByText('Chevrolet Onix 1.0 · Prata')).toBeTruthy();
    expect(screen.getByText('Km atual: 45.200 km')).toBeTruthy();
    expect(screen.getByText('Média: 300 km/dia')).toBeTruthy();
    expect(screen.getByText('Urgente')).toBeTruthy();
    expect(buscarMock).toHaveBeenCalledWith('v1');
  });

  it('média estimada é sinalizada', async () => {
    statusMock.mockResolvedValue({
      status: 'em_dia',
      proxima_data: null,
      proximo_item: null,
      media: 300,
      estimada: true,
    });
    await renderizar();
    expect(await screen.findByText('Média estimada: 300 km/dia')).toBeTruthy();
  });

  it('falha no status do cabeçalho permite tentar de novo', async () => {
    statusMock.mockRejectedValueOnce({ message: 'Network request failed' });
    await renderizar();
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    expect(screen.queryByText('Urgente')).toBeNull();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Urgente')).toBeTruthy();
    expect(screen.queryByText('Sem conexão com a internet. Tente de novo.')).toBeNull();
  });

  it('falha ao carregar o carro mostra o erro e permite tentar de novo', async () => {
    buscarMock.mockRejectedValueOnce({ message: 'Network request failed' });
    await renderizar();
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('ABC1D23')).toBeTruthy();
  });
});

describe('foco', () => {
  it('voltar para a tela recarrega o carro e as listas', async () => {
    await renderizar();
    await screen.findByText('Nenhum pedido aberto.');
    pedidosMock.mockResolvedValue([
      { id: 'p1', itens: ['x'], prazo: '2026-10-20', observacao: null, driver_id: 'm1' },
    ]);
    buscarMock.mockResolvedValue({ ...veiculo, km_atual: 46000 });
    await voltarAoFoco();
    expect(await screen.findByText('Prazo: 20/10/2026')).toBeTruthy();
    expect(await screen.findByText('Km atual: 46.000 km')).toBeTruthy();
    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(servicosMock).toHaveBeenCalledTimes(2);
  });
});

describe('botões', () => {
  it('navegam para o plano, o serviço e o pedido', async () => {
    await renderizar();
    await fireEvent.press(await screen.findByText('Plano de manutenção'));
    expect(mockPush).toHaveBeenLastCalledWith('/carros/v1/itens');
    await fireEvent.press(screen.getByText('Registrar serviço'));
    expect(mockPush).toHaveBeenLastCalledWith('/carros/v1/servico');
    await fireEvent.press(screen.getByText('Pedido de manutenção'));
    expect(mockPush).toHaveBeenLastCalledWith('/carros/v1/pedido');
  });
});

describe('Manutenção', () => {
  it('descreve cada item conforme a previsão', async () => {
    previsaoMock.mockResolvedValue([
      item({
        nome: 'Óleo do motor',
        status: 'urgente',
        km_restante: 800,
        data_prevista: '2026-10-30',
      }),
      item({ nome: 'Pneus', status: 'vencido', km_restante: -200, data_prevista: '2026-09-01' }),
      item({ nome: 'Freios', status: 'sem_historico' }),
      item({ nome: 'Filtro de ar', status: 'proximo', km_restante: 500 }),
      item({ nome: 'Revisão geral', status: 'em_dia', data_prevista: '2027-03-15' }),
      item({ nome: 'Correia', status: 'vencido', data_prevista: '2026-09-10' }),
    ]);
    await renderizar();
    expect(await screen.findByText('Faltam 800 km · previsto para 30/10/2026')).toBeTruthy();
    expect(screen.getByText('Vencido há 200 km')).toBeTruthy();
    expect(screen.getByText('Sem histórico — revisar')).toBeTruthy();
    expect(screen.getByText('Faltam 500 km')).toBeTruthy();
    expect(screen.getByText('Previsto para 15/03/2027')).toBeTruthy();
    expect(screen.getByText('Vencido desde 10/09/2026')).toBeTruthy();
    expect(screen.getByText('Óleo do motor')).toBeTruthy();
    expect(screen.getByText('Manutenção')).toBeTruthy();
  });

  it('lista os itens do mais grave ao mais tranquilo', async () => {
    previsaoMock.mockResolvedValue([
      item({ nome: 'Item em dia', status: 'em_dia' }),
      item({ nome: 'Item vencido', status: 'vencido', km_restante: -1 }),
      item({ nome: 'Item urgente', status: 'urgente', km_restante: 10 }),
    ]);
    await renderizar();
    await screen.findByText('Item em dia');
    const nomes = screen.getAllByText(/^Item /).map((n) => n.props.children);
    expect(nomes).toEqual(['Item vencido', 'Item urgente', 'Item em dia']);
  });

  it('erro de rede mostra a mensagem e Tentar de novo refaz só a previsão', async () => {
    previsaoMock.mockRejectedValueOnce({ message: 'Network request failed' });
    previsaoMock.mockResolvedValue([item({ nome: 'Pneus', status: 'proximo', km_restante: 300 })]);
    await renderizar();
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeTruthy();
    expect(screen.getByText('Km atual: 45.200 km')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Faltam 300 km')).toBeTruthy();
    expect(buscarMock).toHaveBeenCalledTimes(1);
  });

  it('plano sem itens mostra a lista vazia', async () => {
    await renderizar();
    expect(await screen.findByText('Nenhum item no plano de manutenção.')).toBeTruthy();
  });
});

describe('Leituras de km', () => {
  const leituras: LeituraKm[] = [
    {
      id: 'l1',
      km: 45200,
      origem: 'atualizacao',
      capturado_em: '2026-10-07T15:00:00+00:00',
      foto_painel_path: 'f1/v1/painel.jpg',
      salto_suspeito: false,
    },
    {
      id: 'l2',
      km: 52000,
      origem: 'devolucao',
      capturado_em: '2026-10-05T12:00:00+00:00',
      foto_painel_path: null,
      salto_suspeito: true,
    },
  ];

  it('lista km, data e origem, com selo Conferir quando há salto suspeito', async () => {
    leiturasMock.mockResolvedValue(leituras);
    await renderizar();
    expect(await screen.findByText('45.200 km · 07/10/2026 · Atualização')).toBeTruthy();
    expect(screen.getByText('52.000 km · 05/10/2026 · Devolução')).toBeTruthy();
    expect(screen.getAllByText('Conferir')).toHaveLength(1);
    expect(leiturasMock).toHaveBeenCalledWith('v1');
  });

  it.each([
    ['retirada', 'Retirada'],
    ['devolucao', 'Devolução'],
    ['atualizacao', 'Atualização'],
    ['manutencao', 'Manutenção'],
    ['correcao_dono', 'Correção'],
  ] as const)('origem %s aparece como %s', async (origem, rotulo) => {
    leiturasMock.mockResolvedValue([{ ...leituras[0], foto_painel_path: null, origem }]);
    await renderizar();
    expect(await screen.findByText(`45.200 km · 07/10/2026 · ${rotulo}`)).toBeTruthy();
  });

  it('mostra a foto do painel e abre em tela cheia ao tocar', async () => {
    leiturasMock.mockResolvedValue(leituras);
    urlsMock.mockResolvedValue({ 'f1/v1/painel.jpg': 'https://exemplo.test/painel.jpg' });
    await renderizar();
    const foto = await screen.findByLabelText('Foto do painel');
    await waitFor(() => expect(urlsMock).toHaveBeenCalledWith(['f1/v1/painel.jpg']));
    expect(screen.queryByText('Fechar')).toBeNull();
    await fireEvent.press(foto);
    expect(await screen.findByText('Fechar')).toBeTruthy();
    await fireEvent.press(screen.getByText('Fechar'));
    await waitFor(() => expect(screen.queryByText('Fechar')).toBeNull());
  });

  it('puxar para atualizar renova os endereços das fotos', async () => {
    leiturasMock.mockResolvedValue(leituras);
    urlsMock.mockResolvedValue({ 'f1/v1/painel.jpg': 'https://exemplo.test/painel.jpg' });
    await renderizar();
    await screen.findByLabelText('Foto do painel');
    await waitFor(() => expect(urlsMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      await screen.getByTestId('detalhe-carro').props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(urlsMock).toHaveBeenCalledTimes(2));
  });

  it('foto que não carrega mostra "Sem imagem" e pede um endereço novo', async () => {
    leiturasMock.mockResolvedValue(leituras);
    urlsMock.mockResolvedValue({ 'f1/v1/painel.jpg': 'https://exemplo.test/velho.jpg' });
    await renderizar();
    const imagem = await screen.findByTestId('miniatura:f1/v1/painel.jpg');
    urlsMock.mockResolvedValue({ 'f1/v1/painel.jpg': 'https://exemplo.test/novo.jpg' });
    await fireEvent(imagem, 'error');
    await waitFor(() => expect(urlsMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId('miniatura:f1/v1/painel.jpg').props.source).toEqual({
        uri: 'https://exemplo.test/novo.jpg',
      }),
    );
  });

  it('sem leituras mostra a lista vazia', async () => {
    await renderizar();
    expect(await screen.findByText('Nenhuma leitura de km registrada.')).toBeTruthy();
  });
});

describe('Serviços', () => {
  const lista: Servico[] = [
    {
      id: 's1',
      data: '2026-09-20',
      km: 44000,
      oficina: 'Oficina do Zé',
      valor_total: 350.5,
      status: 'aprovado',
      motivo: null,
      itens: [
        { nome: 'Óleo do motor', valor: 200 },
        { nome: 'Filtro de ar', valor: 150.5 },
      ],
    },
    {
      id: 's2',
      data: '2026-10-01',
      km: 45000,
      oficina: null,
      valor_total: 90,
      status: 'contestado',
      motivo: 'Valor acima do combinado',
      itens: [{ nome: 'Lâmpada', valor: null }],
    },
  ];

  it('mostra data, itens, valor e status de cada serviço', async () => {
    servicosMock.mockResolvedValue(lista);
    await renderizar();
    expect(await screen.findByText('20/09/2026 · R$ 350,50')).toBeTruthy();
    expect(screen.getByText('Óleo do motor, Filtro de ar')).toBeTruthy();
    expect(screen.getByText('Aprovado')).toBeTruthy();
    expect(screen.getByText('01/10/2026 · R$ 90,00')).toBeTruthy();
    expect(screen.getByText('Lâmpada')).toBeTruthy();
    expect(screen.getByText('Contestado')).toBeTruthy();
    expect(servicosMock).toHaveBeenCalledWith('v1');
  });

  it.each([
    ['pendente', 'Pendente'],
    ['recusado', 'Recusado'],
  ] as const)('status %s aparece como %s', async (status, rotulo) => {
    servicosMock.mockResolvedValue([{ ...lista[0], status }]);
    await renderizar();
    expect(await screen.findByText(rotulo)).toBeTruthy();
  });

  it('sem serviços mostra a lista vazia', async () => {
    await renderizar();
    expect(await screen.findByText('Nenhum serviço registrado.')).toBeTruthy();
  });
});

describe('Retiradas e devoluções', () => {
  const vinculo: Vinculo = {
    id: 'a1',
    status: 'encerrado',
    inicio_em: '2026-10-01T12:00:00+00:00',
    fim_em: '2026-10-05T22:00:00+00:00',
    km_inicio: 45000,
    km_fim: 45800,
    motorista_nome: 'Ana',
    fotos: [
      { id: 'p1', momento: 'retirada', posicao: 'frente', path: 'f1/r-frente.jpg' },
      { id: 'p2', momento: 'retirada', posicao: 'traseira', path: 'f1/r-traseira.jpg' },
      { id: 'p3', momento: 'retirada', posicao: 'lateral_esq', path: 'f1/r-esq.jpg' },
      { id: 'p4', momento: 'retirada', posicao: 'lateral_dir', path: 'f1/r-dir.jpg' },
      { id: 'p5', momento: 'devolucao', posicao: 'frente', path: 'f1/d-frente.jpg' },
    ],
  };

  it('mostra motorista, datas, km e as miniaturas das fotos', async () => {
    vinculosMock.mockResolvedValue([vinculo]);
    urlsMock.mockResolvedValue(
      Object.fromEntries(
        vinculo.fotos.map((f) => [f.path, `https://exemplo.test/${f.id}.jpg`]),
      ),
    );
    await renderizar();
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.getByText('Retirada: 01/10/2026 · 45.000 km')).toBeTruthy();
    expect(screen.getByText('Devolução: 05/10/2026 · 45.800 km')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Foto da (retirada|devolução)/)).toHaveLength(5);
    expect(screen.getByLabelText('Foto da retirada: frente')).toBeTruthy();
    expect(screen.getByLabelText('Foto da retirada: lateral esquerda')).toBeTruthy();
    expect(screen.getByLabelText('Foto da devolução: frente')).toBeTruthy();
    await waitFor(() => expect(urlsMock).toHaveBeenCalled());
    const caminhos = (urlsMock.mock.calls[0][0] as string[]).slice().sort();
    expect(caminhos).toEqual([
      'f1/d-frente.jpg',
      'f1/r-dir.jpg',
      'f1/r-esq.jpg',
      'f1/r-frente.jpg',
      'f1/r-traseira.jpg',
    ]);
  });

  it('foto sem endereço assinado mostra um espaço reservado, sem quebrar', async () => {
    vinculosMock.mockResolvedValue([vinculo]);
    urlsMock.mockResolvedValue({});
    await renderizar();
    expect(await screen.findByLabelText('Foto da retirada: frente (indisponível)')).toBeTruthy();
    expect(screen.getAllByText('Sem imagem')).toHaveLength(5);
  });

  it('vínculo em andamento não mostra devolução', async () => {
    vinculosMock.mockResolvedValue([
      { ...vinculo, status: 'ativo', fim_em: null, km_fim: null, fotos: [] },
    ]);
    await renderizar();
    expect(await screen.findByText('Retirada: 01/10/2026 · 45.000 km')).toBeTruthy();
    expect(screen.queryByText(/^Devolução:/)).toBeNull();
    expect(screen.getByText('Em uso')).toBeTruthy();
  });

  it('vínculo aguardando fotos é sinalizado', async () => {
    vinculosMock.mockResolvedValue([
      { ...vinculo, status: 'aguardando_fotos', fim_em: null, km_fim: null, fotos: [] },
    ]);
    await renderizar();
    expect(await screen.findByText('Aguardando fotos da retirada')).toBeTruthy();
  });

  it('motorista sem nome aparece como Motorista', async () => {
    vinculosMock.mockResolvedValue([{ ...vinculo, motorista_nome: null, fotos: [] }]);
    await renderizar();
    expect(await screen.findByText('Motorista')).toBeTruthy();
  });

  it('sem vínculos mostra a lista vazia', async () => {
    await renderizar();
    expect(await screen.findByText('Nenhuma retirada ou devolução registrada.')).toBeTruthy();
  });
});

describe('Pedidos abertos', () => {
  const pedido = {
    id: 'p1',
    itens: ['Óleo do motor'],
    prazo: '2026-10-20',
    observacao: 'Levar na terça',
    driver_id: 'm1',
  };

  it('lista os pedidos abertos com itens, prazo e observação', async () => {
    previsaoMock.mockResolvedValue([item({ nome: 'Óleo do motor', status: 'proximo' })]);
    pedidosMock.mockResolvedValue([pedido]);
    await renderizar();
    expect(await screen.findByText('Prazo: 20/10/2026')).toBeTruthy();
    expect(screen.getByText('Levar na terça')).toBeTruthy();
    expect(pedidosMock).toHaveBeenCalledWith('v1');
  });

  it('sem pedidos mostra a lista vazia', async () => {
    await renderizar();
    expect(await screen.findByText('Nenhum pedido aberto.')).toBeTruthy();
  });

  it('Registrar serviço do pedido abre o serviço já ligado ao pedido', async () => {
    pedidosMock.mockResolvedValue([pedido]);
    await renderizar();
    await screen.findByText('Prazo: 20/10/2026');
    const botoes = screen.getAllByText('Registrar serviço');
    expect(botoes).toHaveLength(2);
    await fireEvent.press(botoes[1]);
    expect(mockPush).toHaveBeenLastCalledWith('/carros/v1/servico?pedido=p1');
  });

  it('Cancelar pede confirmação e cancela o pedido', async () => {
    pedidosMock.mockResolvedValue([pedido]);
    await renderizar();
    await fireEvent.press(await screen.findByText('Cancelar'));
    expect(cancelarMock).not.toHaveBeenCalled();
    const botoes = alertSpy.mock.calls[0][2] as BotaoAlerta[];
    await botoes.find((b) => b.style !== 'cancel')?.onPress?.();
    await waitFor(() => expect(cancelarMock).toHaveBeenCalledWith('p1'));
  });

  it('cancelar o pedido atualiza também gastos e pendências', async () => {
    pedidosMock.mockResolvedValue([pedido]);
    await renderizar();
    const invalidar = jest.spyOn(client, 'invalidateQueries');
    await fireEvent.press(await screen.findByText('Cancelar'));
    const botoes = alertSpy.mock.calls[0][2] as BotaoAlerta[];
    await botoes.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['gastos'] }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['pendencias'] });
  });
});

describe('erro ao cancelar pedido', () => {
  it('aparece dentro da seção Pedidos abertos', async () => {
    pedidosMock.mockResolvedValue([
      { id: 'p1', itens: ['x'], prazo: '2026-10-20', observacao: null, driver_id: 'm1' },
    ]);
    cancelarMock.mockRejectedValue({ code: 'P0001', message: 'X', details: 'Este pedido já foi concluído.' });
    await renderizar();
    await fireEvent.press(await screen.findByText('Cancelar'));
    const botoes = alertSpy.mock.calls[0][2] as BotaoAlerta[];
    await botoes.find((b) => b.style === 'destructive')?.onPress?.();
    const erro = await screen.findByText('Este pedido já foi concluído.');
    const titulo = screen.getByText('Pedidos abertos');
    expect(erro.parent).toBe(titulo.parent);
  });
});

describe('menu Mais', () => {
  async function abrirMais() {
    await renderizar();
    await fireEvent.press(await screen.findByText('Mais'));
  }

  it('Corrigir km avisa, pede o km e corrige', async () => {
    await abrirMais();
    await fireEvent.press(screen.getByText('Corrigir km'));
    expect(screen.getByText('Use só para corrigir um km digitado errado.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Km correto'), '45000');
    await fireEvent.press(screen.getByText('Salvar km'));
    await waitFor(() => expect(corrigirMock).toHaveBeenCalledWith('v1', 45000));
  });

  it('corrigir km atualiza também gastos e itens', async () => {
    await abrirMais();
    const invalidar = jest.spyOn(client, 'invalidateQueries');
    await fireEvent.press(screen.getByText('Corrigir km'));
    await fireEvent.changeText(screen.getByLabelText('Km correto'), '45000');
    await fireEvent.press(screen.getByText('Salvar km'));
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['gastos'] }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['itens'] });
  });

  it('Corrigir km recusa valor inválido', async () => {
    await abrirMais();
    await fireEvent.press(screen.getByText('Corrigir km'));
    await fireEvent.press(screen.getByText('Salvar km'));
    expect(await screen.findByText('Informe o km do painel.')).toBeTruthy();
    expect(corrigirMock).not.toHaveBeenCalled();
  });

  it('erro de negócio ao corrigir mostra o DETAIL', async () => {
    corrigirMock.mockRejectedValue({ code: 'P0001', message: 'X', details: 'Km inválido para este carro.' });
    await abrirMais();
    await fireEvent.press(screen.getByText('Corrigir km'));
    await fireEvent.changeText(screen.getByLabelText('Km correto'), '10');
    await fireEvent.press(screen.getByText('Salvar km'));
    expect(await screen.findByText('Km inválido para este carro.')).toBeTruthy();
  });

  it('interruptor liga "Sempre exigir minha aprovação"', async () => {
    await abrirMais();
    await fireEvent(screen.getByLabelText('Sempre exigir minha aprovação'), 'valueChange', true);
    await waitFor(() => expect(atualizarMock).toHaveBeenCalledWith('v1', { exige_aprovacao_sempre: true }));
  });

  it('Desativar carro pede confirmação e desativa', async () => {
    await abrirMais();
    await fireEvent.press(screen.getByText('Desativar carro'));
    expect(alertSpy.mock.calls[0][1]).toBe('O carro sai do painel e das previsões.');
    expect(atualizarMock).not.toHaveBeenCalled();
    const botoes = alertSpy.mock.calls[0][2] as BotaoAlerta[];
    await botoes.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(atualizarMock).toHaveBeenCalledWith('v1', { ativo: false }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
