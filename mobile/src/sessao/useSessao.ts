import { useContext } from 'react';

import { SessaoContext, type ValorSessao } from './SessaoProvider';

export function useSessao(): ValorSessao {
  const valor = useContext(SessaoContext);
  if (!valor) throw new Error('useSessao precisa estar dentro de <SessaoProvider>.');
  return valor;
}
