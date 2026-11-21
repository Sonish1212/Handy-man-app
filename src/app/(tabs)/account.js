import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../lib/auth';
import { callRpc, useWorkRole } from '../../lib/work';
import { colors, fonts, MIN_NEPALI_SIZE, MIN_TAP, radius, spacing } from '../../theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn, profile, session, signOut, refreshProfile } = useAuth();
  const { isTeam } = useWorkRole();
  const signInPhone = profile?.phone ?? session?.user.phone ?? null;
  const phone = signInPhone ?? profile?.contact_phone ?? null;
  const email = profile?.email ?? session?.user.email;
  const contactLine = phone ? formatPhone(phone) : (email ?? '');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.titleNe}>खाता</Text>

      {isSignedIn ? (
        <>
          <View style={styles.box}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Feather name="user" size={24} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{profile?.full_name || 'Add your name'}</Text>
                <Text style={styles.phone}>{contactLine}</Text>
              </View>
            </View>
            {/* Email and Google sign-ins add their mobile here (or at their first booking). */}
            {signInPhone ? null : (
              <MobileNumber value={profile?.contact_phone ?? null} email={email} onSaved={refreshProfile} />
            )}
          </View>

          {isTeam ? (
            <View style={[styles.box, styles.list]}>
              <LinkRow
                icon="briefcase"
                label="Team"
                detail="Payments, assigning and live jobs"
                onPress={() => router.push('/team')}
                last
              />
            </View>
          ) : null}

          <View style={[styles.box, styles.list]}>
            <Row icon="map-pin" label="Saved addresses" />
            <Row icon="credit-card" label="Payment methods" />
            <Row icon="phone" label="Help and support" last />
          </View>

          <Pressable style={styles.signOut} onPress={signOut} accessibilityRole="button">
            <Feather name="log-out" size={18} color={colors.terracotta} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <View style={[styles.box, styles.signedOut]}>
          <View style={styles.badge}>
            <Feather name="smartphone" size={26} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Sign in to book and track jobs</Text>
          <Text style={styles.cardBody}>
            Your bookings, saved addresses and receipts stay in one place. All you need is your phone number or email.
          </Text>
          <Pressable style={styles.button} onPress={() => router.push('/login')} accessibilityRole="button">
            <Text style={styles.buttonText}>Sign in or sign up</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// Shown only to the team.
function LinkRow({ icon, label, detail, onPress, last = false }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Feather name={icon} size={20} color={colors.primary} />
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

// The account's mobile number for email and Google sign-ins: the team and
// professionals call it. A phone sign-in's number is fixed and shown above.
function MobileNumber({ value, email, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const start = () => {
    setDraft(value ? value.replace(/^\+977/, '') : '');
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    const result = await callRpc('set_my_contact_phone', { p_phone: draft });
    setBusy(false);
    if (result.error) return setError(result.error);
    setEditing(false);
    return onSaved?.();
  };

  if (!editing) {
    return (
      <Pressable style={styles.mobileRow} onPress={start} accessibilityRole="button">
        <Feather name="phone" size={18} color={value ? colors.primary : colors.terracotta} />
        <View style={styles.flex}>
          <Text style={styles.mobileLabel}>Mobile number</Text>
          <Text style={value ? styles.mobileValue : styles.mobileMissing}>
            {value ? formatPhone(value) : 'Add your mobile number'}
          </Text>
          {value && email ? <Text style={styles.rowDetail}>Signed in with {email}</Text> : null}
        </View>
        <Text style={styles.mobileAction}>{value ? 'Change' : 'Add'}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.mobileEdit}>
      <Text style={styles.mobileLabel}>Mobile number</Text>
      <View style={[styles.mobileInputRow, error && styles.mobileInputError]}>
        <Text style={styles.mobilePrefix}>+977</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="98XXXXXXXX"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={14}
          autoFocus
          style={styles.mobileInput}
          accessibilityLabel="Mobile number"
        />
      </View>
      <Text style={error ? styles.mobileError : styles.rowDetail}>
        {error ?? 'Our team and your professional call this number about your bookings.'}
      </Text>
      <View style={styles.mobileButtons}>
        <Pressable style={styles.mobileCancel} onPress={() => setEditing(false)} accessibilityRole="button">
          <Text style={styles.mobileCancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.mobileSave} onPress={save} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.mobileSaveText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// Placeholder rows for pages that are not built yet.
function Row({ icon, label, last = false }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Feather name={icon} size={20} color={colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.soon}>Soon</Text>
    </View>
  );
}

function formatPhone(e164) {
  const local = e164.replace(/^\+?977/, '');
  return `+977 ${local.slice(0, 5)} ${local.slice(5)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: 32, gap: spacing.boxGap },
  flex: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  titleNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE + 2, color: colors.textSecondary, marginBottom: 12 },
  box: {
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
    padding: 16,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.box,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  phone: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  list: { paddingVertical: 4 },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: MIN_TAP,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mobileLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  mobileValue: { fontFamily: fonts.medium, fontSize: 15, color: colors.text, marginTop: 1 },
  mobileMissing: { fontFamily: fonts.semibold, fontSize: 15, color: colors.terracotta, marginTop: 1 },
  mobileAction: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  mobileEdit: { gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  mobileInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
  },
  mobileInputError: { borderColor: colors.terracotta },
  mobilePrefix: { fontFamily: fonts.semibold, fontSize: 16, color: colors.textSecondary },
  mobileInput: { flex: 1, minHeight: 48, fontFamily: fonts.regular, fontSize: 17, color: colors.text },
  mobileError: { fontFamily: fonts.medium, fontSize: 13, color: colors.terracotta },
  mobileButtons: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  mobileCancel: { minHeight: MIN_TAP, paddingHorizontal: 16, justifyContent: 'center' },
  mobileCancelText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary },
  mobileSave: {
    minHeight: MIN_TAP,
    minWidth: 96,
    paddingHorizontal: 20,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileSaveText: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 6 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  rowDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  pressed: { opacity: 0.7 },
  soon: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  signOut: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP + 4,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.terracotta,
    marginTop: 8,
  },
  signOutText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.terracotta },
  signedOut: { alignItems: 'flex-start' },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.box,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  cardBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 6 },
  button: {
    alignSelf: 'stretch',
    minHeight: 52,
    marginTop: 20,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
});
