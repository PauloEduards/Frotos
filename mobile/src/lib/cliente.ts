import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chaveAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !chaveAnon) {
  throw new Error(
    'Configuração ausente: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY em mobile/.env (veja mobile/.env.example).',
  );
}

export const supabase = createClient<Database>(url, chaveAnon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
