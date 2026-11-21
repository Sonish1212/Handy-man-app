import FontAwesome from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CodeInput from '../components/CodeInput';
import TestAccountSignIn from '../components/TestAccountSignIn';
import {
  DEMO_CODE,
  isDemoMode,
  isProviderEnabled,
  normalizeEmail,
  normalizeNepaliMobile,
  RESEND_SECONDS,
  useAuth,
} from '../lib/auth';
import { isProApp } from '../lib/variant';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius, spacing } from '../theme';

// One screen for both sign-in and sign-up: Apple, Google, or a 6-digit code
// sent to a phone number or email. A new customer gets an account
// automatically and is asked for their name once. The design pack asks for
// login as late as possible, so this screen opens on top of whatever the
// customer was doing and returns there when done.

const SEND_ERRORS = {
  too_many: 'Too many codes requested. Wait a minute, then try again.',
  not_set_up: 'Sign-in by this method isn’t switched on yet. Try another option.',
  unknown: 'We could not send the code. Check your connection and try again.',
};

const VERIFY_ERRORS = {
  wrong_code: 'That code did not work or has expired. Check it and try again.',
  too_many: 'Too many tries. Wait a minute, then request a new code.',
  unknown: 'Something went wrong. Check your connection and try again.',
};

const SOCIAL_ERRORS = {
  not_connected: 'Apple and Google sign-in work once the app is connected to Supabase. Use a code for now.',
  not_set_up: 'This sign-in option isn’t switched on yet. Use your phone or email instead.',
  unknown: 'Sign-in didn’t finish. Please try again, or use your phone or email.',
};

const HEADINGS = {
  contact: { title: 'Welcome', titleNe: 'स्वागत छ', body: 'Sign in or create an account to book trusted help at home.' },
  code: { title: 'Check your code', titleNe: 'कोड हाल्नुहोस्', body: null },
  name: { title: 'One last thing', titleNe: 'अन्तिम चरण', body: 'What should we call you?' },
};

async function safely(action) {
  try {
    return await action();
  } catch {
    return { error: 'unknown' };
  }
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { sendCode, verifyCode, signInWithGoogle, signInWithApple, updateName } = useAuth();

  const [step, setStep] = useState('contact');
  const [method, setMethod] = useState('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [contact, setContact] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // null, 'code', 'google', 'apple' or 'name'
  const [resendIn, setResendIn] = useState(0);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const validPhone = normalizeNepaliMobile(phoneInput);
  const validEmail = normalizeEmail(emailInput);
  const validValue = method === 'phone' ? validPhone : validEmail;

  // The Apple button only appears on iPhones, and only once Apple is
  // switched on in Supabase.
  useEffect(() => {
    if (Platform.OS !== 'ios' || isDemoMode) return;
    Promise.all([AppleAuthentication.isAvailableAsync(), isProviderEnabled('apple')])
      .then(([onDevice, onServer]) => setAppleAvailable(onDevice && onServer))
      .catch(() => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Professionals already have their name on their professional record, and
  // the app switches them to the professional side by itself.
  const finish = (profile) => {
    if (profile?.full_name || profile?.professional) close();
    else setStep('name');
  };

  const switchMethod = (next) => {
    setMethod(next);
    setError(null);
  };

  const continueWith = async (provider) => {
    if (busy) return;
    setBusy(provider);
    setError(null);
    const result = await safely(provider === 'apple' ? signInWithApple : signInWithGoogle);
    setBusy(null);
    if (result.cancelled) return;
    if (result.error) {
      const message = SOCIAL_ERRORS[result.error] ?? SOCIAL_ERRORS.unknown;
      // Show what Google or Supabase said, so a setup problem can be fixed.
      setError(result.detail ? `${message} (${result.detail})` : message);
      return;
    }
    finish(result.profile);
  };

  const requestCode = async (target) => {
    setBusy('code');
    setError(null);
    const { error: sendError } = await safely(() => sendCode(target));
    setBusy(null);
    if (sendError) {
      setError(SEND_ERRORS[sendError] ?? SEND_ERRORS.unknown);
      return false;
    }
    setResendIn(RESEND_SECONDS);
    return true;
  };

  const submitContact = async () => {
    if (!validValue || busy) return;
    const target = { method, value: validValue };
    if (await requestCode(target)) {
      setContact(target);
      setCode('');
      setStep('code');
    }
  };

  const submitCode = async (value) => {
    if (value.length !== 6 || busy) return;
    setBusy('code');
    setError(null);
    const result = await safely(() => verifyCode(contact, value));
    setBusy(null);
    if (result.error) {
      setError(VERIFY_ERRORS[result.error] ?? VERIFY_ERRORS.unknown);
      setCode('');
      return;
    }
    finish(result.profile);
  };

  const changeCode = (value) => {
    setCode(value);
    if (error) setError(null);
    if (value.length === 6) submitCode(value);
  };

  const submitName = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy('name');
    const { error: nameError } = await safely(() => updateName(trimmed));
    setBusy(null);
    if (nameError) {
      setError('Could not save your name. You can add it later from Account.');
      return;
    }
    close();
  };

  const heading = HEADINGS[step];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <LinearGradient
          colors={[colors.sage, colors.sageLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 8 }]}
        >
          <Feather name="feather" size={150} color={colors.primary} style={styles.leaf} />

          <View style={styles.topBar}>
            {step === 'code' ? (
              <Pressable style={styles.iconButton} onPress={() => setStep('contact')} accessibilityLabel="Back">
                <Feather name="arrow-left" size={22} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.iconButton} />
            )}
            {step !== 'name' && (
              <Pressable style={styles.iconButton} onPress={close} accessibilityLabel="Close">
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            )}
          </View>

          <View style={styles.logo}>
            <Feather name={step === 'name' ? 'user' : step === 'code' ? 'shield' : 'home'} size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{heading.title}</Text>
          <Text style={styles.titleNe}>{heading.titleNe}</Text>
          {heading.body ? <Text style={styles.heroBody}>{heading.body}</Text> : null}
        </LinearGradient>

        <View style={styles.sheet}>
          {isDemoMode && step !== 'name' && (
            <View style={styles.demo}>
              <Feather name="info" size={16} color={colors.text} />
              <Text style={styles.demoText}>
                Demo mode: Supabase isn’t connected, so no SMS or email is sent. Use code {DEMO_CODE}.
              </Text>
            </View>
          )}

          {step === 'contact' && (
            <>
              {appleAvailable && (
                <View style={busy && busy !== 'apple' ? styles.dimmed : null}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={radius.box}
                    style={styles.appleButton}
                    onPress={() => continueWith('apple')}
                  />
                </View>
              )}

              <Pressable
                style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, busy && styles.dimmed]}
                onPress={() => continueWith('google')}
                disabled={Boolean(busy)}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                {busy === 'google' ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <FontAwesome name="google" size={20} color="#4285F4" />
                    <Text style={styles.googleText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or get a code</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.segment} accessibilityRole="tablist">
                {[
                  { id: 'phone', label: 'Phone', icon: 'smartphone' },
                  { id: 'email', label: 'Email', icon: 'mail' },
                ].map((option) => {
                  const active = method === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      onPress={() => switchMethod(option.id)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Feather name={option.icon} size={16} color={active ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {method === 'phone' ? (
                <>
                  <View style={[styles.inputRow, error && styles.inputError]}>
                    <View style={styles.prefix}>
                      <Text style={styles.prefixText}>+977</Text>
                    </View>
                    <TextInput
                      key="phone"
                      value={phoneInput}
                      onChangeText={(text) => {
                        setPhoneInput(text);
                        if (error) setError(null);
                      }}
                      placeholder="Mobile number"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="phone-pad"
                      textContentType="telephoneNumber"
                      autoComplete="tel"
                      maxLength={14}
                      style={styles.input}
                      onSubmitEditing={submitContact}
                      returnKeyType="next"
                      accessibilityLabel="Mobile number"
                    />
                  </View>
                  {phoneInput.length >= 10 && !validPhone && !error ? (
                    <Text style={styles.hint}>Enter a Nepali mobile number starting with 97 or 98.</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={[styles.inputRow, error && styles.inputError]}>
                    <View style={styles.prefix}>
                      <Feather name="mail" size={18} color={colors.textSecondary} />
                    </View>
                    <TextInput
                      key="email"
                      value={emailInput}
                      onChangeText={(text) => {
                        setEmailInput(text);
                        if (error) setError(null);
                      }}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                      onSubmitEditing={submitContact}
                      returnKeyType="next"
                      accessibilityLabel="Email address"
                    />
                  </View>
                  {emailInput.includes('@') && emailInput.includes('.') && !validEmail && !error ? (
                    <Text style={styles.hint}>Check the email address.</Text>
                  ) : null}
                </>
              )}

              <PrimaryButton
                label="Send code"
                onPress={submitContact}
                disabled={!validValue || (Boolean(busy) && busy !== 'code')}
                busy={busy === 'code'}
              />

              <Text style={styles.legal}>
                New here? Your account is created automatically. We only use your details to arrange your bookings.
              </Text>
              {isProApp ? null : (
                <View style={styles.proNote}>
                  <Feather name="tool" size={18} color={colors.primary} />
                  <Text style={styles.proNoteText}>
                    <Text style={styles.proNoteTitle}>Do you do this work yourself?</Text> Plumbers, electricians,
                    cleaners and other professionals join through our separate Handyman Pro app.
                  </Text>
                </View>
              )}

              {__DEV__ && !isDemoMode ? <TestAccountSignIn onSignedIn={finish} /> : null}
            </>
          )}

          {step === 'code' && (
            <>
              <Text style={styles.body}>
                We sent a 6-digit code {contact?.method === 'email' ? 'by email' : 'by SMS'} to{' '}
                <Text style={styles.bold}>{formatContact(contact)}</Text>.{' '}
                <Text style={styles.link} onPress={() => setStep('contact')}>
                  Change
                </Text>
              </Text>
              {contact?.method === 'email' ? (
                <Text style={styles.hint}>It can take a minute. Check your spam folder too.</Text>
              ) : null}

              <View style={styles.codeWrap}>
                <CodeInput value={code} onChange={changeCode} hasError={Boolean(error)} />
              </View>

              {busy === 'code' ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}

              <View style={styles.resendRow}>
                {resendIn > 0 ? (
                  <Text style={styles.hint}>Send a new code in {resendIn}s</Text>
                ) : (
                  <Pressable onPress={() => requestCode(contact)} hitSlop={12} disabled={Boolean(busy)}>
                    <Text style={styles.link}>Send a new code</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {step === 'name' && (
            <>
              <Text style={styles.body}>Professionals see this name when they come to your home.</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={colors.textSecondary}
                textContentType="name"
                autoComplete="name"
                autoCapitalize="words"
                autoFocus
                style={[styles.textInput, styles.nameInput]}
                onSubmitEditing={submitName}
                returnKeyType="done"
                accessibilityLabel="Your name"
              />

              <PrimaryButton label="Continue" onPress={submitName} disabled={!name.trim()} busy={busy === 'name'} />
              <Pressable style={styles.secondary} onPress={close}>
                <Text style={styles.link}>Skip for now</Text>
              </Pressable>
            </>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color={colors.terracotta} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({ label, onPress, disabled, busy }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, (disabled || busy) && styles.buttonDisabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

function formatContact(contact) {
  if (!contact) return '';
  if (contact.method === 'email') return contact.value;
  const local = contact.value.replace('+977', '');
  return `+977 ${local.slice(0, 5)} ${local.slice(5)}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  scroll: { flexGrow: 1 },
  pressed: { opacity: 0.8 },
  dimmed: { opacity: 0.5 },

  hero: {
    paddingHorizontal: spacing.gutter + 4,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  leaf: { position: 'absolute', right: -30, top: 40, opacity: 0.07, transform: [{ rotate: '-20deg' }] },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -10, marginBottom: 8 },
  iconButton: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: fonts.bold, fontSize: 30, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary, marginTop: 2 },
  heroBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginTop: 10 },

  sheet: {
    flexGrow: 1,
    marginTop: -20,
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.gutter + 4,
    paddingTop: 24,
    gap: 12,
  },

  demo: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FDF0DC',
    borderColor: colors.marigold,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 12,
  },
  demoText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },

  appleButton: { width: '100%', height: 52 },
  googleButton: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: '#D3D9CE',
    borderRadius: radius.box,
  },
  googleText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },

  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    backgroundColor: colors.sageLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: MIN_TAP - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
  },
  segmentButtonActive: { backgroundColor: colors.box, borderWidth: 1, borderColor: colors.border },
  segmentText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  segmentTextActive: { fontFamily: fonts.semibold, color: colors.primary },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 52,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    overflow: 'hidden',
  },
  inputError: { borderColor: colors.terracotta },
  prefix: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
    paddingHorizontal: 12,
    backgroundColor: colors.sageLight,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  prefixText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  input: { flex: 1, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  textInput: {
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  nameInput: { marginTop: 4 },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },

  button: {
    minHeight: 52,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
  secondary: { minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  proNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginTop: 4,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sageLight,
  },
  proNoteText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.text },
  proNoteTitle: { fontFamily: fonts.semibold, color: colors.primary },
  legal: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  bold: { fontFamily: fonts.semibold, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  codeWrap: { marginTop: 12 },
  spinner: { marginTop: 8 },
  resendRow: { marginTop: 8, alignItems: 'flex-start' },

  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: '#F8E6DF',
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.terracotta },
});
