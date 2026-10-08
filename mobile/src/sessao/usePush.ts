import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registrarPush, rotaDaNotificacao } from '@/lib/push';

import { useSessao } from './useSessao';

if (Platform.OS !== 'web') {
  // Com o app aberto, a notificação também aparece.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Registra o token de push quando alguém entra e abre a tela certa ao tocar na notificação. */
export function usePush() {
  const { perfil } = useSessao();
  const router = useRouter();
  const papel = perfil?.papel;

  useEffect(() => {
    if (Platform.OS === 'web' || !perfil?.id) return;
    void registrarPush();
  }, [perfil?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' || !papel) return;
    const assinatura = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const dados = resposta.notification.request.content.data as { ref_tabela?: string; ref_id?: string };
      const rota = rotaDaNotificacao(dados ?? {}, papel);
      if (rota) router.push(rota as Href);
    });
    return () => assinatura.remove();
  }, [papel, router]);
}
