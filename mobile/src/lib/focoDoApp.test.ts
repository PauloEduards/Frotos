import { focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { ligarFocoAoApp } from './focoDoApp';

describe('ligarFocoAoApp', () => {
  it('o React Query considera o app em foco só quando ele está ativo', () => {
    let aoMudar!: (estado: string) => void;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, cb) => {
      aoMudar = cb as (estado: string) => void;
      return { remove };
    });
    const desligar = ligarFocoAoApp();

    aoMudar('background');
    expect(focusManager.isFocused()).toBe(false);
    aoMudar('active');
    expect(focusManager.isFocused()).toBe(true);

    desligar();
    expect(remove).toHaveBeenCalled();
    focusManager.setFocused(undefined);
  });
});
