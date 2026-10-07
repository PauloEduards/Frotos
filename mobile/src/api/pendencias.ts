import { supabase } from '@/lib/cliente';
import { comoErroApp } from '@/lib/erros';

const DIA_MS = 24 * 3600 * 1000;
const BRASILIA_MS = -3 * 3600 * 1000;

export type ItemRevisao = { nome: string; valor: number | null };

export type ServicoRevisao = {
  id: string;
  placa: string;
  autor: string;
  itens: ItemRevisao[];
  valor_total: number;
  data: string;
  km: number;
  oficina: string | null;
  nota_foto_path: string | null;
};

export type LeituraConferir = {
  id: string;
  placa: string;
  autor: string;
  km: number;
  capturado_em: string;
  foto_painel_path: string;
  /** Diferença para a leitura anterior do mesmo carro; null se não houver leitura anterior. */
  salto: { km: number; dias: number } | null;
};

export type TipoOcorrencia = 'mecanico' | 'acidente_leve' | 'acidente_grave' | 'outro';

export type OcorrenciaAberta = {
  id: string;
  tipo: TipoOcorrencia;
  descricao: string;
  criada_em: string;
  placa: string;
  motorista: string;
  fotos: string[];
};

type Veiculo = { placa: string } | null;
type Perfil = { nome: string } | null;

type LinhaServico = {
  id: string;
  km: number;
  data: string;
  valor_total: number;
  oficina: string | null;
  nota_foto_path: string | null;
  vehicles: Veiculo;
  autor: Perfil;
  maintenance_record_items: { valor: number | null; nome_outro: string | null; vehicle_items: { nome: string } | null }[];
};

const SELECT_SERVICO =
  'id, km, data, valor_total, oficina, nota_foto_path, vehicles!inner(placa, fleet_id), autor:profiles!autor_id(nome), maintenance_record_items(valor, nome_outro, vehicle_items(nome))';

function paraServico(l: LinhaServico): ServicoRevisao {
  return {
    id: l.id,
    placa: l.vehicles?.placa ?? '—',
    autor: l.autor?.nome ?? 'Motorista',
    itens: (l.maintenance_record_items ?? []).map((i) => ({
      nome: i.vehicle_items?.nome ?? i.nome_outro ?? 'Item',
      valor: i.valor,
    })),
    valor_total: l.valor_total,
    data: l.data,
    km: l.km,
    oficina: l.oficina,
    nota_foto_path: l.nota_foto_path,
  };
}

function desde(dias: number): string {
  return new Date(Date.now() - dias * DIA_MS).toISOString();
}

export async function servicosParaRevisar(fleetId: string): Promise<ServicoRevisao[]> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select(SELECT_SERVICO)
    .eq('status', 'pendente')
    .eq('vehicles.fleet_id', fleetId)
    .order('criado_em');
  if (error) throw comoErroApp(error);
  return ((data ?? []) as unknown as LinhaServico[]).map(paraServico);
}

/** Serviços aprovados direto (motorista confiável, sem revisão do dono) nos últimos `dias`, para contestar. */
export async function servicosRecentesDeMotoristas(fleetId: string, dias = 30): Promise<ServicoRevisao[]> {
  const { data: sessao } = await supabase.auth.getSession();
  const uid = sessao.session?.user.id;
  let consulta = supabase
    .from('maintenance_records')
    .select(SELECT_SERVICO)
    .eq('status', 'aprovado')
    .is('revisado_por', null)
    .eq('vehicles.fleet_id', fleetId)
    .gte('criado_em', desde(dias));
  if (uid) consulta = consulta.neq('autor_id', uid);
  const { data, error } = await consulta.order('criado_em', { ascending: false });
  if (error) throw comoErroApp(error);
  return ((data ?? []) as unknown as LinhaServico[]).map(paraServico);
}

type LinhaLeitura = {
  id: string;
  vehicle_id: string;
  km: number;
  capturado_em: string;
  foto_painel_path: string | null;
  vehicles: Veiculo;
  autor: Perfil;
};

function diaBrt(instante: string): number {
  return Math.floor((new Date(instante).getTime() + BRASILIA_MS) / DIA_MS);
}

export function calcularSalto(
  atual: { km: number; capturado_em: string },
  anterior: { km: number; capturado_em: string } | null,
): { km: number; dias: number } | null {
  if (!anterior) return null;
  const dias = Math.max(1, diaBrt(atual.capturado_em) - diaBrt(anterior.capturado_em));
  return { km: atual.km - anterior.km, dias };
}

export async function leiturasParaConferir(fleetId: string, dias = 30): Promise<LeituraConferir[]> {
  const { data, error } = await supabase
    .from('odometer_readings')
    .select('id, vehicle_id, km, capturado_em, foto_painel_path, vehicles!inner(placa, fleet_id), autor:profiles!autor_id(nome)')
    .eq('salto_suspeito', true)
    .not('foto_painel_path', 'is', null)
    .eq('vehicles.fleet_id', fleetId)
    .gte('capturado_em', desde(dias))
    .order('capturado_em', { ascending: false });
  if (error) throw comoErroApp(error);
  const linhas = ((data ?? []) as unknown as LinhaLeitura[]).filter((l) => l.foto_painel_path);

  return Promise.all(
    linhas.map(async (l) => {
      const { data: anteriores, error: erroAnterior } = await supabase
        .from('odometer_readings')
        .select('km, capturado_em')
        .eq('vehicle_id', l.vehicle_id)
        .lt('capturado_em', l.capturado_em)
        .order('capturado_em', { ascending: false })
        .limit(1);
      if (erroAnterior) throw comoErroApp(erroAnterior);
      const anterior = (anteriores ?? [])[0] ?? null;
      return {
        id: l.id,
        placa: l.vehicles?.placa ?? '—',
        autor: l.autor?.nome ?? 'Motorista',
        km: l.km,
        capturado_em: l.capturado_em,
        foto_painel_path: l.foto_painel_path as string,
        salto: calcularSalto(l, anterior),
      };
    }),
  );
}

type LinhaOcorrencia = {
  id: string;
  tipo: TipoOcorrencia;
  descricao: string;
  criada_em: string;
  vehicles: Veiculo;
  motorista: Perfil;
  incident_photos: { path: string }[];
};

export async function ocorrenciasAbertas(fleetId: string): Promise<OcorrenciaAberta[]> {
  const { data, error } = await supabase
    .from('incidents')
    .select(
      'id, tipo, descricao, criada_em, vehicles!inner(placa, fleet_id), motorista:profiles!driver_id(nome), incident_photos(path)',
    )
    .eq('status', 'aberta')
    .eq('vehicles.fleet_id', fleetId)
    .order('criada_em', { ascending: false });
  if (error) throw comoErroApp(error);
  return ((data ?? []) as unknown as LinhaOcorrencia[]).map((l) => ({
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao,
    criada_em: l.criada_em,
    placa: l.vehicles?.placa ?? '—',
    motorista: l.motorista?.nome ?? 'Motorista',
    fotos: (l.incident_photos ?? []).map((f) => f.path),
  }));
}

export async function revisarServico(
  recordId: string,
  decisao: 'aprovar' | 'recusar' | 'contestar',
  motivo?: string,
): Promise<void> {
  const { error } = await supabase.rpc('revisar_servico', {
    p_record_id: recordId,
    p_decisao: decisao,
    p_motivo: motivo?.trim() ? motivo.trim() : undefined,
  });
  if (error) throw comoErroApp(error);
}

export async function resolverOcorrencia(incidentId: string): Promise<void> {
  const { error } = await supabase.rpc('resolver_ocorrencia', { p_incident_id: incidentId });
  if (error) throw comoErroApp(error);
}

/** Total de pendências (serviços para aprovar + ocorrências abertas): o número do selo da aba. */
export async function contarPendencias(fleetId: string): Promise<number> {
  const [servicos, ocorrencias] = await Promise.all([
    supabase
      .from('maintenance_records')
      .select('id, vehicles!inner(fleet_id)', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .eq('vehicles.fleet_id', fleetId),
    supabase
      .from('incidents')
      .select('id, vehicles!inner(fleet_id)', { count: 'exact', head: true })
      .eq('status', 'aberta')
      .eq('vehicles.fleet_id', fleetId),
  ]);
  if (servicos.error) throw comoErroApp(servicos.error);
  if (ocorrencias.error) throw comoErroApp(ocorrencias.error);
  return (servicos.count ?? 0) + (ocorrencias.count ?? 0);
}
