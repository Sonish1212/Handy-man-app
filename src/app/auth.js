import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { colors, fonts, MIN_NEPALI_SIZE, radius, spacing } from '../theme';

// How long to wait for the sign-in before offering another way.
const WAIT_MS = 10000;

// Where the link in a sign-in email lands. The sign-in itself happens in
// AuthProvider, which reads it from the link's address; this page only shows
// that it is happening and then moves on to the app.
export default function AuthLinkScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isSignedIn) return <Redirect href="/" />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 80 }]}>
      {timedOut ? (
        <>
          <Text style={styles.title}>That link didn’t sign you in</Text>
          <Text style={styles.body}>
            It may have expired or been used already. Each link works once, for one hour. Ask for a new one.
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace('/login')} accessibilityRole="button">
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => router.replace('/')} accessibilityRole="button">
            <Text style={styles.link}>Go to the home page</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.title}>Signing you in…</Text>
          <Text style={styles.titleNe}>साइन इन हुँदैछ…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.gutter + 8,
    backgroundColor: colors.page,
  },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, textAlign: 'center', marginTop: 8 },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
  button: {
    alignSelf: 'stretch',
    minHeight: 52,
    marginTop: 12,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
  linkButton: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
});
