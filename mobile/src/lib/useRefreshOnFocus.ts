import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Recarrega os dados quando a tela volta ao foco (troca de aba ou volta de outra tela).
 * O primeiro foco é ignorado: nele as consultas já estão carregando.
 */
export function useRefreshOnFocus(recarregar: () => unknown) {
  const primeiroFoco = useRef(true);
  const atual = useRef(recarregar);

  useEffect(() => {
    atual.current = recarregar;
  });

  useFocusEffect(
    useCallback(() => {
      if (primeiroFoco.current) {
        primeiroFoco.current = false;
        return;
      }
      void atual.current();
    }, []),
  );
}
