import { ListaVazia } from './ListaVazia';

export const TEXTO_SEM_FROTA = 'Crie sua frota na aba Frota para começar.';

/** Estado das abas quando o proprietário ainda não criou a frota. */
export function SemFrota() {
  return <ListaVazia texto={TEXTO_SEM_FROTA} />;
}
