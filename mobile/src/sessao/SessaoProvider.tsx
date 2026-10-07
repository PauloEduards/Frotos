import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { buscarPerfil, type Perfil } from '@/api/auth';
import { supabase } from '@/lib/cliente';

export type ValorSessao = {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  recarregarPerfil(): Promise<void>;
};

export const SessaoContext = createContext<ValorSessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [sessao, setSessao] = useState<Session | null>(null);
  // Perfil guardado junto do id do usuário a que pertence, para nunca expor o perfil de outro usuário.
  const [perfilCarregado, setPerfilCarregado] = useState<{ id: string; perfil: Perfil | null } | null>(null);

  useEffect(() => {
    let ativo = true;
    let recebeuEvento = false;
    // Não chamar o Supabase de dentro do callback (risco de deadlock): só atualiza o estado.
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => {
      if (!ativo) return;
      recebeuEvento = true;
      setSessao(nova);
      setSessaoPronta(true);
    });
    supabase.auth
      .getSession()
      .then(({ data: r }) => {
        if (!ativo || recebeuEvento) return;
        setSessao(r.session);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setSessaoPronta(true);
      });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const usuarioId = sessao?.user.id ?? null;

  const carregarPerfil = useCallback(async (id: string) => {
    try {
      const p = await buscarPerfil(id);
      setPerfilCarregado({ id, perfil: p });
    } catch {
      setPerfilCarregado({ id, perfil: null });
    }
  }, []);

  useEffect(() => {
    if (!usuarioId) {
      setPerfilCarregado(null);
      return;
    }
    let ativo = true;
    buscarPerfil(usuarioId)
      .then((p) => ativo && setPerfilCarregado({ id: usuarioId, perfil: p }))
      .catch(() => ativo && setPerfilCarregado({ id: usuarioId, perfil: null }));
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  const recarregarPerfil = useCallback(async () => {
    if (usuarioId) await carregarPerfil(usuarioId);
  }, [usuarioId, carregarPerfil]);

  const perfilDoUsuario = usuarioId && perfilCarregado?.id === usuarioId ? perfilCarregado : null;
  const carregando = !sessaoPronta || (usuarioId !== null && perfilDoUsuario === null);

  const valor = useMemo<ValorSessao>(
    () => ({ carregando, sessao, perfil: perfilDoUsuario?.perfil ?? null, recarregarPerfil }),
    [carregando, sessao, perfilDoUsuario, recarregarPerfil],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}
