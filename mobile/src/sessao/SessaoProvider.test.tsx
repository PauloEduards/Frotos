import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { buscarPerfil } from '@/api/auth';
import { supabase } from '@/lib/cliente';
import { criarClienteDeTeste, renderComCliente } from '@/testes/renderComCliente';

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
  const { carregando, sessao, perfil, recarregarPerfil } = useSessao();
  return (
    <>
      <Text>{`carregando=${carregando} sessao=${sessao ? 'sim' : 'nao'} perfil=${perfil?.nome ?? 'nenhum'}`}</Text>
      <Pressable onPress={() => void recarregarPerfil()}>
        <Text>recarregar</Text>
      </Pressable>
    </>
  );
}

function renderizar(client = criarClienteDeTeste()) {
  return renderComCliente(
    <SessaoProvider>
      <Sonda />
    </SessaoProvider>,
    client,
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
    await renderizar();
    expect(await screen.findByText('carregando=false sessao=nao perfil=nenhum')).toBeTruthy();
    expect(buscar).not.toHaveBeenCalled();
  });

  it('com sessão: busca e expõe o perfil', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValue(perfilAna);
    await renderizar();
    expect(await screen.findByText('carregando=false sessao=sim perfil=Ana')).toBeTruthy();
    expect(buscar).toHaveBeenCalledWith('u1');
  });

  it('SIGNED_OUT zera o perfil', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValue(perfilAna);
    await renderizar();
    await screen.findByText('carregando=false sessao=sim perfil=Ana');
    await act(() => callback('SIGNED_OUT', null));
    await waitFor(() =>
      expect(screen.getByText('carregando=false sessao=nao perfil=nenhum')).toBeTruthy(),
    );
  });

  it('carregando fica true enquanto o perfil está pendente', async () => {
    let resolver!: (p: unknown) => void;
    buscar.mockReturnValue(new Promise((r) => (resolver = r)));
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    await renderizar();
    expect(await screen.findByText('carregando=true sessao=sim perfil=nenhum')).toBeTruthy();
    await act(async () => resolver(perfilAna));
    expect(await screen.findByText('carregando=false sessao=sim perfil=Ana')).toBeTruthy();
  });

  it('SIGNED_IN depois da inicialização carrega o perfil', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    buscar.mockResolvedValue(perfilAna);
    await renderizar();
    await screen.findByText('carregando=false sessao=nao perfil=nenhum');
    await act(() => callback('SIGNED_IN', { user: { id: 'u1' } }));
    expect(await screen.findByText('carregando=false sessao=sim perfil=Ana')).toBeTruthy();
    expect(buscar).toHaveBeenCalledWith('u1');
  });

  it('falha ao buscar o perfil: perfil null e carregando false', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockRejectedValue(new Error('falhou'));
    await renderizar();
    expect(await screen.findByText('carregando=false sessao=sim perfil=nenhum')).toBeTruthy();
  });

  it('trocar de usuário nunca expõe o perfil do anterior', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValueOnce(perfilAna);
    await renderizar();
    await screen.findByText('carregando=false sessao=sim perfil=Ana');

    let resolver!: (p: unknown) => void;
    buscar.mockReturnValueOnce(new Promise((r) => (resolver = r)));
    await act(() => callback('SIGNED_IN', { user: { id: 'u2' } }));
    expect(screen.getByText('carregando=true sessao=sim perfil=nenhum')).toBeTruthy();
    await act(async () => resolver({ ...perfilAna, id: 'u2', nome: 'Bruno' }));
    expect(await screen.findByText('carregando=false sessao=sim perfil=Bruno')).toBeTruthy();
  });

  it('sair e entrar de novo com o mesmo usuário não reaproveita o perfil antigo', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValueOnce(perfilAna);
    await renderizar();
    await screen.findByText('carregando=false sessao=sim perfil=Ana');
    await act(() => callback('SIGNED_OUT', null));
    await screen.findByText('carregando=false sessao=nao perfil=nenhum');

    buscar.mockReturnValueOnce(new Promise(() => {}));
    await act(() => callback('SIGNED_IN', { user: { id: 'u1' } }));
    expect(screen.getByText('carregando=true sessao=sim perfil=nenhum')).toBeTruthy();
  });

  it('recarregar o perfil de um usuário que já saiu não sobrescreve o perfil do novo usuário', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValueOnce(perfilAna);
    await renderizar();
    await screen.findByText('carregando=false sessao=sim perfil=Ana');

    let resolverAntigo!: (p: unknown) => void;
    buscar.mockReturnValueOnce(new Promise((r) => (resolverAntigo = r)));
    await fireEvent.press(screen.getByText('recarregar'));

    buscar.mockResolvedValueOnce({ ...perfilAna, id: 'u2', nome: 'Bruno' });
    await act(() => callback('SIGNED_IN', { user: { id: 'u2' } }));
    await screen.findByText('carregando=false sessao=sim perfil=Bruno');

    await act(async () => resolverAntigo(perfilAna));
    expect(screen.getByText('carregando=false sessao=sim perfil=Bruno')).toBeTruthy();
  });
});

describe('cache do React Query', () => {
  it('é limpo ao sair, para o próximo usuário não ver dados do anterior', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValue(perfilAna);
    const client = criarClienteDeTeste();
    await renderizar(client);
    await screen.findByText('carregando=false sessao=sim perfil=Ana');
    client.setQueryData(['frota'], { id: 'f1' });
    const limpar = jest.spyOn(client, 'clear');

    await act(() => callback('SIGNED_OUT', null));
    await waitFor(() => expect(limpar).toHaveBeenCalled());
    expect(client.getQueryData(['frota'])).toBeUndefined();
  });

  it('é limpo ao trocar de usuário', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValue(perfilAna);
    const client = criarClienteDeTeste();
    await renderizar(client);
    await screen.findByText('carregando=false sessao=sim perfil=Ana');
    client.setQueryData(['frota'], { id: 'f1' });

    await act(() => callback('SIGNED_IN', { user: { id: 'u2' } }));
    await waitFor(() => expect(client.getQueryData(['frota'])).toBeUndefined());
  });

  it('não é limpo quando só o token do mesmo usuário é renovado', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    buscar.mockResolvedValue(perfilAna);
    const client = criarClienteDeTeste();
    await renderizar(client);
    await screen.findByText('carregando=false sessao=sim perfil=Ana');
    client.setQueryData(['frota'], { id: 'f1' });

    await act(() => callback('TOKEN_REFRESHED', { user: { id: 'u1' } }));
    await screen.findByText('carregando=false sessao=sim perfil=Ana');
    expect(client.getQueryData(['frota'])).toEqual({ id: 'f1' });
  });
});
