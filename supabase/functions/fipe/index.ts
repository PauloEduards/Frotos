import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buscarComCache,
  lerConsulta,
  type DepsFipe,
  type OpcaoFipe,
} from '../_shared/fipe.ts';

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ erro: 'METODO_INVALIDO' }, 405);

  const consulta = lerConsulta(new URL(req.url).searchParams);
  if (!consulta) return json({ erro: 'CONSULTA_INVALIDA' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const deps: DepsFipe = {
    async lerCache(chave) {
      const { data, error } = await supabase
        .from('fipe_cache')
        .select('dados, atualizado_em')
        .eq('chave', chave)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return { dados: data.dados as OpcaoFipe[], atualizadoEm: new Date(data.atualizado_em) };
    },
    async salvarCache(chave, dados) {
      const { error } = await supabase
        .from('fipe_cache')
        .upsert({ chave, dados, atualizado_em: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
    async buscar(url) {
      const resp = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`FIPE respondeu ${resp.status}`);
      return await resp.json();
    },
  };

  const { status, corpo } = await buscarComCache(consulta, deps, new Date());
  return json(corpo, status);
});
