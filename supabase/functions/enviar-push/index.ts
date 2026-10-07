import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  dividirEmLotes,
  montarMensagensExpo,
  type NotificacaoPendente,
} from '../_shared/expo-push.ts';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, titulo, corpo, prioridade, ref_tabela, ref_id, profiles(expo_push_token)')
    .is('push_enviado_em', null)
    .gt('criada_em', desde)
    .order('criada_em', { ascending: true })
    .limit(500);
  if (error) return json({ erro: error.message }, 500);

  // deno-lint-ignore no-explicit-any
  const pendentes: NotificacaoPendente[] = (data ?? []).map((r: any) => {
    const perfil = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      titulo: r.titulo,
      corpo: r.corpo,
      prioridade: r.prioridade,
      ref_tabela: r.ref_tabela,
      ref_id: r.ref_id,
      expo_push_token: perfil?.expo_push_token ?? null,
    };
  });

  const { mensagens, semToken } = montarMensagensExpo(pendentes);

  const marcar = async (ids: string[]) => {
    if (ids.length === 0) return null;
    const { error: e } = await supabase
      .from('notifications')
      .update({ push_enviado_em: new Date().toISOString() })
      .in('id', ids);
    return e;
  };

  const erroSemToken = await marcar(semToken);
  if (erroSemToken) return json({ erro: erroSemToken.message }, 500);

  let enviadas = 0;
  for (const lote of dividirEmLotes(mensagens)) {
    let resp: Response;
    try {
      resp = await fetch(EXPO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lote),
      });
    } catch (e) {
      return json({ erro: `Falha ao chamar a Expo: ${(e as Error).message}`, enviadas }, 502);
    }
    if (!resp.ok) {
      return json({ erro: `Expo respondeu ${resp.status}`, enviadas }, 502);
    }
    const erroMarca = await marcar(lote.map((m) => m.data.notificacaoId));
    if (erroMarca) return json({ erro: erroMarca.message, enviadas }, 500);
    enviadas += lote.length;
  }

  return json({ enviadas, semToken: semToken.length });
});
