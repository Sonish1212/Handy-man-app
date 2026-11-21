import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../lib/auth';
import { colors, fonts, MIN_TAP, radius } from '../theme';

const ERRORS = {
  wrong_password: 'Email or password is wrong. Check the test user in Supabase → Authentication → Users.',
  not_confirmed: 'This user isn’t confirmed. Recreate it in Supabase with “Auto Confirm User” ticked.',
  too_many: 'Too many tries. Wait a minute and try again.',
  unknown: 'Could not sign in. Check your connection and try again.',
};

// Development-only sign-in for a test user made in the Supabase dashboard.
// The login screen only renders this in development builds (__DEV__), so it
// never reaches customers.
export default function TestAccountSignIn({ onSignedIn }) {
  const { signInWithTestAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    const result = await signInWithTestAccount(email.trim().toLowerCase(), password);
    setBusy(false);
    if (result.error) {
      setError(ERRORS[result.error] ?? ERRORS.unknown);
      return;
    }
    onSignedIn(result.profile);
  };

  if (!open) {
    return (
      <Pressable style={styles.toggle} onPress={() => setOpen(true)} accessibilityRole="button">
        <Feather name="tool" size={14} color={colors.textSecondary} />
        <Text style={styles.toggleText}>Developer: sign in to a test account</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>Test account</Text>
        <Text style={styles.badge}>DEV ONLY</Text>
      </View>
      <Text style={styles.body}>For a test user created in Supabase. Customers never see this.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="test email"
        placeholderTextColor={colors.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel="Test account email"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="password"
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        onSubmitEditing={submit}
        accessibilityLabel="Test account password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, (!email.trim() || !password) && styles.dimmed]}
        onPress={submit}
        disabled={!email.trim() || !password || busy}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>Sign in to test account</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP,
  },
  toggleText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' },
  box: {
    gap: 10,
    padding: 14,
    borderRadius: radius.box,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textSecondary,
    backgroundColor: colors.box,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  badge: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.terracotta,
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.terracotta },
  button: {
    minHeight: 48,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  dimmed: { opacity: 0.5 },
});
