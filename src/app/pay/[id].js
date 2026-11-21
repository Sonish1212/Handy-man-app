import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import { advancePayment, formatRupees } from '../../lib/bookings';
import { useBookingSettings } from '../../lib/catalog';
import { formatSlot } from '../../lib/nepalTime';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors, fonts, MIN_TAP, radius, spacing } from '../../theme';

const METHODS = [
  { id: 'esewa', label: 'eSewa', setting: 'esewa_id' },
  { id: 'khalti', label: 'Khalti', setting: 'khalti_id' },
  { id: 'ime_pay', label: 'IME Pay', setting: null },
  { id: 'bank', label: 'Bank', setting: null },
];

// Pilot payment: the customer sends the advance to the company's eSewa /
// Khalti account and enters the transaction ID; the team checks it and marks
// it paid, which confirms the booking. Replaced by in-app eSewa/Khalti
// payment once the company's merchant accounts are ready.
export default function PayScreen() {
  const { id, fresh } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const settings = useBookingSettings();
  const [booking, setBooking] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [method, setMethod] = useState('esewa');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError('Payments work once the app is connected to Supabase.');
      return;
    }
    const { data, error: queryError } = await supabase
      .from('bookings')
      .select(
        'id, status, deposit_amount, slot_start, slot_end, is_urgent, service:services (name), task:service_tasks (name), payments (id, kind, status, method, amount, provider_reference)',
      )
      .eq('id', id)
      .maybeSingle();
    if (queryError || !data) setLoadError('We couldn’t find this booking.');
    else setBooking(data);
  }, [id]);

  useEffect(() => {
    // Loading starts here and finishes in load()'s own callbacks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const toBookings = () => router.replace('/bookings');

  const submit = async () => {
    if (busy || reference.trim().length < 4) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('submit_advance_payment', {
      p_booking_id: id,
      p_method: method,
      p_reference: reference.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || 'Could not send the payment details. Please try again.');
      return;
    }
    setSent(true);
    load();
  };

  if (loadError || !booking) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top + 40 }]}>
        {loadError ? (
          <>
            <Text style={styles.title}>{loadError}</Text>
            <Pressable style={styles.secondary} onPress={toBookings}>
              <Text style={styles.link}>Go to my bookings</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const advance = advancePayment(booking);
  const payTo = METHODS.find((item) => item.id === method);
  const account = payTo.setting ? settings[payTo.setting] : null;
  const jobName = booking.task?.name ?? booking.service?.name;
  const when = booking.is_urgent ? 'As soon as possible' : formatSlot(booking.slot_start, booking.slot_end);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {fresh ? (
          <View style={styles.success}>
            <View style={styles.successIcon}>
              <Feather name="check" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Booking requested</Text>
            <Text style={styles.successBody}>
              {jobName} · {when}
            </Text>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Pressable style={styles.iconButton} onPress={toBookings} accessibilityLabel="Back">
              <Feather name="arrow-left" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Pay advance</Text>
          </View>
        )}

        {advance.state === 'paid' ? (
          <StatusBox
            icon="check-circle"
            tone="good"
            title="Advance received"
            body="Your booking is confirmed. We’re finding your professional now."
          />
        ) : booking.status !== 'requested' ? (
          <StatusBox icon="info" tone="neutral" title="No advance needed" body="This booking no longer needs an advance." />
        ) : (
          <>
            {advance.state === 'checking' || sent ? (
              <StatusBox
                icon="clock"
                tone="waiting"
                title="We’re checking your payment"
                body={`Reference ${advance.reference ?? reference.trim()}. Usually within 30 minutes. You can correct it below if needed.`}
              />
            ) : (
              <Text style={styles.lead}>
                Pay the advance to confirm your booking. It counts towards your bill and is refunded if you cancel in time.
              </Text>
            )}

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Advance to pay</Text>
              <Text style={styles.amount}>{formatRupees(booking.deposit_amount)}</Text>
            </View>

            <Text style={styles.label}>Pay with</Text>
            <View style={styles.methods}>
              {METHODS.map((item) => {
                const active = method === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.method, active && styles.methodActive]}
                    onPress={() => setMethod(item.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.methodText, active && styles.methodTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.steps}>
              <Step n={1} text={`Open ${payTo.label} and send ${formatRupees(booking.deposit_amount)} to:`} />
              <View style={styles.account}>
                <Text style={styles.accountText}>{account ?? `[${payTo.label} account]`}</Text>
                {!account ? <Text style={styles.accountNote}>Payment details are not available yet. Please contact the team before sending money.</Text> : null}
              </View>
              <Step n={2} text="Copy the transaction ID from the payment receipt." />
              <Step n={3} text="Paste it below and tap Send." />
            </View>

            <TextInput
              value={reference}
              onChangeText={(text) => {
                setReference(text);
                if (error) setError(null);
              }}
              placeholder="Transaction ID"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={64}
              style={styles.input}
              accessibilityLabel="Transaction ID"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primary, (reference.trim().length < 4 || busy) && styles.dimmed]}
              disabled={reference.trim().length < 4 || busy}
              onPress={submit}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Send payment details</Text>}
            </Pressable>
          </>
        )}

        <Pressable style={styles.secondary} onPress={toBookings} accessibilityRole="button">
          <Text style={styles.link}>
            {advance.state === 'unpaid' && !sent && booking.status === 'requested' ? 'Pay later from Bookings' : 'View my bookings'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ n, text }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const TONES = {
  good: { background: colors.sage, color: colors.primary },
  waiting: { background: '#FDF0DC', color: '#8A5A12' },
  neutral: { background: colors.sageLight, color: colors.textSecondary },
};

function StatusBox({ icon, tone, title, body }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.statusBox, { backgroundColor: palette.background }]}>
      <Feather name={icon} size={20} color={palette.color} />
      <View style={styles.flex}>
        <Text style={[styles.statusTitle, { color: palette.color }]}>{title}</Text>
        <Text style={styles.statusBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.gutter, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -10 },
  iconButton: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, textAlign: 'center' },
  success: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  successTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  successBody: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  lead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  statusBox: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.box },
  statusTitle: { fontFamily: fonts.bold, fontSize: 15 },
  statusBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 2 },
  amountBox: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: radius.box,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  amount: { fontFamily: fonts.bold, fontSize: 34, color: colors.primary, marginTop: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  methods: { flexDirection: 'row', gap: 8 },
  method: {
    flex: 1,
    minHeight: MIN_TAP,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.sage },
  methodText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  methodTextActive: { color: colors.primary },
  steps: {
    gap: 10,
    padding: 14,
    borderRadius: radius.box,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
  },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  account: {
    marginLeft: 32,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.sageLight,
  },
  accountText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  accountNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.terracotta, marginTop: 2 },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
    fontFamily: fonts.semibold,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.text,
  },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.terracotta },
  primary: {
    minHeight: 52,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
  dimmed: { opacity: 0.45 },
  secondary: { minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
});
