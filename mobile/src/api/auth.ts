import { supabase } from '@/lib/cliente';

export type Perfil = {
  id: string;
  nome: string;
  telefone: string | null;
  papel: 'proprietario' | 'motorista';
  criado_em: string;
  uf?: string | null;
  cidade?: string | null;
  cpf?: string | null;
  tem_cnh?: boolean;
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
  uf?: string;
  cidade?: string;
  cpf?: string;
  tem_cnh?: boolean;
}): Promise<void> {
  const { email, senha, ...metadados } = d;
  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: metadados },
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
    .select('id, nome, telefone, papel, criado_em, uf, cidade, cpf, tem_cnh')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarPerfil(campos: { uf?: string; cidade?: string; tem_cnh?: boolean }): Promise<void> {
  const { data: sessao } = await supabase.auth.getSession();
  const uid = sessao.session?.user.id;
  if (!uid) throw new Error('JWT expired');
  const { error } = await supabase.from('profiles').update(campos).eq('id', uid);
  if (error) throw error;
}
