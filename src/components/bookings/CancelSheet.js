import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, spacing } from '../../theme';

const REASONS = ['Changed my mind', 'Wrong time', 'Found someone else', 'Other'];

// What cancelling costs depends on how far the job has gone (design pack,
// section 8). The fee amounts are still to be decided, so this only explains
// the rule; the team settles any refund.
function feeMessage(booking) {
  const name = booking.professional?.full_name;
  if (booking.status === 'on_the_way') {
    return `${name ?? 'Your professional'} is already on the way. The team will review any travel fee and the remaining refund with you.`;
  }
  if (booking.status === 'assigned') {
    return `${name ?? 'A professional'} has been booked for you. A late-cancellation fee may apply. The team will confirm any deduction and arrange your refund.`;
  }
  return 'No professional has been assigned yet. Cancellation is free; if you paid an advance, the team will arrange the refund. Cancelling does not transfer money automatically.';
}

// Rendered with key={booking.id}, so the reason and error start fresh for
// each booking.
export default function CancelSheet({ booking, onClose, onConfirm }) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await onConfirm(booking.id, reason);
    setBusy(false);
    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <Modal visible={Boolean(booking)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      {booking ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Cancel booking?</Text>
          <Text style={styles.body}>{feeMessage(booking)}</Text>

          <Text style={styles.label}>Why are you cancelling?</Text>
          <View style={styles.chips}>
            {REASONS.map((item) => {
              const active = reason === item;
              return (
                <Pressable
                  key={item}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setReason(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {active ? <Feather name="check" size={14} color={colors.primary} /> : null}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.keep} onPress={onClose} disabled={busy} accessibilityRole="button">
            <Text style={styles.keepText}>Keep booking</Text>
          </Pressable>
          <Pressable
            style={[styles.cancel, busy && styles.dimmed]}
            onPress={confirm}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color={colors.terracotta} /> : <Text style={styles.cancelText}>Cancel booking</Text>}
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,43,36,0.4)' },
  sheet: {
    backgroundColor: colors.page,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.gutter + 4,
    paddingTop: 10,
    gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.box,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.sage },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.primary },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.terracotta },
  keep: {
    minHeight: 52,
    borderRadius: radius.box,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  keepText: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
  cancel: {
    minHeight: 52,
    borderRadius: radius.box,
    borderWidth: 1,
    borderColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.terracotta },
  dimmed: { opacity: 0.6 },
});
