import AsyncStorage from '@react-native-async-storage/async-storage';

import { adicionar, descartar, listar } from './fila';
import { processarFila, type DepsFila } from './processar';

let mockSeq = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockSeq}` }));

function foto(path: string) {
  return { uri: `file://${path}`, bucket: 'fotos' as const, path, enviada: false, capturadoEm: '2026-10-08T12:00:00.000Z' };
}

function deps(over: Partial<DepsFila> = {}): DepsFila {
  return {
    enviarFoto: jest.fn().mockResolvedValue(undefined),
    chamarRpc: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('persiste e relê a fila (sobrevive a fechar o app)', async () => {
  await adicionar({ tipo: 'km', criadoEm: 'x', fotos: [foto('a.jpg')], acoes: [{ rpc: 'registrar_km', args: { p_km: 1 } }] });
  const itens = await listar();
  expect(itens).toHaveLength(1);
  expect(itens[0].tentativas).toBe(0);
  expect(itens[0].erro).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem('frotos:fila:v1')) as string)).toHaveLength(1);
});

it('falha de rede na 3ª foto: as 2 primeiras ficam enviadas e a nova tentativa começa da 3ª', async () => {
  await adicionar({
    tipo: 'retirada',
    criadoEm: 'x',
    fotos: [foto('1.jpg'), foto('2.jpg'), foto('3.jpg'), foto('4.jpg')],
    acoes: [{ rpc: 'concluir_retirada', args: {} }],
  });
  const enviarFoto = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new TypeError('Network request failed'));
  await processarFila(deps({ enviarFoto }));

  let [item] = await listar();
  expect(item.fotos.map((f) => f.enviada)).toEqual([true, true, false, false]);
  expect(item.tentativas).toBe(1);
  expect(item.erro?.negocio).toBe(false);

  const enviarDeNovo = jest.fn().mockResolvedValue(undefined);
  const chamarRpc = jest.fn().mockResolvedValue(undefined);
  await processarFila(deps({ enviarFoto: enviarDeNovo, chamarRpc }));
  expect(enviarDeNovo.mock.calls.map((c) => c[1])).toEqual(['3.jpg', '4.jpg']);
  expect(chamarRpc).toHaveBeenCalledWith('concluir_retirada', {});
  expect(await listar()).toHaveLength(0);
});

it('item com 2 ações e falha na 2ª: a nova tentativa executa só a 2ª', async () => {
  await adicionar({
    tipo: 'devolucao',
    criadoEm: 'x',
    fotos: [],
    acoes: [
      { rpc: 'registrar_fotos_inspecao', args: { a: 1 } },
      { rpc: 'devolver_carro', args: { b: 2 } },
    ],
  });
  const chamar1 = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError('Network request failed'));
  await processarFila(deps({ chamarRpc: chamar1 }));
  const chamar2 = jest.fn().mockResolvedValue(undefined);
  await processarFila(deps({ chamarRpc: chamar2 }));
  expect(chamar2.mock.calls).toEqual([['devolver_carro', { b: 2 }]]);
  expect(await listar()).toHaveLength(0);
});

it('erro de negócio para só aquele item, mostra a mensagem e não tenta sozinho de novo', async () => {
  await adicionar({ tipo: 'km', criadoEm: 'x', fotos: [], acoes: [{ rpc: 'registrar_km', args: { p_km: 1 } }] });
  await adicionar({ tipo: 'ocorrencia', criadoEm: 'y', fotos: [], acoes: [{ rpc: 'relatar_ocorrencia', args: {} }] });
  const chamarRpc = jest
    .fn()
    .mockRejectedValueOnce({ code: 'P0001', message: 'KM_MENOR', details: 'O km informado (1) é menor que o último registro (45.870).' })
    .mockResolvedValueOnce(undefined);
  await processarFila(deps({ chamarRpc }));

  const itens = await listar();
  expect(itens).toHaveLength(1);
  expect(itens[0].tipo).toBe('km');
  expect(itens[0].erro).toEqual({ mensagem: 'O km informado (1) é menor que o último registro (45.870).', negocio: true });

  const outra = jest.fn();
  await processarFila(deps({ chamarRpc: outra }));
  expect(outra).not.toHaveBeenCalled();

  await descartar(itens[0].id);
  expect(await listar()).toHaveLength(0);
});

describe('revisão final', () => {
  it('erro que não é de rede nem P0001 (ex.: storage 403) para o item, mostra mensagem e a fila segue', async () => {
    await adicionar({ tipo: 'ocorrencia', criadoEm: 'x', fotos: [foto('o.jpg')], acoes: [{ rpc: 'relatar_ocorrencia', args: {} }] });
    await adicionar({ tipo: 'km', criadoEm: 'y', fotos: [], acoes: [{ rpc: 'registrar_km', args: { p_km: 2 } }] });
    const enviarFoto = jest.fn().mockRejectedValue({ statusCode: '403', message: 'new row violates row-level security policy' });
    const chamarRpc = jest.fn().mockResolvedValue(undefined);
    await processarFila(deps({ enviarFoto, chamarRpc }));
    const itens = await listar();
    expect(itens).toHaveLength(1);
    expect(itens[0].tipo).toBe('ocorrencia');
    expect(itens[0].erro?.negocio).toBe(true);
    expect(chamarRpc).toHaveBeenCalledWith('registrar_km', { p_km: 2 });
  });

  it('erro 5xx conta como falha temporária (tenta de novo depois)', async () => {
    await adicionar({ tipo: 'km', criadoEm: 'x', fotos: [], acoes: [{ rpc: 'registrar_km', args: {} }] });
    await processarFila(deps({ chamarRpc: jest.fn().mockRejectedValue({ status: 503, message: 'Service Unavailable' }) }));
    const [item] = await listar();
    expect(item.erro?.negocio).toBe(false);
    expect(item.tentativas).toBe(1);
  });

  it('item adicionado durante o envio não se perde e é enviado na mesma rodada', async () => {
    await adicionar({ tipo: 'km', criadoEm: 'x', fotos: [foto('a.jpg')], acoes: [{ rpc: 'a', args: {} }] });
    let liberar: () => void = () => undefined;
    const enviarFoto = jest.fn().mockImplementationOnce(
      () => new Promise<void>((r) => { liberar = r; }),
    );
    const chamarRpc = jest.fn().mockResolvedValue(undefined);
    const rodada = processarFila(deps({ enviarFoto, chamarRpc }));
    await new Promise((r) => setTimeout(r, 0));
    const novo = adicionar({ tipo: 'ocorrencia', criadoEm: 'y', fotos: [], acoes: [{ rpc: 'b', args: {} }] });
    liberar();
    await novo;
    await rodada;
    expect(chamarRpc.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    expect(await listar()).toHaveLength(0);
  });

  it('corrigirKm troca o p_km das ações e libera o item', async () => {
    const { corrigirKm } = require('./processar');
    await adicionar({
      tipo: 'devolucao', criadoEm: 'x', fotos: [],
      acoes: [{ rpc: 'devolver_carro', args: { p_assignment_id: 'a1', p_km: 1 } }],
    });
    const [item] = await listar();
    const { atualizar } = require('./fila');
    await atualizar(item.id, { erro: { mensagem: 'km menor', negocio: true } });
    await corrigirKm(item.id, 45900);
    const [depois] = await listar();
    expect(depois.erro).toBeNull();
    expect(depois.acoes[0].args.p_km).toBe(45900);
  });
});
