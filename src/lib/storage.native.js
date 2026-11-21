// On phones, keep the login session in expo-sqlite's localStorage.
import 'expo-sqlite/localStorage/install';

export const storage = globalThis.localStorage;
