import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { urlsAssinadas } from '@/api/fotos';
import { minhaFrota } from '@/api/frota';
import {
  leiturasParaConferir,
  ocorrenciasAbertas,
  resolverOcorrencia,
  revisarServico,
  servicosParaRevisar,
  servicosRecentesDeMotoristas,
  type LeituraConferir,
  type OcorrenciaAberta,
  type ServicoRevisao,
} from '@/api/pendencias';
import Pendencias from '@/app/(dono)/(abas)/pendencias';
import { ErroApp } from '@/lib/erros';

jest.mock('@/api/frota', () => ({ minhaFrota: jest.fn() }));
jest.mock('@/api/fotos', () => ({ urlsAssinadas: jest.fn() }));
jest.mock('@/api/pendencias', () => ({
  servicosParaRevisar: jest.fn(),
  servicosRecentesDeMotoristas: jest.fn(),
  leiturasParaConferir: jest.fn(),
  ocorrenciasAbertas: jest.fn(),
  revisarServico: jest.fn(),
  resolverOcorrencia: jest.fn(),
}));

const m = {
  minhaFrota: minhaFrota as jest.Mock,
  urls: urlsAssinadas as jest.Mock,
  servicos: servicosParaRevisar as jest.Mock,
  recentes: servicosRecentesDeMotoristas as jest.Mock,
  leituras: leiturasParaConferir as jest.Mock,
  ocorrencias: ocorrenciasAbertas as jest.Mock,
  revisar: revisarServico as jest.Mock,
  resolver: resolverOcorrencia as jest.Mock,
};

const servico: ServicoRevisao = {
  id: 's1',
  placa: 'ABC1D23',
  autor: 'Bruno',
  itens: [{ nome: 'Pneus (rodízio e alinhamento)', valor: 210 }],
  valor_total: 210,
  data: '2026-10-05',
  oficina: 'Pneus Express',
  km: 61100,
  nota_foto_path: 'f1/v1/notas/a.jpg',
};

const recente: ServicoRevisao = { ...servico, id: 's2', placa: 'XYZ9K88', autor: 'Ana', nota_foto_path: null };

const leitura: LeituraConferir = {
  id: 'l1',
  placa: 'ABC1D23',
  autor: 'Bruno',
  km: 64000,
  capturado_em: '2026-10-06T15:00:00Z',
  foto_painel_path: 'f1/v1/painel.jpg',
  salto: { km: 2000, dias: 1 },
};

const ocorrencia: OcorrenciaAberta = {
  id: 'o1',
  tipo: 'acidente_grave',
  descricao: 'Bati na traseira de um caminhão.',
  criada_em: '2026-10-05T12:00:00Z',
  placa: 'XYZ9K88',
  motorista: 'Ana',
  fotos: ['f1/v2/o1.jpg'],
};

let client: QueryClient;

async function renderizar() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <Pendencias />
    </QueryClientProvider>,
  );
}

afterEach(() => client?.clear());

beforeEach(() => {
  jest.clearAllMocks();
  m.minhaFrota.mockResolvedValue({ id: 'f1' });
  m.urls.mockResolvedValue({
    'f1/v1/notas/a.jpg': 'https://x/nota.jpg',
    'f1/v1/painel.jpg': 'https://x/painel.jpg',
    'f1/v2/o1.jpg': 'https://x/o1.jpg',
  });
  m.servicos.mockResolvedValue([]);
  m.recentes.mockResolvedValue([]);
  m.leituras.mockResolvedValue([]);
  m.ocorrencias.mockResolvedValue([]);
  m.revisar.mockResolvedValue(undefined);
  m.resolver.mockResolvedValue(undefined);
});

describe('Pendências', () => {
  it('sem nada pendente mostra "Nenhuma pendência. Tudo em dia!"', async () => {
    await renderizar();
    expect(await screen.findByText('Nenhuma pendência. Tudo em dia!')).toBeOnTheScreen();
    expect(m.servicos).toHaveBeenCalledWith('f1');
  });

  it('mostra o serviço para aprovar e aprova', async () => {
    m.servicos.mockResolvedValue([servico]);
    await renderizar();

    expect(await screen.findByText('Serviços para aprovar')).toBeOnTheScreen();
    expect(screen.getByText('ABC1D23 · Bruno · 05/10/2026')).toBeOnTheScreen();
    expect(screen.getByText('Pneus (rodízio e alinhamento) · R$ 210,00')).toBeOnTheScreen();
    expect(screen.getByText('R$ 210,00')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota do serviço ABC1D23')).toBeOnTheScreen();
    expect(screen.queryByText('Nenhuma pendência. Tudo em dia!')).toBeNull();

    await fireEvent.press(screen.getByText('Aprovar'));
    await waitFor(() => expect(m.revisar).toHaveBeenCalledWith('s1', 'aprovar', undefined));
  });

  it('recusa com motivo', async () => {
    m.servicos.mockResolvedValue([servico]);
    await renderizar();

    await fireEvent.press(await screen.findByText('Recusar'));
    await fireEvent.changeText(screen.getByLabelText('Motivo (opcional)'), 'Valor acima do combinado');
    await fireEvent.press(screen.getByText('Confirmar recusa'));
    await waitFor(() => expect(m.revisar).toHaveBeenCalledWith('s1', 'recusar', 'Valor acima do combinado'));
  });

  it('recusa sem motivo e mostra o erro do backend', async () => {
    m.servicos.mockResolvedValue([servico]);
    m.revisar.mockRejectedValue(new ErroApp('Este serviço já foi revisado.'));
    await renderizar();

    await fireEvent.press(await screen.findByText('Recusar'));
    await fireEvent.press(screen.getByText('Confirmar recusa'));
    await waitFor(() => expect(m.revisar).toHaveBeenCalledWith('s1', 'recusar', undefined));
    expect(await screen.findByText('Este serviço já foi revisado.')).toBeOnTheScreen();
  });

  it('contesta serviço de motorista confiável após confirmação', async () => {
    m.recentes.mockResolvedValue([recente]);
    await renderizar();

    expect(await screen.findByText('Registrados por motoristas confiáveis')).toBeOnTheScreen();
    expect(screen.getByText('XYZ9K88 · Ana · 05/10/2026')).toBeOnTheScreen();
    expect(screen.getByText('Sem foto da nota')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Contestar'));
    expect(screen.getByText('O serviço sai da previsão.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Motivo (opcional)'), 'Não fiz este serviço');
    await fireEvent.press(screen.getByText('Confirmar contestação'));
    await waitFor(() => expect(m.revisar).toHaveBeenCalledWith('s2', 'contestar', 'Não fiz este serviço'));
  });

  it('cancelar a contestação não chama o backend', async () => {
    m.recentes.mockResolvedValue([recente]);
    await renderizar();

    await fireEvent.press(await screen.findByText('Contestar'));
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText('Contestar')).toBeOnTheScreen();
    expect(m.revisar).not.toHaveBeenCalled();
  });

  it('mostra a leitura suspeita com o salto e a foto do painel', async () => {
    m.leituras.mockResolvedValue([leitura]);
    await renderizar();

    expect(await screen.findByText('Leituras de km para conferir')).toBeOnTheScreen();
    expect(screen.getByText('+2.000 km em 1 dia')).toBeOnTheScreen();
    expect(screen.getByText('ABC1D23 · Bruno · 06/10/2026')).toBeOnTheScreen();
    expect(screen.getByText('Painel marcando 64.000 km')).toBeOnTheScreen();
    expect(screen.getByLabelText('Foto do painel ABC1D23')).toBeOnTheScreen();
  });

  it('usa "dias" no plural e um texto neutro sem leitura anterior', async () => {
    m.leituras.mockResolvedValue([
      { ...leitura, id: 'l2', salto: { km: 900, dias: 2 } },
      { ...leitura, id: 'l3', salto: null },
    ]);
    await renderizar();

    expect(await screen.findByText('+900 km em 2 dias')).toBeOnTheScreen();
    expect(screen.getByText('Salto de km suspeito')).toBeOnTheScreen();
  });

  it('mostra a ocorrência com tipo, descrição e foto, e marca como resolvida', async () => {
    m.ocorrencias.mockResolvedValue([ocorrencia, { ...ocorrencia, id: 'o2', tipo: 'mecanico', fotos: [] }]);
    await renderizar();

    expect(await screen.findByText('Ocorrências')).toBeOnTheScreen();
    expect(screen.getByText('Acidente grave')).toHaveStyle({ color: '#C62828' });
    expect(screen.getByText('Barulho/mecânico')).not.toHaveStyle({ color: '#C62828' });
    expect(screen.getAllByText('Bati na traseira de um caminhão.')).toHaveLength(2);
    expect(screen.getByLabelText('Foto 1 da ocorrência XYZ9K88')).toBeOnTheScreen();

    await fireEvent.press(screen.getAllByText('Marcar como resolvida')[0]);
    await waitFor(() => expect(m.resolver).toHaveBeenCalledWith('o1'));
  });

  it('erro ao resolver aparece no cartão', async () => {
    m.ocorrencias.mockResolvedValue([ocorrencia]);
    m.resolver.mockRejectedValue(new ErroApp('Sem conexão com a internet. Tente de novo.'));
    await renderizar();

    await fireEvent.press(await screen.findByText('Marcar como resolvida'));
    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeOnTheScreen();
  });

  it('falha ao carregar mostra o erro e tenta de novo', async () => {
    m.servicos.mockRejectedValueOnce(new ErroApp('Sem conexão com a internet. Tente de novo.'));
    await renderizar();

    expect(await screen.findByText('Sem conexão com a internet. Tente de novo.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Nenhuma pendência. Tudo em dia!')).toBeOnTheScreen();
  });

  it('segue acionável quando as fotos não podem ser assinadas', async () => {
    m.servicos.mockResolvedValue([servico]);
    m.urls.mockRejectedValue(new ErroApp('Falha'));
    await renderizar();

    expect(await screen.findByText('Aprovar')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota do serviço ABC1D23 (indisponível)')).toBeOnTheScreen();
  });
});
