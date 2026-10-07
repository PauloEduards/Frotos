import { describe, expect, it } from 'vitest';
import {
  autorizado,
  dividirEmLotes,
  montarMensagensExpo,
  type NotificacaoPendente,
} from '../../supabase/functions/_shared/expo-push.ts';

const base: NotificacaoPendente = {
  id: 'n1',
  titulo: 'Título',
  corpo: 'Corpo',
  prioridade: 'normal',
  expo_push_token: 'ExponentPushToken[abc]',
  ref_tabela: 'vehicles',
  ref_id: 'v1',
};

describe('montarMensagensExpo', () => {
  it('normal vira default e copia título, corpo e data', () => {
    const { mensagens, semToken } = montarMensagensExpo([base]);
    expect(semToken).toEqual([]);
    expect(mensagens).toEqual([
      {
        to: 'ExponentPushToken[abc]',
        title: 'Título',
        body: 'Corpo',
        priority: 'default',
        sound: 'default',
        data: { notificacaoId: 'n1', ref_tabela: 'vehicles', ref_id: 'v1' },
      },
    ]);
  });

  it('alta vira high', () => {
    const { mensagens } = montarMensagensExpo([{ ...base, prioridade: 'alta' }]);
    expect(mensagens[0].priority).toBe('high');
  });

  it('token nulo ou inválido vai para semToken', () => {
    const { mensagens, semToken } = montarMensagensExpo([
      { ...base, id: 'a', expo_push_token: null },
      { ...base, id: 'b', expo_push_token: 'abc' },
      { ...base, id: 'c' },
    ]);
    expect(semToken).toEqual(['a', 'b']);
    expect(mensagens.map((m) => m.data.notificacaoId)).toEqual(['c']);
  });
});

describe('dividirEmLotes', () => {
  it('250 itens em lotes de 100', () => {
    const lotes = dividirEmLotes(Array.from({ length: 250 }, (_, i) => i));
    expect(lotes.map((l) => l.length)).toEqual([100, 100, 50]);
  });
  it('vazio', () => {
    expect(dividirEmLotes([])).toEqual([]);
  });
});

describe('autorizado', () => {
  const chave = 'chave-service-role';
  it('aceita Bearer com a chave exata', () => {
    expect(autorizado(`Bearer ${chave}`, chave)).toBe(true);
  });
  it('rejeita header ausente, chave errada ou formato diferente', () => {
    expect(autorizado(null, chave)).toBe(false);
    expect(autorizado('', chave)).toBe(false);
    expect(autorizado('Bearer outra', chave)).toBe(false);
    expect(autorizado(chave, chave)).toBe(false);
    expect(autorizado(`bearer ${chave}`, chave)).toBe(false);
    expect(autorizado(`Bearer ${chave} `, chave)).toBe(false);
  });
  it('rejeita tudo quando a chave do ambiente está vazia', () => {
    expect(autorizado('Bearer ', '')).toBe(false);
    expect(autorizado('Bearer undefined', '')).toBe(false);
  });
});
