import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { cores } from '@/lib/tema';

type NomeIcone = React.ComponentProps<typeof Ionicons>['name'];

const ABAS: { nome: string; titulo: string; icone: NomeIcone }[] = [
  { nome: 'index', titulo: 'Frota', icone: 'car' },
  { nome: 'pendencias', titulo: 'Pendências', icone: 'alert-circle' },
  { nome: 'gastos', titulo: 'Gastos', icone: 'stats-chart' },
  { nome: 'motoristas', titulo: 'Motoristas', icone: 'people' },
  { nome: 'avisos', titulo: 'Avisos', icone: 'notifications' },
];

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
          }}
        />
      ))}
    </Tabs>
  );
}
