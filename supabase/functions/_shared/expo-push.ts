// Montagem das mensagens da Expo Push API. Sem APIs ou imports de Deno.

export type NotificacaoPendente = {
  id: string;
  titulo: string;
  corpo: string;
  prioridade: 'normal' | 'alta';
  expo_push_token: string | null;
  ref_tabela: string | null;
  ref_id: string | null;
};

export type MensagemExpo = {
  to: string;
  title: string;
  body: string;
  priority: 'default' | 'high';
  sound: 'default';
  data: { notificacaoId: string; ref_tabela: string | null; ref_id: string | null };
};

const PREFIXO_TOKEN = 'ExponentPushToken[';

export function montarMensagensExpo(
  n: NotificacaoPendente[],
): { mensagens: MensagemExpo[]; semToken: string[] } {
  const mensagens: MensagemExpo[] = [];
  const semToken: string[] = [];
  for (const item of n) {
    const token = item.expo_push_token;
    if (!token || !token.startsWith(PREFIXO_TOKEN)) {
      semToken.push(item.id);
      continue;
    }
    mensagens.push({
      to: token,
      title: item.titulo,
      body: item.corpo,
      priority: item.prioridade === 'alta' ? 'high' : 'default',
      sound: 'default',
      data: { notificacaoId: item.id, ref_tabela: item.ref_tabela, ref_id: item.ref_id },
    });
  }
  return { mensagens, semToken };
}

export function dividirEmLotes<T>(itens: T[], tamanho = 100): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

// Só aceita chamadas com "Authorization: Bearer <service role key>" (o job do pg_cron).
// Comparação em tempo constante para o tamanho da chave.
export function autorizado(header: string | null, chave: string): boolean {
  if (!chave || header === null) return false;
  const esperado = `Bearer ${chave}`;
  if (header.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) {
    dif |= header.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return dif === 0;
}
