import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './cliente';

type Papel = 'proprietario' | 'motorista';
type DadosNotificacao = { ref_tabela?: string | null; ref_id?: string | null };

/** Para onde levar o usuário ao tocar na notificação (null: só abre o app). */
export function rotaDaNotificacao(dados: DadosNotificacao, papel: Papel): string | null {
  const tabela = dados.ref_tabela ?? '';
  if (papel === 'proprietario') {
    if (tabela === 'vehicles' && dados.ref_id) return `/(dono)/carros/${dados.ref_id}`;
    if (tabela === 'maintenance_records' || tabela === 'incidents' || tabela === 'odometer_readings') {
      return '/(dono)/(abas)/pendencias';
    }
    if (tabela === 'candidaturas' || tabela === 'fleet_members') return '/(dono)/(abas)/motoristas';
    return tabela ? '/(dono)/(abas)/avisos' : null;
  }
  if (tabela === 'candidaturas' || tabela === 'fleet_members') return '/(motorista)';
  return tabela ? '/(motorista)/(frota)/meu-carro' : null;
}

/** Pede permissão e grava o token de push no perfil. Silencioso se negado, no emulador ou se falhar. */
export async function registrarPush(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Avisos',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let permissao = await Notifications.getPermissionsAsync();
    if (!permissao.granted) permissao = await Notifications.requestPermissionsAsync();
    if (!permissao.granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', uid);
  } catch {
    // Sem push o app continua funcionando: os avisos ficam na central de avisos.
  }
}
