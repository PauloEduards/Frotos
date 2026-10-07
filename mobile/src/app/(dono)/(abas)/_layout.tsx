import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

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
            ...(a.nome === 'index' ? { headerRight: BotaoConfiguracoes } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
