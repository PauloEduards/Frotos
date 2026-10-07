import { notifyManager } from '@tanstack/react-query';
import { act } from 'react';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// O TanStack Query avisa os componentes num setTimeout, fora de qualquer act(): nos testes isso gera
// "An update ... was not wrapped in act(...)". Passar cada notificação por act() deixa a saída limpa.
notifyManager.setNotifyFunction((fn) => {
  const anterior = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    act(fn);
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = anterior;
  }
});
