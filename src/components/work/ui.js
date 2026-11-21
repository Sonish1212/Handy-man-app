import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, MIN_TAP, radius } from '../../theme';

// Small building blocks shared by the team and professional screens.

export function WorkHeader({ title, subtitle, fallback = '/account' }) {
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback));
  return (
    <View style={styles.headerRow}>
      <Pressable style={styles.iconButton} onPress={back} accessibilityRole="button" accessibilityLabel="Back">
        <Feather name="arrow-left" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.flex}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const BUTTON_TONES = {
  primary: { background: colors.primary, border: colors.primary, text: '#FFFFFF' },
  secondary: { background: colors.box, border: colors.border, text: colors.text },
  danger: { background: colors.box, border: colors.terracotta, text: colors.terracotta },
};

export function WorkButton({ label, onPress, tone = 'primary', busy = false, disabled = false, icon, style }) {
  const palette = BUTTON_TONES[tone];
  const off = disabled || busy;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        off && styles.dimmed,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
    >
      {busy ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={palette.text} /> : null}
          <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// A message after an action: good news in green, problems in terracotta.
export function Notice({ notice }) {
  if (!notice) return null;
  const bad = notice.tone === 'error';
  return (
    <View style={[styles.notice, bad ? styles.noticeBad : styles.noticeGood]} accessibilityLiveRegion="polite">
      <Feather name={bad ? 'alert-circle' : 'check-circle'} size={18} color={bad ? colors.terracotta : colors.primary} />
      <Text style={styles.noticeText}>{notice.text}</Text>
    </View>
  );
}

// `error`, when given, turns the box red and replaces the hint, so the
// person sees exactly which answer needs fixing.
export function Field({ label, hint, error, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#8A968F"
        style={[styles.input, error && styles.inputError]}
        accessibilityHint={error || undefined}
        {...inputProps}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Call and SMS buttons for a phone number. SMS opens the phone's own
// messages app with the text filled in; nothing is sent automatically.
export function ContactButtons({ phone, name, smsBody }) {
  if (!phone) return null;
  // iOS reads the text after "&", Android after "?".
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const sms = smsBody ? `sms:${phone}${separator}body=${encodeURIComponent(smsBody)}` : `sms:${phone}`;
  return (
    <View style={styles.contactRow}>
      <Pressable
        style={styles.contactButton}
        onPress={() => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Could not open your phone app', `Please dial ${phone} from your phone.`))}
        accessibilityRole="button"
        accessibilityLabel={`Call ${name ?? phone}`}
      >
        <Feather name="phone" size={18} color={colors.primary} />
      </Pressable>
      <Pressable
        style={styles.contactButton}
        onPress={() => Linking.openURL(sms).catch(() => Alert.alert('Could not open Messages', `Please contact ${name ?? phone} from your phone.`))}
        accessibilityRole="button"
        accessibilityLabel={`Send a text message to ${name ?? phone}`}
      >
        <Feather name="message-square" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export function Box({ title, children, style }) {
  return (
    <View style={[styles.box, style]}>
      {title ? <Text style={styles.boxTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function InfoLine({ icon, children, strong = false }) {
  if (!children) return null;
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={16} color={colors.textSecondary} style={styles.infoIcon} />
      <Text style={[styles.infoText, strong && styles.infoStrong]}>{children}</Text>
    </View>
  );
}

export function AsapTag() {
  return (
    <View style={styles.asapTag}>
      <Feather name="zap" size={12} color={colors.terracotta} />
      <Text style={styles.asapText}>ASAP</Text>
    </View>
  );
}

export const workStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginTop: 8 },
  sectionHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: -6 },
  empty: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.terracotta },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -10 },
  iconButton: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  headerSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  button: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: MIN_TAP + 4,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15 },
  dimmed: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  noticeGood: { backgroundColor: colors.sage, borderColor: colors.primary },
  noticeBad: { backgroundColor: '#F8E6DF', borderColor: colors.terracotta },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  input: {
    minHeight: MIN_TAP + 4,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  inputError: { borderColor: colors.terracotta, borderWidth: 2 },
  fieldError: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.terracotta },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: MIN_TAP - 4,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.sage },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipTextActive: { fontFamily: fonts.semibold, color: colors.primary },
  contactRow: { flexDirection: 'row', gap: 8 },
  contactButton: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    padding: 16,
    gap: 10,
  },
  boxTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: { marginTop: 2 },
  infoText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  infoStrong: { fontFamily: fonts.semibold },
  asapTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#F8E6DF',
  },
  asapText: { fontFamily: fonts.bold, fontSize: 11, color: colors.terracotta },
});
