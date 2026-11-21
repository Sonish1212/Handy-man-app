import Feather from '@expo/vector-icons/Feather';
import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LanguageSwitch from '../components/pro/LanguageSwitch';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { colors, fonts, radius, spacing } from '../theme';

const STEPS = ['welcome.step1', 'welcome.step2', 'welcome.step3', 'welcome.step4'];

// The first page of the professional app for someone who is signed out:
// what joining involves, in their language, then sign-in.
export default function ProWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { t } = useT();

  if (isSignedIn) return <Redirect href="/work" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
    >
      <LanguageSwitch />

      <View style={styles.badge}>
        <Feather name="tool" size={30} color={colors.primary} />
      </View>
      <Text style={styles.title}>{t('welcome.title')}</Text>
      <Text style={styles.body}>{t('welcome.body')}</Text>

      <View style={styles.box}>
        {STEPS.map((key, index) => (
          <View key={key} style={styles.step}>
            <View style={styles.number}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{t(key)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.free}>{t('welcome.free')}</Text>
      <Pressable style={styles.button} onPress={() => router.push('/login')} accessibilityRole="button">
        <Text style={styles.buttonText}>{t('welcome.signin')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: spacing.gutter + 4, gap: 14 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.box,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.textSecondary },
  box: {
    gap: 14,
    padding: 16,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
  stepText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 23, color: colors.text },
  free: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  button: {
    minHeight: 54,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
});
