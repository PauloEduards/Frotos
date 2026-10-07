import { useState } from 'react';

import { sair } from '@/api/auth';
import { mensagemErro } from '@/lib/erros';

// Sair com feedback: se falhar, expõe a mensagem em vez de falhar em silêncio.
export function useSair() {
  const [erro, setErro] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  async function aoSair() {
    setErro(null);
    setSaindo(true);
    try {
      await sair();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSaindo(false);
    }
  }

  return { aoSair, erroSair: erro, saindo };
}
