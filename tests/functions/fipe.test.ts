import { describe, expect, it } from 'vitest';
import {
  buscarComCache,
  cacheValido,
  chaveCache,
  lerConsulta,
  urlFipe,
  type DepsFipe,
  type OpcaoFipe,
} from '../../supabase/functions/_shared/fipe.ts';

const BASE = 'https://parallelum.com.br/fipe/api/v1/carros';
const agora = new Date('2026-10-07T12:00:00Z');
const diasAtras = (d: number) => new Date(agora.getTime() - d * 24 * 60 * 60 * 1000);

describe('lerConsulta', () => {
  it('modelos sem marca é inválido', () => {
    expect(lerConsulta(new URLSearchParams('tipo=modelos'))).toBeNull();
  });
  it('tipo desconhecido é inválido', () => {
    expect(lerConsulta(new URLSearchParams('tipo=xyz'))).toBeNull();
    expect(lerConsulta(new URLSearchParams(''))).toBeNull();
  });
  it('marcas', () => {
    expect(lerConsulta(new URLSearchParams('tipo=marcas'))).toEqual({ tipo: 'marcas' });
  });
  it('anos completo', () => {
    expect(lerConsulta(new URLSearchParams('tipo=anos&marca=21&modelo=4828'))).toEqual({
      tipo: 'anos',
      marca: '21',
      modelo: '4828',
    });
  });
  it('anos sem modelo é inválido', () => {
    expect(lerConsulta(new URLSearchParams('tipo=anos&marca=21'))).toBeNull();
  });
  it('rejeita marca com caracteres fora de [A-Za-z0-9_-]', () => {
    expect(lerConsulta(new URLSearchParams('tipo=modelos&marca=../x'))).toBeNull();
  });
});

describe('urlFipe e chaveCache', () => {
  it('monta as URLs', () => {
    expect(urlFipe({ tipo: 'marcas' })).toBe(`${BASE}/marcas`);
    expect(urlFipe({ tipo: 'modelos', marca: '21' })).toBe(`${BASE}/marcas/21/modelos`);
    expect(urlFipe({ tipo: 'anos', marca: '21', modelo: '4828' })).toBe(
      `${BASE}/marcas/21/modelos/4828/anos`,
    );
  });
  it('monta as chaves', () => {
    expect(chaveCache({ tipo: 'marcas' })).toBe('marcas');
    expect(chaveCache({ tipo: 'modelos', marca: '21' })).toBe('modelos:21');
    expect(chaveCache({ tipo: 'anos', marca: '21', modelo: '4828' })).toBe('anos:21:4828');
  });
});

describe('cacheValido', () => {
  it('menos de 30 dias vale', () => {
    expect(cacheValido(diasAtras(29), agora)).toBe(true);
    expect(cacheValido(diasAtras(30), agora)).toBe(false);
  });
});

function deps(opts: {
  cache?: { dados: OpcaoFipe[]; atualizadoEm: Date } | null;
  resposta?: unknown;
  falha?: boolean;
}) {
  const chamadas = { buscar: 0, salvar: [] as [string, OpcaoFipe[]][] };
  const d: DepsFipe = {
    lerCache: async () => opts.cache ?? null,
    salvarCache: async (c, dados) => {
      chamadas.salvar.push([c, dados]);
    },
    buscar: async () => {
      chamadas.buscar++;
      if (opts.falha) throw new Error('rede');
      return opts.resposta;
    },
  };
  return { d, chamadas };
}

describe('buscarComCache', () => {
  const velho = [{ codigo: '1', nome: 'Velho' }];

  it('cache de 10 dias não chama buscar', async () => {
    const { d, chamadas } = deps({ cache: { dados: velho, atualizadoEm: diasAtras(10) } });
    const r = await buscarComCache({ tipo: 'marcas' }, d, agora);
    expect(r).toEqual({ status: 200, corpo: velho });
    expect(chamadas.buscar).toBe(0);
  });

  it('cache de 31 dias busca, salva e retorna novos', async () => {
    const { d, chamadas } = deps({
      cache: { dados: velho, atualizadoEm: diasAtras(31) },
      resposta: [{ codigo: 23, nome: 'GM - Chevrolet' }],
    });
    const r = await buscarComCache({ tipo: 'marcas' }, d, agora);
    const novos = [{ codigo: '23', nome: 'GM - Chevrolet' }];
    expect(r).toEqual({ status: 200, corpo: novos });
    expect(chamadas.salvar).toEqual([['marcas', novos]]);
  });

  it('modelos vem em { modelos } e codigo vira string', async () => {
    const { d } = deps({
      resposta: { modelos: [{ codigo: 4828, nome: 'Onix' }], anos: [{ codigo: '2020-1', nome: '2020' }] },
    });
    const r = await buscarComCache({ tipo: 'modelos', marca: '23' }, d, agora);
    expect(r).toEqual({ status: 200, corpo: [{ codigo: '4828', nome: 'Onix' }] });
  });

  it('anos já vêm com codigo string', async () => {
    const { d } = deps({ resposta: [{ codigo: '2020-1', nome: '2020 Gasolina' }] });
    const r = await buscarComCache({ tipo: 'anos', marca: '23', modelo: '4828' }, d, agora);
    expect(r).toEqual({ status: 200, corpo: [{ codigo: '2020-1', nome: '2020 Gasolina' }] });
  });

  it('falha com cache vencido devolve o vencido', async () => {
    const { d } = deps({ cache: { dados: velho, atualizadoEm: diasAtras(60) }, falha: true });
    const r = await buscarComCache({ tipo: 'marcas' }, d, agora);
    expect(r).toEqual({ status: 200, corpo: velho });
  });

  it('falha sem cache devolve 503', async () => {
    const { d } = deps({ falha: true });
    const r = await buscarComCache({ tipo: 'marcas' }, d, agora);
    expect(r).toEqual({ status: 503, corpo: { erro: 'FIPE_INDISPONIVEL' } });
  });

  it('resposta com formato inesperado conta como falha', async () => {
    const { d } = deps({ resposta: { erro: 'x' } });
    const r = await buscarComCache({ tipo: 'marcas' }, d, agora);
    expect(r).toEqual({ status: 503, corpo: { erro: 'FIPE_INDISPONIVEL' } });
  });
});
