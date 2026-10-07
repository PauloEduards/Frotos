import { focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

/**
 * No celular não há "foco da janela": avisa o React Query quando o app volta para a frente,
 * para ele recarregar as consultas desatualizadas. Devolve a função que desliga o aviso.
 */
export function ligarFocoAoApp(): () => void {
  const assinatura = AppState.addEventListener('change', (estado) => {
    focusManager.setFocused(estado === 'active');
  });
  return () => assinatura.remove();
}
