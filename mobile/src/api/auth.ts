import { supabase } from '@/lib/cliente';

export type Perfil = {
  id: string;
  nome: string;
  telefone: string | null;
  papel: 'proprietario' | 'motorista';
  criado_em: string;
};

export async function entrar(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

export async function cadastrar(d: {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  papel: 'proprietario' | 'motorista';
}): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: d.email,
    password: d.senha,
    options: { data: { nome: d.nome, telefone: d.telefone, papel: d.papel } },
  });
  if (error) throw error;
}

export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function buscarPerfil(id: string): Promise<Perfil> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, telefone, papel, criado_em')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
