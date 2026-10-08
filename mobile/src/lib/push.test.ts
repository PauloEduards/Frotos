import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { registrarPush, rotaDaNotificacao } from './push';

const mockUpdate = jest.fn();
const mockEq = jest.fn();
jest.mock('./cliente', () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
    from: () => ({ update: (v: unknown) => { mockUpdate(v); return { eq: (...a: unknown[]) => { mockEq(...a); return Promise.resolve({ error: null }); } }; } }),
  },
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'proj-1' } } } }));

beforeEach(() => {
  jest.clearAllMocks();
  (Device as { isDevice: boolean }).isDevice = true;
});

describe('rotaDaNotificacao', () => {
  it('dono', () => {
    expect(rotaDaNotificacao({ ref_tabela: 'vehicles', ref_id: 'v1' }, 'proprietario')).toBe('/(dono)/carros/v1');
    expect(rotaDaNotificacao({ ref_tabela: 'maintenance_records', ref_id: 'r1' }, 'proprietario')).toBe('/(dono)/(abas)/pendencias');
    expect(rotaDaNotificacao({ ref_tabela: 'incidents', ref_id: 'i1' }, 'proprietario')).toBe('/(dono)/(abas)/pendencias');
    expect(rotaDaNotificacao({ ref_tabela: 'candidaturas', ref_id: 'c1' }, 'proprietario')).toBe('/(dono)/(abas)/motoristas');
    expect(rotaDaNotificacao({ ref_tabela: 'fleet_members', ref_id: 'm1' }, 'proprietario')).toBe('/(dono)/(abas)/motoristas');
    expect(rotaDaNotificacao({ ref_tabela: 'vehicle_items', ref_id: 'x' }, 'proprietario')).toBe('/(dono)/(abas)/avisos');
  });

  it('motorista', () => {
    expect(rotaDaNotificacao({ ref_tabela: 'candidaturas', ref_id: 'c1' }, 'motorista')).toBe('/(motorista)');
    expect(rotaDaNotificacao({ ref_tabela: 'fleet_members', ref_id: 'm1' }, 'motorista')).toBe('/(motorista)');
    expect(rotaDaNotificacao({ ref_tabela: 'maintenance_requests', ref_id: 'p1' }, 'motorista')).toBe('/(motorista)/(frota)/meu-carro');
    expect(rotaDaNotificacao({ ref_tabela: 'vehicles', ref_id: 'v1' }, 'motorista')).toBe('/(motorista)/(frota)/meu-carro');
    expect(rotaDaNotificacao({}, 'motorista')).toBeNull();
  });
});

describe('registrarPush', () => {
  it('permissão negada: não grava token', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, canAskAgain: true });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await registrarPush();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('permissão concedida: grava o token no perfil', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    await registrarPush();
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(mockUpdate).toHaveBeenCalledWith({ expo_push_token: 'ExponentPushToken[abc]' });
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
  });

  it('emulador/simulador: silencioso', async () => {
    (Device as { isDevice: boolean }).isDevice = false;
    await registrarPush();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('erro ao pegar o token não quebra o app', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error('sem projectId'));
    await expect(registrarPush()).resolves.toBeUndefined();
  });
});
