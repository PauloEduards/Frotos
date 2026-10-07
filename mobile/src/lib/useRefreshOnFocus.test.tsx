import { renderHook } from '@testing-library/react-native';

import { voltarAoFoco } from '@/testes/foco';

import { useRefreshOnFocus } from './useRefreshOnFocus';

jest.mock('expo-router', () => ({ useFocusEffect: require('@/testes/foco').useFocusEffectDeTeste }));

describe('useRefreshOnFocus', () => {
  it('não recarrega no primeiro foco (a consulta já está carregando)', async () => {
    const refetch = jest.fn();
    await renderHook(() => useRefreshOnFocus(refetch));
    expect(refetch).not.toHaveBeenCalled();
  });

  it('recarrega cada vez que a tela volta ao foco', async () => {
    const refetch = jest.fn();
    await renderHook(() => useRefreshOnFocus(refetch));
    await voltarAoFoco();
    expect(refetch).toHaveBeenCalledTimes(1);
    await voltarAoFoco();
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('usa a função mais recente, sem recarregar a cada renderização', async () => {
    const primeira = jest.fn();
    const segunda = jest.fn();
    const { rerender } = await renderHook(({ f }: { f: () => void }) => useRefreshOnFocus(f), {
      initialProps: { f: primeira },
    });
    await rerender({ f: segunda });
    expect(segunda).not.toHaveBeenCalled();
    await voltarAoFoco();
    expect(primeira).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledTimes(1);
  });
});
