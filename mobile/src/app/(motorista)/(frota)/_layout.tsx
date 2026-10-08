import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Redirect, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { contarNaoLidos } from '@/api/avisos';
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

/** Motorista na frota: Meu carro · Carros · Avisos. */
export default function AbasFrota() {
  const situacao = useQuery({ queryKey: ['situacao'], queryFn: minhaSituacao, refetchInterval: 60_000 });
  const naoLidos = useQuery({ queryKey: ['avisos', 'contagem'], queryFn: contarNaoLidos, refetchInterval: 60_000 });
  // Removido da frota: volta para a busca de carros.
  if (situacao.data && !situacao.data.frotaAtiva) return <Redirect href="/(motorista)/(busca)/buscar" />;
  const avisos = naoLidos.data ?? 0;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: cores.primaria, headerTitleAlign: 'center', headerRight: BotaoPerfil }}>
      <Tabs.Screen
        name="meu-carro"
        options={{ title: 'Meu carro', tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="carros"
        options={{ title: 'Carros', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
          tabBarBadge: avisos > 0 ? avisos : undefined,
        }}
      />
    </Tabs>
  );
}
