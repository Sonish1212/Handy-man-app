import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';
import { storage } from './storage';
import { fetchWithTimeout } from './request';

// Lets the Google sign-in pop-up close itself when it returns (web only).
WebBrowser.maybeCompleteAuthSession();

// Until Supabase is connected the app runs in demo mode: no SMS or email is
// sent, DEMO_CODE signs in, and the "account" only lives in memory.
export const DEMO_CODE = '123456';
export const isDemoMode = !isSupabaseConfigured;

// Seconds before a new code can be requested (Supabase's default limit).
export const RESEND_SECONDS = 60;

const PROFILE_COLUMNS = 'id, full_name, phone, email, role';
// contact_phone: the mobile number email and Google sign-ins give (see
// migration 20261122000200_account_phone.sql).
const PROFILE_COLUMNS_WITH_MOBILE = `${PROFILE_COLUMNS}, contact_phone`;

const AuthContext = createContext(null);

// Accepts 98XXXXXXXX, 9779XXXXXXXXX or +9779XXXXXXXXX (spaces and dashes
// allowed) and returns +977 9XXXXXXXXX form, or null if it is not a Nepali
// mobile number.
export function normalizeNepaliMobile(input) {
  let digits = input.replace(/[^\d]/g, '');
  if (digits.startsWith('977')) digits = digits.slice(3);
  if (!/^9[78]\d{8}$/.test(digits)) return null;
  return `+977${digits}`;
}

// Returns the email trimmed and lower-cased, or null if it doesn't look valid.
export function normalizeEmail(input) {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

// Turns a Supabase auth error into a short reason the login screen can explain.
function reasonFor(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (error?.status === 429 || text.includes('rate limit') || text.includes('security purposes')) return 'too_many';
  if (text.includes('expired') || text.includes('invalid') || text.includes('otp')) return 'wrong_code';
  if (text.includes('provider') || text.includes('disabled') || text.includes('not enabled')) return 'not_set_up';
  return 'unknown';
}

// Asks Supabase whether a sign-in provider (google, apple, phone, email) is
// switched on, so the app can explain instead of opening a page that errors.
export async function isProviderEnabled(provider) {
  try {
    const response = await fetchWithTimeout(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    });
    if (!response.ok) return true;
    const settings = await response.json();
    return Boolean(settings?.external?.[provider]);
  } catch {
    return true; // Can't tell; let the sign-in attempt report any problem.
  }
}

// Reads the values Supabase adds after "?" and "#" in the address it sends
// back to the app after Google sign-in (code, tokens or an error).
function getQueryParams(url) {
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const query = queryAt >= 0 ? url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : '';
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const params = {};
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { params, errorCode: params.error_code ?? null };
}

// Signs in from the address Supabase sends back to the app: after Google, or
// when the customer taps the link in a sign-in email. Returns { user },
// { error, detail } or null when the address carries no sign-in at all.
async function sessionFromUrl(url) {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode || params.error) {
    return { error: 'unknown', detail: params.error_description?.replace(/\+/g, ' ') ?? params.error ?? errorCode };
  }
  if (params.code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(params.code);
    return exchanged.error ? { error: reasonFor(exchanged.error) } : { user: exchanged.data.user };
  }
  if (params.access_token && params.refresh_token) {
    const restored = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return restored.error ? { error: reasonFor(restored.error) } : { user: restored.data.user };
  }
  return null;
}

// contact is { method: 'phone' | 'email', value } with an already normalised value.
const otpTarget = (contact) => (contact.method === 'email' ? { email: contact.value } : { phone: contact.value });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!isDemoMode);
  const authRevision = useRef(0);

  // The profile, plus `professional` (their professional record, or null)
  // so the app opens the professional side straight away for them.
  const fetchProfile = useCallback(async (userId) => {
    try {
      const [first, professionalResult] = await Promise.all([
        supabase.from('profiles').select(PROFILE_COLUMNS_WITH_MOBILE).eq('id', userId).single(),
        supabase.rpc('my_professional'),
      ]);
      // A database without the newest update has no contact_phone column yet.
      const profileResult =
        first.error?.code === '42703'
          ? await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single()
          : first;
      if (profileResult.error) return null;
      return { ...profileResult.data, professional: professionalResult.data?.[0] ?? null };
    } catch {
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (isDemoMode || !session) return;
    const fresh = await fetchProfile(session.user.id);
    const current = await supabase.auth.getSession();
    if (fresh && current.data.session?.user.id === fresh.id) setProfile(fresh);
  }, [session, fetchProfile]);

  useEffect(() => {
    if (isDemoMode) return;

    // The app waits for the saved sign-in before showing a screen, so this
    // must always finish: on an error, and after 6 seconds on a slow network
    // (the profile then arrives a little later through the listener below).
    let settled = false;
    let active = true;
    const initialRevision = authRevision.current;
    const finishLoading = () => {
      settled = true;
      if (active) setLoading(false);
    };
    const giveUp = setTimeout(finishLoading, 6000);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active || authRevision.current !== initialRevision) return;
        setSession(data.session);
        if (data.session) {
          const fresh = await fetchProfile(data.session.user.id);
          if (active && authRevision.current === initialRevision && fresh) setProfile(fresh);
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(giveUp);
        if (!settled) finishLoading();
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const revision = ++authRevision.current;
      setSession(nextSession);
      setProfile((current) => current?.id === nextSession?.user.id ? current : null);
      if (!nextSession) {
        setProfile(null);
        return;
      }
      // Supabase advises against calling it again inside this callback, so
      // load the profile just after it returns.
      setTimeout(async () => {
        const fresh = await fetchProfile(nextSession.user.id);
        if (active && authRevision.current === revision && fresh) setProfile(fresh);
      }, 0);
    });
    return () => {
      active = false;
      clearTimeout(giveUp);
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Tapping the link in a sign-in email opens the app with the sign-in in its
  // address (whether the app was closed or already open). The session change
  // then reaches the listener above like any other sign-in.
  useEffect(() => {
    if (isDemoMode) return undefined;
    const handle = async (url) => {
      if (!url || !/[#?&](access_token|code|error)=/.test(url)) return;
      const result = await sessionFromUrl(url).catch(() => ({ error: 'unknown' }));
      if (result?.error) {
        Alert.alert(
          'That sign-in link didn’t work',
          'It may have expired or been used already. Open the sign-in screen and ask for a new code.' +
            (result.detail ? ` (${result.detail})` : ''),
        );
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, []);

  // Sends a 6-digit code by SMS or email. New customers are signed up
  // automatically, so sign-in and sign-up are the same step.
  const sendCode = useCallback(async (contact) => {
    if (isDemoMode) return { error: null };
    if (!(await isProviderEnabled(contact.method))) return { error: 'not_set_up' };
    const options = { shouldCreateUser: true };
    // Emails may contain a link as well as the code. The link must come back
    // to this app (not to the Site URL in Supabase, which phones can't open),
    // and to a page inside it: src/app/auth.js. Without a page, Expo Go
    // treats the address as a new project to load and shows an error.
    if (contact.method === 'email') options.emailRedirectTo = makeRedirectUri({ path: 'auth' });
    const { error } = await supabase.auth.signInWithOtp({ ...otpTarget(contact), options });
    return { error: error ? reasonFor(error) : null };
  }, []);

  // Returns the signed-in profile too, so the login screen can tell straight
  // away whether to ask for the customer's name.
  const verifyCode = useCallback(
    async (contact, code) => {
      if (isDemoMode) {
        if (code !== DEMO_CODE) return { error: 'wrong_code' };
        const demoProfile = profile ?? {
          id: 'demo',
          phone: contact.method === 'phone' ? contact.value : null,
          email: contact.method === 'email' ? contact.value : null,
          full_name: null,
          role: 'customer',
        };
        setSession({ user: { id: 'demo', phone: demoProfile.phone, email: demoProfile.email } });
        setProfile(demoProfile);
        return { error: null, profile: demoProfile };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        ...otpTarget(contact),
        token: code,
        type: contact.method === 'email' ? 'email' : 'sms',
      });
      if (error) return { error: reasonFor(error) };
      const fresh = await fetchProfile(data.user.id);
      setProfile(fresh);
      return { error: null, profile: fresh };
    },
    [profile, fetchProfile],
  );

  // Google: Supabase's sign-in page opens in a secure browser sheet and sends
  // the customer back to the app with their session. Returns
  // { profile }, { cancelled: true } or { error }.
  const signInWithGoogle = useCallback(async () => {
    if (isDemoMode) return { error: 'not_connected' };
    if (!(await isProviderEnabled('google'))) return { error: 'not_set_up' };
    const redirectTo = makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error) return { error: reasonFor(error) };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { cancelled: true };

    const signedIn = await sessionFromUrl(result.url);
    if (!signedIn) return { error: 'unknown' };
    if (signedIn.error) return signedIn;

    const fresh = await fetchProfile(signedIn.user.id);
    setProfile(fresh);
    return { profile: fresh };
  }, [fetchProfile]);

  // Apple: the native iPhone sheet (Face ID / Touch ID), then Supabase checks
  // Apple's token. Apple shares the name only on the very first sign-in.
  const signInWithApple = useCallback(async () => {
    if (isDemoMode) return { error: 'not_connected' };
    if (!(await isProviderEnabled('apple'))) return { error: 'not_set_up' };
    let credential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (e) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return { cancelled: true };
      return { error: 'unknown' };
    }
    if (!credential.identityToken) return { error: 'unknown' };

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { error: reasonFor(error) };

    let fresh = await fetchProfile(data.user.id);
    const appleName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (fresh && !fresh.full_name && appleName) {
      await supabase.from('profiles').update({ full_name: appleName }).eq('id', data.user.id);
      fresh = { ...fresh, full_name: appleName };
    }
    setProfile(fresh);
    return { profile: fresh };
  }, [fetchProfile]);

  const updateName = useCallback(
    async (fullName) => {
      if (isDemoMode) {
        setProfile((current) => ({ ...current, full_name: fullName }));
        return { error: null };
      }
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', session.user.id);
      if (!error) setProfile((current) => ({ ...current, full_name: fullName }));
      return { error };
    },
    [session],
  );

  // Development only: signs in to a test user created in the Supabase
  // dashboard with an email and password (Authentication → Users → Add user).
  // Customers never see this; they use Google or a code.
  const signInWithTestAccount = useCallback(
    async (email, password) => {
      if (isDemoMode) return { error: 'not_connected' };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const text = error.message?.toLowerCase() ?? '';
        if (text.includes('invalid login')) return { error: 'wrong_password' };
        if (text.includes('not confirmed')) return { error: 'not_confirmed' };
        return { error: reasonFor(error) };
      }
      const fresh = await fetchProfile(data.user.id);
      setProfile(fresh);
      return { profile: fresh };
    },
    [fetchProfile],
  );

  const signOut = useCallback(async () => {
    ++authRevision.current;
    setSession(null);
    setProfile(null);
    // Shared devices must not carry one person's address/problem draft into
    // the next person's account. Do not touch Supabase's session-storage keys.
    try {
      const keys = Array.from({ length: storage?.length ?? 0 }, (_, index) => storage.key(index));
      keys.filter((key) => key?.startsWith('bookingDraft:')).forEach((key) => storage.removeItem(key));
    } catch {
      // Signing out still proceeds if browser storage is unavailable.
    }
    if (!isDemoMode) await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      isSignedIn: Boolean(session),
      sendCode,
      verifyCode,
      signInWithGoogle,
      signInWithApple,
      signInWithTestAccount,
      updateName,
      refreshProfile,
      signOut,
    }),
    [
      session,
      profile,
      loading,
      sendCode,
      verifyCode,
      signInWithGoogle,
      signInWithApple,
      signInWithTestAccount,
      updateName,
      refreshProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
