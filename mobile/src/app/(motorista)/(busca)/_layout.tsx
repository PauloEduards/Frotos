import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Redirect, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { minhaSituacao } from '@/api/motorista';
import { cores } from '@/lib/tema';

function BotaoPerfil() {
  return (
    <Link href="/(motorista)/perfil" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Meu perfil" hitSlop={12} style={{ paddingHorizontal: 16 }}>
        <Ionicons name="person-circle" size={28} color={cores.primaria} />
      </Pressable>
    </Link>
  );
}

/** Motorista ainda sem frota: procura carros e acompanha candidaturas. */
export default function AbasBusca() {
  // Quando o dono aceita, a situação muda e o motorista vai para as abas da frota.
  const situacao = useQuery({ queryKey: ['situacao'], queryFn: minhaSituacao, refetchInterval: 30_000 });
  if (situacao.data?.frotaAtiva) return <Redirect href="/(motorista)/(frota)/meu-carro" />;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: cores.primaria, headerTitleAlign: 'center', headerRight: BotaoPerfil }}>
      <Tabs.Screen
        name="buscar"
        options={{
          title: 'Buscar carros',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="candidaturas"
        options={{
          title: 'Minhas candidaturas',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
