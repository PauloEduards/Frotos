import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { contarNaoLidos } from '@/api/avisos';
import { minhaFrota } from '@/api/frota';
import { contarPendencias } from '@/api/pendencias';
import { cores } from '@/lib/tema';

type NomeIcone = React.ComponentProps<typeof Ionicons>['name'];

const ABAS: { nome: string; titulo: string; icone: NomeIcone }[] = [
  { nome: 'index', titulo: 'Frota', icone: 'car' },
  { nome: 'pendencias', titulo: 'Pendências', icone: 'alert-circle' },
  { nome: 'gastos', titulo: 'Gastos', icone: 'stats-chart' },
  { nome: 'motoristas', titulo: 'Motoristas', icone: 'people' },
  { nome: 'avisos', titulo: 'Avisos', icone: 'notifications' },
];

function BotaoConfiguracoes() {
  return (
    <Link href="/(dono)/configuracoes" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Configurações"
        hitSlop={8}
        style={{ paddingHorizontal: 16 }}
      >
        <Ionicons name="settings-outline" size={24} color={cores.primaria} />
      </Pressable>
    </Link>
  );
}

export default function AbasDono() {
  const frota = useQuery({ queryKey: ['frota'], queryFn: minhaFrota });
  const fleetId = frota.data?.id;
  const total = useQuery({
    queryKey: ['pendencias', 'contagem', fleetId],
    queryFn: () => contarPendencias(fleetId as string),
    enabled: fleetId !== undefined,
    refetchInterval: 60_000,
  });
  const pendencias = total.data ?? 0;
  const naoLidos = useQuery({
    queryKey: ['avisos', 'contagem'],
    queryFn: contarNaoLidos,
    refetchInterval: 60_000,
  });
  const avisos = naoLidos.data ?? 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: cores.primaria,
        headerTitleAlign: 'center',
      }}
    >
      {ABAS.map((a) => (
        <Tabs.Screen
          key={a.nome}
          name={a.nome}
          options={{
            title: a.titulo,
            tabBarIcon: ({ color, size }) => <Ionicons name={a.icone} size={size} color={color} />,
            ...(a.nome === 'pendencias' ? { tabBarBadge: pendencias > 0 ? pendencias : undefined } : {}),
            ...(a.nome === 'avisos' ? { tabBarBadge: avisos > 0 ? avisos : undefined } : {}),
            ...(a.nome === 'index' ? { headerRight: BotaoConfiguracoes } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
