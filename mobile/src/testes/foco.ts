import { act } from '@testing-library/react-native';
import { useEffect } from 'react';

const callbacks = new Set<() => void>();

/**
 * Substituto do `useFocusEffect` do expo-router nos testes: roda o callback ao montar
 * (a tela ganha o foco) e guarda-o para `voltarAoFoco()` simular a volta para a tela.
 */
export function useFocusEffectDeTeste(callback: () => void) {
  useEffect(() => {
    callbacks.add(callback);
    callback();
    return () => {
      callbacks.delete(callback);
    };
  }, [callback]);
}

/** Simula o usuário voltando para a tela (troca de aba ou volta de outra tela). */
export async function voltarAoFoco() {
  await act(async () => {
    for (const cb of callbacks) cb();
  });
}
