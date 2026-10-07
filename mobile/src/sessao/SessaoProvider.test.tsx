import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { buscarPerfil } from '@/api/auth';
import { supabase } from '@/lib/cliente';

import { SessaoProvider } from './SessaoProvider';
import { useSessao } from './useSessao';

jest.mock('@/api/auth', () => ({ buscarPerfil: jest.fn() }));
jest.mock('@/lib/cliente', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

const getSession = supabase.auth.getSession as jest.Mock;
const onAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const buscar = buscarPerfil as jest.Mock;

const perfilAna = {
  id: 'u1',
  nome: 'Ana',
  telefone: null,
  papel: 'motorista',
  criado_em: '2026-01-01',
};

let callback: (evento: string, sessao: unknown) => void;

function Sonda() {
  const { carregando, sessao, perfil } = useSessao();
  return (
    <Text>{`carregando=${carregando} sessao=${sessao ? 'sim' : 'nao'} perfil=${perfil?.nome ?? 'nenhum'}`}</Text>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  onAuthStateChange.mockImplementation((cb) => {
    callback = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
});

describe('SessaoProvider', () => {
  it('sem sessão: perfil fica null', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await render(
      <SessaoProvider>
        <Sonda />
      </SessaoProvider>,
    );
    expect(await screen.findByText('carregando=false sessao=nao perfil=nenhum')).toBeTruthy();
    expect(buscar).not.toHaveBeenCalled();
  });

  it('com sessão: busca e expõe o perfil', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValue(perfilAna);
    await render(
      <SessaoProvider>
        <Sonda />
      </SessaoProvider>,
    );
    expect(await screen.findByText('carregando=false sessao=sim perfil=Ana')).toBeTruthy();
    expect(buscar).toHaveBeenCalledWith('u1');
  });

  it('SIGNED_OUT zera o perfil', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValue(perfilAna);
    await render(
      <SessaoProvider>
        <Sonda />
      </SessaoProvider>,
    );
    await screen.findByText('carregando=false sessao=sim perfil=Ana');
    await act(() => callback('SIGNED_OUT', null));
    await waitFor(() =>
      expect(screen.getByText('carregando=false sessao=nao perfil=nenhum')).toBeTruthy(),
    );
  });
});
