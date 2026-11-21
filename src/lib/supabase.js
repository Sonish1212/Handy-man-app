import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { storage } from './storage';
import { fetchWithTimeout } from './request';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// False until .env.local has the project URL and publishable key. The app
// still runs without them, using the built-in placeholder content.
export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      // Document photos can take a while on a slow connection, so storage
      // uploads get longer than ordinary requests before giving up.
      global: {
        fetch: (input, init) =>
          fetchWithTimeout(input, init, String(input?.url ?? input).includes('/storage/v1/') ? 90000 : 15000),
      },
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// On phones, only refresh the login session while the app is open, so a
// customer isn't signed out after the app sat in the background.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
